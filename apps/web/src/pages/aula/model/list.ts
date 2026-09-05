/**
 * El pipeline de la lista de actividades: filtrar → agrupar → ordenar. **Lógica pura.**
 *
 * Un solo lugar decide qué se ve y en qué orden, para docente y estudiante. Las vistas no
 * calculan nada: piden `buildActivityList(...)` y pintan lo que reciben. Así los conteos de los
 * chips y el contenido de la lista no pueden discrepar (hoy discrepan: hallazgo C5).
 */

import type { ActivityFamily, StudentState, TeacherState } from './labels'
import { familyMeta, familyOfType } from './labels'
import type { ActivityLike, StudentView, TeacherView } from './activityState'
import {
  compareByUrgency,
  deriveStudentState,
  deriveTeacherState,
  isVisibleTo,
  matchesSearch,
  periodIdOf,
  tieneEntregasPorCalificar,
  venceHoy,
  vencioSinEntregas,
} from './activityState'
import { bogotaDayDelta, bogotaShortDate } from './countdown'

export type Role = 'docente' | 'estudiante'
export type GroupBy = 'unidad' | 'estado' | 'vencimiento'

/** Valor del filtro de período: un id real, "sin período", o todos. */
export const PERIOD_ALL = 'todos'
export const PERIOD_NONE = 'sin-periodo'

export interface ListFilters {
  search: string
  /** Familia de tipo o `todos`. */
  type: ActivityFamily | 'todos'
  /** `academicTermId`, PERIOD_NONE o PERIOD_ALL. */
  period: string
  /** Id de un chip de estado (ver `stateChipsFor`) o `todas`. */
  state: string
}

export const EMPTY_FILTERS: ListFilters = {
  search: '',
  type: 'todos',
  period: PERIOD_ALL,
  state: 'todas',
}

/** Una actividad con su estado ya derivado: lo que consume la tarjeta. */
export interface DecoratedActivity {
  activity: ActivityLike
  student: StudentView | null
  teacher: TeacherView | null
  /** La urgencia del rol activo, para ordenar. */
  urgency: number
}

export interface ActivityGroup {
  key: string
  label: string
  /** Frase que explica de qué va el grupo. Los grupos sin explicación desorientan. */
  hint?: string
  items: DecoratedActivity[]
}

// ─── Chips de estado ─────────────────────────────────────────────────────────

export interface StateChip {
  id: string
  label: string
  /** Qué actividades entran en este chip. */
  match: (d: DecoratedActivity) => boolean
}

const studentChips: StateChip[] = [
  { id: 'todas', label: 'Todas', match: () => true },
  {
    id: 'me-toca',
    label: 'Me toca',
    match: (d) =>
      !!d.student &&
      (['vencida', 'vence-hoy', 'vence-pronto', 'devuelta', 'en-borrador'] as StudentState[]).includes(d.student.state),
  },
  { id: 'pendiente', label: 'Pendientes', match: (d) => d.student?.state === 'pendiente' },
  {
    id: 'entregadas',
    label: 'Entregadas',
    match: (d) => !!d.student && (['entregada', 'calificada'] as StudentState[]).includes(d.student.state),
  },
  {
    id: 'cerradas',
    label: 'Aún no abren',
    match: (d) => !!d.student && (['bloqueada', 'no-abierta'] as StudentState[]).includes(d.student.state),
  },
]

/**
 * Los chips del docente usan los MISMOS predicados independientes que los paneles de "Hoy",
 * no el estado excluyente de la tarjeta. Si no, el chip "Vencen hoy" desaparece en cuanto esa
 * actividad tiene entregas por calificar, y el tablero y la lista se contradicen.
 */
function teacherChipsFor(now: Date): StateChip[] {
  return [
    { id: 'todas', label: 'Todas', match: () => true },
    { id: 'por-calificar', label: 'Por calificar', match: (d) => tieneEntregasPorCalificar(d.activity) },
    { id: 'vence-hoy', label: 'Vencen hoy', match: (d) => venceHoy(d.activity, now) },
    { id: 'sin-entregas', label: 'Sin entregas', match: (d) => vencioSinEntregas(d.activity, now) },
    { id: 'borrador', label: 'Borradores', match: (d) => d.teacher?.state === 'borrador' },
    { id: 'programada', label: 'Programadas', match: (d) => d.teacher?.state === 'programada' },
  ]
}

export function stateChipsFor(role: Role, now: Date = new Date()): StateChip[] {
  return role === 'estudiante' ? studentChips : teacherChipsFor(now)
}

// ─── Agrupación ──────────────────────────────────────────────────────────────

/**
 * Etiquetas y orden de los grupos "por estado". El orden es intencional: primero lo que
 * exige actuar. Lo que no está en la lista va al final.
 */
const STUDENT_GROUP_ORDER: { state: StudentState; label: string; hint: string }[] = [
  { state: 'vencida', label: 'Se te pasaron', hint: 'Ya venció la fecha, pero todavía puedes hablar con tu profe.' },
  { state: 'devuelta', label: 'Para corregir', hint: 'Tu profe te pidió mejorarlas y volver a entregar.' },
  { state: 'vence-hoy', label: 'Vencen hoy', hint: 'Se cierran hoy.' },
  { state: 'vence-pronto', label: 'Vencen pronto', hint: 'Menos de dos días.' },
  { state: 'en-borrador', label: 'Empezadas sin enviar', hint: 'Las abriste pero no las mandaste.' },
  { state: 'pendiente', label: 'Por hacer', hint: 'Tienes tiempo.' },
  { state: 'no-abierta', label: 'Aún no abren', hint: 'Podrás entrar en su fecha de apertura.' },
  { state: 'bloqueada', label: 'Bloqueadas', hint: 'Se abren al completar lo que piden.' },
  { state: 'entregada', label: 'Entregadas', hint: 'Esperando calificación.' },
  { state: 'calificada', label: 'Calificadas', hint: 'Ya tienen nota.' },
]

const TEACHER_GROUP_ORDER: { state: TeacherState; label: string; hint: string }[] = [
  { state: 'por-calificar', label: 'Por calificar', hint: 'Entregas esperando tu nota.' },
  { state: 'vence-hoy', label: 'Vencen hoy', hint: 'Hoy se cierran para los estudiantes.' },
  { state: 'vencida-sin-entregas', label: 'Vencidas sin entregas', hint: 'Nadie entregó.' },
  { state: 'borrador', label: 'Borradores', hint: 'Todavía no las ven los estudiantes.' },
  { state: 'programada', label: 'Programadas', hint: 'Se publican solas.' },
  { state: 'publicada', label: 'Publicadas', hint: 'Visibles y al día.' },
]

const SIN_UNIDAD = 'Sin unidad'

function groupKeyOf(d: DecoratedActivity, groupBy: GroupBy, role: Role, now: Date): { key: string; label: string; hint?: string } {
  if (groupBy === 'unidad') {
    const title = d.activity.section?.title?.trim()
    return { key: d.activity.section?.id ?? '__sin__', label: title || SIN_UNIDAD }
  }
  if (groupBy === 'estado') {
    if (role === 'estudiante') {
      const row = STUDENT_GROUP_ORDER.find((r) => r.state === d.student?.state)
      return row ? { key: row.state, label: row.label, hint: row.hint } : { key: 'otras', label: 'Otras' }
    }
    const row = TEACHER_GROUP_ORDER.find((r) => r.state === d.teacher?.state)
    return row ? { key: row.state, label: row.label, hint: row.hint } : { key: 'otras', label: 'Otras' }
  }
  // Por vencimiento: cubos con sentido de calendario, no una fecha por grupo.
  const delta = bogotaDayDelta(d.activity.dueDate, now)
  if (delta === null) return { key: 'z-sin-fecha', label: 'Sin fecha de entrega' }
  if (delta < 0) return { key: 'a-vencidas', label: 'Ya vencieron' }
  if (delta === 0) return { key: 'b-hoy', label: 'Hoy' }
  if (delta === 1) return { key: 'c-manana', label: 'Mañana' }
  if (delta <= 7) return { key: 'd-semana', label: 'Esta semana' }
  if (delta <= 30) return { key: 'e-mes', label: 'Este mes' }
  return { key: 'f-despues', label: `Más adelante · desde el ${bogotaShortDate(d.activity.dueDate)}` }
}

function groupSortIndex(key: string, groupBy: GroupBy, role: Role): number {
  if (groupBy === 'estado') {
    const order = role === 'estudiante' ? STUDENT_GROUP_ORDER.map((r) => r.state as string) : TEACHER_GROUP_ORDER.map((r) => r.state as string)
    const i = order.indexOf(key)
    return i === -1 ? order.length : i
  }
  return 0 // 'unidad' ordena alfabéticamente y 'vencimiento' por el prefijo de la clave
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export interface BuildInput {
  activities: ActivityLike[]
  role: Role
  filters: ListFilters
  groupBy: GroupBy
  now?: Date
}

export interface BuildResult {
  groups: ActivityGroup[]
  /** Cuántas quedaron tras filtrar. */
  visible: number
  /** Cuántas hay en total para este rol y período (antes de tipo/estado/búsqueda). */
  total: number
  /** Conteo por chip de estado, calculado sobre el mismo universo que la lista. */
  chipCounts: Record<string, number>
  /** True si hay algún filtro activo (para ofrecer "Quitar filtros"). */
  filtered: boolean
}

/** Decora una actividad con el estado derivado del rol. */
export function decorate(a: ActivityLike, role: Role, now: Date): DecoratedActivity {
  if (role === 'estudiante') {
    const student = deriveStudentState(a, now)
    return { activity: a, student, teacher: null, urgency: student.urgency }
  }
  const teacher = deriveTeacherState(a, now)
  return { activity: a, student: null, teacher, urgency: teacher.urgency }
}

export function buildActivityList({ activities, role, filters, groupBy, now = new Date() }: BuildInput): BuildResult {
  const chips = stateChipsFor(role, now)
  const chip = chips.find((c) => c.id === filters.state) ?? chips[0]

  // 1 · Universo: primero lo que el rol tiene derecho a ver, y luego el período, que es el
  //     organizador primario — así el resto de filtros y los conteos de los chips se calculan
  //     DENTRO del período elegido.
  const universe = activities
    .filter((a) => isVisibleTo(role, a))
    .filter((a) => {
      if (filters.period === PERIOD_ALL) return true
      const p = periodIdOf(a)
      return filters.period === PERIOD_NONE ? p === null : p === filters.period
    })
    .map((a) => decorate(a, role, now))

  // 2 · Filtros que ESTRECHAN (tipo y búsqueda). Se aplican antes de contar los chips.
  const acotado = universe.filter((d) => {
    if (filters.type !== 'todos' && familyOfType(d.activity.type) !== filters.type) return false
    return matchesSearch(d.activity, filters.search)
  })

  // 3 · Conteos de chips sobre lo ya acotado, no sobre todo el universo.
  //     Así el número de un chip es EXACTAMENTE cuántas verás si lo pulsas: con "taller"
  //     escrito en la búsqueda, un chip que dijera 7 y mostrara 2 al pulsarlo sería mentira.
  //     (La auditoría ya señalaba que hoy los conteos y la lista no cuadran — hallazgo C5.)
  const chipCounts: Record<string, number> = {}
  for (const c of chips) chipCounts[c.id] = acotado.filter(c.match).length

  // 4 · El chip elegido.
  const visible = acotado.filter(chip.match)

  // 5 · Agrupar.
  const buckets = new Map<string, ActivityGroup>()
  for (const d of visible) {
    const { key, label, hint } = groupKeyOf(d, groupBy, role, now)
    if (!buckets.has(key)) buckets.set(key, { key, label, hint, items: [] })
    buckets.get(key)!.items.push(d)
  }

  // 6 · Ordenar dentro y entre grupos.
  const groups = [...buckets.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((x, y) => compareByUrgency(x, x.activity, y, y.activity)),
    }))
    .sort((a, b) => {
      if (groupBy === 'estado') {
        return groupSortIndex(a.key, groupBy, role) - groupSortIndex(b.key, groupBy, role)
      }
      if (groupBy === 'vencimiento') return a.key.localeCompare(b.key)
      // Por unidad: "Sin unidad" siempre al final, el resto alfabético.
      if (a.label === SIN_UNIDAD) return 1
      if (b.label === SIN_UNIDAD) return -1
      return a.label.localeCompare(b.label, 'es')
    })

  const filtered =
    filters.search.trim() !== '' ||
    filters.type !== 'todos' ||
    filters.state !== 'todas' ||
    filters.period !== PERIOD_ALL

  return { groups, visible: visible.length, total: universe.length, chipCounts, filtered }
}

// ─── Tipos presentes ─────────────────────────────────────────────────────────

/**
 * Familias de tipo que existen realmente en el aula, para no ofrecer filtros vacíos.
 * La auditoría encontró el problema inverso (C3): faltaba "Autoevaluación" en los filtros
 * aunque existiera. Derivarlo de los datos evita las dos fallas.
 */
export function availableTypes(activities: ActivityLike[]): { family: ActivityFamily; label: string; count: number }[] {
  const counts = new Map<ActivityFamily, number>()
  for (const a of activities) {
    const f = familyOfType(a.type)
    counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([family, count]) => ({ family, label: familyMeta(family).label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}
