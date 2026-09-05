/**
 * Los tableros de "Hoy". **Lógica pura, sin React.**
 *
 * Objetivo declarado del rediseño: que cada rol entienda su situación en menos de cinco
 * segundos. Hoy no ocurre —
 *  - El Home del estudiante lista TODAS las actividades sin distinguir entregadas de
 *    pendientes, y la tarjeta "Mis Calificaciones" es un texto fijo que no dice nada (P1-6).
 *  - El Home del docente cuenta inventario (secciones, recursos, anuncios) en vez de trabajo
 *    pendiente, y media pantalla es un "Próximamente en Fase 2" (P1-2).
 *
 * Aquí se decide qué va en cada tablero. La vista solo pinta.
 */

import type { DecoratedActivity, Role } from './list'
import { decorate } from './list'
import type { ActivityLike } from './activityState'
import { compareByUrgency, isVisibleTo, sameBogotaDay } from './activityState'

// ─── Estudiante ──────────────────────────────────────────────────────────────

export interface NotaReciente {
  activity: ActivityLike
  score: number
  maxScore: number | null
}

export interface StudentToday {
  /**
   * Lo único que hay que hacer ahora. Es la apuesta central del tablero del estudiante: en
   * lugar de una lista donde todo pesa igual, una sola tarjeta grande que responde
   * "¿y ahora qué?". Es null solo si de verdad no queda nada pendiente.
   */
  siguiente: DecoratedActivity | null
  /** El resto de lo que exige acción, ya sin `siguiente`. */
  meToca: DecoratedActivity[]
  /** Con fecha, pero todavía sin prisa. */
  proximas: DecoratedActivity[]
  /** Avance del período: cuántas cerró de las que ya puede hacer. */
  progreso: { hechas: number; total: number; pct: number }
  ultimasNotas: NotaReciente[]
}

/** Estados que cuentan como "ya lo cerré". */
const CERRADAS = new Set(['entregada', 'calificada'])
/** Estados que exigen que el estudiante haga algo. */
const ACCIONABLES = new Set(['vencida', 'vence-hoy', 'devuelta', 'vence-pronto', 'en-borrador'])
/** Estados en los que el estudiante no puede hacer nada aunque quiera. */
const FUERA_DE_SU_MANO = new Set(['bloqueada', 'no-abierta'])

export function buildStudentToday(
  activities: ActivityLike[],
  now: Date = new Date(),
  maxNotas = 3,
): StudentToday {
  const items = activities
    .filter((a) => isVisibleTo('estudiante', a))
    .map((a) => decorate(a, 'estudiante', now))
    .sort((x, y) => compareByUrgency(x, x.activity, y, y.activity))

  const accionables = items.filter((d) => d.student && ACCIONABLES.has(d.student.state))
  const pendientes = items.filter((d) => d.student?.state === 'pendiente')

  // Si no hay nada urgente, el siguiente paso es la pendiente más cercana: el tablero nunca
  // se queda sin respuesta mientras quede algo por hacer.
  const siguiente = accionables[0] ?? pendientes[0] ?? null
  const meToca = accionables.filter((d) => d !== siguiente)
  const proximas = pendientes.filter((d) => d !== siguiente)

  // El avance se mide solo sobre lo que el estudiante YA PUEDE hacer: contar en el
  // denominador lo bloqueado o lo que aún no abre castiga por algo que no depende de él.
  const disponibles = items.filter((d) => d.student && !FUERA_DE_SU_MANO.has(d.student.state))
  const hechas = disponibles.filter((d) => d.student && CERRADAS.has(d.student.state)).length
  const total = disponibles.length

  const ultimasNotas = items
    .filter((d) => d.student?.state === 'calificada' && d.student.score != null)
    .sort((a, b) => {
      const fa = a.student?.entregadaEn ?? a.activity.dueDate ?? ''
      const fb = b.student?.entregadaEn ?? b.activity.dueDate ?? ''
      return fb.localeCompare(fa)
    })
    .slice(0, maxNotas)
    .map((d) => ({
      activity: d.activity,
      score: d.student!.score as number,
      maxScore: d.activity.maxScore ?? null,
    }))

  return {
    siguiente,
    meToca,
    proximas,
    progreso: { hechas, total, pct: total === 0 ? 0 : Math.round((hechas / total) * 100) },
    ultimasNotas,
  }
}

// ─── Docente ─────────────────────────────────────────────────────────────────

export interface TeacherToday {
  /** Lo primero: entregas esperando nota. `total` es la suma de entregas, no de actividades. */
  porCalificar: { entregas: number; actividades: DecoratedActivity[] }
  vencenHoy: DecoratedActivity[]
  sinEntregas: DecoratedActivity[]
  borradores: DecoratedActivity[]
  programadas: DecoratedActivity[]
  publicadas: number
  /** ¿Hay algo que reclame la atención del docente? Si no, el tablero lo celebra. */
  todoAlDia: boolean
}

export function buildTeacherToday(activities: ActivityLike[], now: Date = new Date()): TeacherToday {
  const items = activities
    .map((a) => decorate(a, 'docente', now))
    .sort((x, y) => compareByUrgency(x, x.activity, y, y.activity))

  /*
   * Los cuatro paneles responden preguntas INDEPENDIENTES, así que no se derivan del estado
   * excluyente de la tarjeta: una actividad que vence hoy Y tiene entregas por calificar debe
   * salir en los dos sitios.
   *
   * Se detectó mirando el tablero: el panel decía "Nada se cierra hoy" mientras el estudiante
   * veía "Vence hoy a las 5:00 p.m." de esa misma actividad, porque el estado `por-calificar`
   * se evalúa antes que `vence-hoy` y la absorbía. La auditoría ya advertía (C5) que estos
   * estados se solapan por diseño; los conteos no suman al total, y está bien.
   */
  const porCalificarActs = items.filter((d) => (d.teacher?.porCalificar ?? 0) > 0)
  const entregas = porCalificarActs.reduce((s, d) => s + (d.teacher?.porCalificar ?? 0), 0)
  const vencenHoy = items.filter((d) => d.activity.isPublished && sameBogotaDay(d.activity.dueDate, now))
  const sinEntregas = items.filter((d) => {
    const a = d.activity
    if (!a.isPublished || !a.dueDate) return false
    const venció = new Date(a.dueDate).getTime() < now.getTime()
    return venció && !sameBogotaDay(a.dueDate, now) && (a._count?.submissions ?? 0) === 0
  })
  const borradores = items.filter((d) => d.teacher?.state === 'borrador')
  const programadas = items.filter((d) => d.teacher?.state === 'programada')
  const publicadas = items.filter((d) => d.teacher && d.teacher.state !== 'borrador' && d.teacher.state !== 'programada').length

  return {
    porCalificar: { entregas, actividades: porCalificarActs },
    vencenHoy,
    sinEntregas,
    borradores,
    programadas,
    publicadas,
    todoAlDia: entregas === 0 && vencenHoy.length === 0 && sinEntregas.length === 0 && borradores.length === 0,
  }
}

// ─── Anuncios ────────────────────────────────────────────────────────────────

export interface AnnouncementLike {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  author?: { firstName?: string; lastName?: string } | null
}

/**
 * Orden del muro: primero lo fijado, luego lo más reciente. Los anuncios dejan de ser una
 * pestaña aparte (decisión D1) porque es donde el estudiante ya está mirando.
 */
export function ordenarAnuncios(anuncios: AnnouncementLike[], limite?: number): AnnouncementLike[] {
  const ordenados = [...anuncios].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
  return limite ? ordenados.slice(0, limite) : ordenados
}
