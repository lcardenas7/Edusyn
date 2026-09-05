/**
 * "Elige tu color": el estudiante repinta SU vista del aula.
 *
 * El color del aula lo pone el docente y lo comparte todo el curso. Eso está bien como
 * identidad, pero obliga a treinta personas distintas a mirar el mismo tono todo el año. Aquí
 * cada quien decide, sin cambiarle nada a nadie.
 *
 * El diálogo dice lo que hace ("solo cambia cómo lo ves tú"), porque si no, un estudiante puede
 * creer que le está cambiando el color al curso entero y no tocarlo por miedo.
 */

import { Check, Palette } from 'lucide-react'
import { TEMAS, type TemaElegido } from '../model/tema'
import { Hoja } from './Hoja'

export function DialogoTema({
  elegido,
  colorAula,
  onElegir,
  onCerrar,
}: {
  elegido: TemaElegido
  /** El color del docente, para poder mostrarlo como opción de vuelta. */
  colorAula: string
  onElegir: (id: TemaElegido) => void
  onCerrar: () => void
}) {
  return (
    <Hoja
      titulo="Elige tu color"
      detalle="Solo cambia cómo ves tú el aula. Tus compañeros y tu profe la siguen viendo igual."
      onCerrar={onCerrar}
    >
        <div className="grid grid-cols-4 gap-2 px-5 py-4">
          {TEMAS.map((t) => (
            <Muestra
              key={t.id}
              color={t.color}
              nombre={t.nombre}
              activo={elegido === t.id}
              onClick={() => onElegir(t.id)}
            />
          ))}
        </div>

        <div className="border-t border-hairline px-5 py-3">
          <Muestra
            color={colorAula}
            nombre="El de la materia"
            activo={elegido === null}
            onClick={() => onElegir(null)}
            ancho
          />
        </div>
    </Hoja>
  )
}

function Muestra({
  color,
  nombre,
  activo,
  onClick,
  ancho = false,
}: {
  color: string
  nombre: string
  activo: boolean
  onClick: () => void
  ancho?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex min-h-btn items-center rounded-card border px-2 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        ancho ? 'w-full gap-3' : 'flex-col justify-center gap-1.5'
      } ${activo ? 'border-ink-primary bg-surface-2' : 'border-hairline hover:bg-surface-2'}`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {activo && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
      </span>
      <span className={`truncate text-xs ${ancho ? 'flex-1 text-left text-body-sm' : 'w-full text-center'} ${activo ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}`}>
        {nombre}
      </span>
    </button>
  )
}

/** El icono con el que se abre. Se reutiliza en el riel y en la hoja de "Más". */
export const IconoTema = Palette
