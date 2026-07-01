import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { TemplatesService } from './templates.service';

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: TemplatesService,
  ) {}

  private readonly assignmentIncludes = {
    teacher: true,
    subject: { include: { area: true } },
    group: { include: { grade: true } },
    academicYear: true,
  };

  private async getOrCreateConvivenciaSubject(institutionId: string): Promise<{ id: string; name: string; code: string | null }> {
    let area = await this.prisma.area.findFirst({
      where: {
        institutionId,
        OR: [
          { name: { contains: 'Convivencia', mode: 'insensitive' } },
          { name: { contains: 'Formación', mode: 'insensitive' } },
          { name: { contains: 'Ética', mode: 'insensitive' } },
        ],
      },
    });

    if (!area) {
      area = await this.prisma.area.create({
        data: {
          institutionId,
          name: 'Formación y Convivencia',
          code: 'CONV',
          description: 'Área de formación integral y convivencia escolar',
          order: 99,
        },
      });
    }

    let subject = await this.prisma.subject.findFirst({
      where: {
        areaId: area.id,
        name: { contains: 'Convivencia', mode: 'insensitive' },
      },
    });

    if (!subject) {
      subject = await this.prisma.subject.create({
        data: {
          areaId: area.id,
          name: 'Convivencia',
          code: 'CONV',
          description: 'Evaluación de convivencia escolar',
          subjectType: 'MANDATORY',
          order: 1,
        },
      });
    }

    return { id: subject.id, name: subject.name, code: subject.code };
  }

  async activateConvivenciaForGrade(params: {
    institutionId: string;
    academicYearId: string;
    gradeId: string;
    useTutor: boolean;
    countInAverage: boolean;
    teacherId?: string;
  }) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: params.gradeId },
      select: { id: true, name: true, stage: true, institutionId: true },
    });

    if (!grade) throw new BadRequestException('Grado no encontrado');
    if (grade.institutionId !== params.institutionId) {
      throw new BadRequestException('El grado no pertenece a la institución seleccionada');
    }

    const groups = await this.prisma.group.findMany({
      where: { gradeId: params.gradeId },
      include: {
        director: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
      throw new BadRequestException('No hay grupos para este grado');
    }

    const convivencia = await this.getOrCreateConvivenciaSubject(params.institutionId);

    if (!params.useTutor && !params.teacherId) {
      throw new BadRequestException('Debe seleccionar un docente responsable');
    }

    const skippedGroups: Array<{ groupId: string; groupName: string; reason: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const group of groups) {
        const assignedTeacherId = params.useTutor ? group.directorId : params.teacherId!;

        if (!assignedTeacherId) {
          skippedGroups.push({
            groupId: group.id,
            groupName: group.name,
            reason: params.useTutor ? 'El grupo no tiene tutor asignado' : 'No hay docente seleccionado',
          });
          continue;
        }

        const existing = await tx.teacherAssignment.findFirst({
          where: {
            institutionId: params.institutionId,
            academicYearId: params.academicYearId,
            groupId: group.id,
            subjectId: convivencia.id,
            endDate: null,
          },
          select: { id: true, teacherId: true },
        });

        if (existing) {
          if (existing.teacherId !== assignedTeacherId) {
            await tx.teacherAssignment.update({
              where: { id: existing.id },
              data: { teacherId: assignedTeacherId },
            });
          }
        } else {
          await tx.teacherAssignment.create({
            data: {
              institutionId: params.institutionId,
              academicYearId: params.academicYearId,
              groupId: group.id,
              subjectId: convivencia.id,
              teacherId: assignedTeacherId,
              weeklyHours: 1,
              startDate: new Date(),
            },
          });
        }

        await tx.groupSubjectException.upsert({
          where: {
            groupId_subjectId_academicYearId: {
              groupId: group.id,
              subjectId: convivencia.id,
              academicYearId: params.academicYearId,
            },
          },
          update: {
            type: 'INCLUDE',
            reason: params.useTutor
              ? 'Convivencia activada automáticamente con tutor'
              : 'Convivencia activada por docente específico',
          },
          create: {
            groupId: group.id,
            subjectId: convivencia.id,
            academicYearId: params.academicYearId,
            type: 'INCLUDE',
            reason: params.useTutor
              ? 'Convivencia activada automáticamente con tutor'
              : 'Convivencia activada por docente específico',
          },
        });
      }
    });

    await this.templatesService.syncTemplateFromActiveAssignments(params.gradeId, params.academicYearId, {
      countInAverage: params.countInAverage,
    });

    return {
      success: true,
      subject: convivencia,
      grade: { id: grade.id, name: grade.name, stage: grade.stage },
      totalGroups: groups.length,
      skippedGroups,
      message: params.useTutor
        ? `Convivencia activada para ${grade.name} usando el tutor de cada grupo.`
        : `Convivencia activada para ${grade.name} con el docente seleccionado.`,
    };
  }

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
   * Las notas y la asistencia se transfieren a la nueva asignación para dar
   * continuidad al docente reemplazo (ve la planilla y la asistencia al entrar,
   * no en blanco). La asignación nueva está recién creada → sin conflictos de llave.
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

      // 4. Transferir notas y asistencia para continuidad del docente reemplazo.
      // (La asignación nueva no tiene datos aún → no hay conflictos de llave única.)
      const [movedGrades, movedAttendance] = await Promise.all([
        tx.partialGrade.updateMany({
          where: { teacherAssignmentId: assignmentId },
          data: { teacherAssignmentId: newAssignment.id },
        }),
        tx.attendanceRecord.updateMany({
          where: { teacherAssignmentId: assignmentId },
          data: { teacherAssignmentId: newAssignment.id },
        }),
      ]);

      return {
        closedAssignment: closed,
        newAssignment,
        transferred: { grades: movedGrades.count, attendance: movedAttendance.count },
      };
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

        // 4. Transferir notas y asistencia para continuidad del docente reemplazo.
        // (La asignación nueva no tiene datos aún → sin conflictos de llave única.)
        await Promise.all([
          tx.partialGrade.updateMany({
            where: { teacherAssignmentId: assignment.id },
            data: { teacherAssignmentId: newAssignment.id },
          }),
          tx.attendanceRecord.updateMany({
            where: { teacherAssignmentId: assignment.id },
            data: { teacherAssignmentId: newAssignment.id },
          }),
        ]);
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

    // Verificar si tiene datos asociados que impidan el borrado.
    // C-5: la asignación cascada a PartialGrade Y AttendanceRecord; hay que revisar AMBOS
    // (antes solo se revisaban notas → la asistencia se borraba en silencio).
    const [partialGrades, attendanceRecords, scheduleEntries] = await Promise.all([
      this.prisma.partialGrade.count({ where: { teacherAssignmentId: assignmentId } }),
      this.prisma.attendanceRecord.count({ where: { teacherAssignmentId: assignmentId } }),
      this.prisma.scheduleEntry.count({ where: { teacherAssignmentId: assignmentId } }),
    ]);

    if (partialGrades > 0 || attendanceRecords > 0) {
      throw new BadRequestException(
        `No se puede eliminar: la asignación tiene ${partialGrades} nota(s) y ${attendanceRecords} registro(s) de asistencia. Use "Finalizar" en su lugar para conservar la historia.`
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

    // C-5: borrar carga académica cascada a notas Y asistencia. Nunca destruir historia en masa.
    const [gradeCount, attendanceCount] = await Promise.all([
      this.prisma.partialGrade.count({ where: { teacherAssignment: { academicYearId: { in: yearIds } } } }),
      this.prisma.attendanceRecord.count({ where: { teacherAssignment: { academicYearId: { in: yearIds } } } }),
    ]);
    if (gradeCount > 0 || attendanceCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar la carga académica: existen ${gradeCount} nota(s) y ${attendanceCount} registro(s) de asistencia que se perderían en cascada. Finalice las asignaciones en lugar de eliminarlas.`
      );
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
