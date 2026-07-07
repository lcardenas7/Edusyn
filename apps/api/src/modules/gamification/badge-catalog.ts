/**
 * Catálogo estático de insignias (logros de gamificación). Vive en código para
 * no requerir configuración por institución. Progreso PRIVADO: las insignias
 * premian hitos propios del estudiante, nunca comparan ni castigan la no-participación.
 *
 * Cada insignia se evalúa contra un snapshot de estadísticas del estudiante.
 * Las de racha usan longestStreak (permanente: una racha rota no quita la insignia).
 */

export interface BadgeStats {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lessonsCompleted: number; // count de XpEvent LESSON_COMPLETE
  quizzesGraded: number; // count de XpEvent QUIZ_GRADED
}

export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface BadgeDef {
  code: string;
  name: string;
  description: string;
  emoji: string;
  tier: BadgeTier;
  /** ¿El estudiante cumple el criterio de esta insignia? */
  earned: (s: BadgeStats) => boolean;
}

export const BADGE_CATALOG: BadgeDef[] = [
  // Lecciones
  { code: 'first_lesson', name: 'Primer paso', description: 'Completa tu primera lección', emoji: '🎯', tier: 'BRONZE', earned: s => s.lessonsCompleted >= 1 },
  { code: 'lessons_5', name: 'Aprendiz constante', description: 'Completa 5 lecciones', emoji: '📚', tier: 'SILVER', earned: s => s.lessonsCompleted >= 5 },
  { code: 'lessons_10', name: 'Estudiante dedicado', description: 'Completa 10 lecciones', emoji: '🎓', tier: 'GOLD', earned: s => s.lessonsCompleted >= 10 },

  // Quizzes
  { code: 'first_quiz', name: 'Primera evaluación', description: 'Completa tu primer quiz', emoji: '✍️', tier: 'BRONZE', earned: s => s.quizzesGraded >= 1 },
  { code: 'quizzes_10', name: 'Examinado', description: 'Completa 10 quizzes', emoji: '📝', tier: 'GOLD', earned: s => s.quizzesGraded >= 10 },

  // Racha (usa longestStreak → permanente)
  { code: 'streak_3', name: 'En racha', description: 'Practica 3 días seguidos', emoji: '🔥', tier: 'BRONZE', earned: s => s.longestStreak >= 3 },
  { code: 'streak_7', name: 'Imparable', description: 'Practica 7 días seguidos', emoji: '⚡', tier: 'SILVER', earned: s => s.longestStreak >= 7 },
  { code: 'streak_30', name: 'Constancia de oro', description: 'Practica 30 días seguidos', emoji: '🏅', tier: 'GOLD', earned: s => s.longestStreak >= 30 },

  // Nivel
  { code: 'level_5', name: 'Nivel 5', description: 'Alcanza el nivel 5', emoji: '⭐', tier: 'SILVER', earned: s => s.level >= 5 },
  { code: 'level_10', name: 'Nivel 10', description: 'Alcanza el nivel 10', emoji: '🌟', tier: 'GOLD', earned: s => s.level >= 10 },

  // XP acumulado
  { code: 'xp_500', name: 'Medio millar', description: 'Acumula 500 XP', emoji: '💎', tier: 'SILVER', earned: s => s.totalXp >= 500 },
  { code: 'xp_1000', name: 'Milésimo', description: 'Acumula 1000 XP', emoji: '💠', tier: 'GOLD', earned: s => s.totalXp >= 1000 },
];

export const BADGE_BY_CODE: Record<string, BadgeDef> = Object.fromEntries(
  BADGE_CATALOG.map(b => [b.code, b]),
);
