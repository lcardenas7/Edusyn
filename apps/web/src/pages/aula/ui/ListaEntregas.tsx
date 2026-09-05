/**
 * Las entregas de una actividad, para el docente: ver, calificar y devolver.
 *
 * Corrige P0-4, el defecto más feo del aula actual: "Devolver" pide la retroalimentación con
 * un `window.prompt()` nativo y luego hace `fb || undefined`, así que **si el docente pulsa
 * Cancelar, la entrega se devuelve igual, sin comentario**. Aquí cancelar cancela, y el
 * comentario se escribe en un campo de verdad.
 *
 * También: nada de `catch {}`. Si calificar falla, el docente se entera en vez de creer que
 * guardó (P0-5).
 */

import { useState } from 'react'
import { RotateCcw, Save, X } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'
import type { ActivityLike } from '../model/activityState'
import type { EntregaLike } from '../data/useActividad'
import { agoCopy } from '../model/countdown'
import { submissionStateMeta, TONE_CLASSES } from '../model/labels'
import { EmptyState } from './EmptyState'
import { textoLegible } from '../model/texto'

const nombreDe = (e: EntregaLike): string => {
  const s = e.studentEnrollment?.student
  if (!s) return 'Estudiante'
  return [s.firstName, s.lastName, s.secondLastName].filter(Boolean).join(' ')
}

const ESPERANDO = new Set(['SUBMITTED', 'LATE'])

export function ListaEntregas({
  actividad,
  entregas,
  totalEstudiantes,
  onCambio,
  now = new Date(),
}: {
  actividad: ActivityLike
  entregas: EntregaLike[]
  /** Cuántos estudiantes hay en el grupo, para saber cuántos faltan. */
  totalEstudiantes?: number | null
  onCambio: () => void
  now?: Date
}) {
  const [abierta, setAbierta] = useState<string | null>(null)

  if (entregas.length === 0) {
    return (
      <EmptyState
        scene="sin-actividades"
        title="Todavía no hay entregas"
        detail={
          totalEstudiantes
            ? `Ninguno de tus ${totalEstudiantes} estudiantes ha entregado todavía.`
            : 'Cuando tus estudiantes entreguen, las verás aquí para calificarlas.'
        }
        compact
      />
    )
  }

  // Primero las que esperan nota: es el trabajo que el docente vino a hacer.
  const ordenadas = [...entregas].sort((a, b) => {
    const pa = ESPERANDO.has(a.status) ? 0 : 1
    const pb = ESPERANDO.has(b.status) ? 0 : 1
    if (pa !== pb) return pa - pb
    return nombreDe(a).localeCompare(nombreDe(b), 'es')
  })

  const porCalificar = ordenadas.filter((e) => ESPERANDO.has(e.status)).length
  // Lo que el docente pregunta primero y hasta ahora no se respondía: quién falta.
  const faltan = totalEstudiantes != null ? Math.max(0, totalEstudiantes - entregas.length) : null

  return (
    <section aria-labelledby="entregas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="entregas" className="text-body-base font-semibold text-ink-primary">
          Entregas{' '}
          <span className="text-ink-muted">
            {totalEstudiantes != null ? `(${entregas.length} de ${totalEstudiantes})` : `(${entregas.length})`}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {porCalificar > 0 && (
            <span className="rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-badge font-medium text-warning-700">
              {porCalificar} {porCalificar === 1 ? 'espera nota' : 'esperan nota'}
            </span>
          )}
          {faltan != null && faltan > 0 && (
            <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-badge font-medium text-ink-secondary">
              {faltan} sin entregar
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {ordenadas.map((e) => (
          <li key={e.id}>
            <FilaEntrega
              entrega={e}
              actividad={actividad}
              abierta={abierta === e.id}
              onAbrir={() => setAbierta(abierta === e.id ? null : e.id)}
              onCambio={() => {
                setAbierta(null)
                onCambio()
              }}
              now={now}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FilaEntrega({
  entrega,
  actividad,
  abierta,
  onAbrir,
  onCambio,
  now,
}: {
  entrega: EntregaLike
  actividad: ActivityLike
  abierta: boolean
  onAbrir: () => void
  onCambio: () => void
  now: Date
}) {
  const meta = submissionStateMeta(entrega.status)
  const max = actividad.maxScore != null ? Number(actividad.maxScore) : 5

  const [nota, setNota] = useState(entrega.score != null ? String(entrega.score) : '')
  const [comentario, setComentario] = useState(entrega.feedback ?? '')
  const [guardando, setGuardando] = useState(false)
  const [devolviendo, setDevolviendo] = useState(false)

  const calificar = async () => {
    const valor = Number(nota.replace(',', '.'))
    if (!nota.trim() || Number.isNaN(valor)) {
      toast.warning('Escribe una nota válida')
      return
    }
    if (valor < 0 || valor > max) {
      toast.warning(`La nota tiene que estar entre 0 y ${max}`)
      return
    }
    setGuardando(true)
    try {
      await classroomApi.gradeSubmission(entrega.id, { score: valor, feedback: comentario || undefined })
      toast.success('Nota guardada')
      onCambio()
    } catch (e) {
      toast.error(e)
    } finally {
      setGuardando(false)
    }
  }

  const devolver = async () => {
    // El defecto P0-4 era exactamente esto: cancelar el prompt devolvía igual. Aquí el
    // comentario es obligatorio, porque devolver sin decir qué corregir no ayuda a nadie.
    if (!comentario.trim()) {
      toast.warning('Escribe qué debe corregir antes de devolver la entrega')
      return
    }
    setDevolviendo(true)
    try {
      await classroomApi.returnSubmission(entrega.id, { feedback: comentario })
      toast.success('Entrega devuelta', 'El estudiante la verá como "Devuelta" y podrá corregirla.')
      onCambio()
    } catch (e) {
      toast.error(e)
    } finally {
      setDevolviendo(false)
    }
  }

  return (
    <div className="rounded-card border border-hairline bg-surface-1">
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 p-3.5 text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink-secondary">
          {nombreDe(entrega)
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-sm font-medium text-ink-primary">{nombreDe(entrega)}</span>
          {entrega.submittedAt && (
            <span className="block text-xs text-ink-muted">Entregó {agoCopy(entrega.submittedAt, now)}</span>
          )}
        </span>
        {entrega.score != null && (
          <span className="shrink-0 text-body-base font-bold text-ink-primary tabular-nums">
            {Number(entrega.score).toFixed(1)}
          </span>
        )}
        <span
          className={`hidden shrink-0 items-center rounded-full border px-2.5 py-1 text-badge font-medium sm:inline-flex ${TONE_CLASSES[meta.tone]}`}
        >
          {meta.label}
        </span>
      </button>

      {abierta && (
        <div className="border-t border-hairline p-3.5">
          {entrega.content && (
            <div className="mb-3 rounded-lg bg-surface-2 p-3">
              <p className="text-xs font-semibold text-ink-secondary">Lo que entregó</p>
              <p className="mt-1 text-body-sm whitespace-pre-wrap break-words text-ink-primary">{textoLegible(entrega.content)}</p>
            </div>
          )}
          {entrega.fileUrl && (
            <a
              href={entrega.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 inline-block text-body-sm font-medium text-accent hover:underline"
            >
              Abrir el archivo que subió
            </a>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`nota-${entrega.id}`} className="block text-xs font-semibold text-ink-secondary">
                Nota (0 a {max})
              </label>
              <input
                id={`nota-${entrega.id}`}
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={max}
                value={nota}
                onChange={(ev) => setNota(ev.target.value)}
                className="mt-1 min-h-btn w-24 rounded-lg border border-hairline bg-surface-1 px-3 text-body-sm text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor={`fb-${entrega.id}`} className="block text-xs font-semibold text-ink-secondary">
                Comentario para el estudiante
              </label>
              <textarea
                id={`fb-${entrega.id}`}
                value={comentario}
                onChange={(ev) => setComentario(ev.target.value)}
                rows={2}
                placeholder="Qué hizo bien y qué puede mejorar…"
                className="mt-1 w-full rounded-lg border border-hairline bg-surface-1 p-2.5 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={calificar}
              disabled={guardando}
              className="inline-flex min-h-btn items-center gap-1.5 rounded-lg bg-accent px-4 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Save className="h-4 w-4" aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
            <button
              type="button"
              onClick={devolver}
              disabled={devolviendo}
              title="El estudiante podrá corregirla y volver a entregar"
              className="inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline px-4 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {devolviendo ? 'Devolviendo…' : 'Devolver para corregir'}
            </button>
            <button
              type="button"
              onClick={onAbrir}
              className="inline-flex min-h-btn items-center gap-1.5 rounded-lg px-3 text-body-sm text-ink-muted hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <X className="h-4 w-4" aria-hidden="true" /> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
