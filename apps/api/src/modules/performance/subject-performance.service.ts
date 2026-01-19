import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PerformanceDimension } from '@prisma/client';

@Injectable()
export class SubjectPerformanceService {
  constructor(private prisma: PrismaService) {}

  async getByTeacherAssignment(teacherAssignmentId: string, academicTermId: string) {
    return this.prisma.subjectPerformance.findMany({
      where: {
        teacherAssignmentId,
        academicTermId,
      },
      orderBy: { dimension: 'asc' },
    });
  }

  async getByTeacherAssignmentAndDimension(
    teacherAssignmentId: string,
    academicTermId: string,
    dimension: PerformanceDimension,
  ) {
    return this.prisma.subjectPerformance.findUnique({
      where: {
        teacherAssignmentId_academicTermId_dimension: {
          teacherAssignmentId,
          academicTermId,
          dimension,
        },
      },
    });
  }

  async upsert(data: {
    teacherAssignmentId: string;
    academicTermId: string;
    dimension: PerformanceDimension;
    baseDescription: string;
  }) {
    return this.prisma.subjectPerformance.upsert({
      where: {
        teacherAssignmentId_academicTermId_dimension: {
          teacherAssignmentId: data.teacherAssignmentId,
          academicTermId: data.academicTermId,
          dimension: data.dimension,
        },
      },
      update: {
        baseDescription: data.baseDescription,
      },
      create: {
        teacherAssignmentId: data.teacherAssignmentId,
        academicTermId: data.academicTermId,
        dimension: data.dimension,
        baseDescription: data.baseDescription,
      },
    });
  }

  async bulkUpsert(
    teacherAssignmentId: string,
    academicTermId: string,
    performances: Array<{
      dimension: PerformanceDimension;
      baseDescription: string;
    }>,
  ) {
    const results = await Promise.all(
      performances.map((p) =>
        this.upsert({
          teacherAssignmentId,
          academicTermId,
          ...p,
        }),
      ),
    );
    return results;
  }

  async getByGroup(groupId: string, academicTermId: string) {
    return this.prisma.subjectPerformance.findMany({
      where: {
        academicTermId,
        teacherAssignment: {
          groupId,
        },
      },
      include: {
        teacherAssignment: {
          include: {
            subject: {
              include: { area: true },
            },
            teacher: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: [
        { teacherAssignment: { subject: { area: { order: 'asc' } } } },
        { teacherAssignment: { subject: { order: 'asc' } } },
        { dimension: 'asc' },
      ],
    });
  }

  async delete(id: string) {
    return this.prisma.subjectPerformance.delete({
      where: { id },
    });
  }
}
