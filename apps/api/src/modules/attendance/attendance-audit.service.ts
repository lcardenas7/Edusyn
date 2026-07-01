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
 * Regla de oro: auditar NUNCA debe romper el registro de asistencia.
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
      this.logger.error(`No se pudo registrar auditoría de asistencia (${events.length} eventos): ${err?.message || err}`);
    }
  }
}
