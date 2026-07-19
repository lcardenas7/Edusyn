import { useEffect, useState } from 'react'
import { Loader2, Plus, X, Lock } from 'lucide-react'
import { abpApi, tallerApi } from '../lib/api'
import TallerBoard from './TallerBoard'
import TallerTree from './TallerTree'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Biblioteca de Instrumentos (Fase 5 del plan OS-first).
// El docente arma cada Estación eligiendo instrumentos del catálogo (estilo
// "bloque de Notion", agrupado por tipo de pensamiento) y marcándolos
// obligatorio/opcional. La asignación vive en phaseConfig.instruments[phase]
// (sin migración). Cada equipo resuelve SU instancia del instrumento en el
// núcleo /taller con stationId = "phase:N".
// ═══════════════════════════════════════════════════════════════════════════

type CatalogItem = { key: string; motor: string; dynamic: string; name: string; emoji: string; intent: string; description: string; available: boolean }
type Catalog = { intents: { id: string; name: string }[]; instruments: CatalogItem[] }

let catalogCache: Catalog | null = null
function useCatalog() {
  const [cat, setCat] = useState<Catalog | null>(catalogCache)
  useEffect(() => {
    if (!catalogCache) tallerApi.catalog().then(({ data }) => { catalogCache = data; setCat(data) }).catch(() => {})
  }, [])
  return cat
}

/** Renderiza la instancia de un instrumento para un equipo en una estación. */
export function InstrumentRenderer({ instrumentKey, teamId, phase }: { instrumentKey: string; teamId: string; phase: number }) {
  const [motor, dynamic] = instrumentKey.split(':')
  const stationId = `phase:${phase}`
  if (motor === 'BOARD') return <TallerBoard teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'GRAPH') return <TallerTree teamId={teamId} dynamic={dynamic} stationId={stationId} />
  return <div className="taller-card p-6 text-sm taller-muted">Este instrumento aún no está disponible.</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTUDIANTE — Espacio de trabajo de la estación: los instrumentos que el
// docente asignó a esta fase, abribles uno a la vez.
// ─────────────────────────────────────────────────────────────────────────────
export function StationInstruments({ team, phase }: { team: any; phase: number }) {
  const cat = useCatalog()
  const [open, setOpen] = useState<string | null>(null)
  const assigned: { key: string; required?: boolean }[] = team?.config?.instruments?.[phase] || []
  if (assigned.length === 0) return null

  const defOf = (key: string) => cat?.instruments.find(i => i.key === key)

  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--t-line)' }}>
      <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-2">🧰 Espacio de trabajo de la estación</div>
      <div className="flex flex-wrap gap-2">
        {assigned.map(a => {
          const def = defOf(a.key)
          const active = open === a.key
          return (
            <button key={a.key} onClick={() => setOpen(active ? null : a.key)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition"
              style={active
                ? { background: 'color-mix(in srgb, var(--t-marigold) 16%, var(--t-raised))', color: 'var(--t-marigold)', border: '1px solid color-mix(in srgb, var(--t-marigold) 40%, transparent)', boxShadow: 'var(--t-shadow-sm)' }
                : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
              <span className="text-base">{def?.emoji ?? '🧩'}</span>
              {def?.name ?? a.key}
              {a.required && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--t-marigold) 18%, transparent)', color: '#8a5a10' }}>obligatorio</span>}
            </button>
          )
        })}
      </div>
      {open && (
        <div className="mt-3">
          <InstrumentRenderer instrumentKey={open} teamId={team.id} phase={phase} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCENTE — Configurador: por estación, añadir instrumentos desde la Biblioteca
// (agrupada por intención), marcar obligatorio/opcional y quitar.
// ─────────────────────────────────────────────────────────────────────────────
export function TeacherInstrumentsConfig({ project, phases, onSaved }: {
  project: any
  phases: { n: number; name: string; icon: string }[]
  onSaved: () => void
}) {
  const cat = useCatalog()
  const [phase, setPhase] = useState(1)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const assignedByPhase: Record<number, { key: string; required?: boolean }[]> = project?.phaseConfig?.instruments || {}
  const assigned = assignedByPhase[phase] || []

  const defOf = (key: string) => cat?.instruments.find(i => i.key === key)
  const save = async (items: { key: string; required?: boolean }[]) => {
    setSaving(true)
    try { await abpApi.setPhaseInstruments(project.id, phase, items); onSaved() }
    catch { alert('No se pudo guardar la configuración') }
    finally { setSaving(false) }
  }
  const addInstrument = (key: string) => { setLibraryOpen(false); save([...assigned, { key, required: false }]) }
  const toggleRequired = (key: string) => save(assigned.map(a => a.key === key ? { ...a, required: !a.required } : a))
  const removeInstrument = (key: string) => save(assigned.filter(a => a.key !== key))

  return (
    <div className="taller-card p-5">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Biblioteca de Instrumentos</div>
          <h3 className="font-black taller-ink">🧰 Instrumentos por estación</h3>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto" style={{ color: 'var(--t-marigold)' }} />}
      </div>
      <p className="text-xs taller-muted mb-3">Elige qué herramientas de pensamiento tendrá cada estación. Los equipos las encontrarán en su espacio de trabajo.</p>

      {/* selector de estación */}
      <div className="flex rounded-xl p-1 w-fit flex-wrap gap-0.5 mb-4" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
        {phases.map(p => (
          <button key={p.n} onClick={() => setPhase(p.n)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
            style={phase === p.n ? { background: 'var(--t-raised)', color: 'var(--t-marigold)', boxShadow: 'var(--t-shadow-sm)' } : { color: 'var(--t-muted)' }}>
            {p.icon} {p.n}. {p.name}
            {(assignedByPhase[p.n]?.length ?? 0) > 0 && <span className="ml-1 font-mono">({assignedByPhase[p.n].length})</span>}
          </button>
        ))}
      </div>

      {/* instrumentos asignados a la estación */}
      {assigned.length === 0 ? (
        <p className="text-sm taller-muted mb-3">Esta estación aún no tiene instrumentos. Añade el primero desde la biblioteca.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {assigned.map(a => {
            const def = defOf(a.key)
            return (
              <div key={a.key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)' }}>
                <span className="text-xl">{def?.emoji ?? '🧩'}</span>
                <div className="min-w-0">
                  <div className="font-bold taller-ink text-sm">{def?.name ?? a.key}</div>
                  <div className="text-[11px] taller-muted truncate">{def?.description}</div>
                </div>
                <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold taller-soft cursor-pointer shrink-0">
                  <input type="checkbox" checked={!!a.required} onChange={() => toggleRequired(a.key)} className="accent-[#C8811A]" />
                  Obligatorio
                </label>
                <button onClick={() => removeInstrument(a.key)} className="taller-muted hover:opacity-70 shrink-0" title="Quitar de la estación">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => setLibraryOpen(true)} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1">
        <Plus className="w-4 h-4" /> Añadir instrumento
      </button>

      {/* LA BIBLIOTECA — catálogo por tipo de pensamiento */}
      {libraryOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setLibraryOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="taller-card relative max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLibraryOpen(false)} className="absolute top-4 right-4 taller-muted hover:opacity-70"><X className="w-5 h-5" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Biblioteca de Instrumentos</div>
            <h3 className="text-lg font-black taller-ink mb-1">¿Qué tipo de pensamiento quieres provocar?</h3>
            <p className="text-xs taller-muted mb-4">Estación {phase} · {phases.find(p => p.n === phase)?.name}</p>
            {!cat ? <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /> : cat.intents.map(intent => {
              const items = cat.instruments.filter(i => i.intent === intent.id)
              if (items.length === 0) return null
              return (
                <div key={intent.id} className="mb-4">
                  <div className="text-xs font-black taller-soft mb-2">{intent.name}</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {items.map(item => {
                      const already = assigned.some(a => a.key === item.key)
                      const disabled = !item.available || already
                      return (
                        <button key={item.key} disabled={disabled} onClick={() => addInstrument(item.key)}
                          className="text-left p-3 rounded-xl transition disabled:cursor-not-allowed"
                          style={{
                            background: 'var(--t-surface)', border: '1px solid var(--t-line)',
                            opacity: disabled && !already ? 0.5 : 1,
                            ...(already ? { outline: '2px solid color-mix(in srgb, var(--t-marigold) 45%, transparent)', outlineOffset: '-1px' } : {}),
                          }}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{item.emoji}</span>
                            <span className="font-bold taller-ink text-sm">{item.name}</span>
                            {already && <span className="ml-auto text-[9px] font-mono uppercase taller-mari">añadido</span>}
                            {!item.available && <span className="ml-auto text-[9px] font-mono uppercase taller-muted flex items-center gap-0.5"><Lock className="w-3 h-3" /> pronto</span>}
                          </div>
                          <p className="text-[11px] taller-muted mt-1 leading-snug">{item.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
