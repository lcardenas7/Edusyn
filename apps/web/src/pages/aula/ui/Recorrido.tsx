/**
 * El recorrido de una unidad: sus recursos y actividades como un solo camino.
 *
 * Idea del fundador: que el estudiante vea la unidad como una línea de tiempo y avance paso a
 * paso, en vez de encontrarse dos listas sueltas y tener que adivinar por dónde empezar.
 *
 * Cómo se lee de un vistazo:
 *  - Nodo verde con visto → ya lo hizo.
 *  - Nodo con anillo de acento y "Vas aquí" → es su siguiente paso.
 *  - Nodo hueco → todavía no le toca.
 *  - Candado → no depende de él (bloqueado o aún no abre).
 *
 * Un recurso se marca como visto al abrirlo, y también a mano. Ese dato vive en el dispositivo
 * del estudiante porque el backend no lo guarda: es honesto y suficiente para que el camino
 * avance.
 */

import { Check, Circle, FileText, Image as ImageIcon, Link2, Lock, Type, Video } from 'lucide-react'
import type { Paso } from '../model/recorrido'
import type { MaterialLike } from '../model/units'
import { materialTypeLabel } from '../model/labels'
import type { Role } from '../model/list'
import { ActivityCard } from './ActivityCard'

const ICONO_MATERIAL: Record<string, typeof FileText> = {
  DOCUMENT: FileText,
  VIDEO_YOUTUBE: Video,
  VIDEO_UPLOAD: Video,
  LINK: Link2,
  TEXT: Type,
  IMAGE: ImageIcon,
}

export function Recorrido({
  pasos,
  role,
  totalEstudiantes,
  onAbrirActividad,
  onAbrirMaterial,
  onAlternarVisto,
  now = new Date(),
}: {
  pasos: Paso[]
  role: Role
  totalEstudiantes?: number | null
  onAbrirActividad: (id: string) => void
  onAbrirMaterial?: (m: MaterialLike) => void
  /** Marca o desmarca un recurso como visto. */
  onAlternarVisto?: (clave: string) => void
  now?: Date
}) {
  if (pasos.length === 0) return null

  return (
    <ol className="relative">
      {pasos.map((paso, i) => {
        const ultimo = i === pasos.length - 1
        const hecho = paso.estado === 'hecho'
        const actual = paso.estado === 'actual'
        const bloqueado = paso.estado === 'bloqueado'

        return (
          <li key={paso.clave} className="flex gap-3">
            {/* Columna del camino */}
            <div className="flex w-8 shrink-0 flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  hecho
                    ? 'border-success-500 bg-success-500 text-white'
                    : actual
                      ? 'border-accent bg-accent/10 text-accent'
                      : bloqueado
                        ? 'border-hairline bg-surface-2 text-ink-muted'
                        : 'border-hairline bg-surface-1 text-ink-muted'
                }`}
                aria-hidden="true"
              >
                {hecho ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : bloqueado ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  paso.numero
                )}
              </span>
              {!ultimo && (
                <span
                  className={`w-0.5 flex-1 ${hecho ? 'bg-success-500/40' : 'bg-hairline'}`}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* El paso */}
            <div className={`min-w-0 flex-1 ${ultimo ? 'pb-0' : 'pb-4'}`}>
              {actual && (
                <p className="mb-1 text-xs font-bold tracking-wide text-accent uppercase">Vas aquí</p>
              )}

              {paso.material ? (
                <FilaRecurso
                  material={paso.material}
                  clave={paso.clave}
                  hecho={hecho}
                  role={role}
                  onAbrir={onAbrirMaterial}
                  onAlternarVisto={onAlternarVisto}
                />
              ) : paso.actividad ? (
                <ActivityCard
                  item={paso.actividad}
                  role={role}
                  onOpen={onAbrirActividad}
                  showUnit={false}
                  totalEstudiantes={totalEstudiantes}
                  now={now}
                />
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function FilaRecurso({
  material: m,
  clave,
  hecho,
  role,
  onAbrir,
  onAlternarVisto,
}: {
  material: MaterialLike
  clave: string
  hecho: boolean
  role: Role
  onAbrir?: (m: MaterialLike) => void
  onAlternarVisto?: (clave: string) => void
}) {
  const Icono = ICONO_MATERIAL[m.type] ?? FileText

  const contenido = (
    <>
      <Icono className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body-sm ${hecho ? 'text-ink-secondary' : 'text-ink-primary'}`}>
          {m.title}
        </span>
        <span className="block text-xs text-ink-muted">
          {materialTypeLabel(m.type)}
          {role === 'docente' && m.isVisible === false ? ' · oculto' : ''}
        </span>
      </span>
    </>
  )

  const clase = `flex min-h-row min-w-0 flex-1 items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors ${
    hecho ? 'border-hairline bg-surface-2/50' : 'border-hairline bg-surface-1 hover:border-accent/40'
  } focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`

  const abrir = () => {
    // Abrir un recurso lo da por visto: es la señal más honesta que tenemos sin backend.
    if (!hecho) onAlternarVisto?.(clave)
    onAbrir?.(m)
  }

  return (
    <div className="flex min-w-0 items-stretch gap-2">
      {m.fileUrl ? (
        <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" onClick={() => !hecho && onAlternarVisto?.(clave)} className={clase}>
          {contenido}
        </a>
      ) : (
        <button type="button" onClick={abrir} className={clase}>
          {contenido}
        </button>
      )}

      {/* Marcar a mano: un video puede verse en clase, en el proyector, sin abrirlo aquí. */}
      {role === 'estudiante' && onAlternarVisto && (
        <button
          type="button"
          onClick={() => onAlternarVisto(clave)}
          aria-pressed={hecho}
          title={hecho ? 'Marcar como no visto' : 'Marcar como visto'}
          className={`flex w-11 shrink-0 items-center justify-center rounded-card border transition-colors ${
            hecho
              ? 'border-success-100 bg-success-50 text-success-600'
              : 'border-hairline bg-surface-1 text-ink-muted hover:text-ink-primary'
          } focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none`}
        >
          {hecho ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4" />}
          <span className="sr-only">{hecho ? 'Visto' : 'Marcar como visto'}</span>
        </button>
      )}
    </div>
  )
}
