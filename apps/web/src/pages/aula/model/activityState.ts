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
  /** También `Decimal`: llega como texto. Usar `aNumero`. */
  maxScore?: number | string
  dueDate?: string | null
  openDate?: string | null
  /** ¿El docente acepta entregas después de la fecha límite? */
  allowLateSubmit?: boolean
  isPublished: boolean
  publishedAt?: string | null
  scheduledPublishAt?: string | null
  createdAt?: string
  academicTermId?: string | null
  /** Donde el docente la dejó dentro de la unidad. */
  sortOrder?: number
  section?: { id: string; title: string; academicTermId?: string | null } | null
  /** Entregas SUBMITTED/LATE pendientes de nota (solo llega en el payload docente). */
  gradingPending?: number
  _count?: { submissions?: number } | null
  /** En el payload del estudiante viene su propia entrega (una sola). */
  submissions?: {
    status: string
    /**
     * Ojo: el backend guarda las notas como `Decimal` de Prisma y **se serializan como
     * texto**. Nunca se use sin pasar por `aNumero`: `"4.2".toFixed(1)` revienta y deja la
     * pantalla en blanco. Pasó con datos reales.
     */
    score?: number | string | null
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

/**
 * Convierte a número lo que el backend manda como `Decimal` (texto). Devuelve `null` ante
 * cualquier cosa que no sea un número de verdad, en vez de propagar un `NaN` que luego se
 * pinta como "NaN" en la pantalla del estudiante.
 */
export function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

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
  /**
   * Cómo desempatar dentro de la misma urgencia. Casi siempre `asc` (lo que vence antes va
   * antes); en lo ya vencido es `desc`, porque lo que acaba de vencer todavía se puede
   * recuperar hablando con el profe y lo de hace un mes ya no.
   */
  tieBreak?: 'asc' | 'desc'
  /** Nota obtenida, si ya la tiene. */
  score: number | null
  /** Tiene un borrador sin enviar aunque el estado principal sea otro (p. ej. "vencida"). */
  hasDraft: boolean
  /** Intento en curso / máximo, cuando el tipo los usa. */
  attempt: { current: number; max: number } | null
  entregadaEn: string | null
}

/**
 * Precedencia deliberada. El criterio de orden es **qué puede ganar todavía**, no qué está
 * peor: a un estudiante no le sirve que lo primero que vea sea un taller que venció hace una
 * semana, porque no puede viajar en el tiempo, y además desmoraliza. Así que primero lo que
 * el profe está esperando, luego lo que todavía alcanza a entregar, y al final el control de
 * daños.
 *
 * Una entrega devuelta gana sobre todo lo demás: el docente ya la revisó y espera respuesta.
 */
export function deriveStudentState(a: ActivityLike, now: Date = new Date()): StudentView {
  const sub = a.submissions?.[0]
  const status = sub?.status
  // El backend manda `Decimal` como texto: sin esto, `score.toFixed()` rompe la vista.
  const score = aNumero(sub?.score)
  const hasDraft = status === 'DRAFT'
  const maxAttempts = a.metadata?.maxAttempts
  const attempt =
    maxAttempts && maxAttempts > 1
      ? { current: sub?.attemptNumber ?? 0, max: maxAttempts }
      : null
  const base = { score, hasDraft, attempt, entregadaEn: sub?.submittedAt ?? null }

  if (a.locked) return { state: 'bloqueada', urgency: 90, ...base }
  if (status === 'RETURNED') return { state: 'devuelta', urgency: 0, ...base }
  if (status && GRADED_STATES.has(status)) return { state: 'calificada', urgency: 80, ...base }
  if (status && SUBMITTED_STATES.has(status)) return { state: 'entregada', urgency: 70, ...base }

  const open = time(a.openDate)
  if (open !== null && now.getTime() < open) return { state: 'no-abierta', urgency: 85, ...base }

  const due = time(a.dueDate)
  if (due !== null) {
    // Lo vencido va DESPUÉS de lo que todavía se alcanza a entregar, y entre lo vencido va
    // primero lo más reciente: eso sí se puede recuperar.
    if (now.getTime() > due) return { state: 'vencida', urgency: 4, tieBreak: 'desc', ...base }
    if (sameBogotaDay(a.dueDate, now)) return { state: 'vence-hoy', urgency: 1, ...base }
    if (due - now.getTime() < DUE_SOON_MS) return { state: 'vence-pronto', urgency: 2, ...base }
  }

  if (hasDraft) return { state: 'en-borrador', urgency: 3, ...base }
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

/**
 * ¿Puede este rol ver la actividad?
 *
 * El backend ya filtra los borradores del payload del estudiante, pero la UI no debe
 * depender de eso: si alguna vez llega una actividad sin publicar, el estudiante vería un
 * examen futuro anunciado como "Pendiente". Una segunda cerradura no sobra cuando lo que
 * está en juego es que un estudiante vea un examen antes de tiempo.
 */
export function isVisibleTo(role: 'docente' | 'estudiante', a: ActivityLike): boolean {
  if (role === 'docente') return true
  return a.isPublished === true
}

// ─── Preguntas independientes sobre una actividad ────────────────────────────
//
// El docente hace preguntas que SE SOLAPAN: una actividad puede a la vez vencer hoy y tener
// entregas esperando nota. El estado de la tarjeta es excluyente (muestra una sola cosa), así
// que derivar de él los paneles y los chips producía mentiras — el tablero llegó a decir
// "Nada se cierra hoy" mientras el estudiante veía "Vence hoy a las 5:00 p. m." de esa misma
// actividad. La auditoría ya advertía este solapamiento (hallazgo C5).
//
// Estos predicados son la única fuente para los paneles de "Hoy" y para los chips de filtro,
// para que los dos sitios no puedan discrepar.

/** ¿Se cierra hoy para los estudiantes? Un borrador no cuenta: ni lo ven. */
export function venceHoy(a: ActivityLike, now: Date = new Date()): boolean {
  return a.isPublished === true && sameBogotaDay(a.dueDate, now)
}

/** ¿Ya venció (en un día anterior) y no entregó nadie? */
export function vencioSinEntregas(a: ActivityLike, now: Date = new Date()): boolean {
  if (!a.isPublished || !a.dueDate) return false
  const due = time(a.dueDate)
  if (due === null || due >= now.getTime()) return false
  // Lo que vence hoy todavía tiene horas por delante: no es "desierta" aún.
  if (sameBogotaDay(a.dueDate, now)) return false
  return (a._count?.submissions ?? 0) === 0
}

/** ¿Hay entregas esperando nota? */
export function tieneEntregasPorCalificar(a: ActivityLike): boolean {
  return (a.gradingPending ?? 0) > 0
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
 * vence antes — salvo en lo ya vencido, donde manda lo más reciente (`tieBreak: 'desc'`),
 * porque una entrega que acaba de vencer todavía se puede recuperar y una de hace un mes no.
 *
 * Sin fecha va al final del grupo. El desempate final por título evita que la lista baile
 * entre renders.
 */
export function compareByUrgency(
  ua: { urgency: number; tieBreak?: 'asc' | 'desc' },
  a: ActivityLike,
  ub: { urgency: number; tieBreak?: 'asc' | 'desc' },
  b: ActivityLike,
): number {
  if (ua.urgency !== ub.urgency) return ua.urgency - ub.urgency
  const da = a.dueDate ?? '9999-12-31'
  const db = b.dueDate ?? '9999-12-31'
  if (da !== db) {
    const desc = ua.tieBreak === 'desc' && ub.tieBreak === 'desc'
    return desc ? (da > db ? -1 : 1) : da < db ? -1 : 1
  }
  return a.title.localeCompare(b.title, 'es')
}
