/**
 * "Unidades" — el curso ordenado por temas.
 *
 * Es la columna vertebral pedagógica: cada unidad trae su material de estudio **y** su
 * trabajo, que hoy viven separados en dos pestañas distintas ("Contenidos" y "Actividades") y
 * obligan al estudiante a reconstruir mentalmente qué pertenece a qué.
 *
 * Las unidades se abren y cierran, y lo que el estudiante deja abierto se recuerda: en un
 * curso de ocho unidades, tener que volver a abrir la suya en cada visita es fricción pura.
 */

import { useEffect, useState } from 'react'
import { ChevronDown, EyeOff, FileText, Image as ImageIcon, Link2, Type, Video } from 'lucide-react'
import type { ActivityLike } from '../model/activityState'
import { buildUnits, type MaterialLike, type SeccionLike, type Unidad } from '../model/units'
import { materialTypeLabel } from '../model/labels'
import type { Role } from '../model/list'
import { ActivityCard } from '../ui/ActivityCard'
import { EmptyState } from '../ui/EmptyState'
import { ProgressRing } from '../visual/Progress'

const CLAVE_ABIERTAS = (aulaId: string) => `edusyn:aula:${aulaId}:unidades`

export interface UnidadesProps {
  aulaId: string
  role: Role
  secciones: SeccionLike[]
  actividades: ActivityLike[]
  periodo: string
  onAbrirActividad: (id: string) => void
  onAbrirMaterial?: (material: MaterialLike) => void
  onCrear?: () => void
  now?: Date
}

export function Unidades({
  aulaId,
  role,
  secciones,
  actividades,
  periodo,
  onAbrirActividad,
  onAbrirMaterial,
  onCrear,
  now = new Date(),
}: UnidadesProps) {
  const unidades = buildUnits({ secciones, actividades, role, periodo, now })
  const [abiertas, setAbiertas] = useState<string[]>([])
  const [listo, setListo] = useState(false)

  // Se recuerda qué unidades dejó abiertas. Si nunca eligió, se abre la primera: una pantalla
  // de acordeones todos cerrados no dice nada.
  useEffect(() => {
    let guardadas: string[] | null = null
    try {
      const raw = localStorage.getItem(CLAVE_ABIERTAS(aulaId))
      if (raw) guardadas = JSON.parse(raw)
    } catch {
      guardadas = null
    }
    setAbiertas(Array.isArray(guardadas) ? guardadas : unidades.slice(0, 1).map((u) => u.id))
    setListo(true)
    // Solo al cambiar de aula: no queremos pisar lo que el usuario abre mientras navega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId])

  const alternar = (id: string) => {
    const next = abiertas.includes(id) ? abiertas.filter((x) => x !== id) : [...abiertas, id]
    setAbiertas(next)
    try {
      localStorage.setItem(CLAVE_ABIERTAS(aulaId), JSON.stringify(next))
    } catch {
      /* sin almacenamiento: la preferencia dura lo que la sesión */
    }
  }

  if (unidades.length === 0) {
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink-primary">Unidades</h1>
      <p className="mt-0.5 text-body-sm text-ink-muted">El material y el trabajo de cada tema, juntos.</p>

      <div className="mt-4 space-y-3">
        {unidades.map((u) => (
          <TarjetaUnidad
            key={u.id}
            unidad={u}
            role={role}
            abierta={listo && abiertas.includes(u.id)}
            onAlternar={() => alternar(u.id)}
            onAbrirActividad={onAbrirActividad}
            onAbrirMaterial={onAbrirMaterial}
            now={now}
          />
        ))}
      </div>
    </div>
  )
}

function TarjetaUnidad({
  unidad: u,
  role,
  abierta,
  onAlternar,
  onAbrirActividad,
  onAbrirMaterial,
  now,
}: {
  unidad: Unidad
  role: Role
  abierta: boolean
  onAlternar: () => void
  onAbrirActividad: (id: string) => void
  onAbrirMaterial?: (m: MaterialLike) => void
  now: Date
}) {
  const resumen = [
    u.total.materiales > 0 &&
      `${u.total.materiales} ${u.total.materiales === 1 ? 'recurso' : 'recursos'}`,
    u.total.actividades > 0 &&
      `${u.total.actividades} ${u.total.actividades === 1 ? 'actividad' : 'actividades'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="overflow-hidden rounded-modal border border-hairline bg-surface-1">
      <h2>
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierta}
          className="flex w-full items-center gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none ${
              abierta ? '' : '-rotate-90'
            }`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-body-base font-semibold text-ink-primary">{u.titulo}</span>
              {u.oculta && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted"
                  title="Los estudiantes no la ven"
                >
                  <EyeOff className="h-3 w-3" aria-hidden="true" /> Oculta
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-body-sm text-ink-muted">
              {resumen || 'Todavía sin contenido'}
            </span>
          </span>
          {u.avance != null && <ProgressRing value={u.avance} size={44} thickness={4} />}
        </button>
      </h2>

      {abierta && (
        <div className="space-y-4 border-t border-hairline p-4">
          {u.materiales.length > 0 && (
            <div>
              <h3 className="mb-2 text-body-sm font-semibold text-ink-secondary">Para estudiar</h3>
              <ul className="space-y-1">
                {u.materiales.map((m) => (
                  <li key={m.id}>
                    <FilaMaterial material={m} role={role} onAbrir={onAbrirMaterial} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {u.actividades.length > 0 && (
            <div>
              <h3 className="mb-2 text-body-sm font-semibold text-ink-secondary">Para hacer</h3>
              <div className="space-y-2">
                {u.actividades.map((d) => (
                  <ActivityCard
                    key={d.activity.id}
                    item={d}
                    role={role}
                    onOpen={onAbrirActividad}
                    // La unidad ya está en la cabecera: repetirla en cada tarjeta es ruido.
                    showUnit={false}
                    now={now}
                  />
                ))}
              </div>
            </div>
          )}

          {u.materiales.length === 0 && u.actividades.length === 0 && (
            <p className="text-body-sm text-ink-muted">
              {role === 'docente'
                ? 'Esta unidad todavía está vacía. Añádele material o una actividad.'
                : 'Tu profe todavía no ha puesto nada en esta unidad.'}
            </p>
          )}
        </div>
      )}
    </section>
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
    'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none min-h-row'

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
