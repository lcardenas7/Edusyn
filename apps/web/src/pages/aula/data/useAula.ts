/**
 * Carga de datos del aula. Un solo sitio pide, y **todo fallo se ve**.
 *
 * El aula actual reparte estas llamadas por varios componentes y se traga los errores con
 * `catch {}` en al menos trece sitios (defecto P0-5): el usuario hace clic, no pasa nada, y no
 * hay forma de distinguir "falló" de "no hay datos". Aquí el error viaja hasta la vista, que
 * lo muestra con un botón de reintentar.
 *
 * No hay endpoints nuevos: se consumen exactamente los mismos que hoy (garantía G2 del plan).
 */

import { useCallback, useEffect, useState } from 'react'
import { classroomApi } from '../../../lib/api'
import { parseApiError } from '../../../lib/toast'
import type { ActivityLike } from '../model/activityState'
import type { AnnouncementLike } from '../model/today'
import type { PeriodoOpcion } from '../ui/AulaShell'
import { leerUltimaVisita, marcarVisitada } from '../model/lastVisit'
import { etiquetaDeGrupo } from '../model/grados'

export type Rol = 'docente' | 'estudiante'

/** Lo que la vista necesita saber del aula, ya normalizado. */
export interface AulaCargada {
  id: string
  titulo: string
  asignatura: string | null
  grupo: string | null
  /** El color que el docente eligió. Es lo que distingue dos aulas de la misma asignatura. */
  color: string | null
  estudiantes: number | null
  periodos: PeriodoOpcion[]
  periodoActual: PeriodoOpcion | null
  anuncios: AnnouncementLike[]
  /** Unidades del aula con sus materiales, para la vista de Unidades. */
  secciones: {
    id: string
    title: string
    isVisible: boolean
    academicTermId?: string | null
    materials: { id: string; type: string; title: string; isVisible: boolean; fileUrl?: string; content?: string }[]
  }[]
}

/**
 * Normaliza el payload de `getById`. El backend devuelve el aula con la asignatura y el grupo
 * anidados dentro de `teacherAssignment`, y los períodos con nombres distintos según el rol.
 */
function normalizarAula(data: any): AulaCargada {
  const asignacion = data?.teacherAssignment ?? null
  const periodosCrudos: any[] = data?.academicPeriods ?? []
  const actual = data?.currentPeriod ?? null

  const periodos: PeriodoOpcion[] = periodosCrudos
    .map((p) => ({ id: p.id, name: p.name, activo: actual?.id === p.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return {
    id: data.id,
    titulo: data.title ?? 'Aula',
    asignatura: asignacion?.subject?.name ?? null,
    // El grupo puede llamarse "C" y su grado "Octavo": quedarse solo con el nombre del grupo
    // deja encabezados como "INFORMATICA C", que no dicen de qué curso se trata. Salió
    // probando con datos reales.
    grupo: etiquetaDeGrupo(asignacion?.group?.grade?.name, asignacion?.group?.name) || null,
    color: data?.color ?? null,
    // Ojo: el aula actual cae en `_count.sections` cuando `studentCount` viene en 0 y acaba
    // enseñando el número de SECCIONES con la etiqueta "estudiantes" (hallazgo E9 del informe
    // C). Aquí, si no hay dato, no se inventa: se muestra nada.
    estudiantes: typeof data.studentCount === 'number' ? data.studentCount : null,
    periodos,
    periodoActual: actual ? { id: actual.id, name: actual.name, activo: true } : null,
    anuncios: (data.announcements ?? []) as AnnouncementLike[],
    secciones: (data.sections ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      isVisible: s.isVisible !== false,
      academicTermId: s.academicTermId ?? null,
      materials: s.materials ?? [],
    })),
  }
}

export interface EstadoAula {
  aula: AulaCargada | null
  actividades: ActivityLike[]
  cargando: boolean
  error: string | null
  recargar: () => void
  /** Última visita del estudiante, para marcar lo NUEVO. Ver `lastVisit.ts`. */
  ultimaVisita: Date | null
}

export function useAula(classroomId: string | null, rol: Rol): EstadoAula {
  const [aula, setAula] = useState<AulaCargada | null>(null)
  const [actividades, setActividades] = useState<ActivityLike[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ultimaVisita, setUltimaVisita] = useState<Date | null>(null)
  const [intento, setIntento] = useState(0)

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  useEffect(() => {
    if (!classroomId) {
      setAula(null)
      setActividades([])
      setCargando(false)
      return
    }

    let vivo = true
    setCargando(true)
    setError(null)

    // La última visita se lee ANTES de marcarla, o el estudiante nunca vería nada como nuevo.
    setUltimaVisita(leerUltimaVisita(classroomId))

    Promise.all([
      classroomApi.getById(classroomId),
      classroomApi.listActivities(classroomId, rol === 'estudiante' ? 'student' : undefined),
    ])
      .then(([resAula, resActs]) => {
        if (!vivo) return
        setAula(normalizarAula(resAula.data))
        setActividades(Array.isArray(resActs.data) ? resActs.data : [])
        marcarVisitada(classroomId)
      })
      .catch((e) => {
        if (!vivo) return
        // Nada de `catch {}`: el error llega a la vista con un mensaje que se puede leer.
        setError(parseApiError(e))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })

    return () => {
      vivo = false
    }
  }, [classroomId, rol, intento])

  return { aula, actividades, cargando, error, recargar, ultimaVisita }
}

// ─── Lista de aulas ──────────────────────────────────────────────────────────

export interface AulaListada {
  id: string
  titulo: string
  asignatura: string | null
  grupo: string | null
  grado: string | null
  color?: string | null
  estudiantes: number | null
  activa: boolean
}

export interface EstadoAulas {
  aulas: AulaListada[]
  cargando: boolean
  error: string | null
  recargar: () => void
}

export function useAulas(rol: Rol): EstadoAulas {
  const [aulas, setAulas] = useState<AulaListada[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)

    classroomApi
      .list(rol === 'estudiante' ? 'student' : undefined)
      .then(({ data }) => {
        if (!vivo) return
        const lista = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id,
          titulo: c.title,
          asignatura: c.teacherAssignment?.subject?.name ?? null,
          grupo: c.teacherAssignment?.group?.name ?? null,
          grado: c.teacherAssignment?.group?.grade?.name ?? null,
          color: c.color ?? null,
          estudiantes: typeof c.studentCount === 'number' ? c.studentCount : null,
          // `isActive` existe en el tipo y no se usaba en ninguna parte (hallazgo B6).
          activa: c.isActive !== false,
        }))
        setAulas(lista)
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
  }, [rol, intento])

  return { aulas, cargando, error, recargar }
}
