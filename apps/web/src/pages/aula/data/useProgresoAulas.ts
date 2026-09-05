/**
 * El avance del estudiante en cada una de sus aulas, para la lista de aulas.
 *
 * Viene de la referencia del fundador: cada tarjeta de curso enseña su porcentaje. Hoy el
 * estudiante no ve cómo va hasta entrar al aula, así que no puede decidir por dónde empezar,
 * que es justo lo que esa pantalla debería resolver.
 *
 * **El número tiene que ser verdad.** `GET /classrooms` no trae el avance, así que se piden las
 * actividades de cada aula por separado y se calcula con la misma regla del tablero
 * (`buildStudentToday`): solo cuenta lo que el estudiante YA PUEDE hacer, así que lo bloqueado
 * y lo que aún no abre no le restan.
 *
 * Se hace en segundo plano: la lista se pinta enseguida y las barras aparecen cuando llegan.
 * Un aula que falle simplemente se queda sin barra, sin ruido: es un adorno informativo, no
 * algo por lo que valga la pena enseñar un error.
 */

import { useEffect, useState } from 'react'
import { classroomApi } from '../../../lib/api'
import { buildStudentToday } from '../model/today'
import type { ActivityLike } from '../model/activityState'
import type { Rol } from './useAula'

export interface AvanceDeAula {
  hechas: number
  total: number
  pct: number
}

/** Máximo de aulas que se consultan a la vez, para no lanzar quince peticiones de golpe. */
const TANDA = 4

export function useProgresoAulas(aulaIds: string[], rol: Rol): Record<string, AvanceDeAula> {
  const [avances, setAvances] = useState<Record<string, AvanceDeAula>>({})
  // La lista de ids cambia de identidad en cada render aunque su contenido sea el mismo.
  const clave = aulaIds.join(',')

  useEffect(() => {
    if (rol !== 'estudiante' || aulaIds.length === 0) return
    let vivo = true

    const pedir = async (id: string) => {
      try {
        const { data } = await classroomApi.listActivities(id, 'student')
        if (!vivo) return
        const t = buildStudentToday(Array.isArray(data) ? (data as ActivityLike[]) : [])
        // Un aula sin actividades disponibles no tiene avance que enseñar.
        if (t.progreso.total === 0) return
        setAvances((prev) => ({ ...prev, [id]: t.progreso }))
      } catch {
        // Silencio a propósito: sin barra se sigue pudiendo entrar al aula. Es la segunda y
        // última excepción a la regla de "cero catch vacíos" del módulo, y por eso se explica.
      }
    }

    void (async () => {
      for (let i = 0; i < aulaIds.length && vivo; i += TANDA) {
        await Promise.allSettled(aulaIds.slice(i, i + TANDA).map(pedir))
      }
    })()

    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, rol])

  return avances
}
