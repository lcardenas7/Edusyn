import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface AttendanceAuditActor {
  userId?: string;
  name?: string;
  role?: string;
}

export interface AttendanceAuditEventInput {
  institutionId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  attendanceRecordId?: string | null;
  studentEnrollmentId?: string | null;
  teacherAssignmentId?: string | null;
  date?: Date | string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  previousValue?: any;
  newValue?: any;
}

/**
 * Registro forense de cambios de asistencia (append-only).
 *
 * **Cambio 2026-09-11.** La regla anterior era «auditar nunca debe romper el registro de
 * asistencia»: el fallo se tragaba con un `catch` y solo quedaba una línea de log. Sus dos
 * llamadores escriben la asistencia y la auditoría dentro de la MISMA transacción, así que
 * tragarse el error dejaba exactamente lo que el encargo prohíbe: la nota de asistencia cambiada
 * y ningún rastro de quién la cambió —una escritura parcial disfrazada de éxito.
 *
 * Ahora el fallo se registra y **se propaga**: la transacción revierte y el usuario recibe un
 * error en vez de un cambio sin trazabilidad. Es un cambio de comportamiento deliberado; queda
 * documentado en `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md`.
 */
@Injectable()
export class AttendanceAuditService {
  private readonly logger = new Logger(AttendanceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordMany(events: AttendanceAuditEventInput[], actor?: AttendanceAuditActor): Promise<void> {
    if (!events.length) return;
    try {
      await this.prisma.attendanceAuditEvent.createMany({
        data: events.map((e) => ({
          institutionId: e.institutionId,
          action: e.action,
          actorUserId: actor?.userId ?? null,
          actorName: actor?.name ?? null,
          actorRole: actor?.role ?? null,
          attendanceRecordId: e.attendanceRecordId ?? null,
          studentEnrollmentId: e.studentEnrollmentId ?? null,
          teacherAssignmentId: e.teacherAssignmentId ?? null,
          date: e.date ? new Date(e.date) : null,
          previousStatus: e.previousStatus ?? null,
          newStatus: e.newStatus ?? null,
          previousValue: e.previousValue ?? undefined,
          newValue: e.newValue ?? undefined,
        })),
      });
    } catch (err: any) {
      // Se deja rastro en el log Y se propaga: quien llama está dentro de una transacción y debe
      // revertir la escritura de asistencia que acaba de hacer.
      this.logger.error(`No se pudo registrar auditoría de asistencia (${events.length} eventos): ${err?.message || err}`);
      throw err;
    }
  }
}
