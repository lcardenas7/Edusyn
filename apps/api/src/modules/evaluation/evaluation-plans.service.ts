import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertEvaluationPlanDto } from './dto/upsert-evaluation-plan.dto';
import { PartialGradesService } from './partial-grades.service';
import { EvaluationComponentsService } from './evaluation-components.service';

@Injectable()
export class EvaluationPlansService {
  private readonly logger = new Logger(EvaluationPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly partialGrades: PartialGradesService,
    private readonly components: EvaluationComponentsService,
  ) {}

  /**
   * Valida que el período NO esté FINALIZED.
   * Lanza ForbiddenException si está congelado.
   */
  private async guardTermNotFinalized(academicTermId: string): Promise<void> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    if (term?.status === 'FINALIZED') {
      throw new ForbiddenException(
        'El período está finalizado. Debe reabrirse formalmente para modificar el plan de evaluación.',
      );
    }
  }

  async upsert(dto: UpsertEvaluationPlanDto) {
    const total = dto.components.reduce((sum, c) => sum + c.percentage, 0);
    if (total !== 100) {
      throw new BadRequestException(
        'La suma de porcentajes de los componentes debe ser 100',
      );
    }

    await this.guardTermNotFinalized(dto.academicTermId);

    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.evaluationPlan.upsert({
        where: {
          teacherAssignmentId_academicTermId: {
            teacherAssignmentId: dto.teacherAssignmentId,
            academicTermId: dto.academicTermId,
          },
        },
        update: {},
        create: {
          teacherAssignmentId: dto.teacherAssignmentId,
          academicTermId: dto.academicTermId,
        },
      });

      await tx.evaluationPlanComponentWeight.deleteMany({
        where: { evaluationPlanId: plan.id },
      });

      await tx.evaluationPlanComponentWeight.createMany({
        data: dto.components.map((c) => ({
          evaluationPlanId: plan.id,
          componentId: c.componentId,
          percentage: c.percentage,
        })),
      });
    });

    // M-2: cambiar los pesos NO debe dejar notas finales calculadas con el peso viejo.
    // Recalcular a todos los estudiantes que ya tienen parciales bajo esta asignación+
    // período (recomputePeriodFinalGrade respeta C-1: si una final fue fijada manualmente,
    // no la toca). Fuera de la transacción de arriba: cada estudiante se recalcula de forma
    // independiente y autocontenida; si uno falla, no debe bloquear a los demás.
    const affected = await this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId: dto.teacherAssignmentId,
        academicTermId: dto.academicTermId,
      },
      select: { studentEnrollmentId: true },
      distinct: ['studentEnrollmentId'],
    });

    for (const { studentEnrollmentId } of affected) {
      try {
        await this.partialGrades.recomputePeriodFinalGrade({
          studentEnrollmentId,
          teacherAssignmentId: dto.teacherAssignmentId,
          academicTermId: dto.academicTermId,
        });
      } catch (err: any) {
        this.logger.error(`No se pudo recalcular la nota final tras cambio de pesos (enrollment ${studentEnrollmentId}): ${err?.message || err}`);
      }
    }

    return this.get({
      teacherAssignmentId: dto.teacherAssignmentId,
      academicTermId: dto.academicTermId,
    });
  }

  async get(params: { teacherAssignmentId: string; academicTermId: string }) {
    return this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId: params.teacherAssignmentId,
          academicTermId: params.academicTermId,
        },
      },
      include: {
        components: true,
      },
    });
  }

  /**
   * FASE 2 — Materializa el plan de una asignación HEREDANDO los pesos que la
   * institución definió en su estructura de evaluación.
   *
   * Nunca pisa lo existente: si el plan ya tiene componentes (porque un docente o
   * coordinador los ajustó), se devuelve tal cual. Solo siembra cuando está vacío.
   */
  async ensurePlan(params: { teacherAssignmentId: string; academicTermId: string }) {
    const existing = await this.get(params);
    if (existing && existing.components.length > 0) return existing;

    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: params.teacherAssignmentId },
      select: { institutionId: true },
    });
    if (!assignment) return existing;

    const defaults = await this.components.getDefaultWeights(assignment.institutionId);
    if (defaults.length === 0) return existing;

    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.evaluationPlan.upsert({
        where: {
          teacherAssignmentId_academicTermId: {
            teacherAssignmentId: params.teacherAssignmentId,
            academicTermId: params.academicTermId,
          },
        },
        update: {},
        create: {
          teacherAssignmentId: params.teacherAssignmentId,
          academicTermId: params.academicTermId,
        },
      });

      // createMany + skipDuplicates: un create sobre una clave única dentro de una
      // transacción deja la conexión envenenada si choca.
      await tx.evaluationPlanComponentWeight.createMany({
        data: defaults.map((d) => ({
          evaluationPlanId: plan.id,
          componentId: d.componentId,
          percentage: d.percentage,
        })),
        skipDuplicates: true,
      });
    });

    this.logger.log(
      `Plan de evaluación sembrado desde la estructura institucional (asignación ${params.teacherAssignmentId}).`,
    );
    return this.get(params);
  }
}
