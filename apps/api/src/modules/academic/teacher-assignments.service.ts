import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeacherAssignmentDto) {
    // Validar que existan los registros relacionados
    const [academicYear, group, subject, teacher] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } }),
      this.prisma.group.findUnique({ where: { id: dto.groupId } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
      this.prisma.user.findUnique({ where: { id: dto.teacherId } }),
    ]);

    if (!academicYear) throw new BadRequestException(`Año académico no encontrado: ${dto.academicYearId}`);
    if (!group) throw new BadRequestException(`Grupo no encontrado: ${dto.groupId}`);
    if (!subject) throw new BadRequestException(`Asignatura no encontrada: ${dto.subjectId}`);
    if (!teacher) throw new BadRequestException(`Docente no encontrado: ${dto.teacherId}`);

    // Verificar si ya existe la asignación
    const existing = await this.prisma.teacherAssignment.findFirst({
      where: {
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
      },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una asignación para este docente, grupo y asignatura');
    }

    return this.prisma.teacherAssignment.create({
      data: {
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        weeklyHours: dto.weeklyHours ?? 0,
      },
      include: {
        teacher: true,
        subject: { include: { area: true } },
        group: { include: { grade: true } },
        academicYear: true,
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
      include: {
        teacher: true,
        subject: {
          include: {
            area: true,
          },
        },
        group: {
          include: {
            grade: true,
          },
        },
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
