/**
 * "Unidades" — el curso ordenado por temas.
 *
 * Una unidad no es "un grupo de actividades": es un tema, con su material de estudio **y** su
 * trabajo. En el aula actual eso vive partido en dos pestañas —Contenidos tiene los materiales,
 * Actividades tiene las tareas— y el estudiante tiene que reconstruir mentalmente qué va con
 * qué. El prototipo del rediseño repetía el error al revés: agrupaba solo actividades e
 * ignoraba los materiales (defecto X6 del plan).
 *
 * La forma la pidió el fundador tras ver la lista de aulas: *"las cards del selector me
 * encantó, así más o menos quiero incluso dentro de cada curso el contenido"*. Así que una
 * unidad se presenta como se presenta un curso —portada, avance, acción— y **se entra en
 * ella**, en vez de desplegarse en un acordeón. Con ocho unidades, un acordeón obliga a
 * recordar cuál estabas mirando; una portada se reconoce.
 */

import { ArrowRight, BookOpen, EyeOff, FileText, Image as ImageIcon, Link2, Type, Video } from 'lucide-react'
import type { ActivityLike } from '../model/activityState'
import { buildUnits, type MaterialLike, type SeccionLike, type Unidad } from '../model/units'
import { materialTypeLabel } from '../model/labels'
import type { Role } from '../model/list'
import { ActivityCard } from '../ui/ActivityCard'
import { EmptyState } from '../ui/EmptyState'
import { ProgressRing } from '../visual/Progress'
import { SubjectCover } from '../visual/SubjectCover'

export interface UnidadesProps {
  aulaId: string
  role: Role
  asignatura?: string | null
  color?: string | null
  secciones: SeccionLike[]
  actividades: ActivityLike[]
  periodo: string
  /** Unidad abierta. Sin ella se muestra la parrilla. */
  unidadAbierta?: string | null
  onAbrirUnidad: (unidadId: string | null) => void
  onAbrirActividad: (id: string) => void
  onAbrirMaterial?: (material: MaterialLike) => void
  onCrear?: () => void
  totalEstudiantes?: number | null
  now?: Date
}

export function Unidades(props: UnidadesProps) {
  const { secciones, actividades, role, periodo, now = new Date(), unidadAbierta } = props
  const unidades = buildUnits({ secciones, actividades, role, periodo, now })

  if (unidades.length === 0) return <SinUnidades {...props} />

  const abierta = unidadAbierta ? unidades.find((u) => u.id === unidadAbierta) : null
  return abierta ? (
    <DetalleUnidad {...props} unidad={abierta} />
  ) : (
    <Parrilla {...props} unidades={unidades} />
  )
}

// ─── La parrilla de unidades ─────────────────────────────────────────────────

function Parrilla({
  unidades,
  role,
  asignatura,
  color,
  onAbrirUnidad,
}: UnidadesProps & { unidades: Unidad[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-h1 font-bold text-ink-primary">Unidades</h1>
      <p className="mt-0.5 text-body-sm text-ink-muted">El material y el trabajo de cada tema, juntos.</p>

      {/* Dos por fila desde el móvil: una columna obligaba a bajar por todo el curso. */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {unidades.map((u, i) => (
          <TarjetaUnidad
            key={u.id}
            unidad={u}
            numero={i + 1}
            role={role}
            asignatura={asignatura}
            color={color}
            onAbrir={() => onAbrirUnidad(u.id)}
          />
        ))}
      </div>
    </div>
  )
}

function TarjetaUnidad({
  unidad: u,
  numero,
  role,
  asignatura,
  color,
  onAbrir,
}: {
  unidad: Unidad
  numero: number
  role: Role
  asignatura?: string | null
  color?: string | null
  onAbrir: () => void
}) {
  const resumen = [
    u.total.materiales > 0 && `${u.total.materiales} ${u.total.materiales === 1 ? 'recurso' : 'recursos'}`,
    u.total.actividades > 0 &&
      `${u.total.actividades} ${u.total.actividades === 1 ? 'actividad' : 'actividades'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex w-full flex-col overflow-hidden rounded-modal border border-hairline bg-surface-1 text-left transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <span className="relative block">
        <SubjectCover subject={asignatura} color={color} alto={72} />
        <span
          className="absolute top-2.5 left-3 rounded-full bg-surface-1/90 px-2.5 py-1 text-xs font-bold text-ink-secondary backdrop-blur"
          aria-hidden="true"
        >
          Unidad {numero}
        </span>
        {u.oculta && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-surface-1/90 px-2.5 py-1 text-xs font-medium text-ink-muted backdrop-blur">
            <EyeOff className="h-3 w-3" aria-hidden="true" /> Oculta
          </span>
        )}
        {u.avance != null && (
          <span className="absolute -bottom-5 right-3 rounded-full bg-surface-1 p-1 shadow-sm">
            <ProgressRing value={u.avance} size={44} thickness={4} />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <span className="block pr-10 text-body-sm leading-snug font-bold break-words text-ink-primary sm:text-body-base">
          {u.titulo}
        </span>
        <span className="mt-1 block text-body-sm text-ink-muted">{resumen || 'Todavía sin contenido'}</span>

        <span className="mt-4 inline-flex min-h-btn items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-body-sm font-semibold text-white transition-opacity group-hover:opacity-90">
          {role === 'estudiante' && u.avance != null && u.avance > 0 ? 'Continuar' : 'Abrir'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
    </button>
  )
}

// ─── Dentro de una unidad ────────────────────────────────────────────────────

function DetalleUnidad({
  unidad: u,
  role,
  asignatura,
  color,
  totalEstudiantes,
  onAbrirUnidad,
  onAbrirActividad,
  onAbrirMaterial,
  now = new Date(),
}: UnidadesProps & { unidad: Unidad }) {
  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => onAbrirUnidad(null)}
        className="mb-3 inline-flex min-h-btn items-center gap-1 rounded-lg px-2 text-body-sm font-medium text-ink-muted hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        ‹ Unidades
      </button>

      <div className="overflow-hidden rounded-modal border border-hairline bg-surface-1">
        <div className="relative">
          <SubjectCover subject={asignatura} color={color} alto={96} />
          {u.avance != null && (
            <span className="absolute -bottom-6 right-4 rounded-full bg-surface-1 p-1 shadow-sm">
              <ProgressRing value={u.avance} size={52} />
            </span>
          )}
        </div>
        <div className="p-5 pr-20">
          <h1 className="text-h2 leading-tight font-bold break-words text-ink-primary">{u.titulo}</h1>
          <p className="mt-1 text-body-sm text-ink-muted">
            {u.total.materiales} {u.total.materiales === 1 ? 'recurso' : 'recursos'} ·{' '}
            {u.total.actividades} {u.total.actividades === 1 ? 'actividad' : 'actividades'}
            {u.oculta ? ' · oculta para los estudiantes' : ''}
          </p>
        </div>
      </div>

      {u.materiales.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-body-base font-semibold text-ink-primary">
            <BookOpen className="h-4 w-4 text-ink-muted" aria-hidden="true" /> Para estudiar
          </h2>
          <ul className="space-y-1.5">
            {u.materiales.map((m) => (
              <li key={m.id}>
                <FilaMaterial material={m} role={role} onAbrir={onAbrirMaterial} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {u.actividades.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-body-base font-semibold text-ink-primary">Para hacer</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {u.actividades.map((d) => (
              <ActivityCard
                key={d.activity.id}
                item={d}
                role={role}
                onOpen={onAbrirActividad}
                // La unidad ya está en la cabecera: repetirla en cada tarjeta es ruido.
                showUnit={false}
                totalEstudiantes={totalEstudiantes}
                now={now}
              />
            ))}
          </div>
        </section>
      )}

      {u.materiales.length === 0 && u.actividades.length === 0 && (
        <p className="mt-6 rounded-card border border-dashed border-hairline bg-surface-1 p-6 text-center text-body-sm text-ink-muted">
          {role === 'docente'
            ? 'Esta unidad todavía está vacía. Añádele material o una actividad.'
            : 'Tu profe todavía no ha puesto nada en esta unidad.'}
        </p>
      )}
    </div>
  )
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function SinUnidades({ role, onCrear }: UnidadesProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink-primary">Unidades</h1>
      <div className="mt-4">
        {role === 'docente' ? (
          <EmptyState
            scene="sin-unidades"
            title="Todavía no has organizado el curso en unidades"
            detail="Una unidad agrupa el material de estudio y las actividades de un mismo tema. Es lo que le da orden al aula."
            action={onCrear ? { label: 'Crear la primera unidad', onClick: onCrear } : undefined}
          />
        ) : (
          <EmptyState
            scene="sin-unidades"
            title="Aún no hay unidades en este período"
            detail="Cuando tu profe organice el curso por temas, los verás aquí. Prueba también con otro período."
          />
        )}
      </div>
    </div>
  )
}

const ICONO_MATERIAL: Record<string, typeof FileText> = {
  DOCUMENT: FileText,
  VIDEO_YOUTUBE: Video,
  VIDEO_UPLOAD: Video,
  LINK: Link2,
  TEXT: Type,
  IMAGE: ImageIcon,
}

function FilaMaterial({
  material: m,
  role,
  onAbrir,
}: {
  material: MaterialLike
  role: Role
  onAbrir?: (m: MaterialLike) => void
}) {
  const Icono = ICONO_MATERIAL[m.type] ?? FileText
  const contenido = (
    <>
      <Icono className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-sm text-ink-primary">{m.title}</span>
        <span className="block text-xs text-ink-muted">
          {materialTypeLabel(m.type)}
          {role === 'docente' && m.isVisible === false ? ' · oculto' : ''}
        </span>
      </span>
    </>
  )

  const clase =
    'flex min-h-row w-full items-center gap-3 rounded-card border border-hairline bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

  // Un enlace o archivo se abre como enlace de verdad: así funcionan "abrir en pestaña nueva"
  // y el clic con el botón central, que en un botón de JavaScript no funcionan.
  if (m.fileUrl) {
    return (
      <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={clase}>
        {contenido}
      </a>
    )
  }

  return (
    <button type="button" onClick={() => onAbrir?.(m)} className={clase}>
      {contenido}
    </button>
  )
}
