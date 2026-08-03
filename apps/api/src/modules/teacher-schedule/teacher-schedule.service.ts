import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

const VALID_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const VALID_TYPES = [
  'CLASE',
  'TUTORIA',
  'ATENCION_PADRES',
  'REUNION_AREA',
  'OTRO',
];

export interface TeacherScheduleBlockInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  type: string;
  title: string;
  location?: string | null;
  color?: string | null;
  notes?: string | null;
}

@Injectable()
export class TeacherScheduleService {
  constructor(private prisma: PrismaService) {}

  /** Bloques del docente autenticado, ordenados por día y hora de inicio. */
  async findMine(institutionId: string, teacherId: string) {
    return this.prisma.teacherScheduleBlock.findMany({
      where: { institutionId, teacherId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(
    institutionId: string,
    teacherId: string,
    data: TeacherScheduleBlockInput,
  ) {
    const clean = this.validate(data);
    return this.prisma.teacherScheduleBlock.create({
      data: {
        institutionId,
        teacherId,
        dayOfWeek: clean.dayOfWeek!,
        startTime: clean.startTime!,
        endTime: clean.endTime!,
        type: clean.type ?? 'OTRO',
        title: clean.title!,
        location: clean.location ?? null,
        color: clean.color ?? null,
        notes: clean.notes ?? null,
      },
    });
  }

  async update(
    institutionId: string,
    teacherId: string,
    id: string,
    data: Partial<TeacherScheduleBlockInput>,
  ) {
    await this.ensureOwned(institutionId, teacherId, id);
    const clean = this.validate({ ...data }, true);
    return this.prisma.teacherScheduleBlock.update({
      where: { id },
      data: clean,
    });
  }

  async remove(institutionId: string, teacherId: string, id: string) {
    await this.ensureOwned(institutionId, teacherId, id);
    await this.prisma.teacherScheduleBlock.delete({ where: { id } });
    return { ok: true };
  }

  /** Verifica que el bloque exista y pertenezca al docente autenticado (anti-IDOR). */
  private async ensureOwned(
    institutionId: string,
    teacherId: string,
    id: string,
  ) {
    const block = await this.prisma.teacherScheduleBlock.findFirst({
      where: { id, institutionId, teacherId },
      select: { id: true },
    });
    if (!block) {
      throw new NotFoundException('Bloque de horario no encontrado');
    }
  }

  /**
   * Valida y normaliza. En modo `partial` sólo valida los campos presentes
   * (para PUT donde el cliente puede enviar un subconjunto).
   */
  private validate(
    data: Partial<TeacherScheduleBlockInput>,
    partial = false,
  ): Partial<TeacherScheduleBlockInput> {
    const out: Partial<TeacherScheduleBlockInput> = {};

    if (data.type !== undefined) {
      if (!VALID_TYPES.includes(data.type)) {
        throw new BadRequestException('Tipo de bloque inválido');
      }
      out.type = data.type;
    } else if (!partial) {
      out.type = 'OTRO';
    }

    if (data.dayOfWeek !== undefined || !partial) {
      if (!VALID_DAYS.includes(data.dayOfWeek as DayOfWeek)) {
        throw new BadRequestException('Día de la semana inválido');
      }
      out.dayOfWeek = data.dayOfWeek as DayOfWeek;
    }

    if (data.startTime !== undefined || !partial) {
      if (!HHMM.test(data.startTime ?? '')) {
        throw new BadRequestException('Hora de inicio inválida (formato HH:mm)');
      }
      out.startTime = data.startTime as string;
    }

    if (data.endTime !== undefined || !partial) {
      if (!HHMM.test(data.endTime ?? '')) {
        throw new BadRequestException('Hora de fin inválida (formato HH:mm)');
      }
      out.endTime = data.endTime as string;
    }

    // Si ambos extremos están presentes, inicio debe ser antes que fin.
    if (out.startTime && out.endTime && out.startTime >= out.endTime) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin',
      );
    }

    if (data.title !== undefined || !partial) {
      const title = (data.title ?? '').trim();
      if (!title) {
        throw new BadRequestException('El título es obligatorio');
      }
      out.title = title;
    }

    if (data.location !== undefined) out.location = data.location?.trim() || null;
    if (data.color !== undefined) out.color = data.color || null;
    if (data.notes !== undefined) out.notes = data.notes?.trim() || null;

    return out;
  }
}
