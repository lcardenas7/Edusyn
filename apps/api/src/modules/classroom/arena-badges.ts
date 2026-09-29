/**
 * Catálogo de insignias de la Arena.
 *
 * Vive en código, como el catálogo de insignias del aula (`badge-catalog.ts`):
 * no necesita configuración por institución y así no hay tablas que migrar.
 *
 * Tres familias, porque premian tres cosas distintas y un estudiante puede ser
 * bueno en una sin serlo en las otras:
 *   · duelos ganados — competir y ganar;
 *   · preguntas acertadas — constancia, aunque se pierdan los duelos;
 *   · dominio de una categoría — saber mucho de un tema concreto.
 *
 * Las insignias por categoría se generan a partir de las categorías que el
 * estudiante realmente ha jugado, porque las categorías las pone el docente y no
 * se pueden listar de antemano.
 *
 * Todas se calculan sobre duelos ya terminados y ninguna se pierde una vez
 * ganada: los contadores solo suben. Se muestran también las que faltan, con su
 * progreso, para que se vea qué sigue.
 */

export type BadgeTier = 'BRONCE' | 'PLATA' | 'ORO';

export type ArenaBadge = {
  code: string;
  name: string;
  description: string;
  emoji: string;
  tier: BadgeTier;
  family: 'victorias' | 'aciertos' | 'categoria' | 'gesta';
  target: number;
  current: number;
  earned: boolean;
};

export type ArenaStats = {
  wins: number;
  correct: number;
  perfects: number;
  upsets: number;
  bestStreak: number;
  byCategory: Map<string, { correct: number; answered: number; duels: number }>;
};

const TIERS: BadgeTier[] = ['BRONCE', 'PLATA', 'ORO'];

function ladder(
  family: ArenaBadge['family'],
  prefix: string,
  emoji: string,
  steps: { target: number; name: string; description: string }[],
  current: number,
): ArenaBadge[] {
  return steps.map((step, index) => ({
    code: `${prefix}_${step.target}`,
    name: step.name,
    description: step.description,
    emoji,
    tier: TIERS[Math.min(index, TIERS.length - 1)],
    family,
    target: step.target,
    current: Math.min(current, step.target),
    earned: current >= step.target,
  }));
}

export function arenaBadges(stats: ArenaStats): ArenaBadge[] {
  const badges: ArenaBadge[] = [
    ...ladder('victorias', 'WIN', '⚔️', [
      { target: 1, name: 'Primera sangre', description: 'Gana tu primer duelo.' },
      { target: 10, name: 'Retador', description: 'Gana 10 duelos.' },
      { target: 30, name: 'Leyenda de la Arena', description: 'Gana 30 duelos.' },
    ], stats.wins),
    ...ladder('aciertos', 'HIT', '🎯', [
      { target: 25, name: 'Buen ojo', description: 'Acierta 25 preguntas.' },
      { target: 150, name: 'Puntería fina', description: 'Acierta 150 preguntas.' },
      { target: 500, name: 'Francotirador', description: 'Acierta 500 preguntas.' },
    ], stats.correct),
    ...ladder('gesta', 'PERFECT', '💎', [
      { target: 1, name: 'Pleno', description: 'Termina un duelo con las siete correctas.' },
      { target: 5, name: 'Impecable', description: 'Consigue 5 duelos perfectos.' },
    ], stats.perfects),
    ...ladder('gesta', 'UPSET', '🔥', [
      { target: 1, name: 'Sorpresa', description: 'Gánale a alguien que iba por delante de ti.' },
      { target: 10, name: 'Cazagigantes', description: 'Hazlo 10 veces.' },
    ], stats.upsets),
    ...ladder('gesta', 'STREAK', '⚡', [
      { target: 3, name: 'En racha', description: 'Gana 3 duelos seguidos.' },
      { target: 7, name: 'Imparable', description: 'Gana 7 duelos seguidos.' },
    ], stats.bestStreak),
  ];

  // Una escalera por cada categoría que el estudiante haya jugado de verdad.
  for (const [name, totals] of [...stats.byCategory].sort((a, b) => b[1].correct - a[1].correct)) {
    badges.push(...ladder('categoria', `CAT_${name}`, '📚', [
      { target: 15, name: `Aprendiz de ${name}`, description: `Acierta 15 preguntas de ${name}.` },
      { target: 50, name: `Expert@ en ${name}`, description: `Acierta 50 preguntas de ${name}.` },
      { target: 120, name: `Maestr@ de ${name}`, description: `Acierta 120 preguntas de ${name}.` },
    ], totals.correct));
  }

  return badges;
}
