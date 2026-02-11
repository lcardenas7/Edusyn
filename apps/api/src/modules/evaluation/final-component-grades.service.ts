import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  async upsert(data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }) {
    return this.prisma.finalComponentGrade.upsert({
      where: {
        studentEnrollmentId_teacherAssignmentId_finalComponentId: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          finalComponentId: data.finalComponentId,
        },
      },
      update: { grade: data.grade },
      create: data,
    });
  }

  async bulkUpsert(grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }>) {
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
          create: g,
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
