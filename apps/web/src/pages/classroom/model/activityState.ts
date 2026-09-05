/**
 * Derivación de estado de una actividad. **Lógica pura, sin React.**
 *
 * Por qué vive aquí y no en la vista (docs/REDISENO_AULA_VIRTUAL.md §4): hoy esta lógica está
 * enterrada dentro de `getWorkInfo` / `getStudentTaskStatus` en un archivo de 7110 líneas, es
 * imposible de probar y produce dos verdades distintas para la misma actividad (el borde de
 * color dice una cosa y el badge otra). Aquí hay UNA verdad y está cubierta por pruebas.
 *
 * Todas las comparaciones de "día" se hacen en hora de pared de Colombia (UTC-5), no en la del
 * dispositivo: un estudiante con el celular mal configurado no debe ver "vencida" una tarea que
 * todavía tiene abierta. Ver `lib/datetime.ts`.
 */

import type { StudentState, TeacherState } from './labels'

export const BOGOTA_TZ = 'America/Bogota'

/** El mínimo que necesita esta capa. Compatible con `Activity` de Classroom.tsx. */
export interface ActivityLike {
  id: string
  type: string
  title: string
  description?: string
  maxScore?: number
  dueDate?: string | null
  openDate?: string | null
  isPublished: boolean
  publishedAt?: string | null
  scheduledPublishAt?: string | null
  createdAt?: string
  academicTermId?: string | null
  section?: { id: string; title: string; academicTermId?: string | null } | null
  /** Entregas SUBMITTED/LATE pendientes de nota (solo llega en el payload docente). */
  gradingPending?: number
  _count?: { submissions?: number } | null
  /** En el payload del estudiante viene su propia entrega (una sola). */
  submissions?: {
    status: string
    score?: number | null
    submittedAt?: string | null
    attemptNumber?: number
  }[]
  /** Candado por prerrequisitos. El backend es autoritativo; la UI solo pinta. */
  locked?: boolean
  metadata?: { gameType?: string; maxAttempts?: number; audioResponse?: boolean } | null
}

// ─── Tiempo, anclado a Colombia ──────────────────────────────────────────────

/** "YYYY-MM-DD" del día de pared en Bogotá. Devuelve null si la fecha no es válida. */
export function bogotaDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('sv-SE', { timeZone: BOGOTA_TZ }).slice(0, 10)
}

/** ¿Las dos fechas caen el mismo día en Colombia? */
export function sameBogotaDay(a: string | Date | null | undefined, b: string | Date | null | undefined): boolean {
  const ka = bogotaDayKey(a)
  const kb = bogotaDayKey(b)
  return ka !== null && ka === kb
}

const HOUR = 60 * 60 * 1000
/** Ventana de "vence pronto": dos días. */
export const DUE_SOON_MS = 48 * HOUR

function time(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

// ─── Estado del estudiante ───────────────────────────────────────────────────

const SUBMITTED_STATES = new Set(['SUBMITTED', 'LATE'])
const GRADED_STATES = new Set(['GRADED', 'AUTO_GRADED'])

export interface StudentView {
  state: StudentState
  /** Para ordenar: 0 = lo que más exige actuar. */
  urgency: number
  /** Nota obtenida, si ya la tiene. */
  score: number | null
  /** Tiene un borrador sin enviar aunque el estado principal sea otro (p. ej. "vencida"). */
  hasDraft: boolean
  /** Intento en curso / máximo, cuando el tipo los usa. */
  attempt: { current: number; max: number } | null
  entregadaEn: string | null
}

/**
 * Precedencia deliberada: primero lo que el estudiante NO puede cambiar (bloqueada, aún no
 * abre), luego lo que le exige actuar (devuelta, vencida), luego lo cerrado.
 * Una entrega devuelta gana sobre una calificada: significa "vuelve a mirarlo".
 */
export function deriveStudentState(a: ActivityLike, now: Date = new Date()): StudentView {
  const sub = a.submissions?.[0]
  const status = sub?.status
  const score = sub?.score ?? null
  const hasDraft = status === 'DRAFT'
  const maxAttempts = a.metadata?.maxAttempts
  const attempt =
    maxAttempts && maxAttempts > 1
      ? { current: sub?.attemptNumber ?? 0, max: maxAttempts }
      : null
  const base = { score, hasDraft, attempt, entregadaEn: sub?.submittedAt ?? null }

  if (a.locked) return { state: 'bloqueada', urgency: 90, ...base }
  if (status === 'RETURNED') return { state: 'devuelta', urgency: 1, ...base }
  if (status && GRADED_STATES.has(status)) return { state: 'calificada', urgency: 80, ...base }
  if (status && SUBMITTED_STATES.has(status)) return { state: 'entregada', urgency: 70, ...base }

  const open = time(a.openDate)
  if (open !== null && now.getTime() < open) return { state: 'no-abierta', urgency: 85, ...base }

  const due = time(a.dueDate)
  if (due !== null) {
    if (now.getTime() > due) return { state: 'vencida', urgency: 0, ...base }
    if (sameBogotaDay(a.dueDate, now)) return { state: 'vence-hoy', urgency: 2, ...base }
    if (due - now.getTime() < DUE_SOON_MS) return { state: 'vence-pronto', urgency: 3, ...base }
  }

  if (hasDraft) return { state: 'en-borrador', urgency: 4, ...base }
  return { state: 'pendiente', urgency: 10, ...base }
}

// ─── Estado del docente ──────────────────────────────────────────────────────

export interface TeacherView {
  state: TeacherState
  urgency: number
  porCalificar: number
  entregas: number
  /** Fecha en que se publicará sola, si está programada. */
  seProgramaPara: string | null
}

/**
 * El docente ve el estado de la ACTIVIDAD, no el de una entrega. Precedencia: primero lo que
 * bloquea a los estudiantes (no publicada), luego lo que exige su trabajo (calificar), luego el
 * calendario.
 */
export function deriveTeacherState(a: ActivityLike, now: Date = new Date()): TeacherView {
  const porCalificar = a.gradingPending ?? 0
  const entregas = a._count?.submissions ?? 0
  const programada = time(a.scheduledPublishAt)
  const base = { porCalificar, entregas, seProgramaPara: a.scheduledPublishAt ?? null }

  if (!a.isPublished) {
    if (programada !== null && programada > now.getTime()) {
      return { state: 'programada', urgency: 30, ...base }
    }
    return { state: 'borrador', urgency: 40, seProgramaPara: null, porCalificar, entregas }
  }

  if (porCalificar > 0) return { state: 'por-calificar', urgency: 0, ...base }

  const due = time(a.dueDate)
  if (due !== null) {
    if (sameBogotaDay(a.dueDate, now)) return { state: 'vence-hoy', urgency: 1, ...base }
    if (now.getTime() > due && entregas === 0) {
      return { state: 'vencida-sin-entregas', urgency: 2, ...base }
    }
  }

  return { state: 'publicada', urgency: 50, ...base }
}

// ─── Período ─────────────────────────────────────────────────────────────────

/**
 * Período de una actividad: el suyo propio si lo tiene, si no el de su sección.
 * `null` = sin período. La copia de actividades produce estas huérfanas (defecto P0-1); la UI
 * debe poder mostrarlas, no esconderlas en una pestaña aparte.
 */
export function periodIdOf(a: ActivityLike): string | null {
  return a.academicTermId ?? a.section?.academicTermId ?? null
}

// ─── Búsqueda y filtros ──────────────────────────────────────────────────────

/** Normaliza para buscar sin tildes ni mayúsculas: "leccion" encuentra "Lección". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Busca en el título, la sección y la descripción. Todos los términos deben aparecer. */
export function matchesSearch(a: ActivityLike, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const haystack = normalize([a.title, a.section?.title ?? '', a.description ?? ''].join(' '))
  return q.split(/\s+/).every((term) => haystack.includes(term))
}

// ─── Orden ───────────────────────────────────────────────────────────────────

/**
 * Orden estable: primero lo que exige acción (urgencia), y dentro de la misma urgencia lo que
 * vence antes. Sin fecha va al final del grupo. El desempate por título evita que la lista
 * baile entre renders.
 */
export function compareByUrgency(
  ua: { urgency: number },
  a: ActivityLike,
  ub: { urgency: number },
  b: ActivityLike,
): number {
  if (ua.urgency !== ub.urgency) return ua.urgency - ub.urgency
  const da = a.dueDate ?? '9999-12-31'
  const db = b.dueDate ?? '9999-12-31'
  if (da !== db) return da < db ? -1 : 1
  return a.title.localeCompare(b.title, 'es')
}
