/**
 * La ruleta de categorías.
 *
 * Dibujada en SVG y no con un degradado cónico. El degradado daba un disco de
 * colores planos sin radios ni aro —un gráfico de torta— y los símbolos
 * quedaban sueltos encima, cada uno con su propio peso visual.
 *
 * Lo que la hace parecer una ruleta:
 *  · **radios blancos** entre gajos, que es lo que separa una ruleta de una
 *    torta;
 *  · **aro exterior con tachuelas**, el borde contra el que golpea el tope;
 *  · **cada símbolo dentro de un disco blanco idéntico**. Esto resuelve dos
 *    cosas a la vez: todas las mascotas ocupan exactamente el mismo círculo, así
 *    que ninguna se ve más grande que otra, y sobre blanco pueden ir a todo
 *    color en vez de en silueta plana;
 *  · **sombreado del centro al borde**, para que el disco tenga volumen.
 *
 * El giro lo controla quien la usa, pasando `rotation` y `transition`: este
 * componente solo dibuja.
 */
import { opticalScale, type WheelSlice } from './categories'

type Props = {
  slices: WheelSlice[]
  /** Grados de giro acumulados. */
  rotation: number
  /** Transición CSS del giro; sin ella la rueda salta al ángulo. */
  transition?: string
  /** Categoría que quedó premiada: su disco se agranda al detenerse. */
  winner?: string | null
  /** Texto del centro. */
  hub?: string
  size?: number
}

const R_RIM = 98      // aro exterior
const R_FACE = 86     // cara con los gajos
const R_ICON = 56     // dónde viven los discos de los símbolos
const R_DISC = 14     // radio del disco blanco de cada símbolo
const R_HUB = 24      // centro

function point(radius: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [100 + radius * Math.cos(a), 100 + radius * Math.sin(a)] as const
}

function slicePath(from: number, to: number) {
  const [x1, y1] = point(R_FACE, from)
  const [x2, y2] = point(R_FACE, to)
  const large = to - from > 180 ? 1 : 0
  return `M100 100 L${x1.toFixed(2)} ${y1.toFixed(2)} A${R_FACE} ${R_FACE} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

export default function Wheel({ slices, rotation, transition, winner, hub = 'GIRA', size = 240 }: Props) {
  const count = Math.max(slices.length, 1)
  const step = 360 / count
  // Con muchas categorías el arco se estrecha y el disco tiene que encoger.
  const disc = count > 7 ? R_DISC * Math.sqrt(7 / count) : R_DISC

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        {/* Volumen: el centro se aclara y el borde se oscurece. */}
        <radialGradient id="arena-wheel-shade" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#fff" stopOpacity=".22" />
          <stop offset="58%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".26" />
        </radialGradient>
        <filter id="arena-wheel-drop" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#05061c" floodOpacity=".55" />
        </filter>
      </defs>

      <g filter="url(#arena-wheel-drop)">
        {/* Aro exterior y tachuelas: el borde contra el que golpea el tope. */}
        <circle cx="100" cy="100" r={R_RIM} fill="#0E1130" />
        <circle cx="100" cy="100" r={R_RIM} fill="none" stroke="#FFC94A" strokeWidth="3" />
        {Array.from({ length: count * 2 }, (_, index) => {
          const [x, y] = point((R_RIM + R_FACE) / 2, index * (360 / (count * 2)))
          return <circle key={index} cx={x} cy={y} r="1.9" fill="#FFE2A0" opacity=".85" />
        })}
      </g>

      {/* Todo lo que gira. */}
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '100px 100px', transition }}>
        {slices.map((slice, index) => (
          <path key={`gajo-${slice.name}`} d={slicePath(index * step, (index + 1) * step)} fill={slice.color} />
        ))}

        {/* Radios: separan los gajos y son lo que delata una ruleta. */}
        {slices.map((_, index) => {
          const [x, y] = point(R_FACE, index * step)
          return <line key={`radio-${index}`} x1="100" y1="100" x2={x} y2={y} stroke="#fff" strokeWidth="1.6" strokeOpacity=".85" />
        })}

        <circle cx="100" cy="100" r={R_FACE} fill="url(#arena-wheel-shade)" />
        <circle cx="100" cy="100" r={R_FACE} fill="none" stroke="#fff" strokeWidth="2" strokeOpacity=".9" />

        {/* Un disco blanco idéntico por categoría: iguala el tamaño percibido de
            todas las mascotas y les permite ir a color. */}
        {slices.map((slice, index) => {
          const angle = (index + 0.5) * step
          const [x, y] = point(R_ICON, angle)
          const Mascota = slice.mascot
          const won = winner === slice.name
          const scale = opticalScale(slice.key)
          const box = disc * 1.5
          return (
            <g
              key={`icono-${slice.name}`}
              style={{
                transform: `rotate(${-rotation}deg) ${won ? 'scale(1.18)' : ''}`,
                transformOrigin: `${x}px ${y}px`,
                transition: 'transform .35s cubic-bezier(.3,1.3,.5,1)',
              }}
            >
              <circle cx={x} cy={y} r={disc} fill="#fff" stroke={slice.color} strokeWidth="1.6" />
              <g transform={`translate(${x - (box * scale) / 2} ${y - (box * scale) / 2}) scale(${scale})`}>
                <foreignObject width={box} height={box} style={{ overflow: 'visible' }}>
                  <div style={{ width: box, height: box, display: 'grid', placeItems: 'center', color: slice.color }}>
                    <Mascota size={box * 0.96} />
                  </div>
                </foreignObject>
              </g>
            </g>
          )
        })}
      </g>

      {/* Centro: no gira, para que el rótulo se lea siempre. */}
      <circle cx="100" cy="100" r={R_HUB + 4} fill="#fff" />
      <circle cx="100" cy="100" r={R_HUB} fill="#16183D" />
      <text
        x="100" y="100" textAnchor="middle" dominantBaseline="central"
        fill="#FFC94A" fontSize="11" fontWeight="900" letterSpacing="1.2"
        style={{ fontFamily: 'inherit' }}
      >
        {hub}
      </text>
    </svg>
  )
}
