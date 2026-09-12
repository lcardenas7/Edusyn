import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Motor de evidencia de competencias. Traduce el trabajo del estudiante en
 * evidencia enganchada a can-do's, y deriva el "dominio" (%) a partir de la
 * evidencia acumulada. Nunca lanza en el camino de registro (no debe romper
 * el flujo académico).
 *
 * **Aislamiento (2026-09-11).** Todas las lecturas llevan `institutionId` del ACTOR, no el que
 * venga del recurso nombrado por el cliente. Antes `getMastery` y `getRouteProgress` recibían
 * `studentId` y `routeId` sueltos y consultaban por id: con el identificador de otro colegio
 * devolvían su ruta, sus pasos y su progreso. `CompetencyEvidence` y `LearningRouteStep` llevan
 * `institutionId` propio, así que el filtro es directo; `Competency` es catálogo global (no tiene
 * `institutionId` en el esquema) y por eso no se acota.
 */
@Injectable()
export class CompetencyEvidenceService {
  private readonly logger = new Logger(CompetencyEvidenceService.name);
  private static readonly MASTERY_THRESHOLD = 70; // % para considerar "demostrado"

  constructor(private readonly prisma: PrismaService) {}

  /** Registra evidencia idempotente (upsert por idempotencyKey). */
  private async record(p: {
    institutionId: string; studentId: string; studentEnrollmentId?: string;
    competencyId: string; source: string; sourceRef?: string; routeStepId?: string;
    score: number; idempotencyKey: string;
  }) {
    const score = Math.max(0, Math.min(100, Math.round(p.score)));
    const existing = await this.prisma.competencyEvidence.findFirst({
      where: { idempotencyKey: p.idempotencyKey, institutionId: p.institutionId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.competencyEvidence.updateMany({
        where: { id: existing.id, institutionId: p.institutionId },
        data: { score },
      });
      return;
    }
    await this.prisma.competencyEvidence.create({
      data: {
        institutionId: p.institutionId, studentId: p.studentId, studentEnrollmentId: p.studentEnrollmentId,
        competencyId: p.competencyId, source: p.source, sourceRef: p.sourceRef, routeStepId: p.routeStepId,
        score, idempotencyKey: p.idempotencyKey,
      },
    });
  }

  /**
   * Registra evidencia por una actividad completada. Busca los pasos de ruta que
   * referencian esa actividad y tienen competencia, y crea una evidencia por cada
   * can-do. Si la actividad no es paso de ninguna ruta, no hace nada. Nunca lanza.
   *
   * Los pasos se buscan **acotados a la institución que envía el llamador** (el aula, con la
   * institución de la matrícula del estudiante). Sin ese filtro, un paso de otro colegio que
   * apuntara a la misma actividad —posible mientras `updateStep` aceptaba `activityId` ajeno—
   * habría producido evidencia cruzada.
   */
  async recordFromActivity(p: {
    institutionId: string; studentId: string; studentEnrollmentId?: string;
    activityId: string; scorePercent: number; source: string; sourceRef?: string;
  }): Promise<void> {
    try {
      if (!p.activityId || p.scorePercent == null || !p.institutionId) return;
      const steps = await this.prisma.learningRouteStep.findMany({
        where: {
          activityId: p.activityId,
          competencyId: { not: null },
          institutionId: p.institutionId,
          route: { institutionId: p.institutionId, classroom: { institutionId: p.institutionId } },
          activity: { classroom: { institutionId: p.institutionId } },
        },
        select: { id: true, competencyId: true },
      });
      for (const s of steps) {
        await this.record({
          institutionId: p.institutionId, studentId: p.studentId, studentEnrollmentId: p.studentEnrollmentId,
          competencyId: s.competencyId!, source: p.source, sourceRef: p.sourceRef, routeStepId: s.id,
          score: p.scorePercent,
          idempotencyKey: `evidence:step:${s.id}:student:${p.studentId}:src:${p.sourceRef ?? 'na'}`,
        });
      }
    } catch (err: any) {
      this.logger.warn(`recordFromActivity falló (no crítico): ${err?.message || err}`);
    }
  }

  /** Dominio (%) de un estudiante en una competencia: promedio de sus 3 mejores evidencias. */
  async getMastery(institutionId: string, studentId: string, competencyId: string): Promise<number> {
    const ev = await this.prisma.competencyEvidence.findMany({
      where: { institutionId, studentId, competencyId },
      orderBy: { score: 'desc' }, take: 3, select: { score: true },
    });
    if (!ev.length) return 0;
    return Math.round(ev.reduce((s, e) => s + e.score, 0) / ev.length);
  }

  /**
   * Progreso de un estudiante en una ruta: por paso + dominio del objetivo.
   *
   * La ruta se carga acotada a la institución del actor: una ruta ajena responde 404, igual que
   * una inexistente, para no revelar que existe.
   */
  async getRouteProgress(institutionId: string, routeId: string, studentId: string) {
    const route = await this.prisma.learningRoute.findFirst({
      where: { id: routeId, institutionId, classroom: { institutionId } },
      include: {
        targetCompetency: { select: { id: true } },
        steps: {
          where: { institutionId },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, competencyId: true },
        },
      },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    const steps = await Promise.all(route.steps.map(async (s) => {
      const [evCount, mastery] = await Promise.all([
        this.prisma.competencyEvidence.count({ where: { institutionId, studentId, routeStepId: s.id } }),
        s.competencyId ? this.getMastery(institutionId, studentId, s.competencyId) : Promise.resolve(0),
      ]);
      return { id: s.id, title: s.title, done: evCount > 0, mastery };
    }));

    const targetMastery = route.targetCompetency
      ? await this.getMastery(institutionId, studentId, route.targetCompetency.id)
      : 0;

    const completedSteps = steps.filter(s => s.done).length;
    return {
      routeId,
      targetMastery, // % dominado del can-do objetivo
      demonstrated: targetMastery >= CompetencyEvidenceService.MASTERY_THRESHOLD,
      completedSteps,
      totalSteps: steps.length,
      steps,
    };
  }
}
