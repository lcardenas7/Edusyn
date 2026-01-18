import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PeriodFinalGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    studentEnrollmentId: string;
    academicTermId: string;
    subjectId: string;
    finalScore: number;
    observations?: string;
    enteredById: string;
  }) {
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
      create: data,
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
