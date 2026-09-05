/**
 * Identidad visual por asignatura.
 *
 * Por qué existe: `apps/web` no tenía **ni un solo SVG propio** — toda la identidad del aula
 * eran iconos genéricos de lucide y emoji. Un aula de Matemáticas se veía exactamente igual
 * que una de Artística, con otro color de fondo. Esto le da a cada asignatura una marca
 * reconocible que se repite en la tarjeta del aula, la carátula de unidad y el encabezado.
 *
 * Reglas (docs/REDISENO_AULA_VIRTUAL.md §D5):
 *  - SVG en línea: nada que descargar, escala sin pixelarse.
 *  - La ilustración aporta IDENTIDAD, nunca ESTADO. El estado es siempre texto + icono + color.
 *  - Trazo geométrico simple (nada de dibujo infantil): funciona igual a 24 px que a 96 px.
 */

import type { ReactNode } from 'react'

export interface SubjectHue {
  /** Trazo y texto sobre el lavado. */
  ink: string
  /** Fondo suave del tile. */
  wash: string
  /** Versión saturada, para carátulas grandes. */
  deep: string
}

export interface SubjectIdentity {
  key: string
  hue: SubjectHue
  glyph: ReactNode
}

// Paleta de identidad. Son colores de TAXONOMÍA (qué asignatura es), no de jerarquía visual,
// por eso viven aquí en hex y no como tokens del DS. Ver §5.4 del plan.
const HUES: Record<string, SubjectHue> = {
  azul: { ink: '#2E6BE6', wash: '#EAF1FE', deep: '#1D4FBD' },
  violeta: { ink: '#6B4BD8', wash: '#EFEBFC', deep: '#4F35AD' },
  verde: { ink: '#1E8E5A', wash: '#E6F5EE', deep: '#146B43' },
  teal: { ink: '#0E9F8E', wash: '#E2F5F2', deep: '#0A7A6D' },
  ambar: { ink: '#C77A12', wash: '#FCF2E0', deep: '#9C5F0B' },
  terracota: { ink: '#C1622E', wash: '#FBEDE4', deep: '#984A1F' },
  rosa: { ink: '#B84A7D', wash: '#FBEAF2', deep: '#93365F' },
  indigo: { ink: '#3D4EA8', wash: '#EAECF9', deep: '#2B3880' },
  oliva: { ink: '#6E8B1E', wash: '#F1F5E0', deep: '#546A15' },
  pizarra: { ink: '#4A5568', wash: '#EDF0F4', deep: '#2D3748' },
}

// Trazo común: geométrico, 1.7 px, extremos redondeados. Lo que hace que doce dibujos
// distintos se vean de la misma familia.
const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Cada glifo se dibuja sobre una rejilla de 24×24 con primitivas simples. */
const GLYPHS: Record<string, ReactNode> = {
  // Las cuatro operaciones. Es el glifo que un estudiante lee sin dudar; una escuadra o un
  // compás se confunden con la letra A a tamaño pequeño.
  matematicas: (
    <>
      <path {...S} d="M7.5 4.6v5.8M4.6 7.5h5.8" />
      <path {...S} d="M13.6 7.5h5.8" />
      <path {...S} d="m5.4 14.4 4.2 4.2M9.6 14.4l-4.2 4.2" />
      <path {...S} d="M13.6 16.5h5.8" />
      <circle cx="16.5" cy="13.6" r=".95" fill="currentColor" />
      <circle cx="16.5" cy="19.4" r=".95" fill="currentColor" />
    </>
  ),
  // Libro abierto: la lectura.
  lenguaje: (
    <>
      <path {...S} d="M12 6.5C10.2 5.2 7.9 4.7 5 5v13c2.9-.3 5.2.2 7 1.5" />
      <path {...S} d="M12 6.5C13.8 5.2 16.1 4.7 19 5v13c-2.9-.3-5.2.2-7 1.5" />
      <path {...S} d="M12 6.5v13" />
    </>
  ),
  // Matraz con burbujas: el experimento.
  ciencias: (
    <>
      <path {...S} d="M10 3.5v6L5.2 17.4A2 2 0 0 0 6.9 20.5h10.2a2 2 0 0 0 1.7-3.1L14 9.5v-6" />
      <path {...S} d="M9 3.5h6" />
      <path {...S} d="M7.7 14.5h8.6" />
      <circle {...S} cx="11" cy="17" r="1" />
      <circle {...S} cx="14" cy="18" r=".7" />
    </>
  ),
  // Globo con meridianos: el mundo.
  sociales: (
    <>
      <circle {...S} cx="12" cy="12" r="8" />
      <path {...S} d="M4 12h16" />
      <path {...S} d="M12 4c2.4 2.2 3.6 5 3.6 8s-1.2 5.8-3.6 8c-2.4-2.2-3.6-5-3.6-8s1.2-5.8 3.6-8Z" />
    </>
  ),
  // Dos burbujas de diálogo: la conversación.
  idiomas: (
    <>
      <path {...S} d="M4 6.5A1.5 1.5 0 0 1 5.5 5h8A1.5 1.5 0 0 1 15 6.5v5A1.5 1.5 0 0 1 13.5 13H8l-4 3Z" />
      <path {...S} d="M18 9.5h.5A1.5 1.5 0 0 1 20 11v5a1.5 1.5 0 0 1-1.5 1.5H17l-2.5 2.2V17" />
    </>
  ),
  // Paleta: el color.
  artistica: (
    <>
      <path
        {...S}
        d="M12 4a8 8 0 0 0 0 16c1.2 0 1.8-.8 1.8-1.6 0-1.3-1.1-1.6-1.1-2.6 0-.8.7-1.4 1.6-1.4H16a4 4 0 0 0 4-4c0-3.6-3.6-6.4-8-6.4Z"
      />
      <circle {...S} cx="8.4" cy="10.4" r="1.1" />
      <circle {...S} cx="11.6" cy="7.8" r="1.1" />
      <circle {...S} cx="15.4" cy="9.4" r="1.1" />
    </>
  ),
  // Balón: el juego reglado.
  fisica: (
    <>
      <circle {...S} cx="12" cy="12" r="8" />
      <path {...S} d="m12 7.4 4.1 3-1.6 4.8h-5l-1.6-4.8Z" />
      <path {...S} d="M12 4v3.4M18.6 9.4l-2.5 1M17.1 17.9 14.5 15.2M6.9 17.9l2.6-2.7M5.4 9.4l2.5 1" />
    </>
  ),
  // Circuito: la tecnología.
  tecnologia: (
    <>
      <rect {...S} x="7.5" y="7.5" width="9" height="9" rx="1.6" />
      <path {...S} d="M10 4v3.5M14 4v3.5M10 16.5V20M14 16.5V20M4 10h3.5M4 14h3.5M16.5 10H20M16.5 14H20" />
      <circle {...S} cx="12" cy="12" r="1.4" />
    </>
  ),
  // Manos que sostienen: la ética y la convivencia.
  etica: (
    <>
      <path {...S} d="M12 19.5s-6.2-3.6-6.2-8A3.4 3.4 0 0 1 12 9.2a3.4 3.4 0 0 1 6.2 2.3c0 4.4-6.2 8-6.2 8Z" />
      <path {...S} d="M4.5 15.5 3 17M19.5 15.5 21 17" />
    </>
  ),
  // Columna clásica: la filosofía. Una espiral se leía como una diana.
  filosofia: (
    <>
      <path {...S} d="M5.5 5.5h13" />
      <path {...S} d="M7.5 8h9" />
      <path {...S} d="M9.4 8v8.6M12 8v8.6M14.6 8v8.6" />
      <path {...S} d="M7.5 16.6h9" />
      <path {...S} d="M5.5 19.2h13" />
    </>
  ),
  // Nota: la música.
  musica: (
    <>
      <path {...S} d="M9 17.5V6.2l9-1.7v11.3" />
      <circle {...S} cx="6.8" cy="17.6" r="2.2" />
      <circle {...S} cx="15.8" cy="15.8" r="2.2" />
      <path {...S} d="M9 9.6l9-1.7" />
    </>
  ),
  // Semilla que brota: lo que no encaja en ninguna, dicho en positivo.
  general: (
    <>
      <path {...S} d="M12 20v-7" />
      <path {...S} d="M12 13c0-3 2.2-5.4 5.2-5.4 0 3-2.2 5.4-5.2 5.4Z" />
      <path {...S} d="M12 15.5c0-2.5-1.8-4.5-4.3-4.5 0 2.5 1.8 4.5 4.3 4.5Z" />
      <path {...S} d="M8 20h8" />
    </>
  ),
}

/**
 * Palabras clave → identidad. Se evalúan en orden, así que lo específico va antes
 * que lo genérico ("ciencias sociales" antes que "ciencias").
 */
const RULES: { match: RegExp; key: string; hue: string }[] = [
  { match: /matem|calcul|algebr|geometr|aritm|estad|trigonom/, key: 'matematicas', hue: 'azul' },
  { match: /ingl|english|franc|alem|portug|bilingu|idioma|lengua extranjera/, key: 'idiomas', hue: 'teal' },
  { match: /social|histor|geograf|constitu|democra|catedra de la paz|econom|politic/, key: 'sociales', hue: 'terracota' },
  { match: /lengua|castellan|espanol|español|literat|lectura|comunicac|plan lector/, key: 'lenguaje', hue: 'violeta' },
  { match: /ciencia|biolog|quimic|física natural|fisica natural|ambient|naturale/, key: 'ciencias', hue: 'verde' },
  { match: /educacion fisica|educación física|deport|recreac|fisica y deport/, key: 'fisica', hue: 'oliva' },
  { match: /music|banda|coro/, key: 'musica', hue: 'rosa' },
  { match: /artist|artes|dibujo|plastic|danza|teatro/, key: 'artistica', hue: 'rosa' },
  { match: /tecnolog|informat|computac|sistemas|program|robotic|digital/, key: 'tecnologia', hue: 'indigo' },
  { match: /etica|ética|valores|religi|convivenc|catedra|orientac/, key: 'etica', hue: 'ambar' },
  { match: /filosof|pensamiento|logic|epistem/, key: 'filosofia', hue: 'pizarra' },
  { match: /fisica|física/, key: 'ciencias', hue: 'verde' },
]

const HUE_ORDER = Object.keys(HUES)

/** Hash estable: la misma asignatura siempre recibe el mismo color de reserva. */
function hashHue(name: string): SubjectHue {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return HUES[HUE_ORDER[Math.abs(h) % HUE_ORDER.length]]
}

/** Resuelve la identidad de una asignatura por su nombre. Nunca falla. */
export function subjectIdentity(subject: string | null | undefined): SubjectIdentity {
  const name = (subject ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const rule = RULES.find((r) => r.match.test(name))
  if (rule) return { key: rule.key, hue: HUES[rule.hue], glyph: GLYPHS[rule.key] }
  return { key: 'general', hue: hashHue(name || 'general'), glyph: GLYPHS.general }
}

// ─── Componentes ─────────────────────────────────────────────────────────────

export interface SubjectMarkProps {
  subject: string | null | undefined
  /** Lado del tile en píxeles. */
  size?: number
  /** `tile` = glifo sobre lavado redondeado · `bare` = solo el glifo. */
  variant?: 'tile' | 'bare'
  /** Fuerza el color (p. ej. el color que el docente eligió para su aula). */
  hue?: SubjectHue
  className?: string
}

/**
 * La marca de la asignatura. Decorativa: siempre `aria-hidden`, porque el nombre de la
 * asignatura ya está escrito al lado. Un lector de pantalla no debe leerla dos veces.
 */
export function SubjectMark({ subject, size = 40, variant = 'tile', hue, className = '' }: SubjectMarkProps) {
  const identity = subjectIdentity(subject)
  const color = hue ?? identity.hue
  const glyphSize = variant === 'tile' ? Math.round(size * 0.6) : size

  const svg = (
    <svg
      width={glyphSize}
      height={glyphSize}
      viewBox="0 0 24 24"
      style={{ color: color.ink }}
      aria-hidden="true"
      focusable="false"
    >
      {identity.glyph}
    </svg>
  )

  if (variant === 'bare') return <span className={className}>{svg}</span>

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${className}`}
      style={{ width: size, height: size, backgroundColor: color.wash }}
      aria-hidden="true"
    >
      {svg}
    </span>
  )
}

/**
 * Fondo de carátula: el glifo de la asignatura repetido en muy bajo contraste, recortado.
 * Es lo que convierte una tarjeta blanca en "la portada de Matemáticas" sin gritar.
 * Se coloca en un contenedor `relative overflow-hidden`.
 */
export function SubjectPattern({
  subject,
  hue,
  opacity = 0.09,
  className = '',
}: {
  subject: string | null | undefined
  hue?: SubjectHue
  opacity?: number
  className?: string
}) {
  const identity = subjectIdentity(subject)
  const color = hue ?? identity.hue
  const id = `sp-${identity.key}`

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ color: color.ink, opacity }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <g transform="translate(16 16) scale(1)">{identity.glyph}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
