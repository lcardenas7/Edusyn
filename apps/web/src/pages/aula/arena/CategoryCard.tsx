/**
 * Tarjeta de categoría del vestíbulo.
 *
 * Dos niveles de dibujo por categoría, como en los juegos de preguntas
 * conocidos:
 *  · la **ilustración** grande, que llena la tarjeta y le da personalidad;
 *  · el **icono plano** —la mascota SVG— en el distintivo pequeño, que es el que
 *    sobrevive a 20 px en un gajo de la ruleta o en la píldora de la pregunta.
 *
 * La ilustración es un recurso de imagen opcional (`illustration`). Mientras una
 * categoría no tenga la suya, la tarjeta dibuja la mascota en grande sobre un
 * degradado de su color: se ve completa y coherente desde el primer día, y el
 * día que exista la ilustración entra sin tocar esta pantalla.
 *
 * Por qué opcional y no obligatoria: las categorías las nombra el docente. Una
 * institución puede crear «Mitología griega» mañana, y esa categoría tiene que
 * verse bien sin que nadie dibuje nada.
 */
import { categoryLook } from './categories'

type Props = {
  name: string
  count: number
  active: boolean
  illustration?: string
  onSelect: () => void
}

export default function CategoryCard({ name, count, active, illustration, onSelect }: Props) {
  const look = categoryLook(name)
  const Mascota = look.mascot

  return (
    <button
      type="button" onClick={onSelect} aria-pressed={active}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-transform active:scale-[.98] ${
        active ? 'border-amber-300' : 'border-white/10'
      }`}
    >
      {/* Lienzo de la ilustración. Proporción fija para que todas las tarjetas
          midan igual, tengan imagen o no. */}
      <span
        className="relative block aspect-[4/3] w-full"
        style={{ background: `radial-gradient(90% 80% at 50% 15%, ${look.color}59, ${look.color}14 70%, transparent)` }}
      >
        {illustration ? (
          <img src={illustration} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="absolute inset-0 grid place-items-center pb-2 text-white">
            <span className="drop-shadow-[0_8px_18px_rgba(0,0,0,.5)]">
              <Mascota size={84} />
            </span>
          </span>
        )}
        {/* Distintivo: el icono plano de la misma categoría. */}
        <span
          className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full text-white shadow-lg ring-2 ring-white/25"
          style={{ backgroundColor: look.color }}
        >
          <Mascota size={26} tone="flat" />
        </span>
      </span>

      <span className="flex items-center justify-between gap-2 px-3 py-2.5 text-white" style={{ backgroundColor: look.color }}>
        <span className="min-w-0 truncate text-sm font-black">{name}</span>
        <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold tabular-nums">{count}</span>
      </span>
    </button>
  )
}
