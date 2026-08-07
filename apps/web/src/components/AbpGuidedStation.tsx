import { useState } from 'react'
import { ChevronLeft, Loader2, Send } from 'lucide-react'
import { MissionCard, PhaseTool, PHASE_TOOL_UI } from './AbpTab'
import { InstrumentRenderer, useCatalog, DEFAULT_INSTRUCTIONS } from './TallerInstruments'

// ═══════════════════════════════════════════════════════════════════════════
// ESTACIÓN GUIADA — metodología F.O.C.O.
// (Foco único · Orientación constante · Carga progresiva · Orden suave)
//
// UNA PANTALLA A LA VEZ: el tablero muestra "Lo siguiente" protagonista y la
// ruta completa de la estación; cada paso (instrumento, misión o ENTREGA) se
// abre en FOCO a pantalla completa. Todo paso lleva el hilo conductor con la
// problemática del equipo (team.problem) + la consigna conectada, para que
// nunca se sienta que cada herramienta trabaja algo distinto: todo gira
// alrededor del MISMO reto. Misma experiencia guiada en móvil y en PC:
// columna única, cero paneles múltiples.
// ═══════════════════════════════════════════════════════════════════════════

type StepDef =
  | { kind: 'instrument'; id: string; key: string; required: boolean; used: boolean; name: string; emoji: string; description?: string }
  | { kind: 'mission'; id: string; mission: any }
  | { kind: 'legacy'; id: string }

type Focus = { kind: 'instrument'; key: string } | { kind: 'mission'; id: string } | { kind: 'legacy' } | null

const DELIVERY_LABEL: Record<string, string> = { FILE: 'Archivo', LINK: 'Enlace', TEXT: 'Texto' }

// ¿Para qué trabajamos esta estación? — conecta cada paso con el reto del equipo.
const WHY: Record<number, string> = {
  1: 'todo lo que exploren aquí les ayuda a COMPRENDER su reto a fondo antes de proponer soluciones',
  2: 'cada idea que registren es una forma posible de RESOLVER su reto (cantidad primero, calidad después)',
  3: 'aquí convierten su mejor idea en una META clara que ataque directamente su reto',
  4: 'aquí organizan el TRABAJO que hará realidad la solución de su reto (nadie se queda sin tarea)',
  5: 'aquí CONSTRUYEN la solución de su reto y documentan todo el proceso',
  6: 'aquí le CUENTAN al mundo cómo resolvieron su reto y evalúan a los demás equipos',
}

function stepDone(s: StepDef): boolean {
  if (s.kind === 'instrument') return s.used
  if (s.kind === 'mission') return !!s.mission.complete
  return false
}

/** Lo que cuenta para "Lo siguiente": solo lo obligatorio pendiente (o la herramienta central). */
function stepBlocking(s: StepDef): boolean {
  if (s.kind === 'instrument') return s.required && !s.used
  if (s.kind === 'mission') return !s.mission.complete
  return true // herramienta legacy: es el trabajo central de la estación
}

function stepIcon(s: StepDef, stationIcon: string): string {
  if (s.kind === 'instrument') return s.emoji
  if (s.kind === 'legacy') return stationIcon
  const m = s.mission
  if (m.deliverableKind) return '📎'
  if ((m.activities || []).some((a: any) => a.classroomActivityId)) return '🎮'
  if (m.assigneeType === 'INDIVIDUAL') return '⭐'
  return '🎯'
}

function stepTitle(s: StepDef): string {
  if (s.kind === 'instrument') return s.name
  if (s.kind === 'legacy') return 'Herramienta principal de la estación'
  return s.mission.title
}

function stepHint(s: StepDef, team: any): string {
  if (s.kind === 'instrument') {
    if (s.used) return 'Ya trabajaron aquí · toca para ver cómo quedó'
    return s.required ? 'Obligatorio — ábranlo y trabájenlo en equipo' : 'Opcional — úsalo si les ayuda'
  }
  if (s.kind === 'legacy') return 'El trabajo central de esta estación'
  const m = s.mission
  if (m.complete) return 'Cumplida · toca para ver la entrega'
  const bits: string[] = []
  if (m.deliverableKind) bits.push(`Entrega: ${DELIVERY_LABEL[m.deliverableKind] || 'producto'}`)
  if ((m.activities || []).some((a: any) => a.classroomActivityId)) bits.push('Actividad interactiva')
  if (m.assigneeType === 'INDIVIDUAL') bits.push(m.assigneeEnrollmentId === team?.myEnrollmentId ? 'Tu misión personal' : `De ${m.assigneeName}`)
  if (m.required) bits.push('Obligatoria')
  if (bits.length === 0) bits.push('Misión de la estación')
  return bits.join(' · ')
}

/** Hilo conductor: recuerda que TODO lo de esta estación es para resolver SU reto. */
function ProblemThread({ problem, phase, compact }: { problem: string; phase: number; compact?: boolean }) {
  if (!problem) return null
  return (
    <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: 'color-mix(in srgb, var(--t-teal) 7%, var(--t-surface))', border: '1px solid color-mix(in srgb, var(--t-teal) 28%, var(--t-line))' }}>
      <div className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--t-teal)' }}>🎯 {compact ? 'Esto es para resolver' : 'Su reto'}</div>
      <p className="text-sm taller-ink font-semibold mt-0.5 leading-snug">{problem}</p>
      {!compact && WHY[phase] && <p className="text-xs taller-soft mt-1">En esta estación {WHY[phase]}.</p>}
    </div>
  )
}

export default function AbpGuidedStation({ team, phase, stationName, stationIcon, purpose, feedback, awaiting, validated, busy, onSaved, onPresent }: {
  team: any
  phase: number
  stationName: string
  stationIcon: string
  purpose?: string
  feedback?: string
  awaiting?: boolean
  validated?: boolean
  busy?: boolean
  onSaved: () => void
  onPresent: () => void
}) {
  const cat = useCatalog()
  const [focus, setFocus] = useState<Focus>(null)
  const [instrOpen, setInstrOpen] = useState(false)

  const problem: string = team?.problem || ''
  const assigned: { key: string; required?: boolean }[] = team?.config?.instruments?.[phase] || []
  const reqInstr: { key: string; used: boolean }[] = team?.requiredInstruments || []
  const missions: any[] = team?.currentMissions || []
  const reqMissions = missions.filter(m => m.required)
  const reqDone = reqMissions.filter(m => m.complete).length
  const reqInstrUsed = reqInstr.filter(s => s.used).length
  const canRequest = !!team?.readyForValidation
  const trackTotal = reqMissions.length + reqInstr.length
  const trackDone = reqDone + reqInstrUsed

  // La ruta de la estación: instrumentos asignados → misiones (o herramienta legacy).
  // Las misiones de ENTREGA (deliverableKind) son pasos visibles de la ruta:
  // cada estación se completa entregando un producto, aparte de las herramientas.
  const steps: StepDef[] = []
  for (const a of assigned) {
    const def = cat?.instruments.find(i => i.key === a.key)
    const usage = reqInstr.find(s => s.key === a.key)
    steps.push({ kind: 'instrument', id: `i:${a.key}`, key: a.key, required: !!a.required, used: !!usage?.used, name: def?.name ?? a.key, emoji: def?.emoji ?? '🧩', description: def?.description })
  }
  if (missions.length === 0) steps.push({ kind: 'legacy', id: 'legacy' })
  else for (const m of missions) steps.push({ kind: 'mission', id: `m:${m.id}`, mission: m })

  const nextStep = steps.find(stepBlocking) || null
  const doneCount = steps.filter(stepDone).length

  const openStep = (s: StepDef) => {
    if (s.kind === 'instrument') setFocus({ kind: 'instrument', key: s.key })
    else if (s.kind === 'mission') setFocus({ kind: 'mission', id: s.mission.id })
    else setFocus({ kind: 'legacy' })
    try { window.scrollTo({ top: 0 }) } catch { }
  }
  const closeFocus = () => { setFocus(null); onSaved() }

  // ══ FOCO: una sola cosa a la vez, a pantalla completa ═════════════════════
  if (focus) {
    const step = steps.find(s =>
      (focus.kind === 'instrument' && s.kind === 'instrument' && s.key === (focus as any).key) ||
      (focus.kind === 'mission' && s.kind === 'mission' && s.mission.id === (focus as any).id) ||
      (focus.kind === 'legacy' && s.kind === 'legacy')) || null
    const idx = step ? steps.indexOf(step) : -1
    const done = step ? stepDone(step) : false
    const customInstr = team?.config?.stationInstructions?.[phase]
    const instrText = (customInstr && String(customInstr).trim()) || DEFAULT_INSTRUCTIONS[phase] || ''

    return (
      <div className="max-w-4xl mx-auto pb-6">
        <button onClick={closeFocus} className="flex items-center gap-1.5 text-sm font-bold taller-muted hover:opacity-70 mb-3 py-1">
          <ChevronLeft className="w-4 h-4" /> Ruta de la estación
        </button>

        {/* Cabecera del paso — el estudiante sabe dónde está de inmediato */}
        <div className="taller-card p-5 mb-4">
          <div className="text-[11px] font-mono uppercase tracking-widest taller-mari">
            {idx >= 0 ? `Paso ${idx + 1} de ${steps.length} · ` : ''}{stationIcon} {stationName}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-3xl">{step ? stepIcon(step, stationIcon) : '🧩'}</span>
            <h3 className="text-xl font-black taller-ink tracking-tight min-w-0">{step ? stepTitle(step) : ''}</h3>
            {done && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md shrink-0" style={{ background: 'color-mix(in srgb, #7BA05B 22%, transparent)', color: '#4a6b34' }}>✓ así va quedando</span>}
          </div>
        </div>

        {/* Hilo con la problemática: este paso existe PARA resolver su reto */}
        <ProblemThread problem={problem} phase={phase} compact />

        {/* Consigna: qué es esto, para qué (conectado al reto) + instrucciones */}
        <div className="taller-card p-4 mb-4">
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">💡 Consigna</div>
          {step?.kind === 'instrument' && step.description && (
            <p className="text-sm taller-soft leading-relaxed">{step.description}</p>
          )}
          {step?.kind === 'mission' && step.mission.deliverableKind && (
            <p className="text-sm taller-soft leading-relaxed">Esta estación se completa con una <b className="taller-ink">entrega ({DELIVERY_LABEL[step.mission.deliverableKind] || 'producto'})</b>: es el producto que le muestran al docente.</p>
          )}
          {step?.kind === 'mission' && (step.mission.activities || []).some((a: any) => a.classroomActivityId) && (
            <p className="text-sm taller-soft leading-relaxed">Hay una <b className="taller-ink">actividad interactiva</b> preparada por el docente: ábranla y complétenla aquí mismo.</p>
          )}
          {WHY[phase] && <p className="text-sm taller-soft mt-1 leading-relaxed"><b className="taller-ink">¿Para qué?</b> Porque {WHY[phase]}.</p>}
          {instrText && (
            <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--t-line)' }}>
              <button onClick={() => setInstrOpen(v => !v)} className="flex items-center gap-1.5 text-xs font-bold taller-mari hover:opacity-70">
                📖 Instrucciones de la estación {instrOpen ? '▲' : '▼'}
              </button>
              {instrOpen && (
                <p className="text-sm taller-soft mt-1.5 whitespace-pre-line leading-relaxed">
                  {instrText}
                  {customInstr && <span className="block mt-1 text-[10px] font-mono taller-muted">— indicaciones de tu docente</span>}
                </p>
              )}
            </div>
          )}
        </div>

        {/* El trabajo en sí — protagonista total de la pantalla */}
        {step?.kind === 'instrument' && (
          <InstrumentRenderer instrumentKey={step.key} teamId={team.id} phase={phase} members={team.members || []} />
        )}
        {step?.kind === 'mission' && (
          <MissionCard mission={step.mission} team={team} onSaved={onSaved} />
        )}
        {step?.kind === 'legacy' && (
          <div className="taller-card p-5"><PhaseTool tool={PHASE_TOOL_UI[phase]} team={team} onSaved={onSaved} /></div>
        )}

        {/* Salida clara: volver a la ruta */}
        <button onClick={closeFocus} className="taller-cta mt-5 w-full py-3.5 rounded-xl font-bold text-[15px]">
          {done ? 'Volver a la ruta ✓' : 'Listo por ahora — volver a la ruta'}
        </button>
      </div>
    )
  }

  // ══ TABLERO DE LA ESTACIÓN: Lo siguiente + ruta + compuerta ═══════════════
  return (
    <div className="max-w-3xl mx-auto">
      {/* Encabezado de la estación */}
      <div className="taller-card p-5 mb-4">
        <div className="text-[11px] font-mono uppercase tracking-widest taller-mari">Estación {phase} de 6{purpose ? ` · ${purpose}` : ''}</div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-3xl">{stationIcon}</span>
          <h3 className="text-2xl font-black taller-ink tracking-tight">{stationName}</h3>
          {trackTotal > 0 && <span className="ml-auto text-xs font-mono font-bold taller-soft">{trackDone}/{trackTotal} obligatorio</span>}
        </div>
      </div>

      {/* El docente ya revisó → para continuar hay que cumplir lo que pidió */}
      {feedback && !awaiting && (
        <div className="mb-4 p-4 rounded-2xl" style={{ background: 'color-mix(in srgb, #CB4E42 9%, var(--t-surface))', border: '1px solid color-mix(in srgb, #CB4E42 35%, transparent)' }}>
          <div className="text-[11px] font-mono uppercase tracking-widest font-bold" style={{ color: '#CB4E42' }}>🔔 El docente ya revisó esta estación</div>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#7a2b22' }}>{feedback}</p>
          <p className="text-xs mt-1.5" style={{ color: '#9a4a3e' }}>Para continuar: cumplan lo que falta en la ruta de abajo y vuelvan a presentarla.</p>
        </div>
      )}

      {awaiting && (
        <div className="mb-4 p-4 rounded-2xl flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--t-marigold) 12%, var(--t-surface))', border: '1px solid color-mix(in srgb, var(--t-marigold) 30%, transparent)' }}>
          <span className="text-2xl">⏳</span>
          <div>
            <div className="text-sm font-black" style={{ color: '#8a5a10' }}>Estación presentada — en revisión</div>
            <div className="text-xs taller-soft">El docente la está mirando. Mientras tanto pueden ver cómo quedó su trabajo tocando cualquier paso.</div>
          </div>
        </div>
      )}

      {phase === 6 && validated && (
        <div className="taller-card p-6 text-center mb-4">🏆<p className="font-black taller-ink mt-2">¡Llegaron a la cima de la expedición!</p></div>
      )}

      {/* Hilo con la problemática */}
      <ProblemThread problem={problem} phase={phase} />

      {/* LO SIGUIENTE — protagonista de la pantalla */}
      {!awaiting && nextStep && (
        <div className="taller-card taller-mission p-5 mb-5">
          <div className="text-[11px] font-mono uppercase tracking-widest taller-mari">Lo siguiente</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl shrink-0">{stepIcon(nextStep, stationIcon)}</span>
            <div className="min-w-0">
              <div className="font-black taller-ink text-lg leading-tight">{stepTitle(nextStep)}</div>
              <div className="text-xs taller-muted mt-0.5">{stepHint(nextStep, team)}</div>
            </div>
          </div>
          <button onClick={() => openStep(nextStep)} className="taller-cta mt-4 w-full py-3.5 rounded-xl font-bold text-[15px]">
            {nextStep.kind === 'legacy' ? 'Trabajar aquí →' : 'Empezar ahora →'}
          </button>
        </div>
      )}
      {!awaiting && !nextStep && steps.length > 0 && (
        <div className="taller-card taller-mission p-5 mb-5 text-center">
          <div className="text-3xl">🎉</div>
          <div className="font-black taller-ink text-lg mt-1">¡Completaron lo obligatorio de esta estación!</div>
          <p className="text-sm taller-soft mt-1">Revisen cómo quedó su trabajo en la ruta de abajo y preséntenla al docente.</p>
          <button onClick={onPresent} disabled={busy || !canRequest} className="taller-cta mt-4 w-full py-3.5 rounded-xl font-bold text-[15px] disabled:opacity-50">
            Presentar la estación ✦
          </button>
        </div>
      )}

      {/* LA RUTA — todos los pasos de la estación, uno por fila */}
      {steps.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest taller-muted">La ruta de esta estación</span>
            <span className="text-[11px] font-mono taller-muted">{doneCount}/{steps.length}</span>
            <span className="flex-1 h-px" style={{ background: 'var(--t-line)' }} />
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => {
              const done = stepDone(s)
              const isNext = nextStep === s
              return (
                <button key={s.id} onClick={() => openStep(s)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition"
                  style={{
                    background: done ? 'color-mix(in srgb, var(--t-teal) 6%, var(--t-surface))' : 'var(--t-surface)',
                    border: isNext ? '2px solid var(--t-marigold)' : `1px solid ${done ? 'color-mix(in srgb, var(--t-teal) 35%, var(--t-line))' : 'var(--t-line)'}`,
                    boxShadow: isNext ? 'var(--t-shadow-sm)' : 'none',
                  }}>
                  <span className="w-8 h-8 rounded-full grid place-items-center text-sm font-black shrink-0"
                    style={done
                      ? { background: 'color-mix(in srgb, var(--t-teal) 18%, transparent)', color: 'var(--t-teal)' }
                      : { background: 'color-mix(in srgb, var(--t-marigold) 14%, transparent)', color: 'var(--t-marigold)' }}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="text-xl shrink-0">{stepIcon(s, stationIcon)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate" style={{ color: done ? 'var(--t-muted)' : 'var(--t-ink)' }}>{stepTitle(s)}</span>
                    <span className="block text-[11px] taller-muted truncate">{stepHint(s, team)}</span>
                  </span>
                  <span className="text-xs font-bold shrink-0" style={{ color: done ? 'var(--t-teal)' : 'var(--t-marigold)' }}>
                    {done ? 'Ver cómo quedó →' : isNext ? 'Ahora →' : 'Abrir →'}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* COMPUERTA — barra fija abajo: qué falta + presentar */}
      {!awaiting && !(phase === 6 && validated) && steps.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-6">
          <div className="taller-card p-3 flex items-center gap-3" style={{ boxShadow: '0 8px 28px rgba(35,24,4,.18)' }}>
            <div className="min-w-0 pl-1">
              {trackTotal > 0 && <div className="text-xs font-black taller-ink">{trackDone}/{trackTotal} obligatorio</div>}
              <div className="text-[11px] taller-muted leading-tight">
                {canRequest ? '¡Listos! Ya pueden presentar 🎉'
                  : reqDone < reqMissions.length ? `Falta ${reqMissions.length - reqDone} misión(es) obligatoria(s)`
                  : reqInstrUsed < reqInstr.length ? `Falta usar ${reqInstr.length - reqInstrUsed} instrumento(s) obligatorio(s)`
                  : 'Cuando terminen, preséntenla al docente'}
              </div>
            </div>
            <button onClick={onPresent} disabled={busy || !canRequest}
              className={`ml-auto shrink-0 py-2.5 px-4 rounded-xl font-bold text-sm flex items-center gap-1.5 transition disabled:cursor-not-allowed ${canRequest ? 'taller-cta' : ''}`}
              style={!canRequest ? { background: 'var(--t-surface)', color: 'var(--t-muted)', border: '1px solid var(--t-line)' } : undefined}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : canRequest ? <Send className="w-4 h-4" /> : '🔒'}
              Presentar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
