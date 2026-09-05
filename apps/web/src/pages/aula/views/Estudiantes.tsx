/**
 * "Estudiantes" — quiénes están en el aula y cómo van.
 *
 * Qué mejora respecto de la pestaña actual:
 *  - Deja de tragarse el error con `catch {}` (P0-5): si la lista no carga, se ve y se puede
 *    reintentar, en vez de mostrar un aula vacía que parece no tener estudiantes.
 *  - Se mantiene el **orden canónico** (primer apellido, segundo apellido, nombre), el mismo de
 *    la planilla y del boletín. Que dos listas del mismo grupo salgan en orden distinto es una
 *    forma silenciosa de equivocarse al leer notas.
 */

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { parseApiError } from '../../../lib/toast'
import { AulaState, EmptyState } from '../ui/EmptyState'
import { normalize } from '../model/activityState'

interface EstudianteLike {
  id?: string
  student?: {
    id?: string
    firstName?: string
    lastName?: string
    secondLastName?: string
    photo?: string | null
    user?: { firstName?: string; lastName?: string; email?: string }
    email?: string
  }
}

interface Persona {
  id: string
  nombre: string
  apellidos: string
  email: string
  iniciales: string
  /** Clave de ordenación canónica. */
  orden: string
}

function aPersona(e: EstudianteLike, i: number): Persona {
  const s = e.student ?? {}
  const nombre = s.firstName || s.user?.firstName || ''
  const ap1 = s.lastName || s.user?.lastName || ''
  const ap2 = s.secondLastName || ''
  const apellidos = [ap1, ap2].filter(Boolean).join(' ')
  const iniciales = [nombre[0], ap1[0]].filter(Boolean).join('').toUpperCase() || '?'
  return {
    id: s.id || e.id || String(i),
    nombre,
    apellidos,
    email: s.email || s.user?.email || '',
    iniciales,
    // Mismo criterio que la planilla: apellido1, apellido2, nombre.
    orden: normalize([ap1, ap2, nombre].join(' ')),
  }
}

export function Estudiantes({ classroomId }: { classroomId: string }) {
  const [lista, setLista] = useState<EstudianteLike[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    classroomApi
      .getStudents(classroomId)
      .then(({ data }) => {
        if (vivo) setLista(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        // El aula actual hace `catch {}` aquí, así que un fallo de red se ve idéntico a un
        // grupo sin estudiantes.
        if (vivo) setError(parseApiError(e))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [classroomId, intento])

  const personas = useMemo(() => lista.map(aPersona).sort((a, b) => a.orden.localeCompare(b.orden, 'es')), [lista])

  const filtradas = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return personas
    return personas.filter((p) => normalize(`${p.nombre} ${p.apellidos}`).includes(q))
  }, [personas, busqueda])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink-primary">Estudiantes</h1>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {personas.length > 0
              ? `${personas.length} en el grupo · en orden de lista`
              : 'Quiénes están matriculados en este grupo'}
          </p>
        </div>
        {personas.length > 5 && (
          <div className="relative">
            <label className="sr-only" htmlFor="buscar-estudiante">
              Buscar estudiante
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="buscar-estudiante"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="min-h-btn rounded-lg border border-hairline bg-surface-1 pr-3 pl-9 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-4">
        <AulaState
          loading={cargando}
          error={error}
          onRetry={() => setIntento((n) => n + 1)}
          isEmpty={personas.length === 0}
          empty={
            <EmptyState
              scene="sin-aulas"
              title="Este grupo no tiene estudiantes matriculados"
              detail="Cuando coordinación matricule al grupo, los verás aquí."
            />
          }
        >
          {filtradas.length === 0 ? (
            <EmptyState
              scene="sin-resultados"
              title="Nadie coincide con esa búsqueda"
              action={{ label: 'Ver todos', onClick: () => setBusqueda('') }}
              compact
            />
          ) : (
            <ol className="space-y-1.5">
              {filtradas.map((p, i) => (
                <li
                  key={p.id}
                  className="flex min-h-row items-center gap-3 rounded-card border border-hairline bg-surface-1 px-3.5 py-2.5"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-ink-muted tabular-nums">{i + 1}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-secondary">
                    {p.iniciales}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-ink-primary">
                      {p.apellidos ? `${p.apellidos}, ${p.nombre}` : p.nombre}
                    </span>
                    {p.email && <span className="block truncate text-xs text-ink-muted">{p.email}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </AulaState>
      </div>
    </div>
  )
}
