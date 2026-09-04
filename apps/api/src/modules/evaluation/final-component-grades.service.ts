import { randomUUID } from 'crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveComponentScope, scopeReasonLabel } from './final-component-scope.util';
import { GradeAuditActor, GradeAuditService } from './grade-audit.service';

/** Origen de auditoría de esta superficie: la nota que consolida el año. */
const AUDIT_SOURCE = 'FINAL_COMPONENT_GRADE';

@Injectable()
export class FinalComponentGradesService {
  constructor(
    private prisma: PrismaService,
    private readonly gradeAudit: GradeAuditService,
  ) {}

  /** Lee el registro previo para poder decir qué había antes del cambio. */
  private findExisting(key: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
  }) {
    return this.prisma.finalComponentGrade.findUnique({
      where: { studentEnrollmentId_teacherAssignmentId_finalComponentId: key },
      select: { id: true, grade: true, institutionId: true },
    });
  }

  async getByComponent(finalComponentId: string, teacherAssignmentId: string) {
    return this.prisma.finalComponentGrade.findMany({
      where: { finalComponentId, teacherAssignmentId },
      include: {
        studentEnrollment: {
          include: {
            student: {
              select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
            },
          },
        },
      },
      orderBy: { studentEnrollment: { student: { lastName: 'asc' } } },
    });
  }

  async getByStudent(studentEnrollmentId: string, academicYearId: string) {
    return this.prisma.finalComponentGrade.findMany({
      where: {
        studentEnrollmentId,
        finalComponent: { academicYearId },
      },
      include: { finalComponent: true },
    });
  }

  /**
   * D-19 · Guarda de alcance para la captura.
   *
   * Sin esto se puede registrar la nota de una fuente que ese grado/asignatura
   * NO presenta: quedaría almacenada, invisible en el cálculo (que la descarta
   * por alcance) y sin efecto en ninguna nota anual. Es exactamente la clase de
   * dato fantasma que F1 vino a erradicar, así que se rechaza en el momento de
   * escribir en vez de dejarlo pudrirse en la base.
   */
  private async assertComponentApplies(data: {
    teacherAssignmentId: string;
    finalComponentId: string;
  }) {
    const [component, assignment] = await Promise.all([
      this.prisma.finalComponent.findUnique({
        where: { id: data.finalComponentId },
        select: { id: true, name: true, scopeMode: true },
      }),
      this.prisma.teacherAssignment.findUnique({
        where: { id: data.teacherAssignmentId },
        select: { subjectId: true, group: { select: { gradeId: true } } },
      }),
    ]);
    if (!component) throw new NotFoundException('Componente final no encontrado');

    const gradeId = assignment?.group?.gradeId ?? null;
    // Fail-open: sin grado conocido no se bloquea la captura.
    if (!gradeId) return;

    const rules = await this.prisma.finalComponentScope.findMany({
      where: { finalComponentId: component.id, gradeId },
      select: { finalComponentId: true, gradeId: true, subjectId: true, applies: true },
    });

    const decision = resolveComponentScope(
      { id: component.id, scopeMode: component.scopeMode },
      gradeId,
      assignment?.subjectId ?? null,
      rules,
    );
    if (!decision.applies) {
      throw new ConflictException(
        `No se puede registrar la nota de «${component.name}»: ` +
        (scopeReasonLabel(decision) ?? 'esta evaluación no aplica a esta población.') +
        ' Si debe presentarla, ajuste primero el alcance de la evaluación.',
      );
    }
  }

  async upsert(
    data: {
      studentEnrollmentId: string;
      teacherAssignmentId: string;
      finalComponentId: string;
      grade: number;
    },
    actor?: GradeAuditActor,
  ) {
    await this.assertComponentApplies(data);
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } });
    const key = {
      studentEnrollmentId: data.studentEnrollmentId,
      teacherAssignmentId: data.teacherAssignmentId,
      finalComponentId: data.finalComponentId,
    };
    // La lectura previa es la que da contenido forense: `upsert` crea o
    // actualiza indistintamente y descarta el valor anterior.
    const prev = await this.findExisting(key);

    const result = await this.prisma.finalComponentGrade.upsert({
      where: { studentEnrollmentId_teacherAssignmentId_finalComponentId: key },
      update: { grade: data.grade },
      create: { ...data, institutionId: enr!.institutionId },
    });

    await this.auditChange(prev, result, data.grade, enr!.institutionId, key, actor);
    return result;
  }

  /**
   * Emite el evento que corresponda al cambio.
   *
   * Guardar sin modificar nada NO produce evento: sin esa condición, cada
   * pulsación de guardar enterraría los cambios reales bajo ruido.
   */
  private async auditChange(
    prev: { id: string; grade: any } | null,
    result: { id: string },
    newGrade: number,
    institutionId: string,
    key: { studentEnrollmentId: string; teacherAssignmentId: string; finalComponentId: string },
    actor?: GradeAuditActor,
    batchId?: string,
  ) {
    const previousScore = prev ? Number(prev.grade) : null;
    if (prev && previousScore === newGrade) return;
    await this.gradeAudit.record(
      {
        institutionId,
        source: AUDIT_SOURCE,
        action: prev ? 'UPDATE' : 'CREATE',
        recordId: result.id,
        studentEnrollmentId: key.studentEnrollmentId,
        teacherAssignmentId: key.teacherAssignmentId,
        finalComponentId: key.finalComponentId,
        previousScore,
        newScore: newGrade,
        batchId: batchId ?? null,
      },
      actor,
    );
  }

  async bulkUpsert(
    grades: Array<{
      studentEnrollmentId: string;
      teacherAssignmentId: string;
      finalComponentId: string;
      grade: number;
    }>,
    actor?: GradeAuditActor,
  ) {
    // Una sola comprobación de alcance por combinación (asignación, componente):
    // en un bulk todas las filas comparten la misma coordenada.
    const combos = new Map<string, { teacherAssignmentId: string; finalComponentId: string }>();
    for (const g of grades) combos.set(`${g.teacherAssignmentId}|${g.finalComponentId}`, g);
    for (const c of combos.values()) await this.assertComponentApplies(c);

    // Una escritura masiva ocurrió como una sola acción y debe poder leerse así,
    // sin perder el detalle por estudiante.
    const batchId = randomUUID();

    const results: any[] = [];
    for (const g of grades) {
      const key = {
        studentEnrollmentId: g.studentEnrollmentId,
        teacherAssignmentId: g.teacherAssignmentId,
        finalComponentId: g.finalComponentId,
      };
      const prev = await this.findExisting(key);

      if (g.grade > 0) {
        const institutionId =
          prev?.institutionId ??
          (await this.prisma.studentEnrollment.findUnique({
            where: { id: g.studentEnrollmentId },
            select: { institutionId: true },
          }))!.institutionId;
        const result = await this.prisma.finalComponentGrade.upsert({
          where: { studentEnrollmentId_teacherAssignmentId_finalComponentId: key },
          update: { grade: g.grade },
          create: { ...g, institutionId },
        });
        results.push(result);
        await this.auditChange(prev, result, g.grade, institutionId, key, actor, batchId);
      } else {
        // Score 0 means delete (same pattern as PartialGrade)
        await this.prisma.finalComponentGrade.deleteMany({ where: key });
        // Solo se audita si de verdad había algo que borrar.
        if (prev) {
          await this.gradeAudit.record(
            {
              institutionId: prev.institutionId,
              source: AUDIT_SOURCE,
              action: 'DELETE',
              recordId: prev.id,
              studentEnrollmentId: g.studentEnrollmentId,
              teacherAssignmentId: g.teacherAssignmentId,
              finalComponentId: g.finalComponentId,
              previousScore: Number(prev.grade),
              newScore: null,
              batchId,
            },
            actor,
          );
        }
      }
    }
    return results;
  }

  async remove(id: string, actor?: GradeAuditActor) {
    const prev = await this.prisma.finalComponentGrade.findUnique({
      where: { id },
      select: {
        id: true,
        grade: true,
        institutionId: true,
        studentEnrollmentId: true,
        teacherAssignmentId: true,
        finalComponentId: true,
      },
    });

    const result = await this.prisma.finalComponentGrade.delete({ where: { id } });

    if (prev) {
      await this.gradeAudit.record(
        {
          institutionId: prev.institutionId,
          source: AUDIT_SOURCE,
          action: 'DELETE',
          recordId: prev.id,
          studentEnrollmentId: prev.studentEnrollmentId,
          teacherAssignmentId: prev.teacherAssignmentId,
          finalComponentId: prev.finalComponentId,
          previousScore: Number(prev.grade),
          newScore: null,
        },
        actor,
      );
    }
    return result;
  }
}
