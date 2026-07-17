import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// Estado de completitud de UNA actividad para UN estudiante. Unifica los dos
// mundos: actividades con entrega (ActivitySubmission) y lecciones (LessonProgress).
export interface CompletionState {
  started: boolean; // inició/entregó algo (para "sticky unlock")
  submitted: boolean; // entregada / lección completada
  graded: boolean; // calificada / lección completada (auto-nota)
  score: number | null; // mejor puntaje, en base a la maxScore de la actividad
}

// Estados de entrega que cuentan como "entregado" y como "calificado".
const SUBMITTED_STATUSES = new Set(['SUBMITTED', 'LATE', 'GRADED', 'AUTO_GRADED']);
const GRADED_STATUSES = new Set(['GRADED', 'AUTO_GRADED']);

export interface CompletionActivityRef {
  id: string;
  type: string;
  maxScore?: number | null;
}

/**
 * ¿El estado cumple la condición de desbloqueo? Pura (sin IO). COMPLETED se trata
 * igual que SUBMITTED (una lección "completada" o una tarea "entregada").
 */
export function satisfiesCondition(
  state: CompletionState | undefined,
  condition: string,
  minScore?: number | null,
): boolean {
  if (!state) return false;
  switch (condition) {
    case 'GRADED':
      return state.graded;
    case 'MIN_SCORE':
      return state.graded && state.score != null && state.score >= (minScore ?? 0);
    case 'SUBMITTED':
    case 'COMPLETED':
    default:
      return state.submitted;
  }
}

@Injectable()
export class CompletionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estados de completitud de un conjunto de actividades para un estudiante, en
   * el MÍNIMO de consultas (una para entregas, una para progreso de lecciones).
   */
  async getCompletionMap(
    activities: CompletionActivityRef[],
    studentEnrollmentId: string,
  ): Promise<Map<string, CompletionState>> {
    const result = new Map<string, CompletionState>();
    if (!activities.length) return result;

    // LESSON y GAME se completan vía LessonProgress (el juego suelto también es una
    // lección de una diapositiva). El resto (TASK/QUIZ/EXAM…) vía ActivitySubmission.
    const isLessonBacked = (t: string) => t === 'LESSON' || t === 'GAME';
    const lessonActs = activities.filter(a => isLessonBacked(a.type));
    const submissionActs = activities.filter(a => !isLessonBacked(a.type));

    // ── Actividades con entrega ────────────────────────────────────────────
    if (submissionActs.length) {
      const subs = await this.prisma.activitySubmission.findMany({
        where: { activityId: { in: submissionActs.map(a => a.id) }, studentEnrollmentId },
        select: { activityId: true, status: true, score: true },
      });
      // Inicializa todas en "sin empezar"
      for (const a of submissionActs) {
        result.set(a.id, { started: false, submitted: false, graded: false, score: null });
      }
      for (const s of subs) {
        const state = result.get(s.activityId)!;
        state.started = true; // cualquier entrega (incl. DRAFT/RETURNED) = ya tuvo acceso
        if (SUBMITTED_STATUSES.has(s.status)) state.submitted = true;
        if (GRADED_STATUSES.has(s.status)) {
          state.graded = true;
          const sc = s.score != null ? Number(s.score) : null;
          if (sc != null && (state.score == null || sc > state.score)) state.score = sc; // mejor intento
        }
      }
    }

    // ── Lecciones (LessonProgress) ─────────────────────────────────────────
    if (lessonActs.length) {
      const maxByActivity = new Map(lessonActs.map(a => [a.id, a.maxScore != null ? Number(a.maxScore) : 5]));
      for (const a of lessonActs) {
        result.set(a.id, { started: false, submitted: false, graded: false, score: null });
      }
      const progresses = await this.prisma.lessonProgress.findMany({
        where: { studentEnrollmentId, lesson: { activityId: { in: lessonActs.map(a => a.id) } } },
        select: { status: true, score: true, maxScore: true, lesson: { select: { activityId: true } } },
      });
      for (const p of progresses) {
        const activityId = p.lesson?.activityId;
        if (!activityId) continue;
        const state = result.get(activityId);
        if (!state) continue;
        state.started = p.status !== 'NOT_STARTED';
        if (p.status === 'COMPLETED') {
          state.submitted = true;
          state.graded = true; // la lección se auto-califica al completar
          const activityMax = maxByActivity.get(activityId) ?? 5;
          const lessonMax = p.maxScore != null ? Number(p.maxScore) : 0;
          state.score = lessonMax > 0 ? (Number(p.score) / lessonMax) * activityMax : activityMax;
        }
      }
    }

    return result;
  }
}
