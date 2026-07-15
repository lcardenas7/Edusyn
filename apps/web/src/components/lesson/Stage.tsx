import type { ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// STAGE — el escenario adaptativo (DS-1)
// ─────────────────────────────────────────────────────────────────────────
// Un solo contenedor que recibe `variant` y aplica el layout correcto.
// Los bloques NO manejan su layout de pantalla — lo heredan del Stage.
// Ver docs/DESIGN_SYSTEM_LEARNING.md §4.1 y LEARNING_EXPERIENCE_SPEC.md §3.
// ═══════════════════════════════════════════════════════════════════════════

export type StageVariant =
  | 'reading'
  | 'question'
  | 'media'
  | 'reflection'
  | 'challenge'
  | 'celebration'

interface StageProps {
  variant: StageVariant
  children: ReactNode
  className?: string
}

export function Stage({ variant, children, className = '' }: StageProps) {
  return (
    <div data-stage={variant} className={`w-full ${className}`}>
      {children}
    </div>
  )
}
