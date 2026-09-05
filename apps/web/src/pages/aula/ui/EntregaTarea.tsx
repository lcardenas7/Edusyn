/**
 * El panel de entrega de una tarea, para el estudiante.
 *
 * Reglas que aquí se respetan y que hoy no siempre se cumplen:
 *  - Se dice **por qué** no se puede entregar, en vez de esconder el botón sin más.
 *  - Una entrega ya calificada no se puede pisar por accidente.
 *  - Si venció y el docente no permite entregas tardías, se dice; no se deja intentar y fallar.
 *  - Nada de `catch {}`: si la entrega no sube, el estudiante se entera (P0-5).
 */

import { useState } from 'react'
import { Paperclip, Send, TriangleAlert } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'
import { confirmDialog } from '../../../components/ui/confirm'
import type { ActivityLike, StudentView } from '../model/activityState'
import type { EntregaLike } from '../data/useActividad'
import { agoCopy, dueCopy } from '../model/countdown'
import { submissionStateMeta, TONE_CLASSES } from '../model/labels'

export function EntregaTarea({
  actividad,
  entrega,
  vista,
  onCambio,
  now = new Date(),
}: {
  actividad: ActivityLike
  entrega: EntregaLike | null
  vista: StudentView
  onCambio: () => void
  now?: Date
}) {
  const [texto, setTexto] = useState(entrega?.content ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  const calificada = vista.state === 'calificada'
  const vencida = vista.state === 'vencida'
  const permiteTarde = actividad.allowLateSubmit === true
  const bloqueadaPorFecha = vencida && !permiteTarde
  const noAbierta = vista.state === 'no-abierta'
  const bloqueada = vista.state === 'bloqueada'

  // El único caso en el que de verdad se puede escribir.
  const puedeEntregar = !calificada && !bloqueadaPorFecha && !noAbierta && !bloqueada

  const yaEntregada = !!entrega?.submittedAt
  const meta = submissionStateMeta(entrega?.status)

  const enviar = async () => {
    // Una entrega puede ser solo un archivo: hay tareas que se entregan en foto o en PDF y no
    // tienen nada que escribir.
    if (!texto.trim() && !archivo && !entrega?.fileUrl) {
      toast.warning('Escribe tu respuesta o adjunta un archivo antes de enviar')
      return
    }
    if (yaEntregada) {
      const ok = await confirmDialog('Vas a reemplazar lo que ya habías entregado. ¿Continuar?', {
        title: 'Reemplazar tu entrega',
        confirmLabel: 'Sí, reemplazar',
      })
      if (!ok) return
    }

    setEnviando(true)
    try {
      let fileUrl: string | undefined
      if (archivo) {
        const { data } = await classroomApi.uploadMaterial(archivo)
        fileUrl = data?.data?.path || data?.data?.url
      }
      const contenido = texto.trim() || undefined
      if (entrega?.id) {
        // Sin archivo nuevo se conserva el que ya había: reemplazar una entrega solo para
        // corregir el texto no debe borrar el adjunto.
        await classroomApi.updateSubmission(entrega.id, {
          content: contenido,
          fileUrl: fileUrl ?? entrega.fileUrl ?? undefined,
        })
      } else {
        await classroomApi.submitTask(actividad.id, { content: contenido, fileUrl })
      }
      setArchivo(null)
      toast.success(yaEntregada ? 'Actualizamos tu entrega' : 'Entrega enviada')
      onCambio()
    } catch (e) {
      // Sin `catch {}`: si no subió, el estudiante tiene que saberlo para reintentar.
      toast.error(e)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-labelledby="mi-entrega" className="rounded-card border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mi-entrega" className="text-body-base font-semibold text-ink-primary">
          Tu entrega
        </h2>
        {entrega && (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-badge font-medium ${TONE_CLASSES[meta.tone]}`}
          >
            {meta.label}
          </span>
        )}
      </div>

      {entrega?.submittedAt && (
        <p className="mt-1 text-body-sm text-ink-muted">Enviaste {agoCopy(entrega.submittedAt, now)}.</p>
      )}

      {/* Nota y comentario del docente */}
      {entrega?.score != null && (
        <div className="mt-3 rounded-lg bg-success-50 px-4 py-3">
          <p className="text-h3 font-bold text-success-700">
            {Number(entrega.score).toFixed(1)}
            {actividad.maxScore != null && (
              <span className="text-body-sm font-normal text-ink-secondary"> de {Number(actividad.maxScore)}</span>
            )}
          </p>
        </div>
      )}
      {entrega?.feedback && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface-2 px-4 py-3">
          <p className="text-body-sm font-semibold text-ink-primary">Comentario de tu profe</p>
          <p className="mt-1 text-body-sm whitespace-pre-wrap text-ink-secondary">{entrega.feedback}</p>
        </div>
      )}

      {/* Por qué no se puede entregar — dicho, no escondido */}
      {!puedeEntregar && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-3 text-body-sm text-ink-secondary">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          {calificada
            ? 'Esta entrega ya tiene nota, así que no se puede cambiar. Si necesitas corregir algo, habla con tu profe.'
            : bloqueadaPorFecha
              ? `${dueCopy(actividad.dueDate, now)} y tu profe no aceptó entregas tarde. Habla con él o ella.`
              : noAbierta
                ? 'Todavía no puedes entregar: la actividad aún no abre.'
                : 'Primero tienes que completar lo que esta actividad pide.'}
        </p>
      )}

      {puedeEntregar && (
        <div className="mt-3">
          <label htmlFor="respuesta" className="sr-only">
            Tu respuesta
          </label>
          <textarea
            id="respuesta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder="Escribe aquí tu respuesta…"
            className="w-full rounded-lg border border-hairline bg-surface-1 p-3 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          />

          {/* Adjuntar: muchas tareas se entregan en foto o en PDF, no escribiendo. */}
          <div className="mt-3">
            <label
              htmlFor={`archivo-${actividad.id}`}
              className="inline-flex min-h-btn cursor-pointer items-center gap-2 rounded-lg border border-hairline px-3.5 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              {archivo ? 'Cambiar el archivo' : 'Adjuntar un archivo'}
            </label>
            <input
              id={`archivo-${actividad.id}`}
              type="file"
              className="sr-only"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            {archivo && (
              <span className="ml-2 text-body-sm text-ink-secondary">
                {archivo.name}{' '}
                <button
                  type="button"
                  onClick={() => setArchivo(null)}
                  className="font-medium text-accent hover:underline"
                >
                  quitar
                </button>
              </span>
            )}
            {!archivo && entrega?.fileUrl && (
              <span className="ml-2 text-body-sm text-ink-muted">Ya tienes un archivo adjunto</span>
            )}
          </div>

          {vencida && permiteTarde && (
            <p className="mt-2 text-body-sm text-warning-700">
              {dueCopy(actividad.dueDate, now)}, pero tu profe acepta entregas tarde. Quedará marcada como tardía.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando}
              className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {enviando ? 'Enviando…' : yaEntregada ? 'Actualizar mi entrega' : 'Enviar'}
            </button>
            {entrega?.fileUrl && (
              <a
                href={entrega.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline px-3 text-body-sm text-ink-secondary hover:text-ink-primary"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" /> Ver el archivo que subiste
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
