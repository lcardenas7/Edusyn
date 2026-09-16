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
    'Para PEER, usa "peersPerStudent": 2 (cuántos compañeros evalúa cada estudiante).',
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
