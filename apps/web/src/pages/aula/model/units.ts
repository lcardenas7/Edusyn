/**
 * Las unidades del aula. **Lógica pura, sin React.**
 *
 * Una unidad no es "un grupo de actividades": es un tema, con su material de estudio Y su
 * trabajo. En el aula actual eso vive partido en dos pestañas —"Contenidos" tiene los
 * materiales, "Actividades" tiene las tareas— y el estudiante tiene que reconstruir
 * mentalmente qué pertenece a qué. El prototipo del rediseño repetía el error al revés:
 * agrupaba solo actividades e ignoraba los materiales (defecto X6 del plan).
 *
 * Aquí se unen, que es lo único que justifica la pestaña.
 */

import type { ActivityLike } from './activityState'
import { isVisibleTo } from './activityState'
import { decorate, type DecoratedActivity, type Role } from './list'
import { PERIOD_ALL, PERIOD_NONE } from './list'

export interface MaterialLike {
  id: string
  type: string
  title: string
  /** Donde el docente lo dejó dentro de la unidad. Es su intención pedagógica. */
  sortOrder?: number
  isVisible?: boolean
  fileUrl?: string | null
  content?: string | null
}

export interface SeccionLike {
  id: string
  title: string
  isVisible?: boolean
  academicTermId?: string | null
  materials?: MaterialLike[]
}

export interface Unidad {
  id: string
  titulo: string
  /** El docente ve las ocultas, marcadas; el estudiante no las recibe. */
  oculta: boolean
  materiales: MaterialLike[]
  actividades: DecoratedActivity[]
  /** Avance del estudiante en esta unidad: 0–100. `null` para el docente. */
  avance: number | null
  /** Cuántas cosas hay en total, para el resumen de la cabecera. */
  total: { materiales: number; actividades: number }
}

const CERRADAS = new Set(['entregada', 'calificada'])
const FUERA_DE_SU_MANO = new Set(['bloqueada', 'no-abierta'])

/** Id que usa el cubo de "lo que no está en ninguna unidad". */
export const SIN_UNIDAD_ID = '__sin_unidad__'

export interface BuildUnitsInput {
  secciones: SeccionLike[]
  actividades: ActivityLike[]
  role: Role
  /** Id de período, PERIOD_ALL o PERIOD_NONE. */
  periodo: string
  now?: Date
}

export function buildUnits({ secciones, actividades, role, periodo, now = new Date() }: BuildUnitsInput): Unidad[] {
  const enPeriodo = (termId: string | null | undefined): boolean => {
    if (periodo === PERIOD_ALL) return true
    if (periodo === PERIOD_NONE) return !termId
    return termId === periodo
  }

  const seccionesVisibles = secciones
    // El estudiante no debe ver una unidad que el docente ocultó.
    .filter((s) => role === 'docente' || s.isVisible !== false)
    .filter((s) => enPeriodo(s.academicTermId))

  const visiblesPorId = new Map(seccionesVisibles.map((s) => [s.id, s]))

  const actsVisibles = actividades
    .filter((a) => isVisibleTo(role, a))
    .filter((a) => enPeriodo(a.academicTermId ?? a.section?.academicTermId ?? null))

  const unidades: Unidad[] = seccionesVisibles.map((s) => {
    const materiales = (s.materials ?? []).filter((m) => role === 'docente' || m.isVisible !== false)
    const acts = actsVisibles.filter((a) => a.section?.id === s.id).map((a) => decorate(a, role, now))
    return armar(s.id, s.title, s.isVisible === false, materiales, acts, role)
  })

  // Lo que quedó fuera de toda unidad visible: actividades sueltas, o de una sección que el
  // payload no trajo. No se esconden — esconderlas es como se pierden las cosas.
  const huerfanas = actsVisibles
    .filter((a) => !a.section?.id || !visiblesPorId.has(a.section.id))
    .map((a) => decorate(a, role, now))

  if (huerfanas.length > 0) {
    unidades.push(armar(SIN_UNIDAD_ID, 'Sin unidad', false, [], huerfanas, role))
  }

  return unidades
}

function armar(
  id: string,
  titulo: string,
  oculta: boolean,
  materiales: MaterialLike[],
  actividades: DecoratedActivity[],
  role: Role,
): Unidad {
  let avance: number | null = null
  if (role === 'estudiante') {
    // Igual que el avance del tablero: solo cuenta lo que el estudiante YA PUEDE hacer.
    const disponibles = actividades.filter((d) => d.student && !FUERA_DE_SU_MANO.has(d.student.state))
    const hechas = disponibles.filter((d) => d.student && CERRADAS.has(d.student.state)).length
    avance = disponibles.length === 0 ? null : Math.round((hechas / disponibles.length) * 100)
  }

  return {
    id,
    titulo,
    oculta,
    materiales,
    actividades,
    avance,
    total: { materiales: materiales.length, actividades: actividades.length },
  }
}
