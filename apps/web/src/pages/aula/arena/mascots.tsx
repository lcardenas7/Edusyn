/**
 * Mascotas de las categorías de la Arena.
 *
 * Son dibujos propios, no iconos de biblioteca, y cada uno existe en dos modos —
 * igual que en los juegos de preguntas conocidos, que usan un personaje
 * ilustrado en la tarjeta y un símbolo plano en el distintivo pequeño:
 *
 *  · `tone="color"` — el personaje a todo color. Va en grande: tarjetas del
 *    vestíbulo, pantalla de la ruleta, listas del perfil.
 *  · `tone="flat"` — la misma silueta en un solo tono, que toma el color del
 *    contexto con `currentColor`. Va en pequeño: gajos de la ruleta y píldora de
 *    la pregunta. A 20 px el color estorba y lo que salva la lectura es la
 *    silueta; además así el símbolo funciona sobre cualquier fondo.
 *
 * Todas comparten la misma gramática para que se lean como familia: silueta
 * redondeada que llena el lienzo de 24×24, sin trazos finos, la misma cara en el
 * mismo sitio y un solo rasgo distintivo por personaje.
 */

export type MascotTone = 'color' | 'flat'
type MascotProps = { size?: number; title?: string; tone?: MascotTone }

const FACE = '#1F2452'

/** Resuelve un relleno según el modo. En plano todo es el color del contexto. */
function fill(tone: MascotTone, color: string, flatOpacity = 1) {
  return tone === 'flat' ? { fill: 'currentColor', fillOpacity: flatOpacity } : { fill: color }
}

/** Resuelve un trazo según el modo. */
function line(tone: MascotTone, color: string) {
  return tone === 'flat' ? 'currentColor' : color
}

/** Ojos y sonrisa comunes. `y` desplaza la cara dentro del cuerpo. */
function Face({ y = 0, narrow = false }: { y?: number; narrow?: boolean }) {
  const dx = narrow ? 2.4 : 3
  return (
    <g fill={FACE}>
      <circle cx={12 - dx} cy={12.6 + y} r="1.25" />
      <circle cx={12 + dx} cy={12.6 + y} r="1.25" />
      <path d={`M${12 - 2.6} ${15.4 + y}q2.6 2.4 5.2 0`} stroke={FACE} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Svg({ size = 24, title, children }: { size?: number; title?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      {children}
    </svg>
  )
}

/** Ciencias — criatura de laboratorio con gafas protectoras. */
export function MascotCiencias({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M12 2.4c-4.6 0-7.8 3.4-7.8 8.2 0 5.6 3.3 10.9 7.8 10.9s7.8-5.3 7.8-10.9c0-4.8-3.2-8.2-7.8-8.2Z" {...fill(tone, '#3FBF7F')} />
      <path d="M4.5 7.4h15v2.4h-15Z" {...fill(tone, '#1F7A4D', 0.3)} />
      <circle cx="8.4" cy="10.6" r="2.6" {...fill(tone, '#D6F5E6', 0.28)} />
      <circle cx="15.6" cy="10.6" r="2.6" {...fill(tone, '#D6F5E6', 0.28)} />
      <Face y={1.4} />
    </Svg>
  )
}

/** Matemáticas — calculadora con antena. */
export function MascotMatematicas({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M12 2.6v2.2" stroke={line(tone, '#FFC94A')} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="1.6" r="1.3" {...fill(tone, '#FFC94A')} />
      <rect x="3.2" y="4.4" width="17.6" height="16.4" rx="4.2" {...fill(tone, '#4C7BF4')} />
      <path d="M9.4 7.9h5.2M12 5.3v5.2" stroke={tone === 'flat' ? FACE : '#FFFFFF'} strokeOpacity={tone === 'flat' ? 0.85 : 1} strokeWidth="1.7" strokeLinecap="round" />
      <Face y={2.8} />
    </Svg>
  )
}

/** Lenguaje — un libro con su cinta marcapáginas. */
export function MascotLenguaje({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M4.4 4.2c0-1.1.9-2 2-2h11.2c1.1 0 2 .9 2 2v15.6c0 1.1-.9 2-2 2H6.4c-1.1 0-2-.9-2-2Z" {...fill(tone, '#F7EBD9')} />
      <path d="M4.4 4.2c0-1.1.9-2 2-2H8v19.6H6.4c-1.1 0-2-.9-2-2Z" {...fill(tone, '#E0507F', 0.32)} />
      <path d="M14.4 2.2v6.4l1.9-1.5 1.9 1.5V2.2Z" {...fill(tone, '#E0507F', 0.32)} />
      <Face y={3.4} narrow />
    </Svg>
  )
}

/** Geografía — el planeta, con sus continentes. */
export function MascotGeografia({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <circle cx="12" cy="12.4" r="9.4" {...fill(tone, '#54A9E4')} />
      <g {...fill(tone, '#3FBF7F', 0.3)}>
        <path d="M4.2 8.6c1.8-.9 3.6-.6 4.6.5.9 1-.2 2.2-1.5 2.4-1.4.2-2.8-.2-3.6-1.1Z" />
        <path d="M15.6 5.6c2 .4 3.4 1.6 3.9 3-.5 1.2-2 1.6-3.3 1-1.4-.6-2-2.1-1.5-3.2Z" />
        <path d="M14.8 15.4c1.8-.5 3.4 0 4 1.2-.7 1.4-2.2 2.4-3.9 2.6-1-.9-1.1-2.7-.1-3.8Z" />
      </g>
      <Face y={0.6} />
    </Svg>
  )
}

/** Arte — paleta de pintor: el agujero del pulgar es lo que la hace legible. */
export function MascotArte({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path
        d="M11.4 2.4C5.9 2.4 1.8 6.3 1.8 11.5c0 5 4.2 8.8 9.6 8.8 1.7 0 2.5-.8 2.5-1.9 0-1.5 1-2.3 2.6-2.3h1.8c2.6 0 4.5-2 4.5-4.7 0-5.1-4.6-9-11.4-9Zm-4.8 16a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z"
        fillRule="evenodd" {...fill(tone, '#EBBE87')}
      />
      {tone === 'flat' ? (
        <g fill="currentColor" fillOpacity=".3">
          <circle cx="6.4" cy="7.4" r="1.7" /><circle cx="11.6" cy="5.6" r="1.7" /><circle cx="16.8" cy="7.6" r="1.7" />
        </g>
      ) : (
        <g>
          <circle cx="6.4" cy="7.4" r="1.7" fill="#E0507F" />
          <circle cx="11.6" cy="5.6" r="1.7" fill="#4C7BF4" />
          <circle cx="16.8" cy="7.6" r="1.7" fill="#3FBF7F" />
        </g>
      )}
      <Face y={0.8} narrow />
    </Svg>
  )
}

/** Deportes — balón con cinta en la frente. */
export function MascotDeportes({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      {/* El balón es blanco por definición, y sobre una tarjeta clara se perdía.
          Lleva contorno propio y manchas marcadas para leerse en cualquier fondo. */}
      <circle cx="12" cy="12.8" r="9.2" {...fill(tone, '#EDF1F8')} stroke={tone === 'flat' ? 'none' : '#2B3157'} strokeWidth="1.1" strokeOpacity=".8" />
      <g {...fill(tone, '#2B3157', 0.24)} fillOpacity={tone === 'flat' ? 0.24 : 0.85}>
        <path d="M12 6.2 14.8 8.2l-1.1 3.3h-3.4L9.2 8.2Z" />
        <path d="M5.1 13.4 7.8 15l-.6 2.8a9.2 9.2 0 0 1-2.1-4.4Z" />
        <path d="M18.9 13.4a9.2 9.2 0 0 1-2.1 4.4l-.6-2.8Z" />
      </g>
      <path d="M3.4 9.2h17.2" stroke={line(tone, '#E0503F')} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20.6 9.2 22.6 6.8" stroke={line(tone, '#E0503F')} strokeWidth="1.6" strokeLinecap="round" />
      <Face y={1.8} />
    </Svg>
  )
}

/** Tecnología — un chip con antenas. */
export function MascotTecnologia({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M7 1.8 8.6 5M17 1.8 15.4 5" stroke={line(tone, '#8FAEDC')} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6.6" cy="1.6" r="1.3" {...fill(tone, '#FFC94A')} />
      <circle cx="17.4" cy="1.6" r="1.3" {...fill(tone, '#FFC94A')} />
      <rect x="3.4" y="4.6" width="17.2" height="16" rx="4.6" {...fill(tone, '#6E8FD0')} />
      <path d="M1.4 10h2M1.4 15h2M20.6 10h2M20.6 15h2" stroke={line(tone, '#8FAEDC')} strokeWidth="1.6" strokeLinecap="round" />
      <Face y={2.4} />
    </Svg>
  )
}

/** Idiomas — un globo de diálogo: hablar es lo que define la categoría. */
export function MascotIdiomas({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M3 6.4c0-2 1.6-3.6 3.6-3.6h10.8c2 0 3.6 1.6 3.6 3.6v7.8c0 2-1.6 3.6-3.6 3.6H10l-4.6 3.6c-.8.6-1.9 0-1.9-1v-2.9A3.6 3.6 0 0 1 3 14.2Z" {...fill(tone, '#A78BFA')} />
      <Face y={-1.4} />
    </Svg>
  )
}

/** Historia — un pergamino con sus rodillos. */
export function MascotHistoria({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <rect x="5.4" y="5.6" width="13.2" height="13.4" rx="1.6" {...fill(tone, '#F4E4C9')} />
      <rect x="2.4" y="3" width="19.2" height="3.6" rx="1.8" {...fill(tone, '#C2703D', 0.38)} />
      <rect x="2.4" y="18" width="19.2" height="3.6" rx="1.8" {...fill(tone, '#C2703D', 0.38)} />
      <Face y={0.4} narrow />
    </Svg>
  )
}

/** Música — nota con audífonos. */
export function MascotMusica({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M3.4 11.4a8.6 8.6 0 0 1 17.2 0" stroke={line(tone, '#C77DE8')} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <rect x="1.6" y="10.6" width="4" height="7" rx="2" {...fill(tone, '#C77DE8')} />
      <rect x="18.4" y="10.6" width="4" height="7" rx="2" {...fill(tone, '#C77DE8')} />
      <rect x="6.2" y="5.6" width="11.6" height="15.2" rx="4.6" {...fill(tone, '#E9CEF8', 0.85)} />
      <Face y={2.6} narrow />
    </Svg>
  )
}

/** Ética y convivencia — un corazón con cara. */
export function MascotEtica({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M12 21.6S2.4 15.6 2.4 9.2C2.4 5.8 5 3.4 8 3.4c1.8 0 3.2.9 4 2.2.8-1.3 2.2-2.2 4-2.2 3 0 5.6 2.4 5.6 5.8 0 6.4-9.6 12.4-9.6 12.4Z" {...fill(tone, '#F08AAE')} />
      <Face y={-1.2} />
    </Svg>
  )
}

/** Filosofía — un búho pensativo. */
export function MascotFilosofia({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M4.6 3.2c1.8-.4 3.4.4 4.2 1.8M19.4 3.2c-1.8-.4-3.4.4-4.2 1.8" stroke={line(tone, '#9B8CE8')} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M12 3.4c-4.6 0-8 3.4-8 8.2v2.2c0 4.4 3.4 7.8 8 7.8s8-3.4 8-7.8v-2.2c0-4.8-3.4-8.2-8-8.2Z" {...fill(tone, '#9B8CE8')} />
      <circle cx="8.6" cy="11.6" r="2.7" {...fill(tone, '#F2EEFF', 0.3)} />
      <circle cx="15.4" cy="11.6" r="2.7" {...fill(tone, '#F2EEFF', 0.3)} />
      <g fill={FACE}>
        <circle cx="8.6" cy="11.6" r="1.25" />
        <circle cx="15.4" cy="11.6" r="1.25" />
      </g>
      <path d="M12 13.8 10.6 16h2.8Z" {...fill(tone, '#FFC94A')} />
    </Svg>
  )
}

/** Economía — una moneda sonriente. */
export function MascotEconomia({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <circle cx="12" cy="12.4" r="9.4" {...fill(tone, '#F2C14E')} />
      <circle cx="12" cy="12.4" r="7.3" {...fill(tone, '#FFE0A0', 0.3)} />
      <path d="M12 5.6v1.8M12 17.4v1.8" stroke={FACE} strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" />
      <Face y={0.6} narrow />
    </Svg>
  )
}

/** Comodín — la estrella, para una categoría sin personaje propio. */
export function MascotComodin({ tone = 'color', ...rest }: MascotProps) {
  return (
    <Svg {...rest}>
      <path d="M12 1.8a1.6 1.6 0 0 1 1.45.92l2.2 4.63 5 .74c1.3.2 1.82 1.8.88 2.72l-3.63 3.6.86 5.04c.22 1.3-1.14 2.3-2.3 1.68L12 18.76l-4.46 2.37c-1.16.62-2.52-.38-2.3-1.68l.86-5.04-3.63-3.6c-.94-.92-.42-2.52.88-2.72l5-.74 2.2-4.63A1.6 1.6 0 0 1 12 1.8Z" {...fill(tone, '#FFC94A')} />
      <Face y={1} narrow />
    </Svg>
  )
}

export type Mascot = (props: MascotProps) => React.ReactElement

export const MASCOTS = {
  ciencias: MascotCiencias,
  matematicas: MascotMatematicas,
  lenguaje: MascotLenguaje,
  geografia: MascotGeografia,
  arte: MascotArte,
  deportes: MascotDeportes,
  tecnologia: MascotTecnologia,
  idiomas: MascotIdiomas,
  historia: MascotHistoria,
  musica: MascotMusica,
  etica: MascotEtica,
  filosofia: MascotFilosofia,
  economia: MascotEconomia,
  comodin: MascotComodin,
} satisfies Record<string, Mascot>

export type MascotKey = keyof typeof MASCOTS
