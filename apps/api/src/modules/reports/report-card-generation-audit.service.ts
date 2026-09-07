import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Trazabilidad de la EMISIÓN de boletines — "cero cambios silenciosos".
 *
 * Decisión cerrada del rector (2026-08-27): debe quedar registro de cuándo se exportaron los
 * boletines. Hasta ahora la generación de PDF no dejaba ningún rastro, ni individual ni masiva.
 *
 * Por qué no reutiliza `GradeAuditService`: aquello audita **cambios de nota**, y su acción es
 * `CREATE | UPDATE | DELETE`. Emitir un documento no es ninguna de las tres. Forzarlo ahí
 * ensuciaría un modelo que hoy funciona bien.
 *
 * ── Dos reglas de las que depende que esto no estorbe ──────────────────────────────────────
 *
 * 1. **Auditar nunca puede impedir la emisión.** Si el registro falla, el boletín sale igual y el
 *    error se traga con un log. Es el mismo criterio que ya sigue `GradeAuditService`: un fallo
 *    de auditoría no puede dejar a un docente sin poder entregar boletines.
 *
 * 2. **Append-only por convención.** Nada actualiza ni borra estas filas.
 */
@Injectable()
export class ReportCardGenerationAuditService {
  private readonly logger = new Logger(ReportCardGenerationAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Un boletín individual. */
  async recordSingle(params: {
    institutionId: string;
    studentEnrollmentId: string;
    academicTermId?: string | null;
    actor?: ReportCardGenerationActor;
    succeeded?: boolean;
    detail?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.write({
      institutionId: params.institutionId,
      action: 'SINGLE_PDF',
      studentEnrollmentId: params.studentEnrollmentId,
      academicTermId: params.academicTermId ?? null,
      succeeded: params.succeeded ?? true,
      detail: params.detail ?? null,
      actor: params.actor,
    });
  }

  /**
   * Una emisión masiva. Deja **un solo evento** con el recuento, no uno por estudiante: para
   * responder "¿cuándo se exportaron los boletines de 8°A?" basta con eso, y evita escribir
   * cuarenta filas por cada clic.
   *
   * `batchId` queda disponible por si más adelante hiciera falta correlacionar eventos por
   * estudiante dentro de un mismo lote.
   */
  async recordBulk(params: {
    institutionId: string;
    groupId: string;
    academicTermId?: string | null;
    studentCount: number;
    batchId?: string | null;
    actor?: ReportCardGenerationActor;
    succeeded?: boolean;
    detail?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.write({
      institutionId: params.institutionId,
      action: 'BULK_PDF',
      groupId: params.groupId,
      academicTermId: params.academicTermId ?? null,
      studentCount: params.studentCount,
      batchId: params.batchId ?? null,
      succeeded: params.succeeded ?? true,
      detail: params.detail ?? null,
      actor: params.actor,
    });
  }

  /**
   * D3 — «¿hubo cambios DESPUÉS de emitir, y cuáles?».
   *
   * Ésta es la integración entre la Pieza 1 (cuándo se emitió) y la Pieza 2 (qué se cambió), y es
   * deliberadamente de **solo lectura**: se resuelve comparando dos marcas de tiempo que ya
   * existen. No se acopla nada a la generación del PDF, ni el generador queda enterado de la
   * auditoría académica. Cualquier acoplamiento en la escritura sería frágil por una razón muy
   * concreta: haría que un fallo del generador pudiera afectar al registro de notas.
   *
   * Devuelve, para un estudiante y un período, la última emisión y los cambios académicos
   * posteriores a ella — de nota y del eje cualitativo, que es justo lo que el rector pidió
   * poder identificar.
   */
  async changesAfterLastEmission(params: {
    institutionId: string;
    studentEnrollmentId: string;
    academicTermId: string;
  }) {
    const ultimaEmision = await this.prisma.reportCardGenerationEvent.findFirst({
      where: {
        institutionId: params.institutionId,
        studentEnrollmentId: params.studentEnrollmentId,
        academicTermId: params.academicTermId,
        succeeded: true,
      },
      orderBy: { performedAt: 'desc' },
      select: { id: true, performedAt: true, actorName: true, actorRole: true, action: true },
    });

    // Nunca se emitió: no hay «después de emitir» que responder. Devolver una lista vacía de
    // cambios sería mentir por omisión — no es que no hubiera cambios, es que no hubo emisión.
    if (!ultimaEmision) {
      return { emitted: false as const, lastEmission: null, changes: [] };
    }

    const changes = await this.prisma.gradeAuditEvent.findMany({
      where: {
        institutionId: params.institutionId,
        studentEnrollmentId: params.studentEnrollmentId,
        academicTermId: params.academicTermId,
        performedAt: { gt: ultimaEmision.performedAt },
      },
      orderBy: { performedAt: 'asc' },
      select: {
        id: true, source: true, action: true, reason: true, batchId: true,
        actorName: true, actorRole: true, performedAt: true,
        previousValue: true, newValue: true,
      },
    });

    return { emitted: true as const, lastEmission: ultimaEmision, changes };
  }

  private async write(event: {
    institutionId: string;
    action: 'SINGLE_PDF' | 'BULK_PDF';
    studentEnrollmentId?: string | null;
    academicTermId?: string | null;
    groupId?: string | null;
    batchId?: string | null;
    studentCount?: number | null;
    succeeded: boolean;
    detail?: Record<string, unknown> | null;
    actor?: ReportCardGenerationActor;
  }): Promise<void> {
    try {
      await this.prisma.reportCardGenerationEvent.create({
        data: {
          institutionId: event.institutionId,
          action: event.action,
          actorUserId: event.actor?.userId ?? null,
          actorName: event.actor?.name ?? null,
          actorRole: event.actor?.role ?? null,
          studentEnrollmentId: event.studentEnrollmentId ?? null,
          academicTermId: event.academicTermId ?? null,
          groupId: event.groupId ?? null,
          batchId: event.batchId ?? null,
          studentCount: event.studentCount ?? null,
          succeeded: event.succeeded,
          detail: (event.detail ?? undefined) as never,
        },
      });
    } catch (error) {
      // Regla 1: auditar nunca impide emitir. Se registra el fallo y se sigue.
      this.logger.error(
        `No se pudo registrar la emisión de boletín (${event.action}): ${(error as Error)?.message}`,
      );
    }
  }
}

export interface ReportCardGenerationActor {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
}
