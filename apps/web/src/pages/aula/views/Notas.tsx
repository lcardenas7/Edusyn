/**
 * "Notas" — cómo va cada quien.
 *
 * Para el DOCENTE esto no es una planilla: es el estado de su trabajo de revisión en esta
 * aula —cuántas entregas le faltan por calificar, actividad por actividad—. La nota de una
 * entrega concreta se pone donde corresponde, en el detalle de esa actividad. Y no se manda a
 * nadie al módulo de boletines desde aquí: son otra cosa y otro flujo.
 *
 * Para el estudiante, en cambio, esto sí es la respuesta completa a "¿cómo voy?", y sale de
 * datos reales, no del texto fijo que muestra hoy la tarjeta del Home (P1-6).
 */

import { useEffect, useState } from 'react'
import { classroomApi } from '../../../lib/api'
import { parseApiError } from '../../../lib/toast'
import type { ActivityLike } from '../model/activityState'
import { buildStudentToday } from '../model/today'
import { buildTeacherToday } from '../model/today'
import { activityTypeLabel } from '../model/labels'
import type { Role } from '../model/list'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { ProgressRing } from '../visual/Progress'
import { AulaState, EmptyState } from '../ui/EmptyState'
import { StudentStateChip } from '../ui/StateChip'
import { decorate } from '../model/list'
import { agoCopy } from '../model/countdown'

export interface NotasProps {
  classroomId: string
  role: Role
  actividades: ActivityLike[]
  onAbrirActividad: (id: string) => void
  now?: Date
}

export function Notas(props: NotasProps) {
  return props.role === 'estudiante' ? <NotasEstudiante {...props} /> : <NotasDocente {...props} />
}

// ─── Estudiante ──────────────────────────────────────────────────────────────

interface Resumen {
  calificadas: number
  promedio: number | null
  sobre: number | null
}

function NotasEstudiante({ classroomId, actividades, onAbrirActividad, now = new Date() }: NotasProps) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [intento, setIntento] = useState(0)

  /*
   * El promedio se pide al backend en vez de calcularlo aquí. Un promedio calculado en el
   * navegador es un segundo criterio compitiendo con el del núcleo académico (ponderaciones,
   * recuperaciones, escala institucional), y en notas dos criterios es un defecto, no una
   * comodidad.
   */
  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    classroomApi
      .getMyGrades(classroomId)
      .then(({ data }) => {
        if (!vivo) return
        const entregas: any[] = data?.submissions ?? []
        const conNota = entregas.filter((s) => s.score != null)
        const suma = conNota.reduce((t, s) => t + Number(s.score), 0)
        const maxTotal = conNota.reduce((t, s) => t + Number(s.activity?.maxScore ?? 0), 0)
        setResumen({
          calificadas: conNota.length,
          promedio: conNota.length > 0 ? suma / conNota.length : null,
          sobre: maxTotal > 0 ? maxTotal / conNota.length : null,
        })
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
  }, [classroomId, intento])

  const tablero = buildStudentToday(actividades, now)
  const calificadas = actividades
    .map((a) => decorate(a, 'estudiante', now))
    .filter((d) => d.student?.state === 'calificada' || d.student?.state === 'entregada')
    .sort((a, b) => (b.student?.entregadaEn ?? '').localeCompare(a.student?.entregadaEn ?? ''))

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink-primary">Mis notas</h1>
      <p className="mt-0.5 text-body-sm text-ink-muted">
        Lo que has entregado en esta aula y cómo te ha ido.
      </p>

      <AulaState
        loading={cargando}
        error={error}
        onRetry={() => setIntento((n) => n + 1)}
        isEmpty={calificadas.length === 0}
        empty={
          <div className="mt-4">
            <EmptyState
              scene="todo-al-dia"
              title="Todavía no tienes notas en esta aula"
              detail="Cuando entregues algo y tu profe lo califique, aparecerá aquí."
            />
          </div>
        }
      >
        {/* Resumen */}
        <div className="mt-4 flex flex-wrap items-center gap-5 rounded-modal border border-hairline bg-surface-1 p-5">
          <ProgressRing value={tablero.progreso.pct} size={72} />
          <div className="min-w-0">
            <p className="text-body-base font-semibold text-ink-primary">
              Llevas {tablero.progreso.hechas} de {tablero.progreso.total} entregadas
            </p>
            {resumen?.promedio != null && (
              <p className="mt-0.5 text-body-sm text-ink-secondary">
                Promedio de {resumen.calificadas} {resumen.calificadas === 1 ? 'nota' : 'notas'}:{' '}
                <strong className="text-ink-primary">{resumen.promedio.toFixed(1)}</strong>
                {resumen.sobre != null && ` de ${resumen.sobre.toFixed(1)}`}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-muted">
              Esto es solo de esta asignatura. Tu nota del boletín la calcula el colegio con sus
              propias reglas.
            </p>
          </div>
        </div>

        {/* Detalle */}
        <ul className="mt-4 space-y-2">
          {calificadas.map((d) => (
            <li key={d.activity.id}>
              <button
                type="button"
                onClick={() => onAbrirActividad(d.activity.id)}
                className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface-1 p-3.5 text-left transition-colors hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <ActivityGlyph type={d.activity.type} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-ink-primary">
                    {d.activity.title}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {activityTypeLabel(d.activity.type, d.activity.metadata)}
                    {d.student?.entregadaEn ? ` · entregaste ${agoCopy(d.student.entregadaEn, now)}` : ''}
                  </span>
                </span>
                {d.student?.score != null ? (
                  <span className="shrink-0 text-h3 font-bold text-ink-primary tabular-nums">
                    {d.student.score.toFixed(1)}
                    {d.activity.maxScore != null && (
                      <span className="text-body-sm font-normal text-ink-muted"> /{Number(d.activity.maxScore)}</span>
                    )}
                  </span>
                ) : (
                  <StudentStateChip state="entregada" size="sm" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </AulaState>
    </div>
  )
}

// ─── Docente ─────────────────────────────────────────────────────────────────

function NotasDocente({ actividades, onAbrirActividad, now = new Date() }: NotasProps) {
  const t = buildTeacherToday(actividades, now)
  const conEntregas = actividades
    .map((a) => decorate(a, 'docente', now))
    .filter((d) => (d.teacher?.entregas ?? 0) > 0)
    .sort((a, b) => (b.teacher?.porCalificar ?? 0) - (a.teacher?.porCalificar ?? 0))

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink-primary">Calificación</h1>
      <p className="mt-0.5 text-body-sm text-ink-muted">Cómo va tu trabajo de revisión en esta aula.</p>

      <p className="mt-3 text-body-sm text-ink-muted">
        Solo lo de esta aula. Las notas del boletín las calcula el colegio con sus propias reglas.
      </p>

      {t.porCalificar.entregas > 0 && (
        <p className="mt-4 text-body-base font-semibold text-ink-primary">
          {t.porCalificar.entregas}{' '}
          {t.porCalificar.entregas === 1 ? 'entrega espera tu nota' : 'entregas esperan tu nota'}
        </p>
      )}

      {conEntregas.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            scene="sin-actividades"
            title="Todavía no hay entregas que revisar"
            detail="Cuando tus estudiantes empiecen a entregar, verás aquí el avance de cada actividad."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {conEntregas.map((d) => {
            const total = d.teacher?.entregas ?? 0
            const faltan = d.teacher?.porCalificar ?? 0
            const listas = Math.max(0, total - faltan)
            const pct = total === 0 ? 0 : Math.round((listas / total) * 100)
            return (
              <li key={d.activity.id}>
                <button
                  type="button"
                  onClick={() => onAbrirActividad(d.activity.id)}
                  className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface-1 p-3.5 text-left transition-colors hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ActivityGlyph type={d.activity.type} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-ink-primary">
                      {d.activity.title}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {listas} de {total} calificadas
                      {faltan > 0 ? ` · faltan ${faltan}` : ''}
                    </span>
                  </span>
                  <ProgressRing
                    value={pct}
                    size={40}
                    thickness={4}
                    color={faltan > 0 ? '#E0A020' : undefined}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
