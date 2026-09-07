import { useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  applyIntent,
  createAttempt,
  replay,
  stateHash,
  type AttemptMode,
  type AttemptState,
  type Diagnosis,
  type DomainEvent,
  type Intent,
  type JsonValue,
} from '@edusyn/edulab-runtime'
import {
  fugaIntent,
  fugaLaboratorioDefinition,
  incidentFromGenerated,
  type IncidentProfile,
} from '../../features/edulab/fuga/definition'
import './fuga-laboratorio.css'

interface WorldView {
  zone: { alerted: boolean; isolated: boolean; remote: boolean; exposure: number; safeOrder: boolean }
  leak: { active: boolean; rate: number; pressure: number }
  spill: { spread: number; contained: boolean; reaction: boolean }
  evidence: string[]
  hypothesis: { submitted: boolean; correct: boolean; supported: boolean }
  intervention: { evidenceBased: boolean; hadRecovery: boolean }
  verification: { stable: boolean; explained: boolean }
}

interface Session {
  state: AttemptState
  events: DomainEvent[]
  diagnoses: Diagnosis[]
  acceptedIntents: Intent[]
}

type SessionAction =
  | { type: 'intent'; primitive: Intent['primitive']; targetId: string; payload?: JsonValue }
  | { type: 'restart'; mode: AttemptMode; seed: string }

function startSession(mode: AttemptMode, seed: string): Session {
  return {
    state: createAttempt(fugaLaboratorioDefinition, {
      attemptId: 'local-fuga-attempt',
      mode,
      seed,
    }),
    events: [],
    diagnoses: [],
    acceptedIntents: [],
  }
}

function sessionReducer(session: Session, action: SessionAction): Session {
  if (action.type === 'restart') return startSession(action.mode, action.seed)
  const nextIntent = fugaIntent(session.state.version, action.primitive, action.targetId, action.payload)
  const result = applyIntent(fugaLaboratorioDefinition, session.state, nextIntent)
  return {
    state: result.state,
    events: [...session.events, ...result.events],
    diagnoses: result.diagnoses.length > 0 ? result.diagnoses : session.diagnoses,
    acceptedIntents: result.accepted ? [...session.acceptedIntents, nextIntent] : session.acceptedIntents,
  }
}

const PROFILE_LABELS: Record<IncidentProfile['profile'], string> = {
  acidic: 'Solución ácida diluida',
  basic: 'Solución básica diluida',
  hydroalcoholic: 'Mezcla hidroalcohólica',
  'wash-water': 'Agua del circuito de lavado',
}

const CIRCUITS = ['circuit-a', 'circuit-b', 'circuit-c', 'circuit-d'] as const

function ObjectiveMark({ achieved, demonstrated }: { achieved: boolean; demonstrated: boolean }) {
  return (
    <span className={`edulab-objective-mark ${demonstrated ? 'is-demonstrated' : achieved ? 'is-achieved' : ''}`}>
      {demonstrated ? 'Demostrado' : achieved ? 'Alcanzado' : 'Pendiente'}
    </span>
  )
}

function Intro({ onStart, onExit }: { onStart: (mode: AttemptMode, seed: string) => void; onExit: () => void }) {
  const [mode, setMode] = useState<AttemptMode>('EXPLORE')
  const [seed, setSeed] = useState('fuga-variante-a')
  return (
    <main className="edulab-shell edulab-intro">
      <section className="edulab-intro-card" aria-labelledby="fuga-title">
        <button className="edulab-exit" onClick={onExit}>← Volver a Edusyn</button>
        <div className="edulab-kicker">EDUSIM · EDULAB · CIENCIAS EN ACCIÓN</div>
        <h1 id="fuga-title">Fuga en el laboratorio</h1>
        <p className="edulab-lead">El sensor de una estación de microquímica detectó líquido en la bandeja. Asegura, investiga con controles remotos y demuestra por qué tu intervención funciona.</p>
        <div className="edulab-safety-note">
          <strong>Entrenamiento virtual.</strong> Ante un derrame real, aléjate, reporta y sigue el protocolo del docente. Nunca investigues una sustancia desconocida por tu cuenta ni uses el olor como prueba.
        </div>
        <div className="edulab-intro-options">
          <fieldset>
            <legend>Modo</legend>
            <label><input type="radio" checked={mode === 'EXPLORE'} onChange={() => setMode('EXPLORE')} /> Explorar <small>Ayudas abiertas y reintento libre</small></label>
            <label><input type="radio" checked={mode === 'GUIDED_PRACTICE'} onChange={() => setMode('GUIDED_PRACTICE')} /> Práctica guiada <small>Las consecuencias permanecen hasta corregirlas</small></label>
          </fieldset>
          <fieldset>
            <legend>Variante determinista</legend>
            <label><input type="radio" checked={seed === 'fuga-variante-a'} onChange={() => setSeed('fuga-variante-a')} /> Incidente A</label>
            <label><input type="radio" checked={seed === 'incidente-2'} onChange={() => setSeed('incidente-2')} /> Incidente B</label>
          </fieldset>
        </div>
        <button className="edulab-primary" onClick={() => onStart(mode, seed)}>Entrar al laboratorio</button>
      </section>
    </main>
  )
}

export default function FugaLaboratorio() {
  const navigate = useNavigate()
  const [started, setStarted] = useState(false)
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => startSession('EXPLORE', 'fuga-variante-a'))
  const [profileChoice, setProfileChoice] = useState<IncidentProfile['profile']>('acidic')
  const [circuitChoice, setCircuitChoice] = useState<(typeof CIRCUITS)[number]>('circuit-a')
  const world = session.state.world as unknown as WorldView
  const incident = incidentFromGenerated(session.state.generated.incident)
  const latestDiagnosis = session.diagnoses.at(-1)
  const completed = session.state.status === 'COMPLETED'
  const ending = fugaLaboratorioDefinition.endings.find((item) => item.id === session.state.endingId)

  const progress = useMemo(() => {
    const objectives = Object.values(session.state.objectives)
    return objectives.filter((objective) => objective.demonstrated).length
  }, [session.state.objectives])
  const replayVerified = useMemo(() => {
    if (!completed) return null
    const rebuilt = replay(fugaLaboratorioDefinition, {
      attemptId: session.state.attemptId,
      mode: session.state.mode,
      seed: session.state.seed,
    }, session.acceptedIntents)
    return rebuilt.stateHash === stateHash(session.state)
  }, [completed, session.acceptedIntents, session.state])

  const act = (primitive: Intent['primitive'], targetId: string, payload?: JsonValue) => {
    dispatch({ type: 'intent', primitive, targetId, ...(payload === undefined ? {} : { payload }) })
  }

  if (!started) {
    return <Intro onExit={() => navigate('/dashboard')} onStart={(mode, seed) => {
      dispatch({ type: 'restart', mode, seed })
      setStarted(true)
    }} />
  }

  const evidenceReading = (key: string) => {
    if (!world.evidence.includes(key)) return 'Sin medir'
    if (key === 'ph') return incident.ph
    if (key === 'conductivity') return incident.conductivity
    if (key === 'voc') return incident.voc
    if (key === 'circuit-trace') return incident.circuit.replace('circuit-', 'Circuito ').toUpperCase()
    return PROFILE_LABELS[incident.profile]
  }

  return (
    <main className="edulab-shell">
      <header className="edulab-topbar">
        <div>
          <button className="edulab-exit" onClick={() => navigate('/dashboard')}>← Salir del laboratorio</button>
          <div className="edulab-kicker">MUNDO: CIENCIAS EN ACCIÓN · ZONA: MICROQUÍMICA · CONTENIDO EN REVISIÓN</div>
          <h1>Fuga en el laboratorio</h1>
        </div>
        <div className="edulab-status-strip" aria-label="Estado de misión">
          <span><b>{session.state.mode === 'EXPLORE' ? 'Explorar' : 'Práctica guiada'}</b> modo</span>
          <span><b>{session.state.logicalTick}</b> ticks</span>
          <span><b>{progress}/4</b> demostrados</span>
          <span className={`risk-${world.zone.exposure > 0 || world.spill.reaction ? 'high' : world.leak.active ? 'medium' : 'low'}`}><b>{world.zone.exposure > 0 || world.spill.reaction ? 'Alto' : world.leak.active ? 'Activo' : 'Estable'}</b> riesgo</span>
        </div>
      </header>

      <section className="edulab-workspace">
        <aside className="edulab-mission-panel" aria-label="Objetivos de misión">
          <p className="edulab-panel-label">Misión activa</p>
          <h2>Diagnostica y controla</h2>
          <p>El mundo solo avanza cuando tomas una decisión.</p>
          <ol className="edulab-objectives">
            {fugaLaboratorioDefinition.objectives.map((objective, index) => {
              const state = session.state.objectives[objective.id]!
              return <li key={objective.id}><span>{index + 1}</span><div>{objective.statement}<ObjectiveMark achieved={state.achieved} demonstrated={state.demonstrated} /></div></li>
            })}
          </ol>
          <button className="edulab-secondary" disabled={!world.zone.alerted || !world.zone.isolated || completed} onClick={() => act('actuate', 'supervisor-channel')}>Escalar al responsable</button>
        </aside>

        <section className="edulab-stage" aria-label="Escena interactiva del laboratorio">
          <div className={`edulab-scene ${world.spill.reaction ? 'has-reaction' : ''}`}>
            <svg viewBox="0 0 960 520" role="img" aria-labelledby="scene-title scene-description">
              <title id="scene-title">Estación de microquímica con una fuga activa</title>
              <desc id="scene-description">Cuatro depósitos conectados a una bandeja central. El líquido y los indicadores cambian con las decisiones.</desc>
              <defs>
                <linearGradient id="lab-wall" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#12384a"/><stop offset="1" stopColor="#081c29"/></linearGradient>
                <linearGradient id="steel" x1="0" x2="1"><stop stopColor="#d8e7ea"/><stop offset=".5" stopColor="#7797a1"/><stop offset="1" stopColor="#d6e3e6"/></linearGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <rect width="960" height="520" rx="22" fill="url(#lab-wall)"/>
              <path d="M40 410H920V492H40z" fill="#17303b" stroke="#5f7b84" strokeWidth="2"/>
              {[160, 360, 560, 760].map((x, index) => <g key={x}>
                <rect x={x - 54} y="72" width="108" height="124" rx="18" fill="url(#steel)" stroke="#9fd9de" strokeWidth="2"/>
                <rect x={x - 36} y="94" width="72" height="58" rx="8" fill="#0b2a36"/>
                <text x={x} y="129" textAnchor="middle" fill="#b9f4ef" fontSize="18" fontWeight="700">{String.fromCharCode(65 + index)}</text>
                <path d={`M${x} 196V286H480V348`} fill="none" stroke={world.evidence.includes('circuit-trace') && incident.circuit === `circuit-${String.fromCharCode(97 + index)}` ? '#52e2dc' : '#527482'} strokeWidth="12" strokeLinecap="round"/>
                <circle cx={x} cy="248" r="14" fill={world.leak.active ? '#f5b942' : '#43d19e'} stroke="#071922" strokeWidth="5"/>
              </g>)}
              <rect x="300" y="340" width="360" height="96" rx="22" fill="#244755" stroke={world.spill.reaction ? '#ff6b57' : '#6cb9bf'} strokeWidth="4"/>
              <ellipse cx="480" cy="395" rx={Math.min(145, 44 + world.spill.spread * 13)} ry={Math.min(31, 12 + world.spill.spread * 3)} fill={world.spill.contained ? '#3ac9a0' : world.spill.reaction ? '#ff765f' : '#e1ba4d'} opacity=".78" filter="url(#glow)"/>
              {world.leak.active && <g className="edulab-drip"><circle cx="480" cy="310" r="8" fill="#f7d35e"/><circle cx="480" cy="330" r="5" fill="#f7d35e"/></g>}
              <g transform="translate(56 292)"><rect width="164" height="82" rx="14" fill="#092432" stroke={world.zone.remote ? '#42d5ca' : '#e4a942'} strokeWidth="3"/><text x="82" y="34" textAnchor="middle" fill="#d9f7f5" fontSize="15">CONTROL REMOTO</text><text x="82" y="59" textAnchor="middle" fill={world.zone.remote ? '#62e4bd' : '#ffc85d'} fontSize="13">{world.zone.remote ? 'ACTIVO' : 'INACTIVO'}</text></g>
              <g transform="translate(744 292)"><rect width="164" height="82" rx="14" fill="#092432" stroke={world.leak.active ? '#efb34c' : '#48d6a5'} strokeWidth="3"/><text x="82" y="34" textAnchor="middle" fill="#d9f7f5" fontSize="15">CAUDAL</text><text x="82" y="60" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">{world.leak.rate} u/t</text></g>
            </svg>
            <div className="edulab-consequence" aria-live="polite">
              <span className={`signal signal-${latestDiagnosis?.verdict ?? 'incomplete'}`}></span>
              <div><strong>{latestDiagnosis?.code ?? 'SENSOR.BANDEJA.ACTIVO'}</strong><p>{latestDiagnosis?.message ?? 'Hay líquido en la bandeja. La sustancia y el circuito aún son desconocidos.'}</p></div>
            </div>
          </div>

          <div className="edulab-control-deck">
            <section><h3>1 · Seguridad</h3><div className="edulab-actions">
              <button disabled={completed || world.zone.alerted} onClick={() => act('actuate', 'alarm')}>Activar alerta</button>
              <button disabled={completed || world.zone.isolated} onClick={() => act('actuate', 'access-door')}>Aislar acceso</button>
              <button disabled={completed || world.zone.remote} onClick={() => act('actuate', 'remote-control')}>Control remoto</button>
            </div></section>
            <section><h3>2 · Evidencia</h3><div className="edulab-actions edulab-tools">
              <button disabled={completed} onClick={() => act('inspect', 'sds-terminal')}>SDS <small>{evidenceReading('sds')}</small></button>
              <button disabled={completed} onClick={() => act('inspect', 'sensor-ph')}>pH <small>{evidenceReading('ph')}</small></button>
              <button disabled={completed} onClick={() => act('inspect', 'sensor-conductivity')}>Conductividad <small>{evidenceReading('conductivity')}</small></button>
              <button disabled={completed} onClick={() => act('inspect', 'sensor-voc')}>VOC <small>{evidenceReading('voc')}</small></button>
              <button disabled={completed} onClick={() => act('inspect', 'circuit-tracer')}>Trazador <small>{evidenceReading('circuit-trace')}</small></button>
            </div></section>
            <section className="edulab-console"><h3>3 · Consola de hipótesis</h3><p>Conecta lo observado; puedes revisar la hipótesis después de cualquier consecuencia.</p><div className="edulab-console-row">
              <label>Perfil<select value={profileChoice} onChange={(event) => setProfileChoice(event.target.value as IncidentProfile['profile'])}>{Object.entries(PROFILE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Circuito<select value={circuitChoice} onChange={(event) => setCircuitChoice(event.target.value as typeof circuitChoice)}>{CIRCUITS.map((circuit) => <option key={circuit} value={circuit}>{circuit.replace('circuit-', 'Circuito ').toUpperCase()}</option>)}</select></label>
              <button disabled={completed} onClick={() => act('input', 'evidence-log', { profile: profileChoice, circuit: circuitChoice })}>Registrar hipótesis</button>
            </div></section>
            <section><h3>4 · Intervención remota</h3><div className="edulab-actions edulab-valves">
              {CIRCUITS.map((circuit) => <button disabled={completed || !world.zone.remote} key={circuit} onClick={() => act('actuate', circuit)}>Cerrar {circuit.replace('circuit-', '').toUpperCase()}</button>)}
              <button disabled={completed || world.leak.pressure <= 1} onClick={() => act('actuate', 'relief-control')}>Liberar presión</button>
            </div><div className="edulab-actions edulab-modules">
              <button disabled={completed || !world.zone.remote} onClick={() => act('actuate', 'module-corrosive')}>Módulo corrosivos</button>
              <button disabled={completed || !world.zone.remote} onClick={() => act('actuate', 'module-flammable')}>Módulo inflamables</button>
              <button disabled={completed || !world.zone.remote} onClick={() => act('actuate', 'module-water')}>Módulo acuoso</button>
              <button disabled={completed || !world.spill.reaction} onClick={() => act('actuate', 'module-release')}>Retirar módulo</button>
            </div></section>
            <section><h3>5 · Verificar y explicar</h3><div className="edulab-actions">
              <button disabled={completed} onClick={() => act('inspect', 'verification-sensor')}>Medir estado final</button>
              <button disabled={completed || !world.verification.stable} onClick={() => act('input', 'explanation-console', { causalLink: true })}>Registrar cadena causal</button>
              <button disabled={completed || !world.verification.explained} onClick={() => act('inspect', 'status-panel')}>Cerrar misión</button>
            </div></section>
          </div>
        </section>

        <aside className="edulab-log" aria-label="Bitácora de evidencia">
          <p className="edulab-panel-label">Bitácora</p><h2>Evidencia y decisiones</h2>
          <div className="edulab-evidence-count">{world.evidence.length}<small>evidencias</small></div>
          <ul>{session.events.slice(-9).reverse().map((event) => <li key={event.eventId}><span>{event.logicalTick}</span><div><strong>{event.type.replace(/\./g, ' ')}</strong><small>{String(event.subjectId ?? 'sistema')}</small></div></li>)}</ul>
          {session.events.length === 0 && <p className="edulab-empty">Tus decisiones y sus consecuencias aparecerán aquí.</p>}
        </aside>
      </section>

      {completed && <div className="edulab-ending" role="dialog" aria-modal="true" aria-labelledby="ending-title"><section>
        <div className="edulab-kicker">MISIÓN FINALIZADA</div><h2 id="ending-title">{ending?.label}</h2>
        <p>{session.state.endingId === 'safe_escalation' ? 'Priorizaste la seguridad y entregaste el incidente a personal responsable.' : 'El estado es seguro. Revisa qué alcanzaste y qué pudiste demostrar con evidencia.'}</p>
        <div className="edulab-ending-grid">{fugaLaboratorioDefinition.objectives.map((objective) => { const objectiveState = session.state.objectives[objective.id]!; return <div key={objective.id}><strong>{objective.statement}</strong><ObjectiveMark achieved={objectiveState.achieved} demonstrated={objectiveState.demonstrated} /></div> })}</div>
        <p className="edulab-replay-proof">Replay local: <strong>{replayVerified ? 'verificado' : 'no coincide'}</strong> · {session.acceptedIntents.length} decisiones aceptadas · seed <code>{session.state.seed}</code> · definición <code>{session.state.definition.definitionHash.slice(-8)}</code></p>
        <div className="edulab-ending-actions"><button className="edulab-primary" onClick={() => dispatch({ type: 'restart', mode: session.state.mode, seed: session.state.seed })}>Repetir misma variante</button><button className="edulab-secondary" onClick={() => dispatch({ type: 'restart', mode: session.state.mode, seed: session.state.seed === 'fuga-variante-a' ? 'incidente-2' : 'fuga-variante-a' })}>Probar otra variante</button><button className="edulab-exit" onClick={() => navigate('/dashboard')}>Volver a Edusyn</button></div>
      </section></div>}
    </main>
  )
}
