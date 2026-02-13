import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PeriodFinalGradesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsert(data: {
    studentEnrollmentId: string;
    academicTermId: string;
    subjectId: string;
    finalScore: number;
    observations?: string;
    enteredById: string;
  }) {
    await this.guardTermNotFinalized(data.academicTermId);
    return this.prisma.periodFinalGrade.upsert({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId: data.studentEnrollmentId,
          academicTermId: data.academicTermId,
          subjectId: data.subjectId,
        },
      },
      update: {
        finalScore: data.finalScore,
        observations: data.observations,
        enteredById: data.enteredById,
      },
      create: { ...data, institutionId: (await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId }, select: { institutionId: true } }))!.institutionId },
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
          },
        },
        subject: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
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

  async delete(id: string) {
    const grade = await this.prisma.periodFinalGrade.findUnique({
      where: { id },
      select: { academicTermId: true },
    });
    if (grade) {
      await this.guardTermNotFinalized(grade.academicTermId);
    }
    return this.prisma.periodFinalGrade.delete({ where: { id } });
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
  ) {
    const results: any[] = [];
    for (const grade of grades) {
      const result = await this.upsert({
        ...grade,
        enteredById,
      });
      results.push(result);
    }
    return results;
  }
}
