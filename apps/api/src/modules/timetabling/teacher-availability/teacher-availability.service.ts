import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

@Injectable()
export class TeacherAvailabilityService {
  constructor(private prisma: PrismaService) {}

  async findByTeacher(institutionId: string, academicYearId: string, teacherId: string) {
    return this.prisma.teacherAvailability.findMany({
      where: { institutionId, academicYearId, teacherId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findAll(institutionId: string, academicYearId: string) {
    return this.prisma.teacherAvailability.findMany({
      where: { institutionId, academicYearId },
      orderBy: [{ teacherId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async upsert(institutionId: string, data: {
    academicYearId: string;
    teacherId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
    reason?: string;
  }) {
    this.validateTimeFormat(data.startTime);
    this.validateTimeFormat(data.endTime);

    if (data.startTime >= data.endTime) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora de fin');
    }

    const existing = await this.prisma.teacherAvailability.findFirst({
      where: {
        institutionId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
      },
    });

    if (existing) {
      return this.prisma.teacherAvailability.update({
        where: { id: existing.id },
        data: {
          endTime: data.endTime,
          isAvailable: data.isAvailable ?? true,
          reason: data.reason,
        },
      });
    }

    return this.prisma.teacherAvailability.create({
      data: {
        institutionId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        isAvailable: data.isAvailable ?? true,
        reason: data.reason,
      },
    });
  }

  async bulkSet(institutionId: string, academicYearId: string, teacherId: string, entries: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
    reason?: string;
  }>) {
    // Validar todos
    for (const entry of entries) {
      this.validateTimeFormat(entry.startTime);
      this.validateTimeFormat(entry.endTime);
    }

    return this.prisma.$transaction(async (tx) => {
      // Eliminar disponibilidades existentes del docente para ese año
      await tx.teacherAvailability.deleteMany({
        where: { institutionId, academicYearId, teacherId },
      });

      // Crear nuevas
      const created: any[] = [];
      for (const entry of entries) {
        const avail = await tx.teacherAvailability.create({
          data: {
            institutionId,
            academicYearId,
            teacherId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isAvailable: entry.isAvailable ?? true,
            reason: entry.reason,
          },
        });
        created.push(avail);
      }

      return created;
    });
  }

  async delete(id: string, institutionId: string) {
    const avail = await this.prisma.teacherAvailability.findFirst({
      where: { id, institutionId },
    });
    if (!avail) throw new NotFoundException('Disponibilidad no encontrada');
    return this.prisma.teacherAvailability.delete({ where: { id } });
  }

  private validateTimeFormat(time: string) {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!regex.test(time)) {
      throw new BadRequestException(`Formato de hora inválido: ${time}. Use HH:mm`);
    }
  }
}
