import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly assignmentIncludes = {
    teacher: true,
    subject: { include: { area: true } },
    group: { include: { grade: true } },
    academicYear: true,
  };

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

    // Verificar si ya existe una asignación ACTIVA para esta materia+grupo
    const existingActive = await this.prisma.teacherAssignment.findFirst({
      where: {
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        subjectId: dto.subjectId,
        endDate: null,
      },
    });

    if (existingActive) {
      if (existingActive.teacherId === dto.teacherId) {
        throw new BadRequestException('Ya existe una asignación activa para este docente, grupo y asignatura');
      }
      throw new BadRequestException(
        'Ya existe una asignación activa para esta materia y grupo. Use "Finalizar y reemplazar" para cambiar el docente.',
      );
    }

    const year = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId }, select: { institutionId: true } });
    return this.prisma.teacherAssignment.create({
      data: {
        institutionId: year!.institutionId,
        academicYearId: dto.academicYearId,
        groupId: dto.groupId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        weeklyHours: dto.weeklyHours ?? 0,
        startDate: new Date(),
      },
      include: this.assignmentIncludes,
    });
  }

  /**
   * Finalizar una asignación y crear una nueva para el docente reemplazo.
   * La asignación original queda histórica con endDate + endReason.
   * Los datos (notas, asistencia, etc.) quedan vinculados a la asignación original.
   */
  async replaceTeacher(
    assignmentId: string,
    newTeacherId: string,
    reason: string,
    endDate?: Date,
  ) {
    const existing = await this.prisma.teacherAssignment.findUnique({
      where: { id: assignmentId },
      include: this.assignmentIncludes,
    });

    if (!existing) throw new NotFoundException('Asignación no encontrada');
    if (existing.endDate) throw new BadRequestException('Esta asignación ya fue finalizada');

    const newTeacher = await this.prisma.user.findUnique({ where: { id: newTeacherId } });
    if (!newTeacher) throw new BadRequestException('Docente reemplazo no encontrado');

    const effectiveEndDate = endDate || new Date();

    // Transacción: cerrar asignación actual + crear nueva
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cerrar la asignación actual
      const closed = await tx.teacherAssignment.update({
        where: { id: assignmentId },
        data: {
          endDate: effectiveEndDate,
          endReason: reason,
        },
        include: this.assignmentIncludes,
      });

      // 2. Crear nueva asignación para el docente reemplazo
      const newAssignment = await tx.teacherAssignment.create({
        data: {
          institutionId: existing.academicYear.institutionId,
          academicYearId: existing.academicYearId,
          groupId: existing.groupId,
          subjectId: existing.subjectId,
          teacherId: newTeacherId,
          weeklyHours: existing.weeklyHours,
          startDate: effectiveEndDate,
        },
        include: this.assignmentIncludes,
      });

      // 3. Transferir entradas de horario activas a la nueva asignación
      await tx.scheduleEntry.updateMany({
        where: { teacherAssignmentId: assignmentId },
        data: { teacherAssignmentId: newAssignment.id },
      });

      return { closedAssignment: closed, newAssignment };
    });

    return result;
  }

  /**
   * Finalizar una asignación sin reemplazo (docente sale, materia queda sin asignar).
   */
  async endAssignment(assignmentId: string, reason: string, endDate?: Date) {
    const existing = await this.prisma.teacherAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!existing) throw new NotFoundException('Asignación no encontrada');
    if (existing.endDate) throw new BadRequestException('Esta asignación ya fue finalizada');

    return this.prisma.teacherAssignment.update({
      where: { id: assignmentId },
      data: {
        endDate: endDate || new Date(),
        endReason: reason,
      },
      include: this.assignmentIncludes,
    });
  }

  async list(params: {
    academicYearId?: string;
    groupId?: string;
    teacherId?: string;
    institutionId?: string;
    activeOnly?: boolean;
  }) {
    return this.prisma.teacherAssignment.findMany({
      where: {
        academicYearId: params.academicYearId,
        groupId: params.groupId,
        teacherId: params.teacherId,
        // Por defecto solo asignaciones activas
        ...(params.activeOnly !== false && { endDate: null }),
        // Filtrar por institución a través del grupo → campus
        ...(params.institutionId && {
          group: {
            campus: {
              institutionId: params.institutionId,
            },
          },
        }),
      },
      include: this.assignmentIncludes,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Historial de asignaciones para una materia+grupo (incluye finalizadas).
   */
  async getHistory(academicYearId: string, groupId: string, subjectId: string) {
    return this.prisma.teacherAssignment.findMany({
      where: { academicYearId, groupId, subjectId },
      include: this.assignmentIncludes,
      orderBy: { startDate: 'asc' },
    });
  }
}
