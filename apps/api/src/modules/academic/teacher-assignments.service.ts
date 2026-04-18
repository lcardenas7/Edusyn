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
        // Filtrar por institución directamente (campo propio de TeacherAssignment)
        ...(params.institutionId && { institutionId: params.institutionId }),
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

  /**
   * Transferir TODA la carga activa de un docente a otro.
   * Útil cuando un docente se va y llega su reemplazo.
   * 
   * @param fromTeacherId - Docente saliente
   * @param toTeacherId - Docente de reemplazo
   * @param institutionId - Institución
   * @param academicYearId - Año académico (opcional, si no se especifica usa el activo)
   * @param reason - Razón del cambio
   * @param assignmentIds - IDs específicos a transferir (opcional, si no se especifica transfiere todas)
   */
  async transferFullLoad(params: {
    fromTeacherId: string;
    toTeacherId: string;
    institutionId: string;
    academicYearId?: string;
    reason: string;
    assignmentIds?: string[];
    effectiveDate?: Date;
  }) {
    const { fromTeacherId, toTeacherId, institutionId, reason, assignmentIds, effectiveDate } = params;

    // Validar que ambos docentes existan
    const [fromTeacher, toTeacher] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: fromTeacherId }, select: { id: true, firstName: true, lastName: true } }),
      this.prisma.user.findUnique({ where: { id: toTeacherId }, select: { id: true, firstName: true, lastName: true } }),
    ]);

    if (!fromTeacher) throw new NotFoundException('Docente saliente no encontrado');
    if (!toTeacher) throw new NotFoundException('Docente de reemplazo no encontrado');
    if (fromTeacherId === toTeacherId) throw new BadRequestException('El docente saliente y el reemplazo no pueden ser el mismo');

    // Determinar año académico
    let yearId = params.academicYearId;
    if (!yearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { institutionId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!activeYear) throw new BadRequestException('No hay año académico activo');
      yearId = activeYear.id;
    }

    // Obtener asignaciones activas del docente saliente
    const whereClause: any = {
      teacherId: fromTeacherId,
      academicYearId: yearId,
      endDate: null,
    };

    if (assignmentIds && assignmentIds.length > 0) {
      whereClause.id = { in: assignmentIds };
    }

    const activeAssignments = await this.prisma.teacherAssignment.findMany({
      where: whereClause,
      include: this.assignmentIncludes,
    });

    if (activeAssignments.length === 0) {
      throw new BadRequestException('El docente no tiene asignaciones activas para transferir');
    }

    const transferDate = effectiveDate || new Date();

    // Transacción: cerrar todas las asignaciones y crear nuevas
    const result = await this.prisma.$transaction(async (tx) => {
      const closedAssignments: any[] = [];
      const newAssignments: any[] = [];

      for (const assignment of activeAssignments) {
        // 1. Cerrar la asignación actual
        const closed = await tx.teacherAssignment.update({
          where: { id: assignment.id },
          data: {
            endDate: transferDate,
            endReason: reason,
          },
        });
        closedAssignments.push(closed);

        // 2. Crear nueva asignación para el docente reemplazo
        const newAssignment = await tx.teacherAssignment.create({
          data: {
            institutionId: assignment.institutionId,
            academicYearId: assignment.academicYearId,
            groupId: assignment.groupId,
            subjectId: assignment.subjectId,
            teacherId: toTeacherId,
            weeklyHours: assignment.weeklyHours,
            startDate: transferDate,
          },
          include: this.assignmentIncludes,
        });
        newAssignments.push(newAssignment);

        // 3. Transferir entradas de horario a la nueva asignación
        await tx.scheduleEntry.updateMany({
          where: { teacherAssignmentId: assignment.id },
          data: { teacherAssignmentId: newAssignment.id },
        });
      }

      return { closedAssignments, newAssignments };
    });

    return {
      success: true,
      fromTeacher: `${fromTeacher.firstName} ${fromTeacher.lastName}`,
      toTeacher: `${toTeacher.firstName} ${toTeacher.lastName}`,
      transferredCount: result.newAssignments.length,
      effectiveDate: transferDate,
      reason,
      assignments: result.newAssignments,
    };
  }

  /**
   * Obtener resumen de carga de un docente (para preview antes de transferir)
   */
  async getTeacherLoadSummary(teacherId: string, institutionId: string, academicYearId?: string) {
    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { institutionId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!activeYear) return { assignments: [], totalHours: 0 };
      yearId = activeYear.id;
    }

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        teacherId,
        academicYearId: yearId,
        endDate: null,
      },
      include: this.assignmentIncludes,
      orderBy: [{ group: { name: 'asc' } }, { subject: { name: 'asc' } }],
    });

    const totalHours = assignments.reduce((sum, a) => sum + a.weeklyHours, 0);

    return {
      assignments,
      totalHours,
      summary: assignments.map(a => ({
        id: a.id,
        group: `${a.group.grade.name} - ${a.group.name}`,
        subject: a.subject.name,
        area: a.subject.area?.name || 'Sin área',
        weeklyHours: a.weeklyHours,
      })),
    };
  }

  /**
   * Eliminar una asignación individual.
   * Solo permite eliminar si no tiene datos asociados (notas, asistencia, etc.).
   */
  async delete(assignmentId: string, institutionId: string) {
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { id: assignmentId, institutionId },
    });

    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada');
    }

    // Verificar si tiene datos asociados que impidan el borrado
    const [partialGrades, scheduleEntries] = await Promise.all([
      this.prisma.partialGrade.count({ where: { teacherAssignmentId: assignmentId } }),
      this.prisma.scheduleEntry.count({ where: { teacherAssignmentId: assignmentId } }),
    ]);

    if (partialGrades > 0) {
      throw new BadRequestException(
        `No se puede eliminar: la asignación tiene ${partialGrades} nota(s) registrada(s). Use "Finalizar" en su lugar.`
      );
    }

    // Si tiene horario, eliminarlo también
    if (scheduleEntries > 0) {
      await this.prisma.scheduleEntry.deleteMany({ where: { teacherAssignmentId: assignmentId } });
    }

    await this.prisma.teacherAssignment.delete({ where: { id: assignmentId } });

    return { success: true, message: 'Asignación eliminada correctamente' };
  }

  /**
   * TEMPORAL: Eliminar toda la carga académica de la institución
   */
  async deleteAll(institutionId: string, academicYearId?: string) {
    // Obtener IDs de años académicos de la institución
    const whereYear = academicYearId 
      ? { id: academicYearId, institutionId }
      : { institutionId };
    
    const years = await this.prisma.academicYear.findMany({
      where: whereYear,
      select: { id: true },
    });
    
    const yearIds = years.map(y => y.id);
    
    if (yearIds.length === 0) {
      return { deleted: 0, message: 'No se encontraron años académicos' };
    }
    
    const result = await this.prisma.teacherAssignment.deleteMany({
      where: { academicYearId: { in: yearIds } },
    });
    
    return { 
      deleted: result.count, 
      message: `Se eliminaron ${result.count} asignaciones de carga académica` 
    };
  }
}
