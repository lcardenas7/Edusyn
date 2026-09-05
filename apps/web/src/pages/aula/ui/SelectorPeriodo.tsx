/**
 * El selector de período del encabezado.
 *
 * Antes era un `<select>` nativo con tope de ancho. Dos problemas reales, ambos vistos con
 * datos del colegio:
 *  - Un select **corta** su etiqueta contra el borde en vez de terminarla en "…", así que
 *    "Primer Período · en curso" se leía "Primer Período · e". Texto partido a media palabra:
 *    parece que la pantalla está rota.
 *  - Sin tope, el ancho lo fijaba la opción más larga y le comía la fila al nombre del curso.
 *
 * Ahora es un botón corto —"P1"— que abre la lista con los nombres completos. El encabezado
 * recupera su espacio y nada queda cortado.
 */

import { Check, CalendarRange } from 'lucide-react'
import { periodoCorto } from '../model/periodos'
import { Hoja } from './Hoja'

export interface PeriodoOpcion {
  id: string
  name: string
  activo?: boolean
  /** El número que manda el colegio, cuando lo manda. Ordena la lista. */
  orden?: number | null
}

export const TODOS = 'todos'
export const SIN_PERIODO = 'sin-periodo'

/** Lo que se ve en el botón: corto de verdad, o el nombre recortado con "…" por CSS. */
export function etiquetaBoton(valor: string, periodos: PeriodoOpcion[]): string {
  if (valor === TODOS) return 'Todos'
  if (valor === SIN_PERIODO) return 'Sin período'
  const p = periodos.find((x) => x.id === valor)
  if (!p) return 'Período'
  return periodoCorto(p.name) ?? p.name
}

export function BotonPeriodo({
  valor,
  periodos,
  onAbrir,
}: {
  valor: string
  periodos: PeriodoOpcion[]
  onAbrir: () => void
}) {
  const p = periodos.find((x) => x.id === valor)
  const corto = etiquetaBoton(valor, periodos)
  const largo = p ? `${p.name}${p.activo ? ' · en curso' : ''}` : corto

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Período: ${largo}. Cambiar`}
      className="inline-flex min-h-btn max-w-[10rem] shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-2.5 text-body-sm font-medium text-ink-primary transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:max-w-[14rem]"
    >
      <CalendarRange className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      {/* En móvil manda lo corto; donde hay sitio se lee el nombre completo. Ambos con
          `truncate`, que sí termina en "…" — a diferencia del select. */}
      <span className="truncate sm:hidden">{corto}</span>
      <span className="hidden truncate sm:inline">{largo}</span>
    </button>
  )
}

export function DialogoPeriodo({
  valor,
  periodos,
  onElegir,
  onCerrar,
}: {
  valor: string
  periodos: PeriodoOpcion[]
  onElegir: (v: string) => void
  onCerrar: () => void
}) {
  const elegir = (v: string) => {
    onElegir(v)
    onCerrar()
  }

  return (
    <Hoja titulo="Período académico" detalle="Filtra lo que ves del aula." onCerrar={onCerrar}>
      <div className="px-2 py-3">
        {periodos.map((p) => (
          <Fila
            key={p.id}
            nombre={p.name}
            nota={p.activo ? 'En curso' : undefined}
            activo={valor === p.id}
            onClick={() => elegir(p.id)}
          />
        ))}
        <div className="my-1 border-t border-hairline" />
        {/* "Todos" existe a propósito: sin él, parte del aula queda invisible (C2). */}
        <Fila
          nombre="Todos los períodos"
          nota="Todo el año, junto"
          activo={valor === TODOS}
          onClick={() => elegir(TODOS)}
        />
        <Fila
          nombre="Sin período"
          nota="Lo que no quedó en ninguno"
          activo={valor === SIN_PERIODO}
          onClick={() => elegir(SIN_PERIODO)}
        />
      </div>
    </Hoja>
  )
}

function Fila({
  nombre,
  nota,
  activo,
  onClick,
}: {
  nombre: string
  nota?: string
  activo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activo ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
        activo ? 'bg-accent/10' : 'hover:bg-surface-2'
      }`}
      style={{ minHeight: 52 }}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body-sm ${activo ? 'font-semibold text-accent' : 'text-ink-primary'}`}>
          {nombre}
        </span>
        {nota && <span className="block truncate text-xs text-ink-muted">{nota}</span>}
      </span>
      {activo && <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />}
    </button>
  )
}
