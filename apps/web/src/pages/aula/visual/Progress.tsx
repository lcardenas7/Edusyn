/**
 * Cómo se ve el avance: anillo de progreso y sello de cumplido.
 *
 * El aula actual muestra el progreso solo como número ("60%") o barra fina. Para un estudiante
 * de bachillerato el avance tiene que **verse**: el anillo se lee de reojo y el sello da el
 * cierre que una barra al 100% no da.
 *
 * Accesibilidad: el anillo lleva `role="img"` con su porcentaje escrito, porque aquí el dibujo
 * SÍ transporta información (a diferencia de los glifos, que son decorativos).
 */

import type { ReactNode } from 'react'

export interface ProgressRingProps {
  /** 0–100. Se recorta al rango para que un dato sucio no rompa el dibujo. */
  value: number
  /** Diámetro en píxeles. */
  size?: number
  /** Grosor del trazo. */
  thickness?: number
  /** Color del arco. Por defecto el acento del tema. */
  color?: string
  /** Qué va en el centro. Por defecto, el porcentaje. `null` para dejarlo vacío. */
  children?: ReactNode | null
  /** Texto para lectores de pantalla. Por defecto "Avance: N por ciento". */
  label?: string
  className?: string
}

export function ProgressRing({
  value,
  size = 56,
  thickness = 5,
  color,
  children,
  label,
  className = '',
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)))
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const filled = (pct / 100) * c
  const stroke = color ?? 'rgb(var(--skill-accent))'

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Avance: ${pct} por ciento`}
    >
      <svg width={size} height={size} className="-rotate-90" focusable="false" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-surface-3"
        />
        {/* A 0% no se dibuja el arco: con `strokeLinecap="round"` un tramo de longitud cero
            deja un punto suelto que parece un avance que no existe. */}
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            stroke={stroke}
            strokeDasharray={`${filled} ${c - filled}`}
            // El arco crece con una transición corta; en `prefers-reduced-motion` no se anima.
            className="transition-[stroke-dasharray] duration-300 motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {children === undefined ? (
          <span className="text-xs font-semibold tabular-nums text-ink-primary">{pct}%</span>
        ) : (
          children
        )}
      </span>
    </span>
  )
}

// ─── Sello ───────────────────────────────────────────────────────────────────

export type StampKind = 'entregada' | 'calificada' | 'al-dia'

const STAMP_TEXT: Record<StampKind, { top: string; bottom: string }> = {
  entregada: { top: 'ENTREGADA', bottom: 'A TIEMPO' },
  calificada: { top: 'CALIFICADA', bottom: 'REVISADA' },
  'al-dia': { top: 'AL DÍA', bottom: 'SIN PENDIENTES' },
}

/**
 * Sello de caucho, ligeramente torcido, como el que un profe pone en el cuaderno.
 * Es el único elemento del aula que se permite ser puramente celebratorio.
 *
 * Lleva su texto dentro del SVG, así que no necesita etiqueta aparte; para lectores de
 * pantalla se anuncia con `aria-label` y el dibujo interno queda oculto.
 */
export function Stamp({
  kind = 'calificada',
  size = 96,
  color = '#1E8E5A',
  className = '',
}: {
  kind?: StampKind
  size?: number
  color?: string
  className?: string
}) {
  const text = STAMP_TEXT[kind]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`-rotate-6 ${className}`}
      style={{ color }}
      role="img"
      aria-label={`${text.top} ${text.bottom}`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.85">
        <circle cx="50" cy="50" r="45" />
        <circle cx="50" cy="50" r="38" strokeWidth="1.2" />
      </g>
      {/* `textLength` mantiene las palabras dentro del aro interior: "CALIFICADA" tiene diez
          letras y a cuerpo libre se salía del círculo. */}
      <text
        x="50"
        y="45"
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontWeight="700"
        letterSpacing="0.6"
        opacity="0.9"
        textLength={Math.min(62, text.top.length * 7.2)}
        lengthAdjust="spacingAndGlyphs"
      >
        {text.top}
      </text>
      <path d="M34 52h32" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7.5"
        fontWeight="600"
        letterSpacing="1"
        opacity="0.75"
        textLength={Math.min(56, text.bottom.length * 5.4)}
        lengthAdjust="spacingAndGlyphs"
      >
        {text.bottom}
      </text>
    </svg>
  )
}
