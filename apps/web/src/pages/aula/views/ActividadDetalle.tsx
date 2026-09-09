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
import { BarChart3, ChevronLeft, Copy, Eye, EyeOff, CalendarClock, Paperclip, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react'
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
import { textoLegible } from '../model/texto'

const LessonPlayer = lazy(() => import('../../../components/LessonPlayer'))

/** Tipos cuyo motor todavía vive dentro de Classroom.tsx. */
const MOTOR_COMPARTIDO = new Set(['QUIZ', 'EXAM', 'LIVE_QUIZ', 'HOME_QUIZ', 'ICFES_SIMULATOR', 'SELF_ASSESSMENT'])
const ABRE_REPRODUCTOR = new Set(['LESSON', 'GAME'])

export interface ActividadDetalleProps {
  actividad: ActivityLike
  rol: Rol
  miEntrega: EntregaLike | null
  entregas: EntregaLike[]
  onVolver: () => void
  onCambio: () => void
  onAbrirHerramientas: () => void
  /** Aula en la que estamos: la necesita el asistente de copia. */
  aulaId?: string
  /** Estudiantes del grupo, para poder decir cuántos faltan por entregar. */
  totalEstudiantes?: number | null
  /** Abre otra actividad (se usa al terminar de copiar). */
  onAbrirActividad?: (id: string) => void
  /** Editar el contenido de una lección o un juego, sin salir del aula. */
  onEditarLeccion?: () => void
  now?: Date
}

export function ActividadDetalle({
  actividad: a,
  rol,
  miEntrega,
  entregas,
  onVolver,
  onCambio,
  onAbrirHerramientas,
  aulaId,
  totalEstudiantes,
  onAbrirActividad,
  onEditarLeccion,
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

      <article className="rounded-modal border border-hairline bg-surface-1 p-4 sm:p-6">
        {/* Encabezado */}
        <header className="flex flex-wrap items-start gap-4">
          <ActivityGlyph type={a.type} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: meta.ink }}>
              {activityTypeLabel(a.type, a.metadata)}
            </p>
            <h1 className="mt-0.5 break-words text-h1 leading-tight font-bold text-ink-primary">{a.title}</h1>
            {a.section?.title && <p className="mt-1 text-body-sm text-ink-muted">{a.section.title}</p>}
          </div>
          {/* En móvil el chip baja a su propia línea: compartiendo fila le dejaba al título
              unos 165 px y "Tarea 1 Guía 1." salía partido en dos renglones sin necesidad. */}
          <div className="order-last w-full sm:order-none sm:w-auto">
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
          </div>
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
            {/* `break-words` porque esto lo escribe el docente: un enlace largo sin espacios
                estiraba la página entera a 2000 px en un celular. */}
            <p className="mt-1 text-body-base leading-relaxed whitespace-pre-wrap break-words text-ink-primary">
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

        {/* Al docente hay que decirle dónde sigue el trabajo. Un quiz recién creado no tiene
            preguntas, y el editor de preguntas todavía vive en el aula anterior: sin este
            aviso, la actividad se queda vacía sin que nadie sepa por qué. */}
        {esDocente && MOTOR_COMPARTIDO.has(a.type) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2 p-4">
            <p className="min-w-0 text-body-sm text-ink-secondary">
              Las <strong className="text-ink-primary">preguntas</strong> de esta actividad se añaden
              en el editor de actividades de esta misma aula.
            </p>
            <button
              type="button"
              onClick={onAbrirHerramientas}
              className="inline-flex min-h-btn shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3.5 text-body-sm font-medium text-ink-primary hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              Añadir preguntas
            </button>
          </div>
        )}

        {esDocente && <PanelPlanilla actividad={a} onAbrirHerramientas={onAbrirHerramientas} />}

        {/* Acciones. Para una tarea, el estudiante no tiene botón aquí: su acción es el panel
            de entrega de abajo, así que no se dibuja un separador con nada debajo. */}
        {(esDocente || tieneAccionEstudiante(a, vista.state)) && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline pt-5">
            {esDocente ? (
              <AccionesDocente
                actividad={a}
                onCambio={onCambio}
                onVolver={onVolver}
                // Lecciones y juegos se editan aquí; el resto todavía en el aula anterior.
                onEditar={ABRE_REPRODUCTOR.has(a.type) && onEditarLeccion ? onEditarLeccion : onAbrirHerramientas}
                onCopiar={aulaId ? () => setCopiando(true) : undefined}
              />
            ) : (
              <AccionesEstudiante
                actividad={a}
                estado={vista.state}
                onAbrirReproductor={() => setReproduciendo(true)}
                onAbrirHerramientas={onAbrirHerramientas}
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
        {esDocente && (
          <ListaEntregas
            actividad={a}
            entregas={entregas}
            totalEstudiantes={totalEstudiantes}
            onCambio={onCambio}
            now={now}
          />
        )}
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
  return ABRE_REPRODUCTOR.has(a.type) || MOTOR_COMPARTIDO.has(a.type)
}

function AccionesEstudiante({
  actividad,
  estado,
  onAbrirReproductor,
  onAbrirHerramientas,
}: {
  actividad: ActivityLike
  estado: ReturnType<typeof deriveStudentState>['state']
  onAbrirReproductor: () => void
  onAbrirHerramientas: () => void
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

  if (MOTOR_COMPARTIDO.has(actividad.type)) {
    return (
      <div>
        <button
          type="button"
          onClick={onAbrirHerramientas}
          className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Abrir actividad
        </button>
        <p className="mt-2 text-body-sm text-ink-muted">
          Abre el reproductor de esta actividad para responder o continuar desde tu último avance.
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
  if (typeof document === 'undefined') return textoLegible(html.replace(/<[^>]*>/g, ' '))
  const div = document.createElement('div')
  div.innerHTML = html
  // `textoLegible` va aquí porque es AQUÍ donde aparecen los espacios duros: el navegador
  // convierte cada `&nbsp;` del editor del docente en un U+00A0, y con esos el párrafo entero
  // se vuelve una sola palabra que no cabe en un celular.
  return textoLegible((div.textContent ?? '').trim())
}


/**
 * El puente con la planilla de notas.
 *
 * Calificar en el aula y calificar en la planilla eran dos trabajos separados: el docente ponía
 * la nota a la entrega y luego la volvía a escribir en su planilla. El vínculo ya existía en el
 * backend y en el editor anterior, pero el aula nueva no lo mostraba en ninguna parte, así que
 * desde aquí no se veía siquiera si una actividad estaba vinculada.
 *
 * Antes de escribir nada se pide la previsualización y se dice **cuántas notas** se van a crear,
 * cuántas a pisar y cuántas están en conflicto. Escribir en la planilla sin decir qué se va a
 * tocar es exactamente lo que no debe pasar con notas.
 */
function PanelPlanilla({
  actividad,
  onAbrirHerramientas,
}: {
  actividad: ActivityLike
  onAbrirHerramientas?: () => void
}) {
  const [sincronizando, setSincronizando] = useState(false)
  const vinculada = actividad.syncToGradebook === true

  const casilla = [actividad.gradebookComponent, actividad.gradebookIndex != null ? `casilla ${actividad.gradebookIndex}` : null]
    .filter(Boolean)
    .join(' · ')

  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const { data } = await classroomApi.previewGradebookSync(
        actividad.id,
        actividad.academicTermId ?? undefined,
      )
      const r = data?.summary ?? data?.data?.summary
      if (!r) {
        toast.error('No se pudo consultar qué notas se escribirían. Inténtalo de nuevo.')
        return
      }
      const escribibles = (r.toCreate ?? 0) + (r.toUpdate ?? 0)
      if (escribibles === 0) {
        toast.info(
          r.alreadySynced ? 'La planilla ya está al día con esta actividad' : 'No hay notas para llevar todavía',
          r.noSubmission ? `${r.noSubmission} estudiante(s) sin entrega.` : undefined,
        )
        return
      }
      const detalle = [
        r.toCreate ? `${r.toCreate} nota(s) nuevas` : null,
        r.toUpdate ? `${r.toUpdate} que se reemplazan` : null,
        r.conflicts ? `${r.conflicts} en conflicto (no se tocan)` : null,
        r.noSubmission ? `${r.noSubmission} sin entrega (no se tocan)` : null,
      ].filter(Boolean).join(', ')

      const ok = await confirmDialog(
        `Se van a escribir ${escribibles} nota(s) en la planilla: ${detalle}.`,
        { title: 'Llevar las notas a la planilla', confirmLabel: 'Sí, escribir' },
      )
      if (!ok) return

      const { data: hecho } = await classroomApi.syncToGradebook(actividad.id, {
        academicTermId: actividad.academicTermId ?? undefined,
      })
      const escritas = hecho?.synced ?? hecho?.data?.synced ?? escribibles
      toast.success(`${escritas} nota(s) en la planilla`)
    } catch (e) {
      // Nada de `catch {}`: si no se escribió, el docente tiene que saberlo.
      toast.error(e)
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2 p-4">
      <p className="min-w-0 text-body-sm text-ink-secondary">
        <BarChart3 className="mr-1.5 inline h-4 w-4 align-text-bottom text-ink-muted" aria-hidden="true" />
        {vinculada ? (
          <>
            Las notas de esta actividad van a la <strong className="text-ink-primary">planilla</strong>
            {casilla && <> — {casilla}</>}.
          </>
        ) : (
          <>
            Esta actividad <strong className="text-ink-primary">no está vinculada</strong> a la planilla:
            sus notas se quedan en el aula.
          </>
        )}
      </p>
      {vinculada ? (
        <button
          type="button"
          onClick={sincronizar}
          disabled={sincronizando}
          className="inline-flex min-h-btn shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3.5 text-body-sm font-medium text-ink-primary hover:border-accent/40 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} aria-hidden="true" />
          {sincronizando ? 'Revisando…' : 'Llevar notas a la planilla'}
        </button>
      ) : (
        onAbrirHerramientas && (
          <button
            type="button"
            onClick={onAbrirHerramientas}
            className="inline-flex min-h-btn shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3.5 text-body-sm font-medium text-ink-primary hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            Vincular a la planilla
          </button>
        )
      )}
    </div>
  )
}
