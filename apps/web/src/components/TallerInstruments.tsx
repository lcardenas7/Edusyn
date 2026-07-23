import { useEffect, useState } from 'react'
import { BookOpen, ChevronDown, Loader2, Plus, X, Lock } from 'lucide-react'
import { abpApi, tallerApi } from '../lib/api'
import TallerBoard from './TallerBoard'
import TallerTree from './TallerTree'
import TallerTimeline from './TallerTimeline'
import TallerCards from './TallerCards'
import TallerGallery from './TallerGallery'
import TallerPoll from './TallerPoll'
import TallerMatrix from './TallerMatrix'
import TallerKanban from './TallerKanban'
import TallerMap from './TallerMap'

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
export function InstrumentRenderer({ instrumentKey, teamId, phase, members }: { instrumentKey: string; teamId: string; phase: number; members?: any[] }) {
  const [motor, dynamic] = instrumentKey.split(':')
  const stationId = `phase:${phase}`
  if (motor === 'BOARD') return <TallerBoard teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'GRAPH') return dynamic === 'MAPA_ACTORES'
    ? <TallerMap teamId={teamId} dynamic={dynamic} stationId={stationId} />
    : <TallerTree teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'TIMELINE') return <TallerTimeline teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'CARDS') return <TallerCards teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'MEDIA') return <TallerGallery teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'POLL') return <TallerPoll teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'MATRIX') return <TallerMatrix teamId={teamId} dynamic={dynamic} stationId={stationId} />
  if (motor === 'FLOW') return <TallerKanban teamId={teamId} dynamic={dynamic} stationId={stationId} members={members} />
  return <div className="taller-card p-6 text-sm taller-muted">Este instrumento aún no está disponible.</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTUDIANTE — Instrucciones de la estación ("¿qué haremos aquí y cómo?").
// Colapsable; texto del docente (phaseConfig.stationInstructions[phase]) o el
// default pedagógico de la fase. El estudiante nunca se pregunta "¿y ahora qué?".
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_INSTRUCTIONS: Record<number, string> = {
  1: 'Lean juntos el reto del proyecto y conversen: ¿qué está pasando y a quiénes afecta? Completen las tarjetas del reto entre todos y usen los instrumentos de esta estación para explorar el problema. Cuando el equipo sienta que COMPRENDE el problema, presenten la estación al docente.',
  2: 'Es momento de abrir la mente: propongan TODAS las ideas que se les ocurran para resolver el problema, sin juzgarlas todavía. Usen los instrumentos para registrarlas y voten las que más les convenzan. Cantidad primero, calidad después.',
  3: 'Elijan su mejor idea y conviértanla en un objetivo concreto: ¿qué van a lograr, cómo lo van a medir y para cuándo? Revisen los criterios SMART antes de presentar.',
  4: 'Planifiquen el trabajo: dividan la solución en tareas, asignen un responsable a cada una y muevan las tarjetas a medida que avanzan. Nadie se queda sin tarea.',
  5: 'Construyan su solución y documenten TODO el proceso: fotos, videos, enlaces. Las evidencias cuentan la historia de lo que hicieron.',
  6: 'Preparen la presentación de su solución y evalúen con honestidad el trabajo de los otros equipos. Cierren la expedición con orgullo.',
}

export function StationGuide({ team, phase }: { team: any; phase: number }) {
  const [open, setOpen] = useState(true)
  const custom = team?.config?.stationInstructions?.[phase]
  const text = (custom && String(custom).trim()) || DEFAULT_INSTRUCTIONS[phase] || ''
  if (!text) return null
  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--t-marigold) 7%, var(--t-surface))', border: '1px solid color-mix(in srgb, var(--t-marigold) 25%, var(--t-line))' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left">
        <BookOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--t-marigold)' }} />
        <span className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: '#8a5a10' }}>Instrucciones · ¿Qué haremos en esta estación?</span>
        <ChevronDown className="w-4 h-4 ml-auto transition-transform" style={{ color: 'var(--t-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <p className="px-4 pb-3.5 text-sm taller-soft leading-relaxed whitespace-pre-line" style={{ marginTop: '-2px' }}>
          {text}
          {custom && <span className="block mt-1.5 text-[10px] font-mono taller-muted">— indicaciones de tu docente</span>}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTUDIANTE — Agenda del Cuartel General ("Hoy deberán…"). Reúne en un solo
// vistazo lo que el equipo DEBE hacer en la estación actual: misiones e
// instrumentos obligatorios como checklist (hechos, no promesas), el mensaje del
// docente y una pista de Valeria basada SOLO en hechos de uso de la plataforma
// (Biblia §18.2: para el estudiante Valeria guía el USO, nunca el contenido).
// El principio: el estudiante nunca se pregunta "¿y ahora qué?".
// ─────────────────────────────────────────────────────────────────────────────
export function StationAgenda({ team, phase, stationName, purpose, feedback, awaiting, onEnter }: {
  team: any; phase: number; stationName: string; purpose?: string; feedback?: string; awaiting?: boolean; onEnter: () => void
}) {
  const cat = useCatalog()
  const defOf = (key: string) => cat?.instruments.find(i => i.key === key)
  const missions = (team?.currentMissions || []).filter((m: any) => m.required)
  const reqInstr: { key: string; used: boolean }[] = team?.requiredInstruments || []

  // Mis misiones personales (dirigidas a mí), completas o no — van aparte y destacadas.
  const mias = (team?.currentMissions || []).filter((m: any) => m.assigneeType === 'INDIVIDUAL' && m.assigneeEnrollmentId === team?.myEnrollmentId)

  type Row = { id: string; done: boolean; icon: string; label: string }
  const rows: Row[] = [
    ...missions.map((m: any): Row => ({
      id: `m:${m.id}`, done: !!m.complete,
      icon: m.assigneeType === 'INDIVIDUAL' ? '👤' : '🎯',
      label: m.assigneeType === 'INDIVIDUAL' && m.assigneeEnrollmentId !== team?.myEnrollmentId ? `${m.title} — ${m.assigneeName}` : m.title,
    })),
    ...reqInstr.map((s): Row => ({ id: `i:${s.key}`, done: s.used, icon: defOf(s.key)?.emoji ?? '🧰', label: `Trabajar en: ${defOf(s.key)?.name ?? s.key}` })),
  ]
  const total = rows.length
  const done = rows.filter(r => r.done).length
  const firstPending = rows.find(r => !r.done)

  // Pista de Valeria — solo hechos de uso, nunca juicio académico.
  const miaPendiente = mias.find((m: any) => !m.complete)
  let valeria: string
  if (awaiting) valeria = 'Presentaron esta estación. Ahora esperen a que el docente la revise.'
  else if (miaPendiente) valeria = `El docente te encargó algo a ti: “${miaPendiente.title}”. ${miaPendiente.deliverableKind ? 'Ábrela en el Taller y entrégala.' : 'Ábrela en el Taller.'}`
  else if (total === 0) valeria = 'Entren al Taller y empiecen a trabajar en esta estación.'
  else if (done === total) valeria = '¡Ya completaron todo lo obligatorio! Pueden presentar la estación cuando el equipo se sienta listo.'
  else if (firstPending?.id.startsWith('i:')) valeria = `Todavía no han trabajado en “${firstPending.label.replace('Trabajar en: ', '')}”. Ábranlo en el Espacio de trabajo.`
  else valeria = `Lo siguiente pendiente: ${firstPending?.label}.`

  return (
    <div className="taller-card taller-mission p-5">
      <div className="text-[11px] font-mono uppercase tracking-widest taller-mari mb-1">Misión actual · Estación {phase} de 6</div>
      <h2 className="text-2xl font-black taller-ink tracking-tight">Están en <span className="taller-mari">{stationName}</span></h2>
      {purpose && <p className="text-sm taller-soft mt-1">{purpose}</p>}

      {/* NOVEDAD: el docente revisó y devolvió la estación con indicaciones */}
      {feedback && !awaiting && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, #CB4E42 10%, transparent)', border: '1px solid color-mix(in srgb, #CB4E42 35%, transparent)' }}>
          <div className="text-[11px] font-mono uppercase tracking-widest font-bold mb-1" style={{ color: '#CB4E42' }}>🔔 El docente revisó esta estación</div>
          <p className="text-sm" style={{ color: '#7a2b22' }}>{feedback}</p>
          <p className="text-xs mt-1.5" style={{ color: '#9a4a3e' }}>Cumplan lo que falta abajo y vuelvan a presentarla.</p>
        </div>
      )}

      {/* Hoy deberán: checklist */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-widest taller-muted">Hoy deberán</span>
            <span className="text-[11px] font-mono font-bold taller-mari">{done}/{total}</span>
          </div>
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] shrink-0"
                  style={r.done
                    ? { background: 'color-mix(in srgb, #7BA05B 22%, transparent)', color: '#4a6b34', border: '1px solid color-mix(in srgb, #7BA05B 45%, transparent)' }
                    : { background: 'var(--t-surface)', color: 'var(--t-muted)', border: '1px solid var(--t-line)' }}>
                  {r.done ? '✓' : ''}
                </span>
                <span className="text-base shrink-0">{r.icon}</span>
                <span className="text-sm font-semibold" style={{ color: r.done ? 'var(--t-muted)' : 'var(--t-ink)', textDecoration: r.done ? 'line-through' : 'none' }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⭐ MI MISIÓN PERSONAL — lo que el docente me encargó a mí */}
      {mias.length > 0 && (
        <div className="mt-3 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, #6366F1 8%, transparent)', border: '1px solid color-mix(in srgb, #6366F1 30%, transparent)' }}>
          <div className="text-[11px] font-mono uppercase tracking-widest font-bold mb-1.5" style={{ color: '#4338CA' }}>
            ⭐ {mias.length === 1 ? 'Tu misión personal' : 'Tus misiones personales'}
          </div>
          {mias.map((m: any) => (
            <div key={m.id} className="flex items-start gap-2 py-0.5">
              <span className="text-sm shrink-0">{m.complete ? '✅' : '○'}</span>
              <div className="min-w-0">
                <span className="text-sm font-semibold" style={{ color: m.complete ? 'var(--t-muted)' : 'var(--t-ink)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                <span className="text-xs taller-muted ml-1.5">
                  {m.complete ? 'entregada' : m.deliverableKind ? 'pendiente de entrega' : 'pendiente'}
                  {m.dueAt && !m.complete ? ` · para el ${new Date(m.dueAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pista de Valeria (uso de la plataforma) */}
      <div className="mt-3 flex items-start gap-2 text-sm taller-soft">
        <span className="text-base shrink-0">✨</span>
        <span><b className="taller-mari">Valeria:</b> {valeria}</span>
      </div>

      <button onClick={onEnter} className="taller-cta mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[15px]">
        {awaiting ? 'Ver el Taller →' : done === total && total > 0 ? 'Ir a presentar →' : 'Entrar al Taller →'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTUDIANTE — Paso guiado: número + título + pista, con ✓ cuando ya se cumplió.
// Da el ORDEN de trabajo de la estación (herramientas → misiones → presentar) para
// que el equipo nunca se pregunte "¿por dónde empiezo?".
// ─────────────────────────────────────────────────────────────────────────────
export function StationStep({ n, title, hint, done }: { n: number; title: string; hint: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 mt-5 mb-2.5">
      <span className="w-7 h-7 rounded-full grid place-items-center text-sm font-black shrink-0"
        style={done
          ? { background: 'color-mix(in srgb, var(--t-teal) 18%, transparent)', color: 'var(--t-teal)', border: '2px solid color-mix(in srgb, var(--t-teal) 45%, var(--t-line))' }
          : { background: 'color-mix(in srgb, var(--t-marigold) 16%, transparent)', color: 'var(--t-marigold)', border: '2px solid color-mix(in srgb, var(--t-marigold) 45%, transparent)' }}>
        {done ? '✓' : n}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-black taller-ink leading-tight">{title}</div>
        <div className="text-xs taller-soft mt-0.5">{hint}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTUDIANTE — Espacio de trabajo de la estación: los instrumentos que el
// docente asignó a esta fase, abribles uno a la vez.
// ─────────────────────────────────────────────────────────────────────────────
export function StationInstruments({ team, phase, hideHeading }: { team: any; phase: number; hideHeading?: boolean }) {
  const cat = useCatalog()
  const [open, setOpen] = useState<string | null>(null)
  const assigned: { key: string; required?: boolean }[] = team?.config?.instruments?.[phase] || []
  if (assigned.length === 0) return null

  const defOf = (key: string) => cat?.instruments.find(i => i.key === key)

  return (
    <div className="mb-5 pb-4" style={{ borderBottom: '1px solid var(--t-line)' }}>
      {!hideHeading && <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-2">🧰 Espacio de trabajo de la estación</div>}
      <div className="flex flex-wrap gap-2">
        {assigned.map(a => {
          const def = defOf(a.key)
          const active = open === a.key
          const usage = (team?.requiredInstruments || []).find((s: any) => s.key === a.key)
          return (
            <button key={a.key} onClick={() => setOpen(active ? null : a.key)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition"
              style={active
                ? { background: 'color-mix(in srgb, var(--t-marigold) 16%, var(--t-raised))', color: 'var(--t-marigold)', border: '1px solid color-mix(in srgb, var(--t-marigold) 40%, transparent)', boxShadow: 'var(--t-shadow-sm)' }
                : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
              <span className="text-base">{def?.emoji ?? '🧩'}</span>
              {def?.name ?? a.key}
              {a.required && (usage?.used
                ? <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, #7BA05B 22%, transparent)', color: '#4a6b34' }}>✓ usado</span>
                : <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--t-marigold) 18%, transparent)', color: '#8a5a10' }}>obligatorio</span>)}
            </button>
          )
        })}
      </div>
      {open && (
        <div className="mt-3">
          <InstrumentRenderer instrumentKey={open} teamId={team.id} phase={phase} members={team.members || []} />
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
  const sourceByPhase: Record<number, 'teacher' | 'default'> = project?.phaseConfig?.instrumentsSource || {}
  const isSuggested = sourceByPhase[phase] === 'default'
  const storedInstructions: string = project?.phaseConfig?.stationInstructions?.[phase] || ''
  const [instrText, setInstrText] = useState(storedInstructions)
  const [instrDirty, setInstrDirty] = useState(false)
  useEffect(() => { setInstrText(project?.phaseConfig?.stationInstructions?.[phase] || ''); setInstrDirty(false) }, [phase, project])
  const saveInstructions = async () => {
    setSaving(true)
    try { await abpApi.setStationInstructions(project.id, phase, instrText); setInstrDirty(false); onSaved() }
    catch { alert('No se pudieron guardar las instrucciones') }
    finally { setSaving(false) }
  }

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
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Configuración de la expedición</div>
          <h3 className="font-black taller-ink">🧭 Estaciones</h3>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto" style={{ color: 'var(--t-marigold)' }} />}
      </div>
      <p className="text-xs taller-muted mb-3">Para cada estación defines dos cosas: <b>qué les dices</b> (instrucciones) y <b>con qué trabajan</b> (instrumentos).</p>

      {/* selector de estación */}
      <div className="flex rounded-xl p-1 w-fit flex-wrap gap-0.5 mb-4" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
        {phases.map(p => (
          <button key={p.n} onClick={() => setPhase(p.n)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
            style={phase === p.n ? { background: 'var(--t-raised)', color: 'var(--t-marigold)', boxShadow: 'var(--t-shadow-sm)' } : { color: 'var(--t-muted)' }}>
            {p.icon} {p.n}. {p.name}
            {(assignedByPhase[p.n]?.length ?? 0) > 0 && <span className="ml-1 font-mono">({assignedByPhase[p.n].length})</span>}
            {sourceByPhase[p.n] === 'default' && <span className="ml-1" title="Usa la plantilla sugerida">✨</span>}
          </button>
        ))}
      </div>

      {/* ── 1 · INSTRUCCIONES de esta estación (lo primero que ve el equipo) ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-black shrink-0" style={{ background: 'color-mix(in srgb, var(--t-marigold) 20%, transparent)', color: '#8a5a10' }}>1</span>
          <span className="text-sm font-black taller-ink">📖 Instrucciones para el equipo</span>
          <span className="text-[11px] taller-muted">— lo primero que verán al entrar</span>
        </div>
        <textarea value={instrText} onChange={e => { setInstrText(e.target.value); setInstrDirty(true) }}
          placeholder="Escribe qué debe hacer el equipo en esta estación y cómo. Si lo dejas vacío, Edusyn muestra una guía por defecto."
          maxLength={2000} rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm resize-y" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
        <div className="flex items-center gap-2 mt-1.5">
          {instrDirty
            ? <button onClick={saveInstructions} disabled={saving} className="taller-cta px-4 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50">Guardar instrucciones</button>
            : <span className="text-[11px] taller-muted">{storedInstructions ? '✓ Instrucciones propias guardadas' : 'Sin escribir: se mostrará la guía por defecto de esta estación'}</span>}
        </div>
      </div>

      {/* ── 2 · INSTRUMENTOS de esta estación ── */}
      <div className="flex items-center gap-2 mb-2 pt-4" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-black shrink-0" style={{ background: 'color-mix(in srgb, var(--t-marigold) 20%, transparent)', color: '#8a5a10' }}>2</span>
        <span className="text-sm font-black taller-ink">🧰 Instrumentos de trabajo</span>
        <span className="text-[11px] taller-muted">— con qué construyen aquí</span>
      </div>

      {/* ¿esta estación usa la plantilla sugerida o la configuró el docente? */}
      {isSuggested && (
        <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--t-marigold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--t-marigold) 32%, transparent)', color: '#8a5a10' }}>
          <b>✨ Plantilla sugerida.</b> Aún no has configurado esta estación, así que el equipo verá estos instrumentos (todos opcionales, no bloquean la validación).
          Quita, añade o marca obligatorios los que quieras: al primer cambio, esta estación pasa a ser tuya.
        </div>
      )}

      {/* instrumentos asignados a la estación */}
      {assigned.length === 0 ? (
        <p className="text-sm taller-muted mb-3">Esta estación no tiene instrumentos (la dejaste vacía a propósito). Añade uno desde la biblioteca cuando quieras.</p>
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
