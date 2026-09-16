import { ArrowRight, Check, CheckCircle2, Clipboard, Hammer, Lightbulb, Loader2, Lock, Megaphone, MessageSquareText, Rocket, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConstruyeTeamBrief } from '../../lib/api/construye'
import {
  buildPhaseState, firstOpenPhase, initialPrompt, normalizeBrief, phaseState, promptReady,
  type BriefField, type BriefPhaseKey, type JourneyPhaseKey, type JourneyPhaseState,
} from './journey'

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100'

interface PhaseField { field: BriefField; label: string; hint: string; optional?: boolean; rows?: number }
interface PhaseConfig {
  key: BriefPhaseKey
  title: string
  question: string
  intro: string
  fields: PhaseField[]
  example: { title: string; lines: string[] }
}

/** Preguntas y ejemplos de cada fase. El ejemplo es de OTRO equipo y de otro tema, para
 * inspirar la forma de pensar sin darles la respuesta. */
const PHASES: PhaseConfig[] = [
  {
    key: 'problem',
    title: 'El problema',
    question: '¿Qué está pasando?',
    intro: 'Antes de pensar en la app, entiendan bien la situación. Escríbanla con sus propias palabras.',
    fields: [
      { field: 'problem', label: '¿Qué ocurre?', hint: 'Cuéntenlo como se lo explicarían a un compañero nuevo: ¿qué pasa, dónde y cuándo?', rows: 3 },
      { field: 'affected', label: '¿A quién afecta?', hint: 'Piensen en personas concretas. ¿Quiénes lo viven? ¿Cómo se sienten?' },
      { field: 'whyItMatters', label: '¿Por qué vale la pena resolverlo?', hint: '¿Qué mejoraría si esto dejara de pasar?', optional: true },
    ],
    example: {
      title: 'Así lo escribió un equipo que trabajó sobre la tienda escolar',
      lines: [
        'Qué ocurre: en el descanso la fila de la tienda es tan larga que muchos no alcanzan a comprar antes de volver a clase.',
        'A quién afecta: sobre todo a los de primaria, que salen últimos, y a la señora de la tienda, que no da abasto.',
        'Por qué importa: hay estudiantes que pasan la mañana sin comer y eso les quita energía en clase.',
      ],
    },
  },
  {
    key: 'solution',
    title: 'La solución que imaginamos',
    question: '¿Qué vamos a crear?',
    intro: 'Imaginen cómo una página o app podría ayudar. No hace falta saber programar: descríbanla como la contarían.',
    fields: [
      { field: 'solution', label: '¿Qué hará su página o app y cómo ayuda con el problema?', hint: 'Una o dos frases: qué hace y por qué eso ayuda.', rows: 3 },
      { field: 'audience', label: '¿Quién la usará?', hint: '¿Las mismas personas afectadas? ¿Alguien más?' },
      { field: 'screens', label: '¿Cómo se vería?', hint: 'Antes de escribir, dibujen las pantallas en papel. Luego descríbanlas: "una pantalla con…", "un botón para…", "cuando alguien toca…".', optional: true, rows: 3 },
      { field: 'subject', label: 'Asignatura o tema', hint: 'Si el proyecto se relaciona con una materia, cuál.', optional: true, rows: 1 },
    ],
    example: {
      title: 'Ejemplo del equipo de la tienda escolar',
      lines: [
        'Qué hará: una página para pedir antes del descanso, así la tienda prepara los pedidos y la fila avanza más rápido.',
        'Quién la usará: los estudiantes para pedir y la señora de la tienda para ver los pedidos.',
        'Cómo se vería: una lista de productos con su precio, un botón "Pedir" y una pantalla con los pedidos del día.',
      ],
    },
  },
  {
    key: 'plan',
    title: 'Plan de la versión 1',
    question: '¿Qué hacemos primero?',
    intro: 'Una buena primera versión es pequeña: lo mínimo para que alguien la pruebe hoy. Lo demás puede esperar.',
    fields: [
      { field: 'features', label: '¿Qué tendrá la versión 1?', hint: 'Solo lo indispensable. Si la lista es larga, pasen algo a "después".', rows: 3 },
      { field: 'later', label: '¿Qué dejamos para después?', hint: 'Ideas buenas que no caben en la primera versión.', optional: true },
      { field: 'successCheck', label: '¿Cómo sabremos que funciona?', hint: 'Escríbanla como "si… entonces…": "si escribo una tarea y pulso Agregar, entonces aparece en la lista".' },
      { field: 'style', label: 'Estilo visual', hint: 'Cómo quieren que se vea: colores, sensación, a quién debe gustarle.', optional: true, rows: 1 },
    ],
    example: {
      title: 'Ejemplo del equipo de la tienda escolar',
      lines: [
        'Versión 1: ver la lista de productos y agregar un pedido con el nombre del producto.',
        'Para después: pagos, fotos de los productos y avisos cuando el pedido esté listo.',
        'Cómo sabremos que funciona: si escribo "empanada" y pulso Pedir, entonces el pedido aparece en la lista.',
      ],
    },
  },
  {
    key: 'share',
    title: 'Compartir y reflexionar',
    question: '¿Cómo contamos lo que hicimos?',
    intro: 'Preparen una presentación de 2 minutos y piensen en lo que aprendieron. Cuenten el proceso, no solo la app.',
    fields: [
      { field: 'sharePitch', label: 'Nuestra presentación de 2 minutos', hint: 'En este orden: el problema → la solución y por qué la eligieron → qué probaron → qué mejorarían en la siguiente versión.', rows: 5 },
      { field: 'reflection', label: '¿Qué aprendimos?', hint: 'De programar, de trabajar con IA y qué harían diferente si empezaran de nuevo.', rows: 3 },
    ],
    example: {
      title: 'Así lo contó el equipo de la tienda escolar',
      lines: [
        'El problema: en el descanso muchos no alcanzaban a comprar.',
        'La solución: una página para pedir antes; elegimos esta idea porque la tienda puede preparar los pedidos.',
        'Probamos: hicimos 5 pedidos y todos aparecieron; otro equipo nos dijo que el botón no se veía bien.',
        'Mejoraríamos: avisar cuando el pedido esté listo.',
        'Aprendimos: pedirle a la IA una cosa a la vez y revisar el código antes de pegarlo.',
      ],
    },
  },
]

const STEPS: { key: JourneyPhaseKey; title: string; icon: typeof Search }[] = [
  { key: 'problem', title: 'El problema', icon: Search },
  { key: 'solution', title: 'La solución', icon: Lightbulb },
  { key: 'plan', title: 'Plan de la v1', icon: Rocket },
  { key: 'build', title: 'Construir y probar', icon: Hammer },
  { key: 'share', title: 'Compartir', icon: Megaphone },
]

const STATE_LABEL: Record<JourneyPhaseState, string> = { pending: 'Pendiente', started: 'En curso', done: 'Lista' }

export interface BriefBuilderProps {
  initialBrief?: Partial<ConstruyeTeamBrief> | null
  onSave?: (brief: ConstruyeTeamBrief) => Promise<boolean>
  onPromptCopied?: () => void
  /** Versiones ya guardadas: deciden el estado de la fase 4 y por dónde se abre el recorrido. */
  versionCount?: number
  hasCode?: boolean
  /** Se avisa cuando el equipo abre la fase 4, para llevarlo al taller. */
  onOpenBuild?: () => void
}

/** Recorrido pedagógico de Edusyn Crea: problema → solución → plan de la versión 1 → construir.
 * La petición para la IA externa aparece al final de la fase 3, armada con las decisiones del
 * equipo, y se puede corregir antes de copiarla. */
export default function BriefBuilder({ initialBrief, onSave, onPromptCopied, versionCount = 0, hasCode = false, onOpenBuild }: BriefBuilderProps = {}) {
  const startingBrief = useMemo(() => normalizeBrief(initialBrief), [initialBrief])
  const [brief, setBrief] = useState<ConstruyeTeamBrief>(startingBrief)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(startingBrief))
  const [active, setActive] = useState<JourneyPhaseKey>(() => firstOpenPhase(startingBrief, versionCount))
  const [saving, setSaving] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const hasChanges = JSON.stringify(brief) !== savedSnapshot
  const savedBrief = useMemo(() => JSON.parse(savedSnapshot) as ConstruyeTeamBrief, [savedSnapshot])
  const set = (key: keyof ConstruyeTeamBrief, value: string) => setBrief(current => ({ ...current, [key]: value }))

  const states: Record<JourneyPhaseKey, JourneyPhaseState> = {
    problem: phaseState('problem', savedBrief),
    solution: phaseState('solution', savedBrief),
    plan: phaseState('plan', savedBrief),
    build: buildPhaseState(versionCount, hasCode),
    share: phaseState('share', savedBrief),
  }

  const open = (key: JourneyPhaseKey) => {
    setActive(key)
    // Al cambiar de fase el contenido cambia de alto: se vuelve al inicio del recorrido para
    // que la nueva fase se lea desde su pregunta, no desde la mitad.
    if (key === 'build') onOpenBuild?.()
    else sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function save(): Promise<boolean> {
    if (!onSave) { setSavedSnapshot(JSON.stringify(brief)); return true }
    if (!hasChanges) return true
    setSaving(true)
    try {
      const saved = await onSave(brief)
      if (saved) setSavedSnapshot(JSON.stringify(brief))
      return saved
    } finally {
      setSaving(false)
    }
  }

  async function saveAndContinue(next: JourneyPhaseKey) {
    if (await save()) open(next)
  }

  const phase = PHASES.find(item => item.key === active)
  const nextStep = phase ? STEPS[STEPS.findIndex(step => step.key === phase.key) + 1]?.key : undefined
  const doneCount = (Object.values(states) as JourneyPhaseState[]).filter(state => state === 'done').length

  return <section ref={sectionRef} className="mt-6 scroll-mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
    <header className="border-b border-slate-200 bg-gradient-to-r from-orange-50 via-white to-cyan-50 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-orange-700">Recorrido del equipo</p>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900">De un problema real a una app que pueden explicar</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800"><MessageSquareText className="h-3.5 w-3.5" /> La IA propone · el equipo decide</span>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label={`Avance: ${doneCount} de ${STEPS.length} etapas listas`}>
        {STEPS.map((step, index) => {
          const state = states[step.key]
          const Icon = step.icon
          return <li key={step.key}>
            <button type="button" onClick={() => open(step.key)} aria-current={active === step.key ? 'step' : undefined} className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${active === step.key ? 'border-cyan-400 bg-white shadow-md shadow-cyan-900/5' : 'border-slate-200 bg-white/60 hover:bg-white'}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'started' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                {state === 'done' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-slate-800">{index + 1}. {step.title}</span>
                <span className={`block text-[11px] ${state === 'done' ? 'text-emerald-700' : state === 'started' ? 'text-amber-700' : 'text-slate-400'}`}>{STATE_LABEL[state]}</span>
              </span>
            </button>
          </li>
        })}
      </ol>
    </header>

    {phase && <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
      <div className="p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-700">Etapa {STEPS.findIndex(step => step.key === phase.key) + 1} · {phase.title}</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{phase.question}</h3>
        <p className="mt-1 text-sm text-slate-600">{phase.intro}</p>
        <div className="mt-4 space-y-4">
          {phase.fields.map(item => <label key={item.field} className="block">
            <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-800">{item.label}{item.optional && <span className="text-[11px] font-normal text-slate-400">opcional</span>}</span>
            <span className="mb-1.5 block text-xs text-slate-500">{item.hint}</span>
            <textarea value={brief[item.field]} onChange={event => set(item.field, event.target.value)} rows={item.rows ?? 2} className={`${fieldClass} resize-y`} />
          </label>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {hasChanges ? <><span className="h-2 w-2 rounded-full bg-amber-500" /> Hay cambios sin guardar</> : <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Guardado · pueden volver a mejorarlo cuando quieran</>}
          </span>
          <div className="flex gap-2">
            {onSave && <button type="button" disabled={!hasChanges || saving} onClick={() => { void save() }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Guardar</button>}
            {nextStep && <button type="button" disabled={saving} onClick={() => { void saveAndContinue(nextStep) }} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:bg-slate-400">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />} {onSave ? 'Guardar y seguir' : 'Seguir'}
            </button>}
          </div>
        </div>
      </div>
      <aside className="space-y-4 border-t border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-l lg:border-t-0">
        <details className="group rounded-2xl border border-slate-200 bg-white p-4" open={phase.key === 'problem' && states.problem === 'pending'}>
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-800"><Lightbulb className="mr-1.5 inline h-4 w-4 text-amber-500" />Ver un ejemplo</summary>
          <p className="mt-2 text-xs font-semibold text-slate-500">{phase.example.title}</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">{phase.example.lines.map(line => <li key={line}>{line}</li>)}</ul>
          <p className="mt-2 text-[11px] text-slate-400">Es solo una guía: su proyecto debe partir de algo que ustedes conozcan.</p>
        </details>
        {phase.key === 'plan'
          ? <PromptPanel brief={savedBrief} unsaved={hasChanges && Boolean(onSave)} onCopied={onPromptCopied} />
          : phase.key === 'share'
          ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
            <p className="font-bold text-slate-800">Para la muestra</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Muestren la app funcionando en celular (“Ver la app en grande”).</li>
              <li>Hablen todos: cada integrante cuenta una parte.</li>
              <li>Tengan a mano una parte del código que puedan explicar.</li>
              <li>Escuchen las preguntas: son ideas para la siguiente versión.</li>
            </ul>
          </div>
          : <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs leading-5 text-slate-500"><Lock className="mb-1 h-4 w-4 text-slate-400" />La petición para la IA aparece en el plan de la versión 1, armada con lo que ustedes decidan aquí.</div>}
      </aside>
    </div>}

    {active === 'build' && <div className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Su plan para la versión 1</p>
        <p className="mt-1 text-slate-800">{savedBrief.features.trim() || <em className="text-slate-400">Aún no lo han escrito (fase 3).</em>}</p>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Así sabrán que funciona</p>
        <p className="mt-1 text-slate-800">{savedBrief.successCheck.trim() || <em className="text-slate-400">Aún no lo han escrito (fase 3).</em>}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
        <p className="font-bold text-slate-800">En el taller</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5">
          <li><strong>Pedir:</strong> usen su petición o “Pedir un cambio a la IA”, una cosa a la vez.</li>
          <li><strong>Explicar antes de pegar:</strong> con “Explorar elementos” ubiquen dónde está cada punto de su plan.</li>
          <li><strong>Probar:</strong> hagan su prueba “si… entonces…” en computador y celular. Desde la v2, pidan a otro equipo que la use 5 minutos.</li>
          <li><strong>Guardar:</strong> cuenten qué intentaron, qué probaron y qué parte del código pueden explicar.</li>
        </ul>
      </div>
    </div>}
  </section>
}

function PromptPanel({ brief, unsaved, onCopied }: { brief: ConstruyeTeamBrief; unsaved: boolean; onCopied?: () => void }) {
  const generated = useMemo(() => initialPrompt(brief), [brief])
  const [text, setText] = useState(generated)
  const [edited, setEdited] = useState(false)
  const [copied, setCopied] = useState(false)
  // Si el plan cambia y el equipo no ha retocado la petición, se regenera; si la retocó, se
  // conserva su versión y se ofrece volver a la del plan.
  useEffect(() => { if (!edited) setText(generated) }, [generated, edited])

  if (!promptReady(brief)) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-xs leading-5 text-slate-500">
      <Lock className="mb-1 h-4 w-4 text-slate-400" />
      <p className="font-semibold text-slate-700">Su petición para la IA aparece aquí</p>
      <p>Cuando guarden qué problema resuelven, qué tendrá la versión 1 y cómo sabrán que funciona.</p>
    </div>
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopied?.()
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return <div className="rounded-2xl bg-[#152534] p-4 text-white">
    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-300">Nuestra petición para la IA</p>
    <p className="mt-1 text-xs leading-5 text-slate-300">Está armada con sus decisiones. Léanla y corríjanla: la IA propone, ustedes deciden qué usar.</p>
    <textarea value={text} onChange={event => { setText(event.target.value); setEdited(true) }} rows={10} aria-label="Petición para la IA" className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-[#0d1822] p-3 font-mono text-[11px] leading-5 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400" />
    {edited && <button type="button" onClick={() => { setEdited(false); setText(generated) }} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:underline"><RotateCcw className="h-3 w-3" /> Volver a la petición del plan</button>}
    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-400"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No incluyan nombres, documentos ni datos personales.</p>
    {unsaved && <p className="mt-2 rounded-lg bg-amber-300/15 px-2 py-1.5 text-[11px] text-amber-200">Guarden el plan para que la petición use sus últimos cambios.</p>}
    <button type="button" onClick={copy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Petición copiada' : 'Copiar para usarla en la IA'}</button>
  </div>
}

