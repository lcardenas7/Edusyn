/**
 * Chips de filtro — primera pieza del Design System fuera del Learning Engine.
 *
 * Principio (docs/DESIGN_SYSTEM_LEARNING.md §2, ya codificado en tailwind.config):
 * el color al 100% va SOLO en lo activo. En reposo, superficie neutra + tinta.
 * La identidad la da la ETIQUETA, no el tono: ocho colores compitiendo no
 * jerarquizan, y con suficientes filtros los tonos terminan repitiéndose.
 *
 * Ver docs/AUDITORIA_VISUAL_AULA.md §H1.
 */
import type { ReactNode } from 'react'

interface FilterChipProps {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  /** Ícono/emoji opcional a la izquierda. */
  icon?: ReactNode
  /** Punto de severidad (clase de color de fondo, p. ej. 'bg-orange-500').
   *  Codifica urgencia SIN teñir todo el chip. */
  dot?: string
}

export function FilterChip({ label, count, active, onClick, icon, dot }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-surface-1 border-hairline text-ink-secondary hover:border-ink-muted'
      }`}
    >
      {dot && !active && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {icon}
      {label}
      {count !== undefined && (
        <span className={`text-xs px-1.5 rounded-full font-semibold tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-surface-3 text-ink-muted'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * Tira de filtros: en móvil hace scroll horizontal en vez de envolver.
 * Envolver 9 chips producía ~4 filas (~200px) antes de ver una sola actividad.
 */
export function FilterStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  )
}
