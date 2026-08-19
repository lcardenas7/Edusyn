import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveComponentScope, scopeReasonLabel } from './final-component-scope.util';

@Injectable()
export class FinalComponentGradesService {
  constructor(private prisma: PrismaService) {}

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

  async upsert(data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }) {
    await this.assertComponentApplies(data);
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.finalComponentGrade.upsert({
      where: {
        studentEnrollmentId_teacherAssignmentId_finalComponentId: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          finalComponentId: data.finalComponentId,
        },
      },
      update: { grade: data.grade },
      create: { ...data, institutionId: enr!.institutionId },
    });
  }

  async bulkUpsert(grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }>) {
    // Una sola comprobación de alcance por combinación (asignación, componente):
    // en un bulk todas las filas comparten la misma coordenada.
    const combos = new Map<string, { teacherAssignmentId: string; finalComponentId: string }>();
    for (const g of grades) combos.set(`${g.teacherAssignmentId}|${g.finalComponentId}`, g);
    for (const c of combos.values()) await this.assertComponentApplies(c);

    const results: any[] = [];
    for (const g of grades) {
      if (g.grade > 0) {
        const result = await this.prisma.finalComponentGrade.upsert({
          where: {
            studentEnrollmentId_teacherAssignmentId_finalComponentId: {
              studentEnrollmentId: g.studentEnrollmentId,
              teacherAssignmentId: g.teacherAssignmentId,
              finalComponentId: g.finalComponentId,
            },
          },
          update: { grade: g.grade },
          create: { ...g, institutionId: (await this.prisma.studentEnrollment.findUnique({ where: { id: g.studentEnrollmentId }, select: { institutionId: true } }))!.institutionId },
        });
        results.push(result);
      } else {
        // Score 0 means delete (same pattern as PartialGrade)
        await this.prisma.finalComponentGrade.deleteMany({
          where: {
            studentEnrollmentId: g.studentEnrollmentId,
            teacherAssignmentId: g.teacherAssignmentId,
            finalComponentId: g.finalComponentId,
          },
        });
      }
    }
    return results;
  }

  async remove(id: string) {
    return this.prisma.finalComponentGrade.delete({ where: { id } });
  }
}
