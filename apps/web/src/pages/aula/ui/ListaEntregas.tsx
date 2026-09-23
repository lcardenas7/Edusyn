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
import type { AlumnoActividad, EntregaLike } from '../data/useActividad'
import { agoCopy } from '../model/countdown'
import { submissionStateMeta, TONE_CLASSES } from '../model/labels'
import { EmptyState } from './EmptyState'
import { textoLegible } from '../model/texto'
import { SmartAudio } from '../../../components/media/SmartMedia'
import { nombrePorApellido, resumenParticipacion } from '../model/participacion'

const nombreDe = (e: EntregaLike): string => {
  const s = e.studentEnrollment?.student
  if (!s) return 'Estudiante'
  return nombrePorApellido(s)
}

const ESPERANDO = new Set(['SUBMITTED', 'LATE'])

export function ListaEntregas({
  actividad,
  entregas,
  alumnos,
  errorAlumnos,
  onCambio,
  now = new Date(),
}: {
  actividad: ActivityLike
  entregas: EntregaLike[]
  alumnos: AlumnoActividad[] | null
  errorAlumnos: string | null
  onCambio: () => void
  now?: Date
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'entregaron' | 'todos' | 'sin-entregar'>('entregaron')
  const participacion = resumenParticipacion(alumnos, entregas)
  const porCalificar = participacion.entregaron.filter((e) => ESPERANDO.has(e.status)).length
  // Una recarga fallida no debe dejar una vista vacía que parezca "todos entregaron".
  const filtroVisible = alumnos === null ? 'entregaron' : filtro
  const visibles = filtroVisible === 'sin-entregar' ? [] : participacion.entregaron
  const pendientes = filtroVisible === 'entregaron' ? [] : participacion.sinEntregar ?? []

  return (
    <section aria-labelledby="entregas">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="entregas" className="text-body-base font-semibold text-ink-primary">
          Entregas{' '}
          <span className="text-ink-muted">
            {participacion.total != null
              ? `(${participacion.estudiantesQueEntregaron} de ${participacion.total} estudiantes)`
              : `(${participacion.entregaron.length})`}
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {porCalificar > 0 && (
            <span className="rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-badge font-medium text-warning-700">
              {porCalificar} {porCalificar === 1 ? 'espera nota' : 'esperan nota'}
            </span>
          )}
          {participacion.sinEntregar != null && participacion.sinEntregar.length > 0 && (
            <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-badge font-medium text-ink-secondary">
              {participacion.sinEntregar.length} sin entregar
            </span>
          )}
        </div>
      </div>

      {errorAlumnos && (
        <p role="alert" className="mb-3 text-body-sm text-warning-700">
          No se pudo comprobar quién falta por entregar: {errorAlumnos}.{' '}
          <button type="button" onClick={onCambio} className="font-semibold underline">Reintentar</button>
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar estudiantes por entrega">
        {([
          ['entregaron', 'Entregaron'], ['todos', 'Todos'], ['sin-entregar', 'Sin entregar'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filtroVisible === value}
            disabled={value !== 'entregaron' && alumnos === null}
            onClick={() => setFiltro(value)}
            className={`min-h-btn rounded-lg border px-3 text-body-sm font-medium focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${filtroVisible === value ? 'border-accent bg-accent/10 text-accent' : 'border-hairline text-ink-secondary'}`}
          >
            {label}{value === 'sin-entregar' && participacion.sinEntregar ? ` (${participacion.sinEntregar.length})` : ''}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visibles.map((e) => (
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
        {pendientes.map((alumno) => (
          <li key={alumno.enrollmentId} className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface-1 p-3.5">
            <span className="min-w-0 text-body-sm font-medium text-ink-primary">{nombrePorApellido(alumno)}</span>
            <span className="shrink-0 text-badge text-ink-muted">Sin entregar</span>
          </li>
        ))}
      </ul>
      {visibles.length === 0 && pendientes.length === 0 && (
        <EmptyState scene="sin-actividades" title={filtroVisible === 'sin-entregar' ? 'Todos entregaron' : 'Todavía no hay entregas'}
          detail={filtroVisible === 'sin-entregar' ? 'No quedan estudiantes sin entrega registrada.' : 'Cuando tus estudiantes entreguen, las verás aquí para calificarlas.'} compact />
      )}
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
  const esDeAudio = actividad.metadata?.audioResponse === true
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
            /* En una tarea de audio, mandar al docente a otra pestaña para escuchar treinta
               grabaciones es inservible: se reproduce aquí mismo y se deja igualmente el enlace
               para descargar. `SmartAudio` resuelve la URL firmada del almacenamiento. */
            esDeAudio ? (
              <div className="mb-3">
                <SmartAudio src={entrega.fileUrl} className="w-full max-w-md" />
                <a
                  href={entrega.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-body-sm font-medium text-accent hover:underline"
                >
                  Descargar la grabación
                </a>
              </div>
            ) : (
              <a
                href={entrega.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 inline-block text-body-sm font-medium text-accent hover:underline"
              >
                Abrir el archivo que subió
              </a>
            )
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
