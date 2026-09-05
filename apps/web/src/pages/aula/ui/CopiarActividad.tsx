/**
 * Asistente para copiar una actividad a otra unidad o a otra aula.
 *
 * Corrige P0-1, el defecto de mayor severidad de la auditoría: hoy copiar es un clic sobre una
 * lista de secciones, sin decir a qué período van a parar. Y el backend **no le asigna período
 * a la copia**: lo hereda de la unidad destino (`duplicateActivity` en classroom.service.ts
 * crea la actividad sin `academicTermId`). Si esa unidad no tiene período, la copia nace
 * huérfana, desaparece de toda vista filtrada por período, y **no se puede arreglar desde la
 * interfaz**, porque `updateActivity` no acepta `academicTermId`.
 *
 * Así que la única solución real es la prevención, y eso es lo que hace este asistente:
 *  1. Enseña el período de cada unidad destino, en vez de esconderlo.
 *  2. Si la unidad elegida no tiene período, lo dice y ofrece **el arreglo de verdad**:
 *     asignarle un período a esa unidad (`updateSection` sí lo acepta), antes de copiar.
 *  3. Muestra exactamente qué se copia y qué no, antes de confirmar.
 *
 * Garantía G5 del plan: esto siempre CREA. Nunca modifica ni borra la actividad original, y no
 * arrastra entregas ni notas.
 */

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, CircleAlert, X } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'
import type { ActivityLike } from '../model/activityState'
import { activityTypeLabel } from '../model/labels'
import { ActivityGlyph } from '../visual/ActivityGlyph'

interface AulaDestino {
  id: string
  nombre: string
}

interface UnidadDestino {
  id: string
  title: string
  academicTermId?: string | null
}

interface Periodo {
  id: string
  name: string
}

type Paso = 'destino' | 'revisar' | 'listo'

export interface CopiarActividadProps {
  actividad: ActivityLike
  /** Aula en la que estamos ahora. */
  aulaActualId: string
  onCerrar: () => void
  /** Se llama con el id de la copia creada. */
  onCopiada: (nuevaId: string) => void
}

export function CopiarActividad({ actividad, aulaActualId, onCerrar, onCopiada }: CopiarActividadProps) {
  const [paso, setPaso] = useState<Paso>('destino')
  const [aulas, setAulas] = useState<AulaDestino[]>([])
  const [aulaId, setAulaId] = useState(aulaActualId)
  const [unidades, setUnidades] = useState<UnidadDestino[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [unidadId, setUnidadId] = useState<string>('')
  const [cargandoAulas, setCargandoAulas] = useState(true)
  const [cargandoUnidades, setCargandoUnidades] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [periodoParaUnidad, setPeriodoParaUnidad] = useState('')
  const [nuevaId, setNuevaId] = useState<string | null>(null)

  // Aulas a las que el docente puede copiar.
  useEffect(() => {
    let vivo = true
    classroomApi
      .list()
      .then(({ data }) => {
        if (!vivo) return
        const lista = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id,
          nombre: [c.teacherAssignment?.subject?.name ?? c.title, c.teacherAssignment?.group?.name]
            .filter(Boolean)
            .join(' '),
        }))
        setAulas(lista)
      })
      .catch((e) => toast.error(e))
      .finally(() => {
        if (vivo) setCargandoAulas(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Unidades y períodos del aula destino.
  useEffect(() => {
    if (!aulaId) return
    let vivo = true
    setCargandoUnidades(true)
    setUnidadId('')
    classroomApi
      .getById(aulaId)
      .then(({ data }) => {
        if (!vivo) return
        setUnidades((data.sections ?? []) as UnidadDestino[])
        setPeriodos((data.academicPeriods ?? []) as Periodo[])
      })
      .catch((e) => toast.error(e))
      .finally(() => {
        if (vivo) setCargandoUnidades(false)
      })
    return () => {
      vivo = false
    }
  }, [aulaId])

  const unidad = unidades.find((u) => u.id === unidadId) ?? null
  const periodoDeUnidad = unidad ? periodos.find((p) => p.id === unidad.academicTermId) ?? null : null
  const sinPeriodo = !!unidad && !unidad.academicTermId

  const asignarPeriodo = async () => {
    if (!unidad || !periodoParaUnidad) return
    setAsignando(true)
    try {
      await classroomApi.updateSection(unidad.id, { academicTermId: periodoParaUnidad })
      setUnidades((us) =>
        us.map((u) => (u.id === unidad.id ? { ...u, academicTermId: periodoParaUnidad } : u)),
      )
      toast.success('Período asignado a la unidad')
    } catch (e) {
      toast.error(e)
    } finally {
      setAsignando(false)
    }
  }

  const copiar = async () => {
    if (!unidad) return
    setCopiando(true)
    try {
      const { data } = await classroomApi.duplicateActivity(actividad.id, unidad.id)
      setNuevaId(data?.id ?? null)
      setPaso('listo')
    } catch (e) {
      // Sin `catch {}`: si la copia no se creó, el docente tiene que saberlo.
      toast.error(e)
    } finally {
      setCopiando(false)
    }
  }

  const btnPrim =
    'inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none'
  const btnSec =
    'inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline px-4 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-primary/40 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copiar-titulo"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-modal bg-surface-1 shadow-xl sm:rounded-modal"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 id="copiar-titulo" className="text-body-base font-semibold text-ink-primary">
              {paso === 'listo' ? 'Copia creada' : 'Copiar actividad'}
            </h2>
            {paso !== 'listo' && (
              <p className="mt-0.5 text-body-sm text-ink-muted">
                Paso {paso === 'destino' ? 1 : 2} de 2
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-2 hover:text-ink-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Qué se está copiando: siempre visible */}
          <div className="flex items-center gap-3 rounded-card bg-surface-2 p-3">
            <ActivityGlyph type={actividad.type} size={40} />
            <div className="min-w-0">
              <p className="truncate text-body-sm font-medium text-ink-primary">{actividad.title}</p>
              <p className="text-xs text-ink-muted">{activityTypeLabel(actividad.type, actividad.metadata)}</p>
            </div>
          </div>

          {paso === 'destino' && (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="aula-destino" className="block text-body-sm font-medium text-ink-primary">
                  ¿A qué aula?
                </label>
                <select
                  id="aula-destino"
                  value={aulaId}
                  onChange={(e) => setAulaId(e.target.value)}
                  disabled={cargandoAulas}
                  className="mt-1 min-h-btn w-full rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  {aulas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                      {a.id === aulaActualId ? ' (esta aula)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="text-body-sm font-medium text-ink-primary">¿A qué unidad?</legend>
                {cargandoUnidades ? (
                  <p className="mt-2 text-body-sm text-ink-muted">Cargando unidades…</p>
                ) : unidades.length === 0 ? (
                  <p className="mt-2 text-body-sm text-ink-secondary">
                    Esa aula todavía no tiene unidades. Crea una allí antes de copiar.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {unidades.map((u) => {
                      const p = periodos.find((x) => x.id === u.academicTermId)
                      return (
                        <label
                          key={u.id}
                          className={`flex min-h-row cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                            unidadId === u.id ? 'border-accent bg-accent/[0.06]' : 'border-hairline hover:bg-surface-2'
                          }`}
                        >
                          <input
                            type="radio"
                            name="unidad-destino"
                            value={u.id}
                            checked={unidadId === u.id}
                            onChange={() => setUnidadId(u.id)}
                            className="accent-accent"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm text-ink-primary">{u.title}</span>
                            {/* El período, dicho. Es justo el dato que hoy se oculta y que
                                determina si la copia va a existir o no para el estudiante. */}
                            <span
                              className={`block text-xs ${u.academicTermId ? 'text-ink-muted' : 'text-warning-700'}`}
                            >
                              {p ? p.name : u.academicTermId ? 'Período desconocido' : 'Sin período'}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </fieldset>

              {/* El arreglo de verdad, ofrecido en el momento en que hace falta */}
              {sinPeriodo && (
                <div className="rounded-card border border-warning-100 bg-warning-50 p-4">
                  <p className="flex items-start gap-2 text-body-sm font-semibold text-ink-primary">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
                    Esa unidad no tiene período
                  </p>
                  <p className="mt-1 text-body-sm text-ink-secondary">
                    Si copias ahí, la copia quedará sin período y no aparecerá al filtrar por período — ni
                    para ti ni para tus estudiantes. Y no se puede arreglar después desde aquí. Asígnale un
                    período a la unidad primero:
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor="periodo-unidad">
                      Período para la unidad
                    </label>
                    <select
                      id="periodo-unidad"
                      value={periodoParaUnidad}
                      onChange={(e) => setPeriodoParaUnidad(e.target.value)}
                      className="min-h-btn rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    >
                      <option value="">Elige un período…</option>
                      {periodos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={asignarPeriodo}
                      disabled={!periodoParaUnidad || asignando}
                      className={btnSec}
                    >
                      {asignando ? 'Asignando…' : 'Asignar a la unidad'}
                    </button>
                  </div>
                  {periodos.length === 0 && (
                    <p className="mt-2 text-body-sm text-ink-secondary">
                      Esta aula no tiene períodos configurados. Habla con coordinación antes de copiar aquí.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {paso === 'revisar' && unidad && (
            <div className="mt-4 space-y-3">
              <div className="rounded-card border border-accent/25 bg-accent/[0.06] p-4">
                <p className="text-body-sm text-ink-primary">
                  Se creará una copia de <strong>{actividad.title}</strong> en{' '}
                  <strong>{unidad.title}</strong>
                  {periodoDeUnidad ? (
                    <>
                      {' '}
                      · <strong>{periodoDeUnidad.name}</strong>
                    </>
                  ) : (
                    <> · sin período</>
                  )}
                  .
                </p>
              </div>

              <div>
                <p className="text-body-sm font-semibold text-ink-primary">Se copia</p>
                <ul className="mt-1 space-y-0.5 text-body-sm text-ink-secondary">
                  <li>Las instrucciones y la configuración (nota máxima, intentos, tiempo límite).</li>
                  <li>Las preguntas y sus contextos, si las tiene.</li>
                  <li>La lección interactiva con sus diapositivas, si es una lección.</li>
                </ul>
              </div>

              <div>
                <p className="text-body-sm font-semibold text-ink-primary">No se copia</p>
                <ul className="mt-1 space-y-0.5 text-body-sm text-ink-secondary">
                  <li>Las entregas de tus estudiantes ni sus notas.</li>
                  <li>Las fechas: la copia nace sin fecha de apertura ni de entrega.</li>
                </ul>
              </div>

              <p className="text-body-sm text-ink-muted">
                La copia se llamará «{actividad.title} (copia)» y quedará como <strong>borrador</strong>:
                nadie la ve hasta que tú la publiques. La actividad original no se toca.
              </p>
            </div>
          )}

          {paso === 'listo' && (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
                <Check className="h-7 w-7 text-success-600" aria-hidden="true" />
              </span>
              <p className="mt-4 text-body-base font-semibold text-ink-primary">
                La copia quedó como borrador
              </p>
              <p className="mt-1 text-body-sm text-ink-secondary">
                Nadie la ve todavía. Revísala, ponle fechas y publícala cuando quieras.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3.5">
          {paso === 'destino' && (
            <>
              <button type="button" onClick={onCerrar} className={btnSec}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setPaso('revisar')}
                disabled={!unidadId}
                className={btnPrim}
              >
                Siguiente
              </button>
            </>
          )}

          {paso === 'revisar' && (
            <>
              <button type="button" onClick={() => setPaso('destino')} className={btnSec}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
              </button>
              <button type="button" onClick={copiar} disabled={copiando} className={btnPrim}>
                {copiando ? 'Copiando…' : 'Crear la copia'}
              </button>
            </>
          )}

          {paso === 'listo' && (
            <div className="flex w-full justify-end gap-2">
              <button type="button" onClick={onCerrar} className={btnSec}>
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => (nuevaId ? onCopiada(nuevaId) : onCerrar())}
                className={btnPrim}
              >
                Ver la copia
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
