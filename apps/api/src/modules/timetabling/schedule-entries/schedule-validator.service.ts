import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

export interface ScheduleConflict {
  type: 'TEACHER_OVERLAP' | 'ROOM_OVERLAP' | 'GROUP_OVERLAP' | 'TEACHER_UNAVAILABLE';
  severity: 'ERROR' | 'WARNING';
  message: string;
  details: {
    dayOfWeek: DayOfWeek;
    timeBlockId: string;
    conflictingEntryId?: string;
    teacherId?: string;
    teacherName?: string;
    roomId?: string;
    roomName?: string;
    groupId?: string;
    groupName?: string;
  };
}

@Injectable()
export class ScheduleValidatorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Valida una entrada de horario antes de crearla/actualizarla.
   * Detecta conflictos de docente, aula y grupo.
   */
  async validateEntry(
    institutionId: string,
    academicYearId: string,
    entry: {
      groupId: string;
      timeBlockId: string;
      dayOfWeek: DayOfWeek;
      teacherAssignmentId?: string;
      roomId?: string;
    },
    excludeEntryId?: string,
  ): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];

    // 1. Verificar conflicto de grupo (ya cubierto por unique constraint, pero verificar explícitamente)
    const groupConflict = await this.prisma.scheduleEntry.findFirst({
      where: {
        groupId: entry.groupId,
        timeBlockId: entry.timeBlockId,
        dayOfWeek: entry.dayOfWeek,
        ...(excludeEntryId && { NOT: { id: excludeEntryId } }),
      },
      include: {
        group: { select: { name: true } },
        teacherAssignment: {
          include: {
            teacher: { select: { firstName: true, lastName: true } },
            subject: { select: { name: true } },
          },
        },
      },
    });

    if (groupConflict) {
      const subjectName = groupConflict.teacherAssignment?.subject?.name || groupConflict.projectName || 'N/A';
      conflicts.push({
        type: 'GROUP_OVERLAP',
        severity: 'ERROR',
        message: `El grupo ${groupConflict.group.name} ya tiene asignado "${subjectName}" en este bloque`,
        details: {
          dayOfWeek: entry.dayOfWeek,
          timeBlockId: entry.timeBlockId,
          conflictingEntryId: groupConflict.id,
          groupId: entry.groupId,
          groupName: groupConflict.group.name,
        },
      });
    }

    // 2. Verificar conflicto de docente (mismo docente en dos grupos al mismo tiempo)
    //    Obtenemos teacherId navegando la relación desde ScheduleEntry (sin query directa a TeacherAssignment)
    if (entry.teacherAssignmentId) {
      // Buscar una ScheduleEntry existente con este teacherAssignmentId para extraer datos del docente
      // a través de la relación propia de ScheduleEntry, sin tocar TeacherAssignment directamente
      const refEntry = await this.prisma.scheduleEntry.findFirst({
        where: { teacherAssignmentId: entry.teacherAssignmentId },
        include: {
          teacherAssignment: {
            include: {
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      // Si no hay entry previo con esa asignación, obtener datos desde la propia entry que
      // estamos validando (antes de crear). Usamos un workaround: buscar el conflicto
      // directamente por teacherAssignmentId y dejar que Prisma resuelva la relación.
      const teacherConflict = await this.prisma.scheduleEntry.findFirst({
        where: {
          timeBlockId: entry.timeBlockId,
          dayOfWeek: entry.dayOfWeek,
          teacherAssignment: {
            teacherId: refEntry?.teacherAssignment?.teacherId || undefined,
          },
          ...(excludeEntryId && { NOT: { id: excludeEntryId } }),
        },
        include: {
          group: { select: { name: true } },
          teacherAssignment: {
            include: {
              teacher: { select: { id: true, firstName: true, lastName: true } },
              subject: { select: { name: true } },
            },
          },
        },
      });

      // Extraer datos del docente desde la referencia o desde el conflicto encontrado
      const teacherData = refEntry?.teacherAssignment?.teacher
        || teacherConflict?.teacherAssignment?.teacher;
      const teacherId = teacherData?.id;
      const teacherName = teacherData
        ? `${teacherData.firstName} ${teacherData.lastName}`
        : 'Docente';

      if (teacherConflict && teacherId) {
        const subjectName = teacherConflict.teacherAssignment?.subject?.name || 'N/A';
        conflicts.push({
          type: 'TEACHER_OVERLAP',
          severity: 'ERROR',
          message: `${teacherName} ya está asignado/a a "${subjectName}" en ${teacherConflict.group.name} en este bloque`,
          details: {
            dayOfWeek: entry.dayOfWeek,
            timeBlockId: entry.timeBlockId,
            conflictingEntryId: teacherConflict.id,
            teacherId,
            teacherName,
            groupId: teacherConflict.groupId,
            groupName: teacherConflict.group.name,
          },
        });
      }

      // 3. Verificar disponibilidad del docente
      if (teacherId) {
        const timeBlock = await this.prisma.timeBlock.findUnique({
          where: { id: entry.timeBlockId },
          select: { startTime: true, endTime: true },
        });

        if (timeBlock) {
          const unavailable = await this.prisma.teacherAvailability.findFirst({
            where: {
              institutionId,
              academicYearId,
              teacherId,
              dayOfWeek: entry.dayOfWeek,
              isAvailable: false,
              startTime: { lte: timeBlock.startTime },
              endTime: { gte: timeBlock.endTime },
            },
          });

          if (unavailable) {
            conflicts.push({
              type: 'TEACHER_UNAVAILABLE',
              severity: 'WARNING',
              message: `${teacherName} no está disponible en este horario: ${unavailable.reason || 'Sin razón especificada'}`,
              details: {
                dayOfWeek: entry.dayOfWeek,
                timeBlockId: entry.timeBlockId,
                teacherId,
                teacherName,
              },
            });
          }
        }
      }
    }

    // 4. Verificar conflicto de aula (misma aula en dos grupos al mismo tiempo)
    if (entry.roomId) {
      const roomConflict = await this.prisma.scheduleEntry.findFirst({
        where: {
          roomId: entry.roomId,
          timeBlockId: entry.timeBlockId,
          dayOfWeek: entry.dayOfWeek,
          ...(excludeEntryId && { NOT: { id: excludeEntryId } }),
        },
        include: {
          group: { select: { name: true } },
          room: { select: { name: true } },
        },
      });

      if (roomConflict) {
        conflicts.push({
          type: 'ROOM_OVERLAP',
          severity: 'ERROR',
          message: `El espacio "${roomConflict.room?.name}" ya está asignado al grupo ${roomConflict.group.name} en este bloque`,
          details: {
            dayOfWeek: entry.dayOfWeek,
            timeBlockId: entry.timeBlockId,
            conflictingEntryId: roomConflict.id,
            roomId: entry.roomId,
            roomName: roomConflict.room?.name,
            groupId: roomConflict.groupId,
            groupName: roomConflict.group.name,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Valida todo el horario de un grupo y devuelve todos los conflictos encontrados.
   */
  async validateGroupSchedule(
    institutionId: string,
    academicYearId: string,
    groupId: string,
  ): Promise<ScheduleConflict[]> {
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId, groupId },
    });

    const allConflicts: ScheduleConflict[] = [];

    for (const entry of entries) {
      const conflicts = await this.validateEntry(
        institutionId,
        academicYearId,
        {
          groupId: entry.groupId,
          timeBlockId: entry.timeBlockId,
          dayOfWeek: entry.dayOfWeek,
          teacherAssignmentId: entry.teacherAssignmentId || undefined,
          roomId: entry.roomId || undefined,
        },
        entry.id,
      );
      allConflicts.push(...conflicts);
    }

    return allConflicts;
  }

  /**
   * Resumen de conflictos para toda la institución/año académico.
   */
  async getConflictSummary(institutionId: string, academicYearId: string) {
    const entries = await this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    const allConflicts: (ScheduleConflict & { groupId: string; groupName: string })[] = [];

    for (const entry of entries) {
      const conflicts = await this.validateEntry(
        institutionId,
        academicYearId,
        {
          groupId: entry.groupId,
          timeBlockId: entry.timeBlockId,
          dayOfWeek: entry.dayOfWeek,
          teacherAssignmentId: entry.teacherAssignmentId || undefined,
          roomId: entry.roomId || undefined,
        },
        entry.id,
      );

      for (const c of conflicts) {
        allConflicts.push({
          ...c,
          groupId: entry.groupId,
          groupName: entry.group.name,
        });
      }
    }

    // Deduplicar conflictos (cada conflicto aparece desde ambos lados)
    const seen = new Set<string>();
    const unique = allConflicts.filter((c) => {
      const key = `${c.type}-${c.details.timeBlockId}-${c.details.dayOfWeek}-${c.details.teacherId || ''}-${c.details.roomId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      totalConflicts: unique.length,
      errors: unique.filter((c) => c.severity === 'ERROR').length,
      warnings: unique.filter((c) => c.severity === 'WARNING').length,
      conflicts: unique,
    };
  }
}
