import { randomUUID } from 'crypto';

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeAuditActor, GradeAuditService } from './grade-audit.service';

/** Origen de auditoría de esta superficie: la nota final del período. */
const AUDIT_SOURCE = 'PERIOD_FINAL_GRADE';

@Injectable()
export class PeriodFinalGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeAudit: GradeAuditService,
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
        'El período está finalizado. Debe reabrirse formalmente para modificar notas.',
      );
    }
  }

  async upsert(
    data: {
      studentEnrollmentId: string;
      academicTermId: string;
      subjectId: string;
      finalScore: number;
      observations?: string;
      enteredById: string;
    },
    actor?: GradeAuditActor,
    batchId?: string,
  ) {
    await this.guardTermNotFinalized(data.academicTermId);
    const key = {
      studentEnrollmentId: data.studentEnrollmentId,
      academicTermId: data.academicTermId,
      subjectId: data.subjectId,
    };
    // Lectura previa: `upsert` no distingue alta de modificación y descarta el
    // valor anterior, que es justo lo que da valor forense al rastro.
    const prev = await this.prisma.periodFinalGrade.findUnique({
      where: { studentEnrollmentId_academicTermId_subjectId: key },
      select: { id: true, finalScore: true, institutionId: true },
    });
    const result = await this.prisma.periodFinalGrade.upsert({
      where: { studentEnrollmentId_academicTermId_subjectId: key },
      update: {
        finalScore: data.finalScore,
        observations: data.observations,
        enteredById: data.enteredById,
        isManualOverride: true, // C-1: escritura manual = fijada; el recálculo no la pisa
      },
      create: { ...data, isManualOverride: true, institutionId: (await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } }))!.institutionId },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        academicTerm: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
    });

    const previousScore = prev ? Number(prev.finalScore) : null;
    // Guardar sin cambiar la nota no genera evento.
    if (!prev || previousScore !== data.finalScore) {
      await this.gradeAudit.record(
        {
          institutionId: result.institutionId,
          source: AUDIT_SOURCE,
          action: prev ? 'UPDATE' : 'CREATE',
          recordId: result.id,
          studentEnrollmentId: data.studentEnrollmentId,
          academicTermId: data.academicTermId,
          subjectId: data.subjectId,
          previousScore,
          newScore: data.finalScore,
          batchId: batchId ?? null,
        },
        actor,
      );
    }

    return result;
  }

  async findByGroup(groupId: string, academicTermId: string) {
    return this.prisma.periodFinalGrade.findMany({
      where: {
        academicTermId,
        studentEnrollment: {
          groupId,
        },
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
        { studentEnrollment: { student: { secondLastName: 'asc' } } },
        { studentEnrollment: { student: { firstName: 'asc' } } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  async findByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.periodFinalGrade.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      include: {
        subject: true,
        academicTerm: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async delete(id: string, actor?: GradeAuditActor) {
    const grade = await this.prisma.periodFinalGrade.findUnique({
      where: { id },
      select: {
        academicTermId: true,
        finalScore: true,
        institutionId: true,
        studentEnrollmentId: true,
        subjectId: true,
      },
    });
    if (grade) {
      await this.guardTermNotFinalized(grade.academicTermId);
    }
    const result = await this.prisma.periodFinalGrade.delete({ where: { id } });

    if (grade) {
      await this.gradeAudit.record(
        {
          institutionId: grade.institutionId,
          source: AUDIT_SOURCE,
          action: 'DELETE',
          recordId: id,
          studentEnrollmentId: grade.studentEnrollmentId,
          academicTermId: grade.academicTermId,
          subjectId: grade.subjectId,
          previousScore: Number(grade.finalScore),
          newScore: null,
        },
        actor,
      );
    }
    return result;
  }

  async bulkUpsert(
    grades: Array<{
      studentEnrollmentId: string;
      academicTermId: string;
      subjectId: string;
      finalScore: number;
      observations?: string;
    }>,
    enteredById: string,
    actor?: GradeAuditActor,
  ) {
    // Toda la carga masiva comparte correlación: ocurrió como una sola acción.
    const batchId = randomUUID();
    const results: any[] = [];
    for (const grade of grades) {
      const result = await this.upsert({ ...grade, enteredById }, actor, batchId);
      results.push(result);
    }
    return results;
  }
}
