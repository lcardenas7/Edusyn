import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeacherAssignmentDto) {
    return this.prisma.teacherAssignment.create({
      data: {
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        weeklyHours: dto.weeklyHours ?? 0,
      },
    });
  }

  async list(params: { academicYearId?: string; groupId?: string; teacherId?: string }) {
    return this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId: params.academicYearId,
        groupId: params.groupId,
        teacherId: params.teacherId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
