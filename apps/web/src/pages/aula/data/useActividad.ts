/**
 * Carga del detalle de una actividad, con su entrega (estudiante) o sus entregas (docente).
 *
 * Como el resto del módulo: un solo sitio pide y **todo fallo se ve**. El aula actual llama a
 * `listSubmissions` con `catch {}`, así que una lista de entregas que no carga es
 * indistinguible de una actividad sin entregas.
 */

import { useCallback, useEffect, useState } from 'react'
import { classroomApi } from '../../../lib/api'
import { parseApiError } from '../../../lib/toast'
import type { ActivityLike } from '../model/activityState'
import type { Rol } from './useAula'

/** Una entrega, tal como la devuelve el backend. */
export interface EntregaLike {
  id: string
  activityId: string
  status: string
  content?: string | null
  fileUrl?: string | null
  score?: number | null
  feedback?: string | null
  submittedAt?: string | null
  gradedAt?: string | null
  attemptNumber?: number
  studentEnrollment?: {
    id?: string
    student: { id: string; firstName: string; lastName: string; secondLastName?: string; photo?: string }
  }
}

export interface EstadoActividad {
  actividad: ActivityLike | null
  /** Estudiante: su propia entrega. */
  miEntrega: EntregaLike | null
  /** Docente: todas las entregas del grupo. */
  entregas: EntregaLike[]
  cargando: boolean
  error: string | null
  recargar: () => void
}

export function useActividad(activityId: string | null, rol: Rol): EstadoActividad {
  const [actividad, setActividad] = useState<ActivityLike | null>(null)
  const [miEntrega, setMiEntrega] = useState<EntregaLike | null>(null)
  const [entregas, setEntregas] = useState<EntregaLike[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  useEffect(() => {
    if (!activityId) {
      setActividad(null)
      setMiEntrega(null)
      setEntregas([])
      setCargando(false)
      return
    }

    let vivo = true
    setCargando(true)
    setError(null)

    const esEstudiante = rol === 'estudiante'

    Promise.all([
      classroomApi.getActivity(activityId, esEstudiante ? 'student' : undefined),
      esEstudiante
        ? // "Todavía no he entregado" llega como 404, y eso NO es un error que mostrar. Pero
          // solo se traga el 404: un 500 o una caída de red sí tienen que verse.
          classroomApi.getMySubmission(activityId).catch((e) => {
            if (e?.response?.status === 404) return { data: null }
            throw e
          })
        : classroomApi.listSubmissions(activityId),
    ])
      .then(([resAct, resSubs]) => {
        if (!vivo) return
        setActividad(resAct.data as ActivityLike)
        if (esEstudiante) {
          setMiEntrega((resSubs.data as EntregaLike) ?? null)
          setEntregas([])
        } else {
          setMiEntrega(null)
          setEntregas(Array.isArray(resSubs.data) ? resSubs.data : [])
        }
      })
      .catch((e) => {
        if (vivo) setError(parseApiError(e))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })

    return () => {
      vivo = false
    }
  }, [activityId, rol, intento])

  return { actividad, miEntrega, entregas, cargando, error, recargar }
}
