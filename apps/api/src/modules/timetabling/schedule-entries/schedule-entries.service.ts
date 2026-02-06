import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScheduleValidatorService } from './schedule-validator.service';
import { DayOfWeek } from '@prisma/client';

@Injectable()
export class ScheduleEntriesService {
  constructor(
    private prisma: PrismaService,
    private validator: ScheduleValidatorService,
  ) {}

  private readonly entryIncludes = {
    group: { select: { id: true, name: true, code: true } },
    timeBlock: { select: { id: true, startTime: true, endTime: true, order: true, label: true, type: true } },
    teacherAssignment: {
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    },
    room: { select: { id: true, name: true, code: true } },
  };

  async findByGroup(institutionId: string, academicYearId: string, groupId: string) {
    return this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId, groupId },
      orderBy: [{ dayOfWeek: 'asc' }, { timeBlock: { order: 'asc' } }],
      include: this.entryIncludes,
    });
  }

  async findByTeacher(institutionId: string, academicYearId: string, teacherId: string) {
    return this.prisma.scheduleEntry.findMany({
      where: {
        institutionId,
        academicYearId,
        teacherAssignment: { teacherId },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { timeBlock: { order: 'asc' } }],
      include: this.entryIncludes,
    });
  }

  async findByRoom(institutionId: string, academicYearId: string, roomId: string) {
    return this.prisma.scheduleEntry.findMany({
      where: { institutionId, academicYearId, roomId },
      orderBy: [{ dayOfWeek: 'asc' }, { timeBlock: { order: 'asc' } }],
      include: this.entryIncludes,
    });
  }

  async create(institutionId: string, data: {
    academicYearId: string;
    groupId: string;
    timeBlockId: string;
    dayOfWeek: DayOfWeek;
    teacherAssignmentId?: string;
    projectName?: string;
    projectDescription?: string;
    roomId?: string;
    notes?: string;
    color?: string;
  }) {
    // Validar que tiene clase regular O proyecto (no ambos)
    if (data.teacherAssignmentId && data.projectName) {
      throw new BadRequestException('Una entrada no puede tener asignación de docente y proyecto simultáneamente');
    }

    // Detectar conflictos
    const conflicts = await this.validator.validateEntry(
      institutionId,
      data.academicYearId,
      {
        groupId: data.groupId,
        timeBlockId: data.timeBlockId,
        dayOfWeek: data.dayOfWeek,
        teacherAssignmentId: data.teacherAssignmentId,
        roomId: data.roomId,
      },
    );

    const errors = conflicts.filter((c) => c.severity === 'ERROR');
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Conflictos detectados',
        conflicts: errors,
      });
    }

    const entry = await this.prisma.scheduleEntry.create({
      data: {
        institutionId,
        academicYearId: data.academicYearId,
        groupId: data.groupId,
        timeBlockId: data.timeBlockId,
        dayOfWeek: data.dayOfWeek,
        teacherAssignmentId: data.teacherAssignmentId || null,
        projectName: data.projectName || null,
        projectDescription: data.projectDescription || null,
        roomId: data.roomId || null,
        notes: data.notes || null,
        color: data.color || null,
      },
      include: this.entryIncludes,
    });

    // Devolver con advertencias si las hay
    const warnings = conflicts.filter((c) => c.severity === 'WARNING');
    return { entry, warnings };
  }

  async update(id: string, institutionId: string, data: {
    teacherAssignmentId?: string | null;
    projectName?: string | null;
    projectDescription?: string | null;
    roomId?: string | null;
    notes?: string | null;
    color?: string | null;
  }) {
    const existing = await this.prisma.scheduleEntry.findFirst({
      where: { id, institutionId },
    });
    if (!existing) throw new NotFoundException('Entrada de horario no encontrada');

    // Detectar conflictos para la entrada actualizada
    const conflicts = await this.validator.validateEntry(
      institutionId,
      existing.academicYearId,
      {
        groupId: existing.groupId,
        timeBlockId: existing.timeBlockId,
        dayOfWeek: existing.dayOfWeek,
        teacherAssignmentId: data.teacherAssignmentId !== undefined
          ? (data.teacherAssignmentId || undefined)
          : (existing.teacherAssignmentId || undefined),
        roomId: data.roomId !== undefined
          ? (data.roomId || undefined)
          : (existing.roomId || undefined),
      },
      id,
    );

    const errors = conflicts.filter((c) => c.severity === 'ERROR');
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Conflictos detectados',
        conflicts: errors,
      });
    }

    const entry = await this.prisma.scheduleEntry.update({
      where: { id },
      data,
      include: this.entryIncludes,
    });

    const warnings = conflicts.filter((c) => c.severity === 'WARNING');
    return { entry, warnings };
  }

  async delete(id: string, institutionId: string) {
    const existing = await this.prisma.scheduleEntry.findFirst({
      where: { id, institutionId },
    });
    if (!existing) throw new NotFoundException('Entrada de horario no encontrada');

    return this.prisma.scheduleEntry.delete({ where: { id } });
  }

  async clearGroupSchedule(institutionId: string, academicYearId: string, groupId: string) {
    return this.prisma.scheduleEntry.deleteMany({
      where: { institutionId, academicYearId, groupId },
    });
  }

  /**
   * Obtener el horario completo como grilla (formato optimizado para el frontend).
   */
  async getGrid(institutionId: string, academicYearId: string, groupId: string) {
    const [entries, timeBlocks] = await Promise.all([
      this.prisma.scheduleEntry.findMany({
        where: { institutionId, academicYearId, groupId },
        include: this.entryIncludes,
      }),
      this.prisma.timeBlock.findMany({
        where: {
          institutionId,
          shift: {
            groups: { some: { id: groupId } },
          },
        },
        orderBy: { order: 'asc' },
      }),
    ]);

    // Organizar por día y bloque
    const days: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const grid: Record<string, Record<string, any>> = {};

    for (const day of days) {
      grid[day] = {};
      for (const block of timeBlocks) {
        const entry = entries.find(
          (e) => e.dayOfWeek === day && e.timeBlockId === block.id,
        );
        grid[day][block.id] = entry || null;
      }
    }

    return {
      timeBlocks,
      days,
      grid,
      entries,
    };
  }
}
