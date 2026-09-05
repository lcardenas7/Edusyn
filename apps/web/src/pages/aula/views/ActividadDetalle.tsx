/**
 * El detalle de una actividad.
 *
 * Qué corrige:
 *  - P1-5 Se muestran los datos que existen y nunca se pintan: fecha de apertura, intentos,
 *         cuándo se publicará una programada, cuántos entregaron.
 *  - A6   La línea de tiempos completa, no solo "Vence".
 *  - P0-2 "Cancelar programación" ya no publica. Son dos acciones separadas y rotuladas: una
 *         devuelve a borrador (con confirmación) y otra publica ahora.
 *  - P0-5 Cero `catch {}`: toda acción falla en voz alta.
 *
 * Sobre lo que NO está aquí: los motores de quiz, examen, simulacro y autoevaluación viven
 * dentro de `Classroom.tsx` (no son componentes reutilizables), así que para esos tipos se
 * ofrece un puente honesto al aula actual en vez de una pantalla muerta. Las lecciones y los
 * juegos sí se abren aquí, porque `LessonPlayer` sí es un componente propio.
 */

import { Suspense, lazy, useState } from 'react'
import { ChevronLeft, Copy, Eye, EyeOff, CalendarClock, Paperclip, Pencil, Play, Trash2 } from 'lucide-react'
import { classroomApi } from '../../../lib/api'
import { toast } from '../../../lib/toast'
import { confirmDialog } from '../../../components/ui/confirm'
import type { ActivityLike } from '../model/activityState'
import { deriveStudentState, deriveTeacherState } from '../model/activityState'
import { activityTypeLabel, activityTypeMeta } from '../model/labels'
import { bogotaLongDate, bogotaTime, dueCopy, milestonesOf, opensCopy } from '../model/countdown'
import type { EntregaLike } from '../data/useActividad'
import type { Rol } from '../data/useAula'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { StudentStateChip, TeacherStateChip } from '../ui/StateChip'
import { Timeline } from '../ui/Timeline'
import { EntregaTarea } from '../ui/EntregaTarea'
import { ListaEntregas } from '../ui/ListaEntregas'
import { CopiarActividad } from '../ui/CopiarActividad'

const LessonPlayer = lazy(() => import('../../../components/LessonPlayer'))

/** Tipos cuyo motor todavía vive dentro de Classroom.tsx. */
const MOTOR_EN_AULA_ACTUAL = new Set(['QUIZ', 'EXAM', 'LIVE_QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR', 'SELF_ASSESSMENT'])
const ABRE_REPRODUCTOR = new Set(['LESSON', 'GAME'])

export interface ActividadDetalleProps {
  actividad: ActivityLike
  rol: Rol
  miEntrega: EntregaLike | null
  entregas: EntregaLike[]
  onVolver: () => void
  onCambio: () => void
  onIrAlAulaActual: () => void
  /** Aula en la que estamos: la necesita el asistente de copia. */
  aulaId?: string
  /** Abre otra actividad (se usa al terminar de copiar). */
  onAbrirActividad?: (id: string) => void
  now?: Date
}

export function ActividadDetalle({
  actividad: a,
  rol,
  miEntrega,
  entregas,
  onVolver,
  onCambio,
  onIrAlAulaActual,
  aulaId,
  onAbrirActividad,
  now = new Date(),
}: ActividadDetalleProps) {
  const [reproduciendo, setReproduciendo] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const esDocente = rol === 'docente'
  const vista = deriveStudentState(a, now)
  const vistaDocente = deriveTeacherState(a, now)
  const meta = activityTypeMeta(a.type)

  const hitos = milestonesOf(
    {
      publishedAt: a.publishedAt,
      openDate: a.openDate,
      dueDate: a.dueDate,
      submittedAt: miEntrega?.submittedAt,
      gradedAt: miEntrega?.gradedAt,
    },
    now,
  )

  const adjunto = (a as unknown as { attachmentUrl?: string; attachmentName?: string })

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onVolver}
        className="mb-3 inline-flex min-h-btn items-center gap-1 rounded-lg px-2 text-body-sm font-medium text-ink-muted hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Actividades
      </button>

      <article className="rounded-modal border border-hairline bg-surface-1 p-5 sm:p-6">
        {/* Encabezado */}
        <header className="flex flex-wrap items-start gap-4">
          <ActivityGlyph type={a.type} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: meta.ink }}>
              {activityTypeLabel(a.type, a.metadata)}
            </p>
            <h1 className="mt-0.5 text-h1 leading-tight font-bold text-ink-primary">{a.title}</h1>
            {a.section?.title && <p className="mt-1 text-body-sm text-ink-muted">{a.section.title}</p>}
          </div>
          {esDocente ? (
            <TeacherStateChip
              state={vistaDocente.state}
              suffix={vistaDocente.state === 'por-calificar' ? `· ${vistaDocente.porCalificar}` : undefined}
            />
          ) : (
            <StudentStateChip
              state={vista.state}
              suffix={vista.state === 'calificada' && vista.score != null ? `· ${vista.score.toFixed(1)}` : undefined}
            />
          )}
        </header>

        {/* Cuándo pasa cada cosa */}
        {hitos.length > 0 && (
          <div className="mt-5">
            <Timeline hitos={hitos} />
          </div>
        )}

        {/* Lo urgente, dicho en una frase */}
        {!esDocente && (opensCopy(a.openDate, now) || a.dueDate) && (
          <p className="mt-4 text-body-base font-medium text-ink-primary">
            {opensCopy(a.openDate, now) ?? dueCopy(a.dueDate, now)}
          </p>
        )}
        {esDocente && vistaDocente.state === 'programada' && vistaDocente.seProgramaPara && (
          <p className="mt-4 text-body-base font-medium text-ink-primary">
            Se publica sola el {bogotaLongDate(vistaDocente.seProgramaPara, now)} a las{' '}
            {bogotaTime(vistaDocente.seProgramaPara)}.
          </p>
        )}

        {/* Datos sueltos */}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-ink-secondary">
          {a.maxScore != null && (
            <div>
              <dt className="inline text-ink-muted">Vale </dt>
              <dd className="inline font-medium">{Number(a.maxScore)}</dd>
            </div>
          )}
          {vista.attempt && !esDocente && (
            <div>
              <dt className="inline text-ink-muted">Intento </dt>
              <dd className="inline font-medium">
                {vista.attempt.current} de {vista.attempt.max}
              </dd>
            </div>
          )}
          {esDocente && (
            <div>
              <dt className="inline text-ink-muted">Entregas </dt>
              <dd className="inline font-medium">{entregas.length}</dd>
            </div>
          )}
          {a.allowLateSubmit && (
            <div className="text-ink-muted">
              <dd className="inline">Acepta entregas tarde</dd>
            </div>
          )}
        </dl>

        {/* Qué hay que hacer */}
        {a.description && (
          <section className="mt-5">
            <h2 className="text-body-sm font-semibold text-ink-secondary">Instrucciones</h2>
            {/* El texto viene del editor enriquecido del docente. Se limpia a texto plano
                antes que confiar en insertar HTML de terceros en la página. */}
            <p className="mt-1 text-body-base leading-relaxed whitespace-pre-wrap text-ink-primary">
              {aTextoPlano(a.description)}
            </p>
          </section>
        )}

        {adjunto.attachmentUrl && (
          <a
            href={adjunto.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-btn items-center gap-2 rounded-lg border border-hairline px-3 text-body-sm font-medium text-ink-secondary hover:text-ink-primary"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {adjunto.attachmentName || 'Material adjunto'}
          </a>
        )}

        {/* Acciones. Para una tarea, el estudiante no tiene botón aquí: su acción es el panel
            de entrega de abajo, así que no se dibuja un separador con nada debajo. */}
        {(esDocente || tieneAccionEstudiante(a, vista.state)) && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-5">
            {esDocente ? (
              <AccionesDocente
                actividad={a}
                onCambio={onCambio}
                onVolver={onVolver}
                onEditar={onIrAlAulaActual}
                onCopiar={aulaId ? () => setCopiando(true) : undefined}
              />
            ) : (
              <AccionesEstudiante
                actividad={a}
                estado={vista.state}
                onAbrirReproductor={() => setReproduciendo(true)}
                onIrAlAulaActual={onIrAlAulaActual}
              />
            )}
          </div>
        )}
      </article>

      {/* Entrega / entregas */}
      <div className="mt-5">
        {!esDocente && a.type === 'TASK' && (
          <EntregaTarea actividad={a} entrega={miEntrega} vista={vista} onCambio={onCambio} now={now} />
        )}
        {esDocente && <ListaEntregas actividad={a} entregas={entregas} onCambio={onCambio} now={now} />}
      </div>

      {reproduciendo && (
        <Suspense fallback={null}>
          <LessonPlayer activityId={a.id} isTeacher={esDocente} onClose={() => setReproduciendo(false)} />
        </Suspense>
      )}

      {copiando && aulaId && (
        <CopiarActividad
          actividad={a}
          aulaActualId={aulaId}
          onCerrar={() => setCopiando(false)}
          onCopiada={(nueva) => {
            setCopiando(false)
            if (onAbrirActividad) onAbrirActividad(nueva)
            else onCambio()
          }}
        />
      )}
    </div>
  )
}

// ─── Acciones ────────────────────────────────────────────────────────────────

/** ¿El estudiante tiene algún botón que pulsar en la cabecera de esta actividad? */
function tieneAccionEstudiante(a: ActivityLike, estado: ReturnType<typeof deriveStudentState>['state']): boolean {
  if (estado === 'bloqueada' || estado === 'no-abierta') return false
  return ABRE_REPRODUCTOR.has(a.type) || MOTOR_EN_AULA_ACTUAL.has(a.type)
}

function AccionesEstudiante({
  actividad,
  estado,
  onAbrirReproductor,
  onIrAlAulaActual,
}: {
  actividad: ActivityLike
  estado: ReturnType<typeof deriveStudentState>['state']
  onAbrirReproductor: () => void
  onIrAlAulaActual: () => void
}) {
  if (estado === 'bloqueada' || estado === 'no-abierta') return null

  if (ABRE_REPRODUCTOR.has(actividad.type)) {
    return (
      <button
        type="button"
        onClick={onAbrirReproductor}
        className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Play className="h-4 w-4" aria-hidden="true" />
        {estado === 'calificada' || estado === 'entregada' ? 'Volver a verla' : 'Empezar'}
      </button>
    )
  }

  if (MOTOR_EN_AULA_ACTUAL.has(actividad.type)) {
    return (
      <div>
        <button
          type="button"
          onClick={onIrAlAulaActual}
          className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Resolver en el aula actual
        </button>
        <p className="mt-2 text-body-sm text-ink-muted">
          Este tipo de actividad todavía se resuelve en la versión anterior del aula. Tu progreso y tus
          respuestas son los mismos.
        </p>
      </div>
    )
  }

  return null
}

function AccionesDocente({
  actividad: a,
  onCambio,
  onVolver,
  onEditar,
  onCopiar,
}: {
  actividad: ActivityLike
  onCambio: () => void
  onVolver: () => void
  onEditar: () => void
  onCopiar?: () => void
}) {
  const [ocupado, setOcupado] = useState(false)

  const publicarAhora = async () => {
    setOcupado(true)
    try {
      await classroomApi.publishActivity(a.id)
      toast.success('Publicada', 'Tus estudiantes ya pueden verla.')
      onCambio()
    } catch (e) {
      toast.error(e)
    } finally {
      setOcupado(false)
    }
  }

  /**
   * Aquí estaba el defecto P0-2. En el aula actual, "Cancelar programación" llama a
   * `handlePublish(id, false)`, que cae en la rama que ejecuta `publishActivity`: el botón
   * promete cancelar y lo que hace es **publicar la actividad de inmediato**, delante de todos
   * los estudiantes. Son dos acciones distintas y aquí están separadas.
   */
  const volverABorrador = async () => {
    const ok = await confirmDialog(
      'La actividad dejará de estar publicada y tus estudiantes no la verán hasta que la vuelvas a publicar. Sus entregas no se borran.',
      { title: 'Volver a borrador', confirmLabel: 'Sí, volver a borrador' },
    )
    if (!ok) return
    setOcupado(true)
    try {
      await classroomApi.unpublishActivity(a.id)
      toast.success('Volvió a borrador')
      onCambio()
    } catch (e) {
      toast.error(e)
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = async () => {
    const ok = await confirmDialog(
      'Se eliminará la actividad. Esta acción NO se puede deshacer.',
      { title: `Eliminar "${a.title}"`, danger: true },
    )
    if (!ok) return
    setOcupado(true)
    try {
      await classroomApi.deleteActivity(a.id)
      toast.success('Actividad eliminada')
      onVolver()
    } catch (e) {
      toast.error(e)
    } finally {
      setOcupado(false)
    }
  }

  const btn =
    'inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline px-3.5 text-body-sm font-medium text-ink-secondary transition-colors hover:text-ink-primary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

  return (
    <>
      {!a.isPublished ? (
        <button type="button" onClick={publicarAhora} disabled={ocupado} className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none">
          <Eye className="h-4 w-4" aria-hidden="true" /> Publicar ahora
        </button>
      ) : (
        <button type="button" onClick={volverABorrador} disabled={ocupado} className={btn}>
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Volver a borrador
        </button>
      )}

      {a.scheduledPublishAt && !a.isPublished && (
        <span className="inline-flex min-h-btn items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-body-sm text-ink-secondary">
          <CalendarClock className="h-4 w-4" aria-hidden="true" /> Programada
        </span>
      )}

      <button type="button" onClick={onEditar} disabled={ocupado} className={btn}>
        <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
      </button>
      <button type="button" onClick={onCopiar ?? onEditar} disabled={ocupado} className={btn}>
        <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
      </button>
      <button
        type="button"
        onClick={eliminar}
        disabled={ocupado}
        className="inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-danger-100 px-3.5 text-body-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar
      </button>
    </>
  )
}

/** HTML del editor → texto plano. */
function aTextoPlano(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ')
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').trim()
}
