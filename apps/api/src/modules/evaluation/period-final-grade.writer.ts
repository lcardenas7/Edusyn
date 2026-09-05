import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { GradeAuditActor, GradeAuditService } from './grade-audit.service';

/**
 * G-1 · La única puerta de escritura a la nota final de período.
 *
 * Antes de este adaptador la misma nota podía alterarse desde cuatro sitios
 * distintos —captura manual, recálculo desde parciales, importación masiva y
 * recuperaciones—, y solo el primero dejaba rastro. Cerrar la puerta principal
 * no bastaba: quedaban ventanas al lado.
 *
 * Regla del módulo: **nadie escribe `periodFinalGrade` directamente.** Quien lo
 * necesite pasa por aquí, y aquí siempre se audita.
 *
 * El origen viaja en el evento para que el registro distinga una nota puesta a
 * mano de una derivada por el sistema: son hechos distintos y leerlos igual
 * confundiría a quien audite.
 */
export type OrigenNotaFinal = 'MANUAL' | 'RECALCULO' | 'IMPORTACION' | 'RECUPERACION';

const FUENTE_AUDITORIA: Record<OrigenNotaFinal, string> = {
  MANUAL: 'PERIOD_FINAL_GRADE',
  RECALCULO: 'PERIOD_FINAL_GRADE_RECALC',
  IMPORTACION: 'PERIOD_FINAL_GRADE_IMPORT',
  RECUPERACION: 'PERIOD_FINAL_GRADE_RECOVERY',
};

/** Actor de las escrituras que no tiene detrás a una persona. */
export const ACTOR_SISTEMA: GradeAuditActor = { role: 'SISTEMA' };

export interface ContextoEscritura {
  origen: OrigenNotaFinal;
  /** Causal tipificada, donde la política la exija. */
  causal?: string | null;
  /** Correlación con la operación que desencadenó la escritura. */
  batchId?: string | null;
  /** Ausente en el recálculo: entonces se registra como acción del sistema. */
  actor?: GradeAuditActor;
}

export interface ClaveNotaFinal {
  studentEnrollmentId: string;
  academicTermId: string;
  subjectId: string;
}

@Injectable()
export class PeriodFinalGradeWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeAudit: GradeAuditService,
  ) {}

  /** Genera una correlación para una operación que producirá varias escrituras. */
  nuevaCorrelacion(): string {
    return randomUUID();
  }

  private async leerPrevia(clave: ClaveNotaFinal) {
    return this.prisma.periodFinalGrade.findUnique({
      where: { studentEnrollmentId_academicTermId_subjectId: clave },
      select: { id: true, finalScore: true, institutionId: true },
    });
  }

  private async auditar(
    ctx: ContextoEscritura,
    datos: {
      institutionId: string;
      accion: 'CREATE' | 'UPDATE' | 'DELETE';
      recordId: string | null;
      clave: ClaveNotaFinal;
      previa: number | null;
      nueva: number | null;
    },
  ) {
    await this.gradeAudit.record(
      {
        institutionId: datos.institutionId,
        source: FUENTE_AUDITORIA[ctx.origen],
        action: datos.accion,
        recordId: datos.recordId,
        studentEnrollmentId: datos.clave.studentEnrollmentId,
        academicTermId: datos.clave.academicTermId,
        subjectId: datos.clave.subjectId,
        previousScore: datos.previa,
        newScore: datos.nueva,
        reason: ctx.causal ?? null,
        batchId: ctx.batchId ?? null,
      },
      ctx.actor ?? ACTOR_SISTEMA,
    );
  }

  /**
   * Crea o actualiza una nota final.
   *
   * No emite evento si el valor no cambió: un guardado que no altera nada no es
   * un hecho que auditar, y en el recálculo esto evita inundar el registro cada
   * vez que se recalcula un período entero sin que ninguna nota se mueva.
   */
  async upsert(params: {
    clave: ClaveNotaFinal;
    institutionId: string;
    finalScore: number;
    observations?: string;
    enteredById?: string | null;
    isManualOverride: boolean;
    contexto: ContextoEscritura;
    include?: unknown;
  }) {
    const previa = await this.leerPrevia(params.clave);

    const result = await this.prisma.periodFinalGrade.upsert({
      where: { studentEnrollmentId_academicTermId_subjectId: params.clave },
      update: {
        finalScore: params.finalScore,
        ...(params.observations !== undefined ? { observations: params.observations } : {}),
        ...(params.enteredById ? { enteredById: params.enteredById } : {}),
        isManualOverride: params.isManualOverride,
      },
      create: {
        ...params.clave,
        institutionId: params.institutionId,
        finalScore: params.finalScore,
        observations: params.observations,
        enteredById: params.enteredById ?? undefined,
        isManualOverride: params.isManualOverride,
      },
      ...(params.include ? { include: params.include as any } : {}),
    } as any);

    const anterior = previa ? Number(previa.finalScore) : null;
    if (!previa || anterior !== params.finalScore) {
      await this.auditar(params.contexto, {
        institutionId: params.institutionId,
        accion: previa ? 'UPDATE' : 'CREATE',
        recordId: (result as any).id,
        clave: params.clave,
        previa: anterior,
        nueva: params.finalScore,
      });
    }

    return result;
  }

  /** Elimina la nota final de una coordenada concreta, si existe. */
  async eliminar(clave: ClaveNotaFinal, contexto: ContextoEscritura) {
    const previa = await this.leerPrevia(clave);
    if (!previa) return 0;

    await this.prisma.periodFinalGrade.delete({ where: { id: previa.id } });

    await this.auditar(contexto, {
      institutionId: previa.institutionId,
      accion: 'DELETE',
      recordId: previa.id,
      clave,
      previa: Number(previa.finalScore),
      nueva: null,
    });
    return 1;
  }

  /** Elimina por id, cuando quien llama ya resolvió el registro. */
  async eliminarPorId(id: string, contexto: ContextoEscritura) {
    const previa = await this.prisma.periodFinalGrade.findUnique({
      where: { id },
      select: {
        id: true,
        finalScore: true,
        institutionId: true,
        studentEnrollmentId: true,
        academicTermId: true,
        subjectId: true,
      },
    });
    if (!previa) return null;

    const result = await this.prisma.periodFinalGrade.delete({ where: { id } });

    await this.auditar(contexto, {
      institutionId: previa.institutionId,
      accion: 'DELETE',
      recordId: previa.id,
      clave: {
        studentEnrollmentId: previa.studentEnrollmentId,
        academicTermId: previa.academicTermId,
        subjectId: previa.subjectId,
      },
      previa: Number(previa.finalScore),
      nueva: null,
    });
    return result;
  }

  /**
   * Fija el valor de la nota final de una coordenada ya existente.
   *
   * Sustituye a las actualizaciones masivas que antes escribían sin leer: para
   * auditar hay que saber qué había antes, así que se resuelve registro a
   * registro. Son operaciones de una nota por estudiante y asignatura, no
   * cargas de miles.
   */
  async fijarValor(clave: ClaveNotaFinal, finalScore: number, contexto: ContextoEscritura) {
    const previa = await this.leerPrevia(clave);
    if (!previa) return 0;

    const anterior = Number(previa.finalScore);
    if (anterior === finalScore) return 0;

    await this.prisma.periodFinalGrade.update({
      where: { id: previa.id },
      data: { finalScore },
    });

    await this.auditar(contexto, {
      institutionId: previa.institutionId,
      accion: 'UPDATE',
      recordId: previa.id,
      clave,
      previa: anterior,
      nueva: finalScore,
    });
    return 1;
  }
}
