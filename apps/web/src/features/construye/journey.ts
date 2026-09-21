import type { ConstruyeBuildGate, ConstruyeTeamBrief, ConstruyeTeamDetail, ConstruyeVersionEvidence } from '../../lib/api/construye'
import type { PreviewProject } from './protocol'

/** Recorrido pedagógico de Edusyn Crea. Todo aquí es puro: decide el estado de cada fase y
 * arma las peticiones para la IA externa SOLO con lo que el equipo escribió. Nunca incluye
 * nombres, institución ni datos académicos. */

export type JourneyPhaseKey = 'problem' | 'solution' | 'plan' | 'build' | 'share'
export type BriefPhaseKey = Exclude<JourneyPhaseKey, 'build'>
export type JourneyPhaseState = 'pending' | 'started' | 'done'
export type BriefField = Exclude<keyof ConstruyeTeamBrief, 'grade'>

export const EMPTY_BRIEF: ConstruyeTeamBrief = {
  problem: '', affected: '', whyItMatters: '',
  solution: '', audience: '', screens: '', subject: '', grade: '8.º', style: 'Claro, accesible y juvenil',
  features: '', later: '', successCheck: '',
  sharePitch: '', reflection: '',
}

/** Completa un brief guardado (incluidos los de antes del recorrido) con los campos que le
 * falten, sin alterar lo que el equipo ya escribió. */
export function normalizeBrief(brief: Partial<ConstruyeTeamBrief> | null | undefined): ConstruyeTeamBrief {
  return { ...EMPTY_BRIEF, ...(brief ?? {}) }
}

const MIN_TEXT = 3
const filled = (value: string | undefined) => (value ?? '').trim().length >= MIN_TEXT

export const PHASE_FIELDS: Record<BriefPhaseKey, { required: BriefField[]; optional: BriefField[] }> = {
  problem: { required: ['problem', 'affected'], optional: ['whyItMatters'] },
  solution: { required: ['solution', 'audience'], optional: ['screens', 'subject'] },
  plan: { required: ['features', 'successCheck'], optional: ['later', 'style'] },
  share: { required: ['sharePitch', 'reflection'], optional: [] },
}

export function phaseState(phase: BriefPhaseKey, brief: ConstruyeTeamBrief): JourneyPhaseState {
  const { required, optional } = PHASE_FIELDS[phase]
  if (required.every(field => filled(brief[field]))) return 'done'
  // El estilo trae un valor por defecto: no cuenta como "empezaron" la fase.
  return [...required, ...optional].some(field => field !== 'style' && filled(brief[field])) ? 'started' : 'pending'
}

export function buildPhaseState(versionCount: number, hasCode: boolean): JourneyPhaseState {
  if (versionCount > 0) return 'done'
  return hasCode ? 'started' : 'pending'
}

/** La primera fase que el equipo todavía no ha completado: por ahí se abre el recorrido. */
export function firstOpenPhase(brief: ConstruyeTeamBrief, versionCount: number): JourneyPhaseKey {
  if (versionCount > 0) return 'build'
  for (const phase of ['problem', 'solution', 'plan'] as const) {
    if (phaseState(phase, brief) !== 'done') return phase
  }
  return 'build'
}

/** Los cuatro momentos del estudio de Crea: documentar la idea, preparar la petición para la
 * IA (se puede omitir), construir en el taller de código y presentar lo hecho. */
export type StudioMode = 'document' | 'prompt' | 'code' | 'share'
export const DOCUMENT_PHASES = ['problem', 'solution', 'plan'] as const

/** Etapas de documentación listas (problema, solución, plan). */
export function documentationProgress(brief: ConstruyeTeamBrief): { done: number; total: number } {
  return { done: DOCUMENT_PHASES.filter(phase => phaseState(phase, brief) === 'done').length, total: DOCUMENT_PHASES.length }
}

/** La etapa de documentación por la que conviene seguir: la primera que no está lista. */
export function nextDocumentPhase(brief: ConstruyeTeamBrief): BriefPhaseKey {
  return DOCUMENT_PHASES.find(phase => phaseState(phase, brief) !== 'done') ?? 'plan'
}

/** Dónde abrir el estudio: quien ya tiene código vuelve al taller; quien terminó de documentar
 * pasa a la petición (o al código si la omitió); si no, sigue documentando. */
export function initialStudioMode(brief: ConstruyeTeamBrief, versionCount: number, promptSkipped: boolean): StudioMode {
  if (versionCount > 0) return 'code'
  if (promptReady(brief)) return promptSkipped ? 'code' : 'prompt'
  return 'document'
}

/** El prompt inicial aparece cuando existe un plan de versión 1 (qué tendrá y cómo probarla). */
export function promptReady(brief: ConstruyeTeamBrief): boolean {
  return phaseState('plan', brief) === 'done' && filled(brief.problem)
}

export const GATE_MISSING_LABEL: Record<ConstruyeBuildGate['missing'][number], string> = {
  problem: 'qué problema quieren resolver (fase 1)',
  features: 'qué tendrá la versión 1 (fase 3)',
  successCheck: 'cómo sabrán que funciona (fase 3)',
}

/** Mismo criterio que el servidor (`buildGate` en construye.service.ts), para explicar la
 * condición antes de intentar guardar. El servidor sigue siendo quien decide. */
export function localGate(brief: ConstruyeTeamBrief, versionCount: number, unlockedByTeacher: boolean): ConstruyeBuildGate {
  const missing = (['problem', 'features', 'successCheck'] as const).filter(field => !filled(brief[field]))
  const hasVersions = versionCount > 0
  return { canSaveFirstVersion: hasVersions || unlockedByTeacher || missing.length === 0, unlockedByTeacher, hasVersions, missing: [...missing] }
}

const orPlaceholder = (value: string, placeholder: string) => value.trim() || placeholder
// Una decisión opcional que el equipo no escribió se omite: un marcador vacío invita a la IA a
// inventarla. Las obligatorias sí llevan marcador, para que se note lo que falta.
const optionalLine = (label: string, value: string) => (value.trim() ? [`- ${label}: ${value.trim()}`] : [])

export function initialPrompt(brief: ConstruyeTeamBrief): string {
  return [
    'Actúa como una guía de programación para estudiantes de colegio. Queremos construir, paso a paso, una primera versión pequeña de una página web.',
    '',
    'El problema',
    `- Qué ocurre: ${orPlaceholder(brief.problem, '[qué ocurre]')}`,
    `- A quién afecta: ${orPlaceholder(brief.affected, '[a quién afecta]')}`,
    ...optionalLine('Por qué importa', brief.whyItMatters),
    '',
    'La solución que imaginamos',
    `- Qué hará y cómo ayuda: ${orPlaceholder(brief.solution, '[qué hará]')}`,
    `- Quién la usará: ${orPlaceholder(brief.audience, '[quién la usará]')}`,
    ...optionalLine('Cómo se vería (pantallas y acciones)', brief.screens),
    ...optionalLine('Área o asignatura', brief.subject),
    `- Estilo visual: ${orPlaceholder(brief.style, 'claro y accesible')}`,
    '',
    'Plan de la versión 1',
    `- Debe tener SOLO esto: ${orPlaceholder(brief.features, '[qué tendrá la versión 1]')}`,
    ...optionalLine('Queda para después (no lo hagas todavía)', brief.later),
    `- Así comprobaremos que funciona: ${orPlaceholder(brief.successCheck, '[cómo lo comprobaremos]')}`,
    '',
    'Entrega únicamente tres archivos completos y separados: index.html, styles.css y app.js. No uses React, npm, paquetes, enlaces externos, llamadas a internet, cuentas, anuncios, APIs, iframes ni datos personales. La app se verá sobre todo en un celular (360 a 420 píxeles de ancho): letra base de 16px, títulos moderados y nada de anchos fijos grandes. Para íconos, usa SVG pequeños dentro de index.html.',
    '',
    'Después del código, explícanos con palabras sencillas qué hace cada archivo y qué parte del código cumple cada punto del plan, para que podamos entenderlo y explicarlo. Si falta una decisión importante, pregúntanos antes (máximo tres preguntas).',
  ].join('\n')
}

export interface ChangeRequest {
  change: string
  reason: string
  keep: string
  check: string
}

export const EMPTY_CHANGE_REQUEST: ChangeRequest = { change: '', reason: '', keep: '', check: '' }

export function changeRequestReady(request: ChangeRequest): boolean {
  return filled(request.change) && filled(request.check)
}

export function changePrompt(request: ChangeRequest, brief: ConstruyeTeamBrief, project: PreviewProject | null): string {
  const context = brief.solution.trim() || brief.problem.trim()
  const lines = [
    'Actúa como una guía de programación para estudiantes. Tenemos una página web hecha con tres archivos (index.html, styles.css y app.js) y queremos mejorarla con un cambio concreto.',
    '',
    ...(context ? [`De qué trata nuestra app: ${context}`, ''] : []),
    `Qué queremos cambiar o agregar: ${request.change.trim()}`,
    `Por qué: ${orPlaceholder(request.reason, '[por qué]')}`,
    `Qué debe seguir igual: ${orPlaceholder(request.keep, 'todo lo que ya funciona')}`,
    `Así sabremos que salió bien: ${request.check.trim()}`,
    '',
    'Haz solo ese cambio. Devuelve completos únicamente los archivos que cambien y explica en palabras sencillas qué modificaste y dónde, para que podamos entenderlo. Sin librerías, enlaces externos, llamadas a internet ni datos personales.',
  ]
  if (project) {
    lines.push('', 'Nuestro código actual:', '', '--- index.html ---', project.html, '', '--- styles.css ---', project.css, '', '--- app.js ---', project.js)
  }
  return lines.join('\n')
}

export interface VersionEvidenceInput {
  attempted: string
  tested: string
  learned: string
  /** "Explicar antes de pegar": una parte del código que el equipo puede ubicar y explicar. */
  explained: string
  peerFeedback: string
}

export const EMPTY_EVIDENCE: VersionEvidenceInput = { attempted: '', tested: '', learned: '', explained: '', peerFeedback: '' }

export function evidenceReady(evidence: VersionEvidenceInput): boolean {
  return filled(evidence.attempted) && filled(evidence.tested) && filled(evidence.explained)
}

export const SESSION_MET_LABEL: Record<'yes' | 'partly' | 'no', string> = { yes: 'Sí', partly: 'En parte', no: 'No' }

/** Notas de sesión de HOY (hora de Colombia), la más reciente primero. */
export function todaySessionNotes<T extends { type: string; createdAt: string; detail?: unknown }>(journal: T[], today: string, dayOf: (iso: string) => string): T[] {
  return journal.filter(entry => entry.type === 'SESSION_NOTE' && dayOf(entry.createdAt) === today)
}

/** Evidencia de cada versión, tomada de su entrada VERSION_CREATED en la bitácora. */
export function evidenceByVersion(journal: ConstruyeTeamDetail['journal']): Map<string, ConstruyeVersionEvidence> {
  const result = new Map<string, ConstruyeVersionEvidence>()
  for (const entry of journal) {
    if (entry.type !== 'VERSION_CREATED' || !entry.detail || typeof entry.detail !== 'object') continue
    const detail = entry.detail as { versionId?: unknown; evidence?: ConstruyeVersionEvidence }
    if (typeof detail.versionId === 'string' && detail.evidence) result.set(detail.versionId, detail.evidence)
  }
  return result
}
