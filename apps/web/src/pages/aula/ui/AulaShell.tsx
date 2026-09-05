/**
 * El armazón del aula: riel de navegación, encabezado de contexto y barra inferior en móvil.
 *
 * Qué corrige de la auditoría:
 *  - P1-7  No había orientación persistente: ni migas de pan, ni período visible para el
 *          docente, ni forma de saber dónde estás. Ahora el contexto va fijo arriba.
 *  - F1    La barra de pestañas era `sticky top-0`, pero el header móvil de `Layout` es
 *          `fixed` de 56 px: al hacer scroll la barra se metía DEBAJO del header y desaparecía.
 *          Aquí el encabezado es `top-14 lg:top-0`, que es exactamente el alto de ese header.
 *  - F4    Ocho pestañas con scroll horizontal y la barra oculta: en móvil no había forma de
 *          saber que había más destinos a la derecha. Ahora hay barra inferior fija.
 *  - C2    El período no tenía opción "Todos", así que parte del aula era invisible.
 *
 * Decisión D2: riel colapsable en escritorio (el menú global ya ocupa 256 px) y barra inferior
 * al alcance del pulgar en móvil, porque los estudiantes usan celular y una hamburguesa
 * esconde la navegación justo a quien más la necesita.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, Ellipsis, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { SubjectMark, subjectIdentity } from '../visual/SubjectMark'
import { hexARgb, resolverAcento } from '../model/tema'
import { DialogoTema, IconoTema } from './SelectorTema'
import { BotonPeriodo, DialogoPeriodo } from './SelectorPeriodo'
import { ProveedorAcento } from './AulaTema'
import { destinosDe, vistaLabel, type Vista } from './destinations'
import { useRail } from './useRail'
import { useTemaEstudiante } from './useTemaEstudiante'

export type { PeriodoOpcion } from './SelectorPeriodo'
import type { PeriodoOpcion } from './SelectorPeriodo'

export interface AulaShellProps {
  aula: {
    id: string
    titulo: string
    /** "Matemáticas" — de aquí sale la marca visual. */
    asignatura?: string | null
    /** "8-A" */
    grupo?: string | null
    /** El color que el docente eligió para esta aula. Manda sobre el de la asignatura. */
    color?: string | null
  }
  role: 'docente' | 'estudiante'
  vista: Vista
  onNavegar: (v: Vista) => void
  onSalir: () => void
  periodos: PeriodoOpcion[]
  /** Id del período, `todos`, o `sin-periodo`. */
  periodo: string
  onPeriodo: (p: string) => void
  /** Conteos opcionales por destino, p. ej. { actividades: 6 }. */
  badges?: Partial<Record<Vista, number>>
  /**
   * Aviso que debe verse en TODAS las vistas, no solo en la que esté abierta. Hoy lo usa la
   * sesión de quiz en vivo: el aviso actual vive dentro de la pestaña Actividades, así que un
   * estudiante parado en Inicio no se entera de que la clase ya empezó a responder.
   */
  aviso?: ReactNode
  /**
   * Salir del módulo y volver al resto de la aplicación. Hace falta porque dentro del aula el
   * menú global se esconde: sin esta puerta, el docente quedaría encerrado.
   */
  onSalirDelModulo?: () => void
  children: ReactNode
}

export function AulaShell({
  aula,
  role,
  vista,
  onNavegar,
  onSalir,
  periodos,
  periodo,
  onPeriodo,
  badges = {},
  aviso,
  onSalirDelModulo,
  children,
}: AulaShellProps) {
  const { expandido, alternar } = useRail()
  const [masAbierto, setMasAbierto] = useState(false)
  const [temaAbierto, setTemaAbierto] = useState(false)
  const [periodoAbierto, setPeriodoAbierto] = useState(false)
  // Solo el estudiante repinta su vista: el color del aula es la identidad que el docente eligió
  // para su curso, y él sí debe verla como la dejó.
  const esEstudiante = role === 'estudiante'
  const { tema, elegir } = useTemaEstudiante(esEstudiante)

  /*
   * La barra inferior de móvil ocupa la esquina donde vive el botón flotante de Valeria, que
   * se monta justo sobre el destino "Más". Este atributo permite levantarlo desde `index.css`
   * sin tocar `ValeriaAssistant.tsx`, y desaparece al salir del aula.
   */
  useEffect(() => {
    document.body.setAttribute('data-aula-nav-inferior', '')
    /*
     * Modo inmersivo: mientras estás dentro de un aula, el menú global del docente se esconde
     * en escritorio. Dos barras laterales seguidas gastaban ~480 px de cromo y ninguna de las
     * dos mandaba. Las reglas viven en index.css; aquí solo se enciende y se apaga.
     */
    document.body.setAttribute('data-aula-inmersiva', '')
    return () => {
      document.body.removeAttribute('data-aula-nav-inferior')
      document.body.removeAttribute('data-aula-inmersiva')
    }
  }, [])
  const destinos = destinosDe(role)
  const principales = destinos.filter((d) => d.principal)
  const secundarios = destinos.filter((d) => !d.principal)
  const identidad = subjectIdentity(aula.asignatura)
  const colorAula = aula.color?.trim() || identidad.hue.ink
  // Lo que de verdad se pinta: el tema del estudiante si eligió uno, si no el del aula.
  const acento = resolverAcento(tema, colorAula)
  const hueDelAula = { ink: acento, wash: `${acento}1A`, deep: acento }

  const irA = (v: Vista) => {
    onNavegar(v)
    setMasAbierto(false)
  }

  return (
    // El color de la asignatura tiñe el acento DENTRO del aula: la identidad se siente sin
    // decorar nada más. Se hace redefiniendo el token en este contenedor, no con CSS global,
    // para que no se filtre al resto de la aplicación.
    <div
      className="min-h-screen bg-accent/[0.045]"
      style={{ ['--skill-accent' as string]: hexARgb(acento) }}
    >
      <div className="mx-auto flex max-w-workspace">
        {/* ─── Riel (escritorio) ─────────────────────────────────────────── */}
        <aside
          className="sticky top-0 hidden h-screen shrink-0 border-r border-accent/15 bg-accent/[0.05] transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col"
          style={{ width: expandido ? 232 : 68 }}
          aria-label="Secciones del aula"
        >
          {/* Identidad del aula */}
          <div className={`flex items-center gap-2.5 border-b border-accent/15 px-3 py-3.5 ${expandido ? '' : 'justify-center'}`}>
            <SubjectMark subject={aula.asignatura} size={36} hue={hueDelAula} />
            {expandido && (
              <div className="min-w-0">
                <p className="truncate text-body-sm font-semibold text-ink-primary">{aula.asignatura || aula.titulo}</p>
                {aula.grupo && <p className="truncate text-xs text-ink-muted">{aula.grupo}</p>}
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {destinos.map((d) => {
              const Icon = d.icon
              const activo = vista === d.id
              const badge = badges[d.id]
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => irA(d.id)}
                  aria-current={activo ? 'page' : undefined}
                  title={expandido ? d.hint : `${d.label} — ${d.hint}`}
                  className={`flex min-h-btn w-full items-center gap-3 rounded-lg px-3 text-body-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                    activo ? 'bg-accent/10 text-accent' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
                  } ${expandido ? '' : 'justify-center px-0'}`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  {expandido && <span className="flex-1 text-left">{d.label}</span>}
                  {expandido && badge != null && badge > 0 && (
                    <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-xs font-semibold text-warning-700">
                      {badge}
                    </span>
                  )}
                  {!expandido && badge != null && badge > 0 && (
                    <span className="sr-only">{badge} pendientes</span>
                  )}
                  {!expandido && <span className="sr-only">{d.label}</span>}
                </button>
              )
            })}
          </nav>

          <div className="space-y-0.5 border-t border-accent/15 p-2">
            {esEstudiante && (
              <button
                type="button"
                onClick={() => setTemaAbierto(true)}
                title="Elige el color con el que ves el aula"
                className={`flex min-h-btn w-full items-center gap-3 rounded-lg px-3 text-body-sm font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  expandido ? '' : 'justify-center px-0'
                }`}
              >
                <IconoTema className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {expandido ? <span>Elige tu color</span> : <span className="sr-only">Elige tu color</span>}
              </button>
            )}
            {onSalirDelModulo && (
              <button
                type="button"
                onClick={onSalirDelModulo}
                title="Salir del aula y volver al menú de Edusyn"
                className={`flex min-h-btn w-full items-center gap-3 rounded-lg px-3 text-body-sm font-medium text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  expandido ? '' : 'justify-center px-0'
                }`}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {expandido ? <span>Salir del aula</span> : <span className="sr-only">Salir del aula</span>}
              </button>
            )}
            <button
              type="button"
              onClick={alternar}
              aria-expanded={expandido}
              title={expandido ? 'Contraer el menú' : 'Expandir el menú'}
              className={`flex min-h-btn w-full items-center gap-3 rounded-lg px-3 text-body-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                expandido ? '' : 'justify-center px-0'
              }`}
            >
              {expandido ? (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span>Contraer</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="sr-only">Expandir el menú</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ─── Contenido ─────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/*
            `top-14 lg:top-0` es el arreglo del hallazgo F1: en móvil, `Layout` tiene un header
            fijo de 56 px, así que un `top-0` metería esta barra debajo de él.
          */}
          <header className="sticky top-14 z-20 border-b border-accent/15 bg-accent/[0.07] backdrop-blur lg:top-0">
            {/* Una sola fila, también en móvil. Envolviendo, el selector de período se llevaba
                una línea entera del encabezado fijo y le comía altura útil a la pantalla. */}
            <div className="flex flex-nowrap items-center gap-x-1.5 px-3 py-2 sm:gap-x-2 sm:px-4">
              <button
                type="button"
                onClick={onSalir}
                aria-label="Volver a mis aulas"
                className="inline-flex min-h-btn shrink-0 items-center gap-1 rounded-lg px-1.5 text-body-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:px-2"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Mis aulas</span>
              </button>

              {/* Migas de pan: dónde estoy, sin adivinar */}
              <nav aria-label="Ubicación" className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="shrink-0 lg:hidden">
                  <SubjectMark subject={aula.asignatura} size={24} hue={hueDelAula} />
                </span>
                <p className="min-w-0 truncate text-body-sm">
                  <span className="font-medium text-ink-primary">
                    {aula.asignatura || aula.titulo}
                    {aula.grupo ? ` ${aula.grupo}` : ''}
                  </span>
                  {/* En móvil la vista actual ya la dice la barra inferior, resaltada. Repetirla
                      aquí solo servía para dejar el nombre del aula en "Matem…". */}
                  <span className="mx-1.5 hidden text-ink-muted sm:inline" aria-hidden="true">
                    ›
                  </span>
                  <span className="hidden text-ink-secondary sm:inline">{vistaLabel(vista)}</span>
                </p>
              </nav>

              {periodos.length > 0 && (
                <BotonPeriodo valor={periodo} periodos={periodos} onAbrir={() => setPeriodoAbierto(true)} />
              )}
            </div>
          </header>

          {/* `pb-24` deja aire para la barra inferior de móvil */}
          {/* `pb-32` deja aire de sobra: con `pb-24` la última tarjeta quedaba pegada a la
              barra inferior y el botón de Valeria le caía encima. */}
          <main className="px-3 pt-4 pb-32 sm:px-4 sm:pt-5 lg:pb-10">
            {aviso && <div className="mx-auto mb-4 max-w-3xl">{aviso}</div>}
            {/* Todo lo de dentro pinta con el MISMO acento que el riel y el encabezado. */}
            <ProveedorAcento acento={acento}>{children}</ProveedorAcento>
          </main>
        </div>
      </div>

      {/* ─── Barra inferior (móvil) ────────────────────────────────────────── */}
      <nav
        aria-label="Secciones del aula"
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-accent/15 bg-surface-1/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex">
          {principales.map((d) => {
            const Icon = d.icon
            const activo = vista === d.id
            const badge = badges[d.id]
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => irA(d.id)}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                  activo ? 'text-accent' : 'text-ink-muted'
                }`}
                style={{ minHeight: 56 }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {d.label}
                {badge != null && badge > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-20px)] min-w-4 rounded-full bg-warning-600 px-1 text-[10px] leading-4 font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            aria-expanded={masAbierto}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              secundarios.some((d) => d.id === vista) ? 'text-accent' : 'text-ink-muted'
            }`}
            style={{ minHeight: 56 }}
          >
            <Ellipsis className="h-5 w-5" aria-hidden="true" />
            Más
          </button>
        </div>
      </nav>

      {/* Hoja de destinos secundarios */}
      {masAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setMasAbierto(false)}
            className="absolute inset-0 bg-ink-primary/40"
          />
          <div className="absolute right-0 bottom-0 left-0 rounded-t-modal border-t border-hairline bg-surface-1 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-body-base font-semibold text-ink-primary">Más secciones</p>
              <button
                type="button"
                onClick={() => setMasAbierto(false)}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-ink-muted hover:bg-surface-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-2 pb-3">
              {secundarios.map((d) => {
                const Icon = d.icon
                const activo = vista === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => irA(d.id)}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      activo ? 'bg-accent/10 text-accent' : 'text-ink-primary hover:bg-surface-2'
                    }`}
                    style={{ minHeight: 56 }}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-medium">{d.label}</span>
                      <span className="block text-xs text-ink-muted">{d.hint}</span>
                    </span>
                  </button>
                )
              })}

              {esEstudiante && (
                <button
                  type="button"
                  onClick={() => {
                    setMasAbierto(false)
                    setTemaAbierto(true)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-ink-primary transition-colors hover:bg-surface-2"
                  style={{ minHeight: 56 }}
                >
                  <IconoTema className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-medium">Elige tu color</span>
                    <span className="block text-xs text-ink-muted">Cambia cómo ves tú el aula</span>
                  </span>
                </button>
              )}

              {onSalirDelModulo && (
                <button
                  type="button"
                  onClick={() => {
                    setMasAbierto(false)
                    onSalirDelModulo()
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-lg border-t border-hairline px-3 py-3 text-left text-ink-secondary transition-colors hover:bg-surface-2"
                  style={{ minHeight: 56 }}
                >
                  <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-medium">Salir del aula</span>
                    <span className="block text-xs text-ink-muted">Volver al menú de Edusyn</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {periodoAbierto && (
        <DialogoPeriodo
          valor={periodo}
          periodos={periodos}
          onElegir={onPeriodo}
          onCerrar={() => setPeriodoAbierto(false)}
        />
      )}

      {temaAbierto && (
        <DialogoTema
          elegido={tema}
          colorAula={colorAula}
          onElegir={elegir}
          onCerrar={() => setTemaAbierto(false)}
        />
      )}
    </div>
  )
}
