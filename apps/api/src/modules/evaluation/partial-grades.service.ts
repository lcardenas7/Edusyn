import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartialGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
  }) {
    return this.prisma.partialGrade.upsert({
      where: {
        studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          academicTermId: data.academicTermId,
          componentType: data.componentType,
          activityIndex: data.activityIndex,
        },
      },
      update: {
        activityName: data.activityName,
        activityType: data.activityType,
        score: data.score,
        observations: data.observations,
      },
      create: data,
    });
  }

  async bulkUpsert(grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
  }>) {
    const results: any[] = [];
    for (const grade of grades) {
      // Solo guardar si la nota es mayor a 0
      if (grade.score > 0) {
        const result = await this.upsert(grade);
        results.push(result);
      }
    }
    return results;
  }

  async count() {
    const count = await this.prisma.partialGrade.count();
    return { count };
  }

  async getByAssignment(teacherAssignmentId: string, academicTermId: string) {
    return this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId,
        academicTermId,
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async getByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.partialGrade.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async delete(id: string) {
    return this.prisma.partialGrade.delete({ where: { id } });
  }

  async deleteByActivity(
    teacherAssignmentId: string,
    academicTermId: string,
    componentType: string,
    activityIndex: number,
  ) {
    return this.prisma.partialGrade.deleteMany({
      where: {
        teacherAssignmentId,
        academicTermId,
        componentType,
        activityIndex,
      },
    });
  }
}
