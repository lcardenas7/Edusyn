/**
 * La línea de tiempos de una actividad: Publicada · Se abre · Vence · Entregada · Calificada.
 *
 * Corrige P1-5 (A6): estas fechas ya existen en los datos y nunca se pintan. `openDate` incluso
 * bloquea al estudiante y jamás se le dice cuándo abre; `scheduledPublishAt` solo aparecía como
 * etiqueta de un botón.
 *
 * Sobre la forma: el prototipo dibujaba siempre las cinco columnas con guiones para las vacías,
 * a ancho fijo. En 360 px las etiquetas se montaban unas sobre otras. Aquí:
 *  - solo se dibujan los hitos que existen (`milestonesOf` ya los filtra);
 *  - en móvil es una lista vertical, que es la forma natural de leer una secuencia en un
 *    teléfono, y solo se vuelve horizontal cuando hay sitio.
 *
 * Son dos maquetados en vez de uno acrobático a propósito: es más código, pero ninguno de los
 * dos se rompe.
 */

import { Check } from 'lucide-react'
import { bogotaShortDate, bogotaTime, type Milestone } from '../model/countdown'

export function Timeline({ hitos }: { hitos: Milestone[] }) {
  if (hitos.length === 0) return null

  return (
    <div className="rounded-card bg-surface-2 p-4">
      {/* Móvil: lista vertical */}
      <ol className="space-y-0 sm:hidden">
        {hitos.map((h, i) => (
          <li key={h.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Punto hecho={h.done} />
              {i < hitos.length - 1 && (
                <span className={`w-0.5 flex-1 ${h.done ? 'bg-accent/40' : 'bg-hairline'}`} />
              )}
            </div>
            <div className={`pb-4 ${i === hitos.length - 1 ? 'pb-0' : ''}`}>
              <p className={`text-body-sm font-medium ${h.done ? 'text-ink-primary' : 'text-ink-muted'}`}>
                {h.label}
              </p>
              <p className="text-body-sm text-ink-muted">
                {bogotaShortDate(h.date)} · {bogotaTime(h.date)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Escritorio: fila horizontal */}
      <ol className="hidden sm:flex sm:items-start">
        {hitos.map((h, i) => (
          <li key={h.key} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
              <Punto hecho={h.done} />
              <p className={`mt-1.5 text-body-sm font-medium ${h.done ? 'text-ink-primary' : 'text-ink-muted'}`}>
                {h.label}
              </p>
              <p className="truncate text-xs text-ink-muted">{bogotaShortDate(h.date)}</p>
              <p className="truncate text-xs text-ink-muted">{bogotaTime(h.date)}</p>
            </div>
            {i < hitos.length - 1 && (
              <span
                aria-hidden="true"
                className={`mt-3 h-0.5 w-full min-w-4 flex-1 ${h.done ? 'bg-accent/40' : 'bg-hairline'}`}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Punto({ hecho }: { hecho: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
        hecho ? 'border-accent bg-accent text-white' : 'border-hairline bg-surface-1'
      }`}
    >
      {hecho && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  )
}
