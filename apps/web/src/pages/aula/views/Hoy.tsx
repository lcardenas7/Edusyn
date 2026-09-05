/**
 * "Hoy" — el tablero de aterrizaje del aula, distinto por rol.
 *
 * Reemplaza al Home actual, que para el estudiante es un inventario donde todo pesa igual y
 * una tarjeta de calificaciones que muestra un texto fijo (P1-6), y para el docente es un
 * conteo de secciones y recursos más media pantalla de "Próximamente en Fase 2" (P1-2).
 *
 * La vista no calcula nada: `buildStudentToday` / `buildTeacherToday` deciden qué va en cada
 * bloque y están probados aparte.
 */

import { ClipboardCheck, FileEdit, CalendarClock, Sparkles, UserX, Plus } from 'lucide-react'
import type { ActivityLike } from '../model/activityState'
import type { AnnouncementLike } from '../model/today'
import { buildStudentToday, buildTeacherToday } from '../model/today'
import type { DecoratedActivity } from '../model/list'
import { ActivityCard } from '../ui/ActivityCard'
import { AnnouncementWall } from '../ui/AnnouncementWall'
import { EmptyState } from '../ui/EmptyState'
import { NextStep } from '../ui/NextStep'
import { ProgressRing, Stamp } from '../visual/Progress'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { activityTypeLabel } from '../model/labels'

export interface HoyProps {
  role: 'docente' | 'estudiante'
  nombre: string
  aulaTitulo: string
  periodoNombre?: string | null
  estudiantes?: number | null
  actividades: ActivityLike[]
  anuncios: AnnouncementLike[]
  onAbrirActividad: (activityId: string) => void
  /** Lleva a Actividades con un filtro ya puesto (p. ej. "por-calificar"). */
  onVerActividades: (filtroEstado?: string) => void
  onCrear?: (tipo: 'TASK' | 'QUIZ' | 'LESSON' | 'MATERIAL') => void
  onValeria?: () => void
  now?: Date
}

export function Hoy(props: HoyProps) {
  return props.role === 'estudiante' ? <HoyEstudiante {...props} /> : <HoyDocente {...props} />
}

// ─── Estudiante ──────────────────────────────────────────────────────────────

function HoyEstudiante({
  nombre,
  aulaTitulo,
  periodoNombre,
  actividades,
  anuncios,
  onAbrirActividad,
  onVerActividades,
  now = new Date(),
}: HoyProps) {
  const t = buildStudentToday(actividades, now)
  const sinNada = t.siguiente === null && t.meToca.length === 0 && t.proximas.length === 0

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <h1 className="text-h1 font-bold text-ink-primary">Hola, {nombre} 👋</h1>
        <p className="mt-1 text-body-sm text-ink-muted">
          {aulaTitulo}
          {periodoNombre ? ` · ${periodoNombre}` : ''}
        </p>
      </header>

      {t.siguiente ? (
        <NextStep item={t.siguiente} onOpen={onAbrirActividad} now={now} />
      ) : (
        <section className="flex flex-col items-center rounded-modal border border-hairline bg-surface-1 px-6 py-8 text-center">
          <Stamp kind="al-dia" size={104} />
          <p className="mt-3 text-h3 font-bold text-ink-primary">Estás al día</p>
          <p className="mt-1 max-w-sm text-body-sm text-ink-secondary">
            {t.progreso.total > 0
              ? 'No te queda nada pendiente en este período. Cuando tu profe publique algo nuevo, aparecerá aquí.'
              : 'Todavía no hay actividades publicadas en esta aula.'}
          </p>
        </section>
      )}

      {/* Avance del período */}
      {t.progreso.total > 0 && (
        <section className="flex items-center gap-4 rounded-card border border-hairline bg-surface-1 p-4">
          <ProgressRing value={t.progreso.pct} size={64} />
          <div className="min-w-0">
            <p className="text-body-base font-semibold text-ink-primary">
              Llevas {t.progreso.hechas} de {t.progreso.total}
            </p>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              Cuenta solo lo que ya puedes hacer: lo bloqueado y lo que aún no abre no te resta.
            </p>
          </div>
        </section>
      )}

      {t.meToca.length > 0 && (
        <section aria-labelledby="me-toca">
          <h2 id="me-toca" className="mb-1 text-body-base font-semibold text-ink-primary">
            También te toca
          </h2>
          <p className="mb-3 text-body-sm text-ink-muted">Vencidas, por corregir o empezadas sin enviar.</p>
          <div className="space-y-2">
            {t.meToca.map((d) => (
              <ActivityCard key={d.activity.id} item={d} role="estudiante" onOpen={onAbrirActividad} now={now} />
            ))}
          </div>
        </section>
      )}

      {t.proximas.length > 0 && (
        <section aria-labelledby="proximas">
          <h2 id="proximas" className="mb-1 text-body-base font-semibold text-ink-primary">
            Más adelante
          </h2>
          <p className="mb-3 text-body-sm text-ink-muted">Todavía tienes tiempo.</p>
          <div className="space-y-2">
            {t.proximas.slice(0, 4).map((d) => (
              <ActivityCard key={d.activity.id} item={d} role="estudiante" onOpen={onAbrirActividad} now={now} />
            ))}
          </div>
          {t.proximas.length > 4 && (
            <button
              type="button"
              onClick={() => onVerActividades()}
              className="mt-2 min-h-btn rounded-lg px-2 text-body-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              Ver las {t.proximas.length} que vienen
            </button>
          )}
        </section>
      )}

      {sinNada && t.progreso.total === 0 && (
        <EmptyState
          scene="sin-actividades"
          title="Aún no hay actividades"
          detail="Cuando tu profe publique la primera, la verás aquí."
        />
      )}

      {/* Últimas notas — datos reales, no el texto fijo de hoy */}
      {t.ultimasNotas.length > 0 && (
        <section aria-labelledby="notas">
          <h2 id="notas" className="mb-3 text-body-base font-semibold text-ink-primary">
            Tus últimas notas
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {t.ultimasNotas.map((n) => (
              <button
                key={n.activity.id}
                type="button"
                onClick={() => onAbrirActividad(n.activity.id)}
                className="rounded-card border border-hairline bg-surface-1 p-3 text-left transition-colors hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <div className="flex items-center gap-2">
                  <ActivityGlyph type={n.activity.type} size={28} />
                  <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                    {activityTypeLabel(n.activity.type, n.activity.metadata)}
                  </p>
                </div>
                <p className="mt-1.5 truncate text-body-sm font-medium text-ink-primary">{n.activity.title}</p>
                <p className="mt-0.5 text-h2 font-bold text-ink-primary tabular-nums">
                  {n.score.toFixed(1)}
                  {n.maxScore != null && <span className="text-body-sm font-normal text-ink-muted"> / {n.maxScore}</span>}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      <AnnouncementWall anuncios={anuncios} now={now} />
    </div>
  )
}

// ─── Docente ─────────────────────────────────────────────────────────────────

const CREAR: { tipo: 'TASK' | 'QUIZ' | 'LESSON' | 'MATERIAL'; label: string }[] = [
  { tipo: 'TASK', label: 'Tarea' },
  { tipo: 'QUIZ', label: 'Quiz' },
  { tipo: 'LESSON', label: 'Lección' },
  { tipo: 'MATERIAL', label: 'Recurso' },
]

function HoyDocente({
  nombre,
  aulaTitulo,
  periodoNombre,
  estudiantes,
  actividades,
  anuncios,
  onAbrirActividad,
  onVerActividades,
  onCrear,
  onValeria,
  now = new Date(),
}: HoyProps) {
  const t = buildTeacherToday(actividades, now)

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <h1 className="text-h1 font-bold text-ink-primary">Hola, {nombre} 👋</h1>
        <p className="mt-1 text-body-sm text-ink-muted">
          {aulaTitulo}
          {periodoNombre ? ` · ${periodoNombre}` : ''}
          {estudiantes != null ? ` · ${estudiantes} estudiantes` : ''}
        </p>
      </header>

      {/* Crear: la acción más frecuente, al alcance y no escondida arriba a la derecha */}
      {onCrear && (
        <section className="flex flex-wrap gap-2">
          {CREAR.map((c) => (
            <button
              key={c.tipo}
              type="button"
              onClick={() => onCrear(c.tipo)}
              className="inline-flex min-h-btn items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3.5 text-body-sm font-medium text-ink-primary transition-colors hover:border-accent/40 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> {c.label}
            </button>
          ))}
          {onValeria && (
            <button
              type="button"
              onClick={onValeria}
              className="inline-flex min-h-btn items-center gap-1.5 rounded-lg bg-accent px-3.5 text-body-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Pedirle a Valeria
            </button>
          )}
        </section>
      )}

      {t.todoAlDia ? (
        <section className="flex flex-col items-center rounded-modal border border-hairline bg-surface-1 px-6 py-8 text-center">
          <Stamp kind="al-dia" size={104} />
          <p className="mt-3 text-h3 font-bold text-ink-primary">No hay nada esperándote</p>
          <p className="mt-1 max-w-sm text-body-sm text-ink-secondary">
            Sin entregas por calificar, sin vencimientos hoy y sin borradores sueltos.
          </p>
        </section>
      ) : (
        <>
          {/* Por calificar: lo primero, porque es trabajo que bloquea al estudiante */}
          {t.porCalificar.entregas > 0 && (
            <button
              type="button"
              onClick={() => onVerActividades('por-calificar')}
              className="w-full rounded-modal border border-warning-100 bg-warning-50 p-5 text-left transition-colors hover:bg-warning-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100">
                  <ClipboardCheck className="h-5 w-5 text-warning-700" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-h3 font-bold text-ink-primary">
                    {t.porCalificar.entregas}{' '}
                    {t.porCalificar.entregas === 1 ? 'entrega esperando nota' : 'entregas esperando nota'}
                  </p>
                  <p className="mt-1 text-body-sm text-ink-secondary">
                    En{' '}
                    {t.porCalificar.actividades
                      .slice(0, 3)
                      .map((d) => `${d.activity.title} (${d.teacher?.porCalificar})`)
                      .join(' · ')}
                    {t.porCalificar.actividades.length > 3 ? ` y ${t.porCalificar.actividades.length - 3} más` : ''}
                  </p>
                </div>
              </div>
            </button>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Panel
              titulo="Vencen hoy"
              icono={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              items={t.vencenHoy}
              vacio="Nada se cierra hoy."
              onAbrir={onAbrirActividad}
            />
            <Panel
              titulo="Vencieron sin entregas"
              icono={<UserX className="h-4 w-4" aria-hidden="true" />}
              items={t.sinEntregas}
              vacio="Todas tuvieron entregas."
              onAbrir={onAbrirActividad}
            />
            <Panel
              titulo="Borradores"
              icono={<FileEdit className="h-4 w-4" aria-hidden="true" />}
              items={t.borradores}
              vacio="Sin borradores sueltos."
              nota="Los estudiantes todavía no las ven."
              onAbrir={onAbrirActividad}
            />
            <Panel
              titulo="Programadas"
              icono={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              items={t.programadas}
              vacio="Ninguna programada."
              nota="Se publican solas en su fecha."
              onAbrir={onAbrirActividad}
            />
          </div>
        </>
      )}

      <AnnouncementWall anuncios={anuncios} now={now} />
    </div>
  )
}

function Panel({
  titulo,
  icono,
  items,
  vacio,
  nota,
  onAbrir,
}: {
  titulo: string
  icono: React.ReactNode
  items: DecoratedActivity[]
  vacio: string
  nota?: string
  onAbrir: (id: string) => void
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface-1 p-4">
      <h2 className="flex items-center gap-2 text-body-sm font-semibold text-ink-primary">
        <span className="text-ink-muted">{icono}</span>
        {titulo}
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-secondary">
          {items.length}
        </span>
      </h2>
      {nota && <p className="mt-0.5 text-xs text-ink-muted">{nota}</p>}
      {items.length === 0 ? (
        <p className="mt-2 text-body-sm text-ink-muted">{vacio}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.slice(0, 4).map((d) => (
            <li key={d.activity.id}>
              <button
                type="button"
                onClick={() => onAbrir(d.activity.id)}
                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-body-sm text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {d.activity.title}
              </button>
            </li>
          ))}
          {items.length > 4 && <li className="px-2 text-xs text-ink-muted">y {items.length - 4} más</li>}
        </ul>
      )}
    </section>
  )
}
