import { extractJson } from '../../lib/extractJson'

/** Flujo "IA externa" de la evaluación formativa: Edusyn arma la petición, el docente la lleva a
 * la IA que prefiera y pega la respuesta. Nada se envía desde Edusyn, y la respuesta pasa por la
 * misma limpieza que el borrador de la IA interna (y luego por la validación del servidor). */

export type EvaluatorType = 'SELF' | 'PEER'
export interface DraftLevel { label: string; description: string; score: number }
export interface DraftCriterion { name: string; description: string; weight: number; levels: DraftLevel[] }
export interface DraftDimension { label: string; evaluatorType: EvaluatorType; peersPerStudent: number | null; evaluationComponentId: string | null; criteria: DraftCriterion[] }
export interface Draft { title: string; description: string; dimensions: DraftDimension[] }

export const TYPE_NAMES: Record<EvaluatorType, string> = { SELF: 'Autoevaluación', PEER: 'Coevaluación' }

export interface RubricPromptInput {
  purpose: string
  types: EvaluatorType[]
  minScore?: number
  maxScore?: number
  levels?: number
  criteriaPerDimension?: number
}

export function buildRubricPrompt(input: RubricPromptInput): string {
  const min = Number.isFinite(input.minScore) ? input.minScore! : 1
  const max = Number.isFinite(input.maxScore) ? input.maxScore! : 5
  const levels = Math.min(Math.max(input.levels || 4, 2), 7)
  const criteria = Math.min(Math.max(input.criteriaPerDimension || 4, 1), 8)
  const dims = input.types.map(t => `${TYPE_NAMES[t]} (evaluatorType "${t}")`)
  return [
    'Actúa como experto en evaluación formativa escolar. Diseña una rúbrica para que los estudiantes reflexionen sobre su proceso.',
    '',
    `Qué queremos evaluar: ${input.purpose.trim() || '[describe qué quieres evaluar]'}`,
    `Dimensiones (exactamente ${dims.length}): ${dims.join(', ')}.`,
    `- Cada dimensión tiene exactamente ${criteria} criterios y sus pesos (weight) suman 100.`,
    `- Cada criterio tiene exactamente ${levels} niveles con score creciente entre ${min} y ${max}.`,
    '- Los descriptores son claros, observables, respetuosos y escritos para que un estudiante los entienda.',
    '- SELF es cuando el estudiante se evalúa a sí mismo; PEER es cuando un compañero lo evalúa.',
    '- No diagnostiques ni uses etiquetas psicológicas. No incluyas nombres ni datos personales.',
    '',
    'Responde ÚNICAMENTE con un JSON válido, sin texto adicional, con este formato exacto:',
    '{"title":"...","description":"instrucciones breves para los estudiantes","dimensions":[{"label":"...","evaluatorType":"SELF","peersPerStudent":null,"criteria":[{"name":"...","description":"...","weight":25,"levels":[{"label":"...","description":"...","score":1}]}]}]}',
    'Para PEER, decide en "peersPerStudent" cuántos compañeros evalúa cada estudiante (entre 1 y 3) según lo que se evalúa:',
    '1 si es un trabajo en parejas, 2 en grupos pequeños y 3 si quieres más de una mirada sobre cada estudiante. Para SELF usa null.',
    'Edusyn reparte después quién evalúa a quién de forma equilibrada; el docente puede ajustarlo a mano antes de publicar.',
  ].join('\n')
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** Limpia un borrador (de la IA interna o pegado). Mismas reglas que el servidor: solo SELF/PEER,
 * criterios con nombre y al menos dos niveles con puntaje numérico. */
export function sanitizeDraft(raw: any): Draft {
  const dimensions = (Array.isArray(raw?.dimensions) ? raw.dimensions : []).map((d: any): DraftDimension => ({
    label: text(d?.label, 120),
    evaluatorType: d?.evaluatorType === 'PEER' ? 'PEER' : 'SELF',
    evaluationComponentId: null,
    peersPerStudent: d?.evaluatorType === 'PEER' ? Math.max(1, Math.min(Math.trunc(Number(d?.peersPerStudent)) || 2, 10)) : null,
    criteria: (Array.isArray(d?.criteria) ? d.criteria : []).map((c: any): DraftCriterion => ({
      name: text(c?.name, 160),
      description: text(c?.description, 600),
      weight: Number(c?.weight) || 0,
      levels: (Array.isArray(c?.levels) ? c.levels : [])
        .map((l: any): DraftLevel => ({ label: text(l?.label, 80), description: text(l?.description, 400), score: Number(l?.score) }))
        .filter((l: DraftLevel) => l.label && Number.isFinite(l.score)),
    })).filter((c: DraftCriterion) => c.name && c.levels.length >= 2),
  })).filter((d: DraftDimension) => d.label && d.criteria.length)
  return { title: text(raw?.title, 180) || 'Evaluación formativa', description: text(raw?.description, 1500), dimensions }
}

export type ParseResult = { draft: Draft } | { error: string }

export function parseRubricDraft(pasted: string): ParseResult {
  if (!pasted.trim()) return { error: 'Pega la respuesta de la IA.' }
  let raw: any
  try {
    raw = extractJson(pasted)
  } catch {
    return { error: 'No encontramos un JSON válido en la respuesta. Pídele a la IA que responda solo con el JSON.' }
  }
  if (!raw || typeof raw !== 'object') return { error: 'No encontramos un JSON válido en la respuesta. Pídele a la IA que responda solo con el JSON.' }
  const draft = sanitizeDraft(raw)
  if (!draft.dimensions.length) return { error: 'La respuesta no trae dimensiones con criterios y niveles. Revisa que la IA haya usado el formato pedido.' }
  return { draft }
}

export const weightSum = (d: DraftDimension) => d.criteria.reduce((n, c) => n + (Number(c.weight) || 0), 0)

export interface GradebookComponent { id: string; code: string; name: string }
export interface OpenTerm { id: string; name: string; status: string }

const LEVEL_NAMES: Record<number, string[]> = {
  2: ['Por mejorar', 'Logrado'],
  3: ['Inicial', 'En proceso', 'Logrado'],
  4: ['Inicial', 'En proceso', 'Logrado', 'Destacado'],
  5: ['Inicial', 'Básico', 'En proceso', 'Logrado', 'Destacado'],
}

/** Puntajes repartidos de forma pareja en la escala de la institución (redondeados a 0,1). */
export function levelScores(min: number, max: number, count: number): number[] {
  if (count < 2) return [max]
  return Array.from({ length: count }, (_, i) => Math.round((min + ((max - min) * i) / (count - 1)) * 10) / 10)
}

/** Pesos iguales que suman exactamente 100 (el resto va al último criterio). */
export function evenWeights(count: number): number[] {
  if (count < 1) return []
  const base = Math.floor(100 / count)
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? 100 - base * (count - 1) : base))
}

export function blankLevels(min = 1, max = 5, count = 4): DraftLevel[] {
  const names = LEVEL_NAMES[count] ?? LEVEL_NAMES[4]
  return levelScores(min, max, names.length).map((score, i) => ({ label: names[i], description: '', score }))
}

export function blankCriterion(min = 1, max = 5, weight = 100): DraftCriterion {
  return { name: '', description: '', weight, levels: blankLevels(min, max) }
}

export function blankDimension(type: EvaluatorType, min = 1, max = 5, criteria = 3): DraftDimension {
  const weights = evenWeights(criteria)
  return {
    label: TYPE_NAMES[type], evaluatorType: type, peersPerStudent: type === 'PEER' ? 2 : null, evaluationComponentId: null,
    criteria: weights.map(w => blankCriterion(min, max, w)),
  }
}

export function blankDraft(types: EvaluatorType[], min = 1, max = 5): Draft {
  return { title: '', description: '', dimensions: types.map(t => blankDimension(t, min, max)) }
}

/** Lo que falta para poder crear, en palabras del docente. Vacío si está listo. */
export function draftProblems(draft: Draft, termId: string): string[] {
  const problems: string[] = []
  if (!draft.title.trim()) problems.push('Escribe un título.')
  if (!termId) problems.push('Elige un período abierto.')
  if (!draft.dimensions.length) problems.push('Agrega al menos una dimensión.')
  draft.dimensions.forEach((d, i) => {
    const name = d.label.trim() || `Dimensión ${i + 1}`
    if (!d.label.trim()) problems.push(`La dimensión ${i + 1} necesita un nombre.`)
    if (!d.criteria.length) problems.push(`"${name}" necesita al menos un criterio.`)
    if (d.criteria.some(c => !c.name.trim())) problems.push(`Hay criterios sin nombre en "${name}".`)
    if (d.criteria.some(c => c.levels.length < 2 || c.levels.some(l => !l.label.trim() || !Number.isFinite(Number(l.score))))) problems.push(`Cada criterio de "${name}" necesita al menos dos niveles con nombre y puntaje.`)
    if (Math.abs(weightSum(d) - 100) > 0.01) problems.push(`Los pesos de "${name}" suman ${weightSum(d)}%; deben sumar 100%.`)
  })
  return problems
}
