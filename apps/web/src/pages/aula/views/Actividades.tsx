/**
 * "Actividades" — la lista completa, con búsqueda, filtros y agrupación conmutable.
 *
 * Qué corrige:
 *  - P1-3 No existía búsqueda. Con 40 actividades por período, encontrar una era scroll y
 *         memoria.
 *  - P1-9 La única organización era cronológica o por sección. Ahora se conmuta entre unidad,
 *         estado y vencimiento sin perder el sitio.
 *  - H1 (auditoría visual) Los filtros se comían la pantalla: DOS sistemas de chips paralelos,
 *         casi idénticos, con ocho colores distintos —y `violet` repetido, así que el color ya
 *         ni siquiera identificaba— ocupando ~200 px en móvil antes de ver una sola actividad.
 *         Aquí hay UNA fila: el tipo y la agrupación son selectores, los chips son neutros y
 *         el color aparece solo en el activo.
 *  - C3   Faltaban tipos en el filtro (autoevaluación). Ahora se derivan de los datos, así que
 *         ni faltan ni sobran opciones vacías.
 *  - E2   "Ver todas" no restablecía el período, así que el clic no resolvía el vacío. Ahora
 *         limpiar es una sola operación sobre todos los filtros.
 *
 * La vista no decide nada: `buildActivityList` filtra, agrupa y ordena, y está probado aparte.
 */

import { useMemo, useState } from 'react'
import { ChevronDown, Info, Search, X } from 'lucide-react'
import type { ActivityLike } from '../model/activityState'
import {
  agrupacionPorDefecto,
  availableTypes,
  buildActivityList,
  EMPTY_FILTERS,
  PERIOD_ALL,
  stateChipsFor,
  type GroupBy,
  type ListFilters,
  type Role,
} from '../model/list'
import type { ActivityFamily } from '../model/labels'
import { ActivityCard } from '../ui/ActivityCard'
import { EmptyState } from '../ui/EmptyState'
import { StateLegend } from '../ui/StateChip'

const AGRUPACIONES: { id: GroupBy; label: string }[] = [
  { id: 'unidad', label: 'Por unidad' },
  { id: 'estado', label: 'Por estado' },
  { id: 'vencimiento', label: 'Por fecha de entrega' },
]

export interface ActividadesProps {
  role: Role
  actividades: ActivityLike[]
  /** Período seleccionado en el encabezado del aula. Es el organizador primario. */
  periodo: string
  /** Restablecer el período forma parte de "quitar filtros" (defecto E2). */
  onPeriodo: (p: string) => void
  /** Filtro de estado con el que se entra (p. ej. desde "Hoy" → "por calificar"). */
  filtroEstadoInicial?: string | null
  onAbrirActividad: (id: string) => void
  onCrear?: () => void
  /** Estudiantes del grupo, para que la barra de entregas diga la verdad. */
  totalEstudiantes?: number | null
  now?: Date
}

export function Actividades({
  role,
  actividades,
  periodo,
  onPeriodo,
  filtroEstadoInicial,
  onAbrirActividad,
  onCrear,
  totalEstudiantes,
  now = new Date(),
}: ActividadesProps) {
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<ActivityFamily | 'todos'>('todos')
  const [estado, setEstado] = useState(filtroEstadoInicial ?? 'todas')
  const [agrupacion, setAgrupacion] = useState<GroupBy>(() => agrupacionPorDefecto(role))
  // Grupos que el usuario abrió o cerró a mano. Lo que no esté aquí usa su valor por defecto.
  const [plegados, setPlegados] = useState<Record<string, boolean>>({})
  const [verLeyenda, setVerLeyenda] = useState(false)

  const filtros: ListFilters = { search: busqueda, type: tipo, period: periodo, state: estado }

  const resultado = useMemo(
    () => buildActivityList({ activities: actividades, role, filters: filtros, groupBy: agrupacion, now }),
    // `filtros` se reconstruye en cada render; sus partes son las dependencias reales.
    [actividades, role, busqueda, tipo, periodo, estado, agrupacion, now],
  )

  const tipos = useMemo(() => availableTypes(actividades), [actividades])
  const chips = stateChipsFor(role)

  const limpiar = () => {
    setBusqueda('')
    setTipo('todos')
    setEstado(EMPTY_FILTERS.state)
    onPeriodo(PERIOD_ALL)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink-primary">Actividades</h1>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            {resultado.visible === resultado.total
              ? `${resultado.total} en total`
              : `${resultado.visible} de ${resultado.total}`}
          </p>
        </div>
        {onCrear && role === 'docente' && (
          <button
            type="button"
            onClick={onCrear}
            className="inline-flex min-h-btn items-center gap-1.5 rounded-lg bg-accent px-4 text-body-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Nueva actividad
          </button>
        )}
      </header>

      {/* ─── Controles: UNA fila, no dos sistemas paralelos ─────────────── */}
      <div className="mt-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <label className="sr-only" htmlFor="buscar-actividad">
              Buscar actividad
            </label>
            <input
              id="buscar-actividad"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o unidad…"
              className="min-h-btn w-full rounded-lg border border-hairline bg-surface-1 pr-8 pl-9 text-body-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Borrar la búsqueda"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <label className="sr-only" htmlFor="filtro-tipo">
            Tipo de actividad
          </label>
          <select
            id="filtro-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ActivityFamily | 'todos')}
            className="min-h-btn rounded-lg border border-hairline bg-surface-1 px-2.5 text-body-sm text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <option value="todos">Todos los tipos</option>
            {/* Se derivan de los datos: ni faltan tipos ni sobran opciones vacías (C3). */}
            {tipos.map((t) => (
              <option key={t.family} value={t.family}>
                {t.label} ({t.count})
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="agrupar">
            Agrupar por
          </label>
          <select
            id="agrupar"
            value={agrupacion}
            onChange={(e) => setAgrupacion(e.target.value as GroupBy)}
            className="min-h-btn rounded-lg border border-hairline bg-surface-1 px-2.5 text-body-sm text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {AGRUPACIONES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chips neutros: el color solo en el activo. Envuelven, así que nada queda escondido
            detrás de un scroll sin affordance (F2). */}
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => {
            const n = resultado.chipCounts[c.id] ?? 0
            const activo = estado === c.id
            // Un chip en cero que no está activo no aporta: solo ocupa sitio.
            if (n === 0 && !activo && c.id !== 'todas') return null
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setEstado(c.id)}
                aria-pressed={activo}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  activo
                    ? 'border-accent bg-accent text-white'
                    : 'border-hairline bg-surface-1 text-ink-secondary hover:border-accent/40 hover:text-ink-primary'
                }`}
              >
                {c.label}
                <span className={activo ? 'text-white/80' : 'text-ink-muted'}>{n}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setVerLeyenda((v) => !v)}
            aria-expanded={verLeyenda}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-body-sm text-ink-muted hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            ¿Qué significan?
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${verLeyenda ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {verLeyenda && (
          <div className="rounded-card border border-hairline bg-surface-1 p-4">
            <StateLegend role={role} />
          </div>
        )}
      </div>

      {/* ─── Lista ──────────────────────────────────────────────────────── */}
      {resultado.groups.length === 0 ? (
        <div className="mt-6">
          {resultado.filtered ? (
            <EmptyState
              scene="sin-resultados"
              title="Nada coincide con lo que buscas"
              detail="Prueba con otras palabras o quita los filtros para ver toda el aula."
              action={{ label: 'Quitar filtros', onClick: limpiar }}
            />
          ) : role === 'docente' ? (
            <EmptyState
              scene="sin-actividades"
              title="Todavía no has creado actividades"
              detail="Crea la primera para que tus estudiantes tengan qué entregar."
              action={onCrear ? { label: 'Crear actividad', onClick: onCrear } : undefined}
            />
          ) : (
            <EmptyState
              scene="sin-actividades"
              title="Aún no hay actividades"
              detail="Cuando tu profe publique la primera, la verás aquí."
            />
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {resultado.groups.map((g) => {
            // Lo terminado nace plegado: con catorce actividades, el estudiante tenía que bajar
            // por encima de todo lo que ya entregó para llegar a lo que le falta.
            const plegado = plegados[g.key] ?? g.plegadoPorDefecto ?? false
            return (
              <section key={g.key} aria-labelledby={`grupo-${g.key}`}>
                <button
                  type="button"
                  onClick={() => setPlegados((p) => ({ ...p, [g.key]: !plegado }))}
                  aria-expanded={!plegado}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg py-1 text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none ${
                      plegado ? '-rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span id={`grupo-${g.key}`} className="flex items-center gap-2">
                      <span className="text-body-base font-semibold text-ink-primary">{g.label}</span>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-secondary">
                        {g.items.length}
                      </span>
                    </span>
                    {g.hint && !plegado && (
                      <span className="mt-0.5 block text-body-sm text-ink-muted">{g.hint}</span>
                    )}
                  </span>
                </button>

                {!plegado && (
                  <div className="space-y-2">
                    {g.items.map((d) => (
                      <ActivityCard
                        key={d.activity.id}
                        item={d}
                        role={role}
                        onOpen={onAbrirActividad}
                        // Repetir la unidad en cada tarjeta cuando la lista YA está agrupada por
                        // unidad es ruido.
                        showUnit={agrupacion !== 'unidad'}
                        totalEstudiantes={totalEstudiantes}
                        now={now}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
