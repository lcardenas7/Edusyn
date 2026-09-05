/**
 * El tile ilustrado de una actividad.
 *
 * Reemplaza al "icono de lucide dentro de un cuadrado de color" de la lista actual. Cada
 * familia tiene una **silueta propia**, no un icono genérico teñido: un examen y un quiz se
 * distinguen de reojo, sin leer la etiqueta. Es lo que hace que la lista se vea como un aula
 * y no como una bandeja de correo.
 *
 * La etiqueta de texto SIEMPRE acompaña al glifo en la tarjeta: el dibujo es refuerzo, nunca
 * el único canal (docs/REDISENO_AULA_VIRTUAL.md §D5).
 */

import type { ReactNode } from 'react'
import type { ActivityFamily } from '../model/labels'
import { familyMeta, familyOfType } from '../model/labels'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Siluetas sobre rejilla de 24×24. Mismo trazo para toda la familia visual. */
const SHAPES: Record<ActivityFamily, ReactNode> = {
  // Hoja con esquina doblada y un visto: algo que se entrega y se revisa.
  tarea: (
    <>
      <path {...S} d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z" />
      <path {...S} d="M14 3.5V8h4.5" />
      <path {...S} d="m8.8 14.2 2 2 4-4.2" />
    </>
  ),
  // Tres opciones, una marcada: la forma de una pregunta cerrada.
  quiz: (
    <>
      <rect {...S} x="3.5" y="5" width="17" height="14" rx="2" />
      <circle {...S} cx="8" cy="9.5" r="1.3" />
      <circle {...S} cx="8" cy="14.5" r="1.3" />
      <path {...S} d="M11.5 9.5h6M11.5 14.5h4" />
      <path {...S} d="m6.9 14.5.8.8 1.5-1.6" />
    </>
  ),
  // Hoja con sello: la evaluación formal.
  examen: (
    <>
      <path {...S} d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-6" />
      <path {...S} d="M8.5 8h4M8.5 11.5h3" />
      <circle {...S} cx="16.5" cy="6.5" r="3" />
      <path {...S} d="m15 9 .4 3 1.1-.8 1.1.8.4-3" />
    </>
  ),
  // Pantalla con un rayo y ondas laterales: emite en vivo, todos responden a la vez.
  // (Con las ondas arriba se leía como un despertador.)
  'quiz-vivo': (
    <>
      <rect {...S} x="7.5" y="6" width="9" height="12" rx="2" />
      <path {...S} d="m12.7 8.8-2.2 3.4h3l-2.2 3.4" />
      <path {...S} d="M4.6 9.2a5 5 0 0 0 0 5.6M19.4 9.2a5 5 0 0 1 0 5.6" />
      <path {...S} d="M2.2 7a8.5 8.5 0 0 0 0 10M21.8 7a8.5 8.5 0 0 1 0 10" opacity="0.5" />
      <path {...S} d="M9.5 20.8h5" />
    </>
  ),
  // Casa con una tarjeta dentro: el mismo quiz, pero por su cuenta.
  'quiz-casa': (
    <>
      <path {...S} d="M4 10.5 12 4l8 6.5" />
      <path {...S} d="M6 9.6V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V9.6" />
      <rect {...S} x="9" y="12" width="6" height="5.5" rx="1" />
      <path {...S} d="M10.6 14.4h2.8" />
    </>
  ),
  // Barras dentro de un marco: la prueba con estructura de examen de Estado.
  icfes: (
    <>
      <rect {...S} x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path {...S} d="M8 16v-3.5M12 16V9M16 16v-5.5" />
      <path {...S} d="M6 19.5h12" />
    </>
  ),
  // Libro abierto con un play: contenido que se recorre.
  leccion: (
    <>
      <path {...S} d="M12 7.2C10.3 6 8.2 5.5 5.5 5.8v11.4c2.7-.3 4.8.2 6.5 1.4" />
      <path {...S} d="M12 7.2c1.7-1.2 3.8-1.7 6.5-1.4v11.4c-2.7-.3-4.8.2-6.5 1.4" />
      <path {...S} d="M12 7.2v12" />
      <path {...S} d="m10.4 10.6 2.6 1.6-2.6 1.6Z" />
    </>
  ),
  // Pieza de rompecabezas: practicar jugando.
  juego: (
    <>
      <path
        {...S}
        d="M9.6 4.5h4.8v2a1.8 1.8 0 1 0 3.6 0v-2h1.5v4.8h-2a1.8 1.8 0 1 0 0 3.6h2v4.8h-4.8v-2a1.8 1.8 0 1 0-3.6 0v2H4.5v-4.8h2a1.8 1.8 0 1 0 0-3.6h-2V4.5h5.1"
      />
    </>
  ),
  // Espejo con una estrella: mirarse a uno mismo.
  autoevaluacion: (
    <>
      <path {...S} d="M12 3.5c3.6 0 6.5 3.1 6.5 7s-2.9 7-6.5 7-6.5-3.1-6.5-7 2.9-7 6.5-7Z" />
      <path {...S} d="M9.5 20.5h5" />
      <path {...S} d="M12 17.5v3" />
      <path {...S} d="m12 7.2 1.2 2.5 2.6.4-1.9 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-1.9-1.9 2.6-.4Z" />
    </>
  ),
}

export interface ActivityGlyphProps {
  /** El `type` crudo del backend (TASK, QUIZ, LIVE_QUIZ…). Se traduce a familia aquí. */
  type?: string | null
  /** La familia ya resuelta. Tiene prioridad sobre `type`. */
  family?: ActivityFamily
  /** Lado del tile en píxeles. */
  size?: number
  /** `tile` = silueta sobre lavado redondeado · `bare` = solo la silueta. */
  variant?: 'tile' | 'bare'
  className?: string
}

/**
 * Decorativo por definición: `aria-hidden`. La etiqueta del tipo se escribe al lado, así que
 * un lector de pantalla no debe anunciarlo dos veces.
 */
export function ActivityGlyph({ type, family: forced, size = 44, variant = 'tile', className = '' }: ActivityGlyphProps) {
  const family = forced ?? familyOfType(type)
  const meta = familyMeta(family)
  const glyphSize = variant === 'tile' ? Math.round(size * 0.58) : size

  const svg = (
    <svg
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 24 24"
      style={{ color: meta.ink }}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[family]}
    </svg>
  )

  if (variant === 'bare') return <span className={className}>{svg}</span>

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${className}`}
      style={{ width: size, height: size, backgroundColor: meta.wash }}
      aria-hidden="true"
    >
      {svg}
    </span>
  )
}
