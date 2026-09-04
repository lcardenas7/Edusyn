import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface GradeAuditActor {
  userId?: string;
  name?: string;
  role?: string;
}

export interface GradeAuditEventInput {
  institutionId: string;
  source?: string; // default 'PARTIAL_GRADE'
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  partialGradeId?: string | null;
  /** Id del registro afectado para los orígenes distintos de la nota parcial. */
  recordId?: string | null;
  /** Motivo declarado; solo lo exigen las operaciones de ciclo de período. */
  reason?: string | null;
  /** Correlación de lote: una escritura masiva comparte el mismo valor. */
  batchId?: string | null;
  studentEnrollmentId?: string | null;
  teacherAssignmentId?: string | null;
  academicTermId?: string | null;
  componentType?: string | null;
  activityIndex?: number | null;
  activityName?: string | null;
  subjectId?: string | null;
  finalComponentId?: string | null;
  evaluativeActivityId?: string | null;
  previousScore?: number | null;
  newScore?: number | null;
  previousValue?: any;
  newValue?: any;
}

/**
 * Registro forense de cambios de nota (append-only).
 *
 * Regla de oro: auditar NUNCA debe romper el guardado de la nota.
 * Por eso todos los métodos atrapan sus propios errores y solo loguean.
 */
@Injectable()
export class GradeAuditService {
  private readonly logger = new Logger(GradeAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: GradeAuditEventInput, actor?: GradeAuditActor): Promise<void> {
    await this.recordMany([event], actor);
  }

  async recordMany(events: GradeAuditEventInput[], actor?: GradeAuditActor): Promise<void> {
    if (!events.length) return;
    try {
      await this.prisma.gradeAuditEvent.createMany({
        data: events.map((e) => ({
          institutionId: e.institutionId,
          source: e.source || 'PARTIAL_GRADE',
          action: e.action,
          actorUserId: actor?.userId ?? null,
          actorName: actor?.name ?? null,
          actorRole: actor?.role ?? null,
          partialGradeId: e.partialGradeId ?? null,
          recordId: e.recordId ?? null,
          reason: e.reason ?? null,
          batchId: e.batchId ?? null,
          studentEnrollmentId: e.studentEnrollmentId ?? null,
          teacherAssignmentId: e.teacherAssignmentId ?? null,
          academicTermId: e.academicTermId ?? null,
          componentType: e.componentType ?? null,
          activityIndex: e.activityIndex ?? null,
          activityName: e.activityName ?? null,
          subjectId: e.subjectId ?? null,
          finalComponentId: e.finalComponentId ?? null,
          evaluativeActivityId: e.evaluativeActivityId ?? null,
          previousScore: e.previousScore ?? null,
          newScore: e.newScore ?? null,
          previousValue: e.previousValue ?? undefined,
          newValue: e.newValue ?? undefined,
        })),
      });
    } catch (err: any) {
      // Nunca propagar: el guardado de la nota es prioritario sobre la auditoría.
      this.logger.error(`No se pudo registrar auditoría de notas (${events.length} eventos): ${err?.message || err}`);
    }
  }
}
