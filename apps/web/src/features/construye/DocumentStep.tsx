import { ArrowLeft, ArrowRight, Check, Hammer, Lightbulb, Megaphone, Rocket, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { ConstruyeTeamBrief } from '../../lib/api/construye'
import { PHASES, phaseConfig } from './briefPhases'
import { DOCUMENT_PHASES, phaseState, promptReady, type BriefPhaseKey, type JourneyPhaseState } from './journey'

const NAV: { key: BriefPhaseKey; title: string; icon: typeof Search; tone: string }[] = [
  { key: 'problem', title: 'El problema', icon: Search, tone: 'border-orange-400 text-orange-700' },
  { key: 'solution', title: 'La solución', icon: Lightbulb, tone: 'border-amber-400 text-amber-700' },
  { key: 'plan', title: 'Plan de la versión 1', icon: Rocket, tone: 'border-cyan-500 text-cyan-700' },
]

const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100'

export const STATE_TEXT: Record<JourneyPhaseState, string> = { pending: 'Sin empezar', started: 'En curso', done: 'Lista' }

/** Documentar la idea antes de construir: a la izquierda las etapas (como las categorías de un
 * editor por bloques), a la derecha una sola etapa a la vez. Todo se guarda solo. */
export default function DocumentStep({ brief, onChange, initialPhase, onContinue }: {
  brief: ConstruyeTeamBrief
  onChange: (field: keyof ConstruyeTeamBrief, value: string) => void
  initialPhase: BriefPhaseKey
  onContinue: () => void
}) {
  const [active, setActive] = useState<BriefPhaseKey>(initialPhase)
  const [example, setExample] = useState(false)
  const phase = phaseConfig(active)
  const index = DOCUMENT_PHASES.indexOf(active as (typeof DOCUMENT_PHASES)[number])
  const prev = index > 0 ? DOCUMENT_PHASES[index - 1] : null
  const next = index >= 0 && index < DOCUMENT_PHASES.length - 1 ? DOCUMENT_PHASES[index + 1] : null
  const ready = promptReady(brief)
  const go = (key: BriefPhaseKey) => { setActive(key); setExample(false) }

  return <div className="grid min-h-full lg:grid-cols-[260px_minmax(0,1fr)]">
    <nav aria-label="Etapas para documentar" className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
      <p className="px-4 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[.14em] text-slate-400">Documentar la idea</p>
      <ul className="lg:pb-4">
        {NAV.map((item, i) => {
          const state = phaseState(item.key, brief)
          const Icon = item.icon
          const current = active === item.key
          return <li key={item.key}>
            <button type="button" onClick={() => go(item.key)} aria-current={current ? 'step' : undefined}
              className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left transition ${current ? `${item.tone} bg-slate-50` : 'border-transparent text-slate-700 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{i + 1}. {item.title}</span>
                <span className={`block text-[11px] ${state === 'done' ? 'text-emerald-700' : state === 'started' ? 'text-amber-700' : 'text-slate-400'}`}>{STATE_TEXT[state]}</span>
              </span>
              {state === 'done' && <Check className="h-4 w-4 text-emerald-600" aria-label="Lista" />}
            </button>
          </li>
        })}
      </ul>
      <div className="hidden border-t border-slate-100 p-4 text-xs leading-5 text-slate-500 lg:block">
        <p className="flex items-center gap-1.5 font-semibold text-slate-700"><Hammer className="h-3.5 w-3.5" /> Después</p>
        <p className="mt-1">Con el plan listo preparan la petición para la IA (o la omiten) y pasan al taller de código.</p>
        <p className="mt-2 flex items-center gap-1.5 font-semibold text-slate-700"><Megaphone className="h-3.5 w-3.5" /> Al final</p>
        <p className="mt-1">Presentan lo que construyeron y lo que aprendieron.</p>
      </div>
    </nav>

    <section className="min-w-0 bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-700">Etapa {index + 1} de {DOCUMENT_PHASES.length} · {phase.title}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{phase.question}</h2>
        <p className="mt-1 text-sm text-slate-600">{phase.intro}</p>
        <button type="button" onClick={() => setExample(v => !v)} aria-expanded={example} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline">
          <Lightbulb className="h-3.5 w-3.5" /> {example ? 'Ocultar el ejemplo' : 'Ver un ejemplo de otro equipo'}
        </button>
        {example && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
          <p className="font-semibold">{phase.example.title}</p>
          <ul className="mt-1 space-y-1">{phase.example.lines.map(line => <li key={line}>{line}</li>)}</ul>
          <p className="mt-1 text-amber-800/80">Es solo una guía: su proyecto parte de algo que ustedes conocen.</p>
        </div>}

        <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          {phase.fields.map(item => <label key={item.field} className="block">
            <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-800">{item.label}{item.optional && <span className="text-[11px] font-normal text-slate-400">opcional</span>}</span>
            <span className="mb-1.5 block text-xs text-slate-500">{item.hint}</span>
            <textarea value={brief[item.field]} onChange={event => onChange(item.field, event.target.value)} rows={item.rows ?? 2} className={`${fieldClass} resize-y`} />
          </label>)}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {prev
            ? <button type="button" onClick={() => go(prev)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"><ArrowLeft className="h-4 w-4" /> {phaseConfig(prev).title}</button>
            : <span />}
          {next
            ? <button type="button" onClick={() => go(next)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Siguiente: {phaseConfig(next).title} <ArrowRight className="h-4 w-4" /></button>
            : <button type="button" onClick={onContinue} disabled={!ready} title={ready ? undefined : 'Completen qué problema resuelven, qué tendrá la versión 1 y cómo sabrán que funciona'} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              <Sparkles className="h-4 w-4" /> Continuar: preparar la petición
            </button>}
        </div>
        {!next && !ready && <p className="mt-2 text-right text-xs text-slate-500">Para continuar falta: {missingForPrompt(brief).join(', ')}.</p>}
      </div>
    </section>
  </div>
}

export function missingForPrompt(brief: ConstruyeTeamBrief): string[] {
  const out: string[] = []
  if (phaseState('problem', brief) !== 'done') out.push('el problema (qué ocurre y a quién afecta)')
  if (!brief.features.trim()) out.push('qué tendrá la versión 1')
  if (!brief.successCheck.trim()) out.push('cómo sabrán que funciona')
  return out
}

/** Presentar: la misma forma, con la etapa de compartir y las pautas para la muestra. */
export function ShareStep({ brief, onChange }: { brief: ConstruyeTeamBrief; onChange: (field: keyof ConstruyeTeamBrief, value: string) => void }) {
  const phase = PHASES.find(p => p.key === 'share')!
  return <section className="min-h-full bg-slate-50 px-4 py-5 sm:px-8 sm:py-7">
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-cyan-700">Presentar</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{phase.question}</h2>
        <p className="mt-1 text-sm text-slate-600">{phase.intro}</p>
        <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          {phase.fields.map(item => <label key={item.field} className="block">
            <span className="text-sm font-semibold text-slate-800">{item.label}</span>
            <span className="mb-1.5 block text-xs text-slate-500">{item.hint}</span>
            <textarea value={brief[item.field]} onChange={event => onChange(item.field, event.target.value)} rows={item.rows ?? 3} className={`${fieldClass} resize-y`} />
          </label>)}
        </div>
      </div>
      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
        <p className="font-bold text-slate-800">Para la muestra</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>Muestren la app funcionando en celular (botón «Ver en grande»).</li>
          <li>Hablen todos: cada integrante cuenta una parte.</li>
          <li>Tengan a mano una parte del código que puedan explicar.</li>
          <li>Escuchen las preguntas: son ideas para la siguiente versión.</li>
        </ul>
      </aside>
    </div>
  </section>
}
