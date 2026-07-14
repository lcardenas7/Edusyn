// ═══════════════════════════════════════════════════════════════════════════
// EXPEDICIÓN ABP — constantes de las 6 fases, defaults y catálogo de insignias.
// Los defaults hacen que un proyecto funcione out-of-the-box sin configurar nada.
// ═══════════════════════════════════════════════════════════════════════════

export const ABP_PHASES = [
  { n: 1, key: 'RETO', name: 'El Reto', icon: '🧭' },
  { n: 2, key: 'IDEAS', name: 'Tormenta de Ideas', icon: '⚡' },
  { n: 3, key: 'OBJETIVOS', name: 'Objetivos', icon: '🎯' },
  { n: 4, key: 'PLAN', name: 'Plan de Acción', icon: '🛠️' },
  { n: 5, key: 'PROTOTIPO', name: 'Prototipo', icon: '🚀' },
  { n: 6, key: 'SOCIAL', name: 'Socialización', icon: '🏆' },
] as const;

export const ABP_PHASE_COUNT = 6;

// Criterios por fase con valores por defecto sensatos (el docente puede sobreescribir
// vía AbpProject.phaseConfig). Un proyecto nuevo arranca con estos, sin configurar nada.
export interface AbpPhaseConfig {
  minCanvasCards: number; // Fase 1
  minIdeasPerMember: number; // Fase 2
  votesPerStudent: number; // Fase 2
  smartCriteria: number; // Fase 3 (de 5)
  minObjectiveLength: number; // Fase 3
  minEvidences: number; // Fase 5
}

export const DEFAULT_PHASE_CONFIG: AbpPhaseConfig = {
  minCanvasCards: 4,
  minIdeasPerMember: 2,
  votesPerStudent: 3,
  smartCriteria: 5,
  minObjectiveLength: 20,
  minEvidences: 3,
};

/** Mezcla los overrides del docente con los defaults (nunca undefined). */
export function resolvePhaseConfig(stored: any): AbpPhaseConfig {
  return { ...DEFAULT_PHASE_CONFIG, ...(stored && typeof stored === 'object' ? stored : {}) };
}

// Insignia de equipo que se otorga al VALIDAR cada fase (código → etiqueta).
export const ABP_BADGE_ON_PHASE: Record<number, string> = {
  1: '🧭 Reto validado',
  2: '⚡ Lluvia perfecta',
  3: '🎯 Arquitectos',
  4: '🛠️ Manos a la obra',
  5: '🚀 Prototipo listo',
  6: '🏆 Expedición completa',
};

// Fase 1 — Canvas del Problema: las 4 tarjetas colaborativas (pregunta + icono).
export const CANVAS_CARDS = [
  { q: '¿Qué está pasando?', icon: '🔍' },
  { q: '¿A quiénes afecta?', icon: '👥' },
  { q: '¿Por qué es importante?', icon: '⭐' },
  { q: '¿Qué pasa si nadie lo resuelve?', icon: '⚠️' },
] as const;

// ¿Cumple la fase sus criterios automáticos para poder solicitar validación?
// Se refina por fase conforme se construyen las herramientas (tickets 3–8).
export function phaseCriteriaMet(phase: number, data: any, config: AbpPhaseConfig): boolean {
  if (phase === 1) {
    const canvas = Array.isArray(data?.canvas) ? data.canvas : [];
    const filled = canvas.filter((c: any) => c && String(c.value || '').trim()).length;
    return filled >= config.minCanvasCards;
  }
  return true; // fases 2–6: sin criterio automático aún (permisivo)
}

// XP de equipo por evento (la barra denormalizada; el XP individual va por grantXp).
export const ABP_XP = {
  CANVAS_CARD: 10,
  IDEA: 15,
  VOTE: 5,
  TASK_DONE: 20,
  EVIDENCE: 15,
  PHASE_VALIDATED: 50,
};
