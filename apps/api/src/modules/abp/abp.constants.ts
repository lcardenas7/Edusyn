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

// Rúbrica de cierre del DOCENTE por fase (3 criterios, escala 1–4). Defaults sensatos;
// personalizables por proyecto vía phaseConfig.rubrics[phase].
export const ABP_RUBRICS: Record<number, string[]> = {
  1: ['Claridad del problema', 'Relevancia para la comunidad', 'Profundidad del análisis'],
  2: ['Variedad de ideas', 'Creatividad', 'Proceso de selección'],
  3: ['Especificidad', 'Medible y con plazo', 'Alineación al reto'],
  4: ['Reparto de tareas', 'Viabilidad de la solución', 'Cumplimiento'],
  5: ['Calidad de la solución', 'Evidencia del proceso', 'Presentación'],
  6: ['Comunicación', 'Reflexión', 'Coevaluación justa'],
};
export function rubricFor(phase: number, phaseConfig: any): string[] {
  const custom = phaseConfig?.rubrics?.[phase];
  return Array.isArray(custom) && custom.length ? custom : (ABP_RUBRICS[phase] || []);
}

// Fase 6 — Rúbrica de coevaluación (cada equipo evalúa a los demás, escala 1–4).
export const ABP_COEVAL_CRITERIA = [
  'Claridad de la presentación',
  'Creatividad de la solución',
  'Trabajo en equipo',
  'Impacto en la comunidad',
] as const;

// Fase 1 — Canvas del Problema: las 4 tarjetas colaborativas (pregunta + icono).
export const CANVAS_CARDS = [
  { q: '¿Qué está pasando?', icon: '🔍' },
  { q: '¿A quiénes afecta?', icon: '👥' },
  { q: '¿Por qué es importante?', icon: '⭐' },
  { q: '¿Qué pasa si nadie lo resuelve?', icon: '⚠️' },
] as const;

// ¿Cumple la fase sus criterios automáticos para poder solicitar validación?
// Se refina por fase conforme se construyen las herramientas (tickets 3–8).
export function phaseCriteriaMet(phase: number, data: any, config: AbpPhaseConfig, memberIds: string[] = []): boolean {
  const n = memberIds.length || 1;
  if (phase === 1) {
    const canvas = Array.isArray(data?.canvas) ? data.canvas : [];
    const filled = canvas.filter((c: any) => c && String(c.value || '').trim()).length;
    return filled >= config.minCanvasCards;
  }
  if (phase === 2) {
    const ideas = Array.isArray(data?.ideas) ? data.ideas : [];
    const totalVotes = ideas.reduce((s: number, i: any) => s + (i.votes || 0), 0);
    return ideas.length >= config.minIdeasPerMember * n && totalVotes >= n;
  }
  if (phase === 3) {
    const smart = data?.smart || {};
    const checked = Array.isArray(smart.checks) ? smart.checks.filter(Boolean).length : 0;
    return checked >= config.smartCriteria && String(smart.text || '').trim().length >= config.minObjectiveLength;
  }
  if (phase === 4) {
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    if (tasks.length === 0) return false;
    const allDone = tasks.every((t: any) => t.col === 2);
    const owners = new Set(tasks.map((t: any) => t.owner).filter(Boolean));
    const everyoneHasTask = memberIds.length > 0 && memberIds.every(id => owners.has(id));
    return allDone && everyoneHasTask;
  }
  if (phase === 5) {
    const evidences = Array.isArray(data?.evidences) ? data.evidences : [];
    return evidences.length >= config.minEvidences;
  }
  return true; // fase 6: sin criterio automático (coevaluación, permisivo)
}

// Herramienta signature de cada fase (se convierte en la actividad de la misión por defecto).
export const PHASE_TOOL: Record<number, string> = {
  1: 'CANVAS', 2: 'IDEAS', 3: 'SMART', 4: 'KANBAN', 5: 'EVIDENCE', 6: 'COEVAL',
};

// Plantillas de misiones por fase (V1). La 1ª de cada fase es la misión-herramienta
// (Opción A). El docente puede editar/borrar/agregar; en V2 Valeria las genera por equipo.
export interface MissionTemplate { title: string; description?: string; required: boolean; tool?: string; activities?: { type: string; title: string }[] }
export const MISSION_TEMPLATES: Record<number, MissionTemplate[]> = {
  1: [
    { title: 'Comprender el problema', description: 'Completen el Canvas del Problema con sus 4 preguntas.', required: true, tool: 'CANVAS' },
    { title: 'Investigar el contexto', description: 'Salgan a recoger información real del problema.', required: false, activities: [{ type: 'READING', title: 'Leer una fuente sobre el tema' }, { type: 'UPLOAD', title: 'Subir una foto del problema en su entorno' }] },
  ],
  2: [{ title: 'Generar y priorizar ideas', description: 'Lluvia de ideas y votación en el muro.', required: true, tool: 'IDEAS' }],
  3: [{ title: 'Definir el objetivo', description: 'Redacten su objetivo SMART.', required: true, tool: 'SMART' }],
  4: [{ title: 'Planear las tareas', description: 'Repartan el trabajo en el tablero.', required: true, tool: 'KANBAN' }],
  5: [{ title: 'Construir y evidenciar', description: 'Suban las evidencias del prototipo.', required: true, tool: 'EVIDENCE' }],
  6: [{ title: 'Presentar y coevaluar', description: 'Presenten y evalúen a los demás equipos.', required: true, tool: 'COEVAL' }],
};

// ¿Está cumplido el criterio de la herramienta de una fase? (completa su actividad).
export function toolCriterionMet(phase: number, data: any, config: AbpPhaseConfig, memberIds: string[] = []): boolean {
  return phaseCriteriaMet(phase, data, config, memberIds);
}

// XP de equipo por evento (la barra denormalizada; el XP individual va por grantXp).
export const ABP_XP = {
  CANVAS_CARD: 10,
  IDEA: 15,
  VOTE: 5,
  TASK_DONE: 20,
  EVIDENCE: 15,
  DISCOVERY: 10,
  PHASE_VALIDATED: 50,
};
