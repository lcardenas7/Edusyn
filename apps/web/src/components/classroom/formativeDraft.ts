import { extractJson, IncompleteJsonError } from '../../lib/extractJson'

/** Flujo "IA externa" de la evaluación formativa: Edusyn arma la petición, el docente la lleva a
 * la IA que prefiera y pega la respuesta. Nada se envía desde Edusyn, y la respuesta pasa por la
 * misma limpieza que el borrador de la IA interna (y luego por la validación del servidor). */

export type EvaluatorType = 'SELF' | 'PEER'
export interface DraftLevel { label: string; description: string; score: number }
export interface DraftCriterion { name: string; description: string; weight: number; levels: DraftLevel[] }
export interface DraftDimension { label: string; evaluatorType: EvaluatorType; peersPerStudent: number | null; evaluationComponentId: string | null; criteria: DraftCriterion[] }
export interface Draft { title: string; description: string; dimensions: DraftDimension[] }

export const TYPE_NAMES: Record<EvaluatorType, string> = { SELF: 'Autoevaluación', PEER: 'Coevaluación' }

/** Cuántas preguntas puede pedir el docente por dimensión. */
export const QUESTION_COUNTS = [6, 10, 15, 20] as const
export const DEFAULT_QUESTIONS = 10

export interface RubricPromptInput {
  purpose: string
  types: EvaluatorType[]
  minScore?: number
  maxScore?: number
  levels?: number
  criteriaPerDimension?: number
  /** Aspectos elegidos por el docente, en orden. Si hay, la IA los usa tal cual. */
  aspects?: string[]
  perAspect?: number
  /** Con autoevaluación y coevaluación: la coevaluación repite las mismas preguntas, dirigidas al compañero. */
  mirrorPeer?: boolean
}

export function buildRubricPrompt(input: RubricPromptInput): string {
  const min = Number.isFinite(input.minScore) ? input.minScore! : 1
  const max = Number.isFinite(input.maxScore) ? input.maxScore! : 5
  const levels = Math.min(Math.max(input.levels || 4, 2), 7)
  const criteria = Math.min(Math.max(input.criteriaPerDimension || DEFAULT_QUESTIONS, 1), 30)
  const aspectCount = Math.max(2, Math.min(6, Math.round(criteria / 3)))
  const chosen = (input.aspects || []).map(a => a.trim()).filter(Boolean)
  const perAspect = Math.min(Math.max(input.perAspect || 2, 1), 5)
  const hasPeer = input.types.includes('PEER')
  const dims = input.types.map(t => `${TYPE_NAMES[t]} (evaluatorType "${t}")`)
  return [
    'Actúa como experto en evaluación formativa escolar. Diseña una rúbrica para que los estudiantes reflexionen sobre su proceso.',
    '',
    `Qué queremos evaluar: ${input.purpose.trim() || '[describe qué quieres evaluar]'}`,
    `Dimensiones (exactamente ${dims.length}): ${dims.join(', ')}.`,
    chosen.length
      ? `- Cada dimensión es un cuestionario de exactamente ${chosen.length * perAspect} preguntas (criteria): ${perAspect} por cada uno de estos aspectos, en este orden: ${chosen.join('; ')}. Usa esos nombres de aspecto tal cual.`
      : `- Cada dimensión es un cuestionario de exactamente ${criteria} preguntas (criteria), agrupadas en ${aspectCount} aspectos distintos (p. ej. responsabilidad, colaboración, comunicación, respeto) con varias preguntas cada uno.`,
    '- En cada pregunta, "name" es el aspecto (igual en todas las preguntas de ese aspecto, y esas preguntas van seguidas) y "description" es la pregunta o afirmación concreta que lee el estudiante.',
    '- Usa el mismo "weight" en todas las preguntas; Edusyn lo ajusta para que sumen 100.',
    `- Cada pregunta tiene exactamente ${levels} niveles con score creciente entre ${min} y ${max}, con las mismas etiquetas en todas las preguntas y descripciones breves (máximo 12 palabras).`,
    '- Los descriptores son claros, observables, respetuosos y escritos para que un estudiante los entienda.',
    '- SELF es cuando el estudiante se evalúa a sí mismo; PEER es cuando un compañero lo evalúa.',
    '- Quien responde es siempre un estudiante. En SELF escribe criterios y niveles en primera persona ("Cumplí con mi parte a tiempo").',
    '- En PEER escríbelos en tercera persona sobre el compañero evaluado ("Mi compañero cumplió con su parte a tiempo"), nunca en primera persona.',
    '- No diagnostiques ni uses etiquetas psicológicas. No incluyas nombres ni datos personales.',
    ...(hasPeer ? [
      '',
      'IMPORTANTE sobre la coevaluación (PEER): quien lee estas preguntas es un estudiante que está evaluando a OTRO compañero.',
      'Cada pregunta y cada nivel deben hablar del compañero evaluado, nunca de quien responde. No uses "yo", "me", "mi trabajo" ni verbos en primera persona.',
      'Correcto: "Mi compañero entregó su parte a tiempo." / "Escuchó las ideas del equipo."  Incorrecto: "Entregué mi parte a tiempo." / "Escuché las ideas del equipo."',
      'Aunque evalúen los mismos aspectos que la autoevaluación, reescribe las preguntas de la coevaluación sobre el compañero.',
      ...(input.types.includes('SELF') ? [input.mirrorPeer
        ? 'Preguntas relacionadas: la coevaluación tiene EXACTAMENTE las mismas preguntas que la autoevaluación, en el mismo orden y con los mismos aspectos y niveles, pero cada una reescrita sobre el compañero (pregunta 1 de la autoevaluación = pregunta 1 de la coevaluación sobre el compañero).'
        : 'Preguntas independientes: la coevaluación tiene sus propias preguntas, pensadas para observar a un compañero; no repitas las de la autoevaluación.'] : []),
    ] : []),
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
    // La IA suele fallar al repartir pesos entre muchas preguntas: si no suman 100, valen igual.
    .map((d: DraftDimension) => Math.abs(weightSum(d) - 100) < 0.01 && d.criteria.every(c => Number.isInteger(c.weight)) ? d : { ...d, criteria: d.criteria.map((c, i, all) => ({ ...c, weight: evenWeights(all.length)[i] })) })
  return { title: text(raw?.title, 180) || 'Evaluación formativa', description: text(raw?.description, 1500), dimensions }
}

export type ParseResult = { draft: Draft } | { error: string }

export function parseRubricDraft(pasted: string): ParseResult {
  if (!pasted.trim()) return { error: 'Pega la respuesta de la IA.' }
  let raw: any
  try {
    raw = extractJson(pasted)
  } catch (e) {
    if (e instanceof IncompleteJsonError) return { error: e.message }
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

/** Pesos enteros lo más parejos posible que suman exactamente 100. El sobrante se reparte de a
 * un punto a lo largo de la lista: con 28 preguntas quedan 16 de 4% y 12 de 3%, no 27 de 3% y
 * una sola de 19% que pesaría seis veces más que las demás. */
export function evenWeights(count: number): number[] {
  if (count < 1) return []
  const base = Math.floor(100 / count)
  const extra = 100 - base * count
  return Array.from({ length: count }, (_, i) => base + (Math.floor(((i + 1) * extra) / count) - Math.floor((i * extra) / count)))
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
  for (const type of ['SELF', 'PEER'] as EvaluatorType[]) {
    if (draft.dimensions.filter(d => d.evaluatorType === type).length > 1) problems.push(`Deja una sola ${TYPE_NAMES[type].toLowerCase()}: junta sus preguntas en una.`)
  }
  draft.dimensions.forEach((d, i) => {
    const name = d.label.trim() || `Dimensión ${i + 1}`
    if (!d.label.trim()) problems.push(`La dimensión ${i + 1} necesita un nombre.`)
    if (!d.criteria.length) problems.push(`"${name}" necesita al menos una pregunta.`)
    if (d.criteria.some(c => !c.name.trim())) problems.push(`Hay preguntas sin aspecto en "${name}".`)
    if (d.criteria.some(c => !c.description.trim())) problems.push(`Escribe la frase que lee el estudiante en cada pregunta de "${name}".`)
    if (d.criteria.some(c => c.levels.length < 2 || c.levels.some(l => !l.label.trim() || !Number.isFinite(Number(l.score))))) problems.push(`Cada pregunta de "${name}" necesita al menos dos respuestas con nombre y puntaje.`)
    if (Math.abs(weightSum(d) - 100) > 0.01) problems.push(`Los pesos de "${name}" suman ${weightSum(d)}%; deben sumar 100%.`)
  })
  return problems
}

/** Ejemplos de cómo se escribe una pregunta según quién la responde. */
export const PERSON_HINT: Record<EvaluatorType, { who: string; statement: string; level: string }> = {
  SELF: { who: 'Cada estudiante responde sobre sí mismo.', statement: 'Ej.: Cumplí con mi parte del trabajo a tiempo.', level: 'Ej.: Entregué mi parte completa y a tiempo.' },
  PEER: { who: 'Cada estudiante responde sobre sus compañeros.', statement: 'Ej.: Mi compañero cumplió con su parte del trabajo a tiempo.', level: 'Ej.: Entregó su parte completa y a tiempo.' },
}

export const hasEvenWeights = (d: DraftDimension) => {
  const even = evenWeights(d.criteria.length)
  return d.criteria.every((c, i) => Number(c.weight) === even[i])
}

/** Una dimensión nueva a partir de otra de distinto tipo: conserva los aspectos (títulos, pesos y
 * puntajes) pero deja en blanco las frases, porque una autoevaluación habla en primera persona y
 * una coevaluación habla del compañero. */
export function starterFrom(base: DraftDimension, type: EvaluatorType, min = 1, max = 5): DraftDimension {
  const fresh = blankDimension(type, min, max)
  if (!base.criteria.length) return fresh
  return {
    ...fresh,
    criteria: base.criteria.map(c => ({ name: c.name, description: '', weight: c.weight, levels: c.levels.map(l => ({ label: l.label, description: '', score: l.score })) })),
  }
}

/** Convierte una evaluación guardada (con las rúbricas congeladas) en un borrador editable. */
export function draftFromSaved(saved: any): Draft {
  return sanitizeDraft({
    title: saved?.title,
    description: saved?.description ?? '',
    dimensions: (saved?.dimensions || []).map((d: any) => ({
      label: d.label,
      evaluatorType: d.evaluatorType,
      peersPerStudent: d.peersPerStudent,
      criteria: (d.rubricSnapshot?.criteria || []).map((c: any) => ({
        name: c.name, description: c.description ?? '', weight: Number(c.weight),
        levels: (c.levels || []).map((l: any) => ({ label: l.label, description: l.description ?? '', score: Number(l.score) })),
      })),
    })),
  })
}

/** Agrupa las preguntas seguidas que comparten aspecto, para mostrarlas como un cuestionario. */
export function groupByAspect<T extends { name: string }>(criteria: T[]): Array<{ aspect: string; items: Array<{ criterion: T; index: number }> }> {
  const groups: Array<{ aspect: string; items: Array<{ criterion: T; index: number }> }> = []
  criteria.forEach((criterion, index) => {
    const aspect = criterion.name.trim()
    const last = groups[groups.length - 1]
    if (last && last.aspect.toLowerCase() === aspect.toLowerCase()) last.items.push({ criterion, index })
    else groups.push({ aspect, items: [{ criterion, index }] })
  })
  return groups
}
