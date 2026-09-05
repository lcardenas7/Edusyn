/**
 * Ilustraciones para estados vacíos.
 *
 * El aula actual resuelve los vacíos con un icono gris y una frase seca ("Nada en este
 * filtro"). El prototipo los resolvía con el emoji 🔍. Un vacío es un momento de conversación
 * con el usuario: o le falta algo por hacer, o hizo todo y merece saberlo.
 *
 * Trazo geométrico, dos colores (el acento y la superficie), sobre una mancha suave que le da
 * peso al dibujo sin ensuciar el canvas.
 */

export type SceneName =
  | 'sin-actividades'
  | 'todo-al-dia'
  | 'sin-resultados'
  | 'sin-unidades'
  | 'sin-anuncios'
  | 'sin-aulas'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Mancha de fondo: da volumen sin competir con el trazo. */
function Blob({ opacity = 0.1 }: { opacity?: number }) {
  return (
    <path
      d="M28 74c-14-6-20-24-11-38C27 21 51 13 76 15c26 2 47 14 52 31 5 17-7 33-27 39-21 6-58 0-73-11Z"
      fill="currentColor"
      opacity={opacity}
    />
  )
}

const SCENES: Record<SceneName, React.ReactNode> = {
  // Tarjetas en blanco apiladas, esperando la primera.
  'sin-actividades': (
    <>
      <Blob />
      <rect {...S} x="30" y="34" width="52" height="34" rx="5" opacity="0.35" />
      <rect {...S} x="38" y="42" width="52" height="34" rx="5" fill="var(--card, #fff)" />
      <path {...S} d="M48 54h22M48 62h14" opacity="0.6" />
      <circle {...S} cx="94" cy="34" r="11" />
      <path {...S} d="M94 29v10M89 34h10" />
    </>
  ),
  // Todo hecho: el visto grande y unas chispas. El único dibujo que celebra.
  'todo-al-dia': (
    <>
      <Blob opacity={0.14} />
      <circle {...S} cx="64" cy="56" r="24" />
      <path {...S} d="m53 56 8 8 17-18" strokeWidth="2.6" />
      <path {...S} d="M30 30v8M26 34h8" opacity="0.5" strokeWidth="1.8" />
      <path {...S} d="M99 24v6M96 27h6" opacity="0.5" strokeWidth="1.8" />
      <circle cx="104" cy="66" r="2.6" fill="currentColor" opacity="0.35" />
      <circle cx="24" cy="62" r="2" fill="currentColor" opacity="0.3" />
    </>
  ),
  // Lupa sobre una lista que no dio resultados.
  'sin-resultados': (
    <>
      <Blob />
      <rect {...S} x="26" y="30" width="54" height="48" rx="5" opacity="0.4" />
      <path {...S} d="M36 44h28M36 54h20M36 64h24" opacity="0.4" />
      <circle {...S} cx="84" cy="58" r="17" fill="var(--card, #fff)" />
      <path {...S} d="M96 70l10 10" strokeWidth="2.6" />
      <path {...S} d="M78 58h12" opacity="0.7" />
    </>
  ),
  // Libros en un estante, uno recostado: falta organizar el curso en unidades.
  // (Barras rectas se confundían con el glifo de ICFES.)
  'sin-unidades': (
    <>
      <Blob />
      <path {...S} d="M24 76h80" strokeWidth="2.4" />
      <rect {...S} x="34" y="40" width="13" height="36" rx="2.5" />
      <path {...S} d="M37.5 46h6" opacity="0.6" />
      <rect {...S} x="51" y="46" width="13" height="30" rx="2.5" opacity="0.6" />
      <path {...S} d="M54.5 52h6" opacity="0.45" />
      <g opacity="0.4">
        <rect {...S} x="66" y="52" width="13" height="30" rx="2.5" transform="rotate(-18 66 76)" />
      </g>
      <path {...S} d="M88 60h12M94 54v12" opacity="0.55" />
    </>
  ),
  // Tablón con una sola chincheta: todavía no hay nada publicado.
  'sin-anuncios': (
    <>
      <Blob />
      <rect {...S} x="28" y="28" width="72" height="50" rx="5" />
      <path {...S} d="M28 40h72" opacity="0.45" />
      <circle {...S} cx="64" cy="56" r="8" opacity="0.5" />
      <path {...S} d="M64 52v5M64 61h.01" />
      <path {...S} d="M46 86l6-8M82 86l-6-8" opacity="0.4" />
    </>
  ),
  // Puertas: aún no hay aulas a las que entrar.
  'sin-aulas': (
    <>
      <Blob />
      <rect {...S} x="30" y="32" width="34" height="48" rx="4" />
      <circle cx="56" cy="58" r="2.4" fill="currentColor" />
      <rect {...S} x="70" y="42" width="30" height="38" rx="4" opacity="0.45" />
      <circle cx="93" cy="63" r="2.2" fill="currentColor" opacity="0.45" />
      <path {...S} d="M24 80h84" strokeWidth="2.4" />
    </>
  ),
}

export interface SceneProps {
  name: SceneName
  /** Ancho en píxeles; el alto sale de la proporción 128×96. */
  width?: number
  className?: string
}

/**
 * Decorativa: el texto que la acompaña dice lo mismo, así que se oculta a lectores de
 * pantalla para no duplicar el mensaje.
 */
export function Scene({ name, width = 168, className = '' }: SceneProps) {
  return (
    <svg
      width={width}
      height={Math.round((width * 96) / 128)}
      viewBox="0 0 128 96"
      className={`text-accent ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {SCENES[name]}
    </svg>
  )
}
