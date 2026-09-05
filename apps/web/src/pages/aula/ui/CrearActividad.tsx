/**
 * Crear una actividad, sin salir del aula.
 *
 * Hasta ahora el aula nueva mandaba al docente al aula anterior para esto, que es lo que más
 * hace: es la fricción más grande que quedaba.
 *
 * Qué mejora respecto del formulario actual:
 *  - **Cada mecánica se explica.** Hoy "Evaluar" ofrece seis opciones, tres de ellas variantes
 *    de quiz, sin decir en qué se diferencian (`model/creacion.ts`).
 *  - **Solo se piden los campos que aplican.** A un juego de repaso no se le pregunta la nota
 *    máxima; a una lección, cuántos intentos.
 *  - **Crear una unidad al vuelo no usa `window.prompt()`** (defecto documentado): se escribe
 *    en el propio formulario.
 *  - **El período se elige y se ve.** Es el dato que, si falta, deja la actividad invisible al
 *    filtrar — el mismo agujero que P0-1.
 *  - Cero `catch {}`: si la creación falla, se dice.
 */

import { useState } from 'react'
import { ArrowLeft, Check, Plus, X } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'
import { bogotaInputToIso } from '../../../lib/datetime'
import {
  aPayloadDeTipo,
  camposDe,
  INTENCIONES,
  mecanicaDe,
  mecanicasDe,
  type Intencion,
  type MecanicaMeta,
} from '../model/creacion'
import type { PeriodoOpcion } from './AulaShell'
import { ActivityGlyph } from '../visual/ActivityGlyph'

export interface UnidadOpcion {
  id: string
  title: string
  academicTermId?: string | null
}

export interface CrearActividadProps {
  aulaId: string
  unidades: UnidadOpcion[]
  periodos: PeriodoOpcion[]
  /** Período con el que se entra, para no obligar a elegirlo otra vez. */
  periodoActual?: string | null
  onCerrar: () => void
  /**
   * Se llama con la actividad creada y con dónde seguir: el editor de lecciones y juegos vive
   * aquí, pero el de preguntas de quiz todavía no.
   */
  onCreada: (actividad: { id: string; title: string; type: string }, siguiente: MecanicaMeta['siguiente']) => void
}

type Paso = 'intencion' | 'mecanica' | 'datos'

export function CrearActividad({
  aulaId,
  unidades,
  periodos,
  periodoActual,
  onCerrar,
  onCreada,
}: CrearActividadProps) {
  const [paso, setPaso] = useState<Paso>('intencion')
  const [intencion, setIntencion] = useState<Intencion | null>(null)
  const [tipo, setTipo] = useState<string>('')

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [nuevaUnidad, setNuevaUnidad] = useState('')
  const [creandoUnidad, setCreandoUnidad] = useState(false)
  const [periodo, setPeriodo] = useState(periodoActual ?? '')
  const [vence, setVence] = useState('')
  const [notaMax, setNotaMax] = useState('5.0')
  const [aceptaTarde, setAceptaTarde] = useState(false)
  const [intentos, setIntentos] = useState('1')
  const [minutos, setMinutos] = useState('')
  const [creando, setCreando] = useState(false)

  const mecanica = tipo ? mecanicaDe(tipo) : null
  const campos = tipo ? camposDe(tipo) : null

  const btnPrim =
    'inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none'
  const btnSec =
    'inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline px-4 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

  const crear = async () => {
    if (!titulo.trim() || !mecanica) return
    setCreando(true)
    try {
      // La unidad nueva se crea antes, para poder colgar la actividad de ella.
      let seccionFinal = unidadId
      if (creandoUnidad && nuevaUnidad.trim()) {
        const { data } = await classroomApi.createSection(aulaId, {
          title: nuevaUnidad.trim(),
          academicTermId: periodo || null,
        })
        seccionFinal = data.id
      }

      const { type, gameType } = aPayloadDeTipo(tipo)
      const { data: creada } = await classroomApi.createActivity(aulaId, {
        sectionId: seccionFinal || undefined,
        academicTermId: periodo || undefined,
        type,
        title: titulo.trim(),
        description: descripcion.trim() || undefined,
        ...(gameType ? { gameType } : {}),
        ...(campos?.calificable ? { maxScore: parseFloat(notaMax) || 5 } : {}),
        ...(campos?.calificable && vence ? { dueDate: bogotaInputToIso(vence) } : {}),
        ...(campos?.esTarea ? { allowLateSubmit: aceptaTarde } : {}),
        ...(campos?.conPreguntas
          ? {
              maxAttempts: parseInt(intentos, 10) || 1,
              timeLimitMinutes: minutos ? parseInt(minutos, 10) : undefined,
            }
          : {}),
      } as Parameters<typeof classroomApi.createActivity>[1])

      toast.success('Creada como borrador', 'Nadie la ve hasta que la publiques.')
      onCreada({ id: creada.id, title: creada.title, type: creada.type }, mecanica.siguiente)
    } catch (e) {
      toast.error(e)
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-primary/40 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-titulo"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-modal bg-surface-1 shadow-xl sm:rounded-modal"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 id="crear-titulo" className="text-body-base font-semibold text-ink-primary">
              {paso === 'intencion'
                ? '¿Qué quieres hacer?'
                : paso === 'mecanica'
                  ? '¿Cómo lo quieres hacer?'
                  : mecanica?.label}
            </h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              {paso === 'datos' ? 'Se creará como borrador.' : `Paso ${paso === 'intencion' ? 1 : 2} de 3`}
            </p>
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
          {/* ─── Paso 1: la intención, no la herramienta ─────────────────── */}
          {paso === 'intencion' && (
            <div className="space-y-2">
              {INTENCIONES.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    setIntencion(i.id)
                    const opciones = mecanicasDe(i.id)
                    // Con una sola mecánica no hay nada que elegir: se salta el paso.
                    if (opciones.length === 1) {
                      setTipo(opciones[0].type)
                      setPaso('datos')
                    } else {
                      setPaso('mecanica')
                    }
                  }}
                  className="flex w-full items-start gap-3 rounded-card border border-hairline p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.04] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ActivityGlyph
                    family={i.id === 'evaluar' ? 'quiz' : i.id === 'practicar' ? 'juego' : i.id === 'aprender' ? 'leccion' : 'tarea'}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-base font-semibold text-ink-primary">{i.label}</span>
                    <span className="mt-0.5 block text-body-sm text-ink-secondary">{i.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Paso 2: la mecánica, con su diferencia dicha ────────────── */}
          {paso === 'mecanica' && intencion && (
            <div className="space-y-2">
              {mecanicasDe(intencion).map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => {
                    setTipo(m.type)
                    setPaso('datos')
                  }}
                  className="flex w-full items-start gap-3 rounded-card border border-hairline p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.04] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ActivityGlyph type={aPayloadDeTipo(m.type).type} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold text-ink-primary">{m.label}</span>
                    <span className="mt-0.5 block text-body-sm text-ink-secondary">{m.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Paso 3: solo lo que aplica a este tipo ──────────────────── */}
          {paso === 'datos' && campos && (
            <div className="space-y-4">
              <div>
                <label htmlFor="act-titulo" className="block text-body-sm font-medium text-ink-primary">
                  ¿Cómo se llama? <span className="text-danger-600">*</span>
                </label>
                <input
                  id="act-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  autoFocus
                  placeholder="Taller de ecuaciones lineales"
                  className="mt-1 min-h-btn w-full rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
              </div>

              <div>
                <label htmlFor="act-desc" className="block text-body-sm font-medium text-ink-primary">
                  Instrucciones <span className="font-normal text-ink-muted">(opcional)</span>
                </label>
                <textarea
                  id="act-desc"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Qué tienen que hacer, y con qué material."
                  className="mt-1 w-full rounded-lg border border-hairline bg-surface-1 p-3 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
              </div>

              {/* Unidad: crear una nueva NO abre un prompt del navegador */}
              <div>
                <span className="block text-body-sm font-medium text-ink-primary">Unidad</span>
                {creandoUnidad ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={nuevaUnidad}
                      onChange={(e) => setNuevaUnidad(e.target.value)}
                      autoFocus
                      placeholder="Nombre de la nueva unidad"
                      className="min-h-btn min-w-0 flex-1 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    />
                    <button type="button" onClick={() => setCreandoUnidad(false)} className={btnSec}>
                      Elegir una
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-2">
                    <select
                      value={unidadId}
                      onChange={(e) => setUnidadId(e.target.value)}
                      className="min-h-btn min-w-0 flex-1 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    >
                      <option value="">Sin unidad</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.title}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setCreandoUnidad(true)} className={btnSec}>
                      <Plus className="h-4 w-4" aria-hidden="true" /> Nueva
                    </button>
                  </div>
                )}
              </div>

              {periodos.length > 0 && (
                <div>
                  <label htmlFor="act-periodo" className="block text-body-sm font-medium text-ink-primary">
                    Período
                  </label>
                  <select
                    id="act-periodo"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className={`mt-1 min-h-btn w-full rounded-lg border bg-surface-1 px-3 text-body-sm text-ink-primary ${
                      periodo ? 'border-hairline' : 'border-warning-500'
                    }`}
                  >
                    <option value="">Sin período</option>
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.activo ? ' · en curso' : ''}
                      </option>
                    ))}
                  </select>
                  {!periodo && (
                    <p className="mt-1 text-body-sm text-warning-700">
                      Sin período no aparecerá al filtrar por período, ni para ti ni para tus estudiantes.
                    </p>
                  )}
                </div>
              )}

              {campos.calificable && (
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label htmlFor="act-nota" className="block text-body-sm font-medium text-ink-primary">
                      Vale
                    </label>
                    <input
                      id="act-nota"
                      type="number"
                      step="0.1"
                      min={0}
                      value={notaMax}
                      onChange={(e) => setNotaMax(e.target.value)}
                      className="mt-1 min-h-btn w-24 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="act-vence" className="block text-body-sm font-medium text-ink-primary">
                      Se entrega hasta <span className="font-normal text-ink-muted">(opcional)</span>
                    </label>
                    <input
                      id="act-vence"
                      type="datetime-local"
                      value={vence}
                      onChange={(e) => setVence(e.target.value)}
                      className="mt-1 min-h-btn w-full rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    />
                  </div>
                </div>
              )}

              {campos.conPreguntas && (
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label htmlFor="act-intentos" className="block text-body-sm font-medium text-ink-primary">
                      Intentos
                    </label>
                    <input
                      id="act-intentos"
                      type="number"
                      min={1}
                      value={intentos}
                      onChange={(e) => setIntentos(e.target.value)}
                      className="mt-1 min-h-btn w-24 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="act-minutos" className="block text-body-sm font-medium text-ink-primary">
                      Minutos <span className="font-normal text-ink-muted">(vacío = sin límite)</span>
                    </label>
                    <input
                      id="act-minutos"
                      type="number"
                      min={1}
                      value={minutos}
                      onChange={(e) => setMinutos(e.target.value)}
                      className="mt-1 min-h-btn w-28 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary"
                    />
                  </div>
                </div>
              )}

              {campos.esTarea && (
                <label className="flex cursor-pointer items-center gap-2.5 text-body-sm text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={aceptaTarde}
                    onChange={(e) => setAceptaTarde(e.target.checked)}
                    className="accent-accent"
                  />
                  Aceptar entregas después de la fecha
                </label>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3.5">
          <button
            type="button"
            onClick={() => {
              if (paso === 'datos') setPaso(intencion && mecanicasDe(intencion).length > 1 ? 'mecanica' : 'intencion')
              else if (paso === 'mecanica') setPaso('intencion')
              else onCerrar()
            }}
            className={btnSec}
          >
            {paso === 'intencion' ? (
              'Cancelar'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
              </>
            )}
          </button>

          {paso === 'datos' && (
            <button type="button" onClick={crear} disabled={!titulo.trim() || creando} className={btnPrim}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {creando ? 'Creando…' : 'Crear borrador'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
