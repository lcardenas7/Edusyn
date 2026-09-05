/**
 * Estados vacíos, de carga y de error.
 *
 * Corrige tres defectos concretos de la auditoría:
 *  - E1/E3 Los vacíos no tienen acción: el botón para resolverlos está lejos, arriba.
 *  - E2    "Ver todas" no restablece el filtro de período, así que el clic no resuelve nada.
 *          Aquí la acción la decide quien monta la vista, y el pipeline limpia TODOS los
 *          filtros de una vez (`EMPTY_FILTERS`).
 *  - D (§D del informe C) Error y vacío se mostraban a la vez, diciendo cosas contradictorias.
 *          `AulaState` los hace mutuamente excluyentes.
 */

import type { ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Scene, type SceneName } from '../visual/Scene'

export interface EmptyStateProps {
  scene: SceneName
  title: string
  /** Una frase que explica qué pasó y qué se puede hacer. */
  detail?: string
  /** Acción primaria. Un vacío sin salida es un callejón. */
  action?: { label: string; onClick: () => void }
  /** Acción secundaria, en texto. */
  secondary?: { label: string; onClick: () => void }
  compact?: boolean
}

export function EmptyState({ scene, title, detail, action, secondary, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-modal border border-dashed border-hairline bg-surface-1 px-6 text-center ${
        compact ? 'py-8' : 'py-12'
      }`}
    >
      <Scene name={scene} width={compact ? 132 : 176} />
      <p className="mt-3 text-body-base font-semibold text-ink-primary">{title}</p>
      {detail && <p className="mt-1 max-w-sm text-body-sm text-ink-secondary">{detail}</p>}
      {(action || secondary) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="min-h-btn rounded-lg bg-accent px-4 text-body-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {action.label}
            </button>
          )}
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="min-h-btn rounded-lg px-4 text-body-sm font-medium text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Carga ───────────────────────────────────────────────────────────────────

/**
 * Esqueleto con la forma de una tarjeta de actividad. Un esqueleto que se parece a lo que
 * viene evita el salto de layout y el "spinner que no dice nada" del aula actual.
 */
export function ActivityListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-card border border-hairline bg-surface-1 p-4">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-surface-3 motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="h-4 w-2/5 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando actividades…</span>
    </div>
  )
}

// ─── Error ───────────────────────────────────────────────────────────────────

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-modal border border-danger-100 bg-danger-50 px-6 py-10 text-center"
    >
      <TriangleAlert className="h-8 w-8 text-danger-600" aria-hidden="true" />
      <p className="mt-3 text-body-base font-semibold text-ink-primary">No pudimos cargar esto</p>
      <p className="mt-1 max-w-sm text-body-sm text-ink-secondary">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-btn items-center gap-2 rounded-lg border border-hairline bg-surface-1 px-4 text-body-sm font-medium text-ink-primary hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reintentar
        </button>
      )}
    </div>
  )
}

// ─── Selector: carga · error · vacío · contenido ─────────────────────────────

/**
 * Un solo lugar decide cuál de los cuatro estados se ve, para que no puedan coincidir.
 * En el aula actual, si la carga fallaba se mostraba el banner de error Y el estado vacío
 * debajo, con mensajes que se contradecían.
 */
export function AulaState({
  loading,
  error,
  onRetry,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  loading: boolean
  error?: string | null
  onRetry?: () => void
  isEmpty: boolean
  empty: ReactNode
  skeleton?: ReactNode
  children: ReactNode
}) {
  if (loading) return <>{skeleton ?? <ActivityListSkeleton />}</>
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (isEmpty) return <>{empty}</>
  return <>{children}</>
}
