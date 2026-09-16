import { CheckCircle2, Flag, Loader2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { isoToBogotaDateInput, todayBogotaInput } from '../../lib/datetime'
import type { ConstruyeJournalEntry, ConstruyeSessionNote } from '../../lib/api/construye'
import { SESSION_MET_LABEL, todaySessionNotes } from './journey'

type Met = 'yes' | 'partly' | 'no'

const fieldClass = 'w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300'

/** Rutina de cada sesión: una meta al empezar y una salida al terminar. Es el "latido" que le
 * dice al docente qué equipos avanzan y cuáles están atascados, sin revisar código. */
export default function SessionCard({ journal, onSave }: {
  journal: ConstruyeJournalEntry[]
  onSave: (note: ConstruyeSessionNote, summary: string) => Promise<boolean>
}) {
  const notes = todaySessionNotes(journal, todayBogotaInput(), iso => isoToBogotaDateInput(iso))
  const goalEntry = notes.find(entry => (entry.detail as ConstruyeSessionNote | undefined)?.kind === 'GOAL')
  const goal = goalEntry ? (goalEntry.detail as Extract<ConstruyeSessionNote, { kind: 'GOAL' }>) : null
  const exitEntry = goalEntry ? notes.find(entry => (entry.detail as ConstruyeSessionNote | undefined)?.kind === 'EXIT' && entry.createdAt >= goalEntry.createdAt) : undefined
  const exit = exitEntry ? (exitEntry.detail as Extract<ConstruyeSessionNote, { kind: 'EXIT' }>) : null

  const [draftGoal, setDraftGoal] = useState('')
  const [closing, setClosing] = useState(false)
  const [met, setMet] = useState<Met | null>(null)
  const [blocker, setBlocker] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (note: ConstruyeSessionNote, summary: string) => {
    setSaving(true)
    try {
      if (await onSave(note, summary)) { setDraftGoal(''); setClosing(false) }
    } finally {
      setSaving(false)
    }
  }

  return <section className="mt-4 rounded-[22px] border border-slate-200 bg-[#16293a] px-4 py-3 text-white sm:px-5">
    {!goal && <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 text-sm font-bold"><Flag className="h-4 w-4 text-amber-300" /> Meta de hoy</span>
      <input value={draftGoal} maxLength={300} onChange={event => setDraftGoal(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && draftGoal.trim()) void run({ kind: 'GOAL', goal: draftGoal.trim() }, `Meta de hoy: ${draftGoal.trim()}`) }} placeholder="En una frase: ¿qué queremos lograr en esta sesión?" className={`${fieldClass} min-w-[240px] flex-1`} />
      <button type="button" disabled={!draftGoal.trim() || saving} onClick={() => run({ kind: 'GOAL', goal: draftGoal.trim() }, `Meta de hoy: ${draftGoal.trim()}`)} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-200 disabled:opacity-50">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />} Fijar meta
      </button>
    </div>}

    {goal && !exit && !closing && <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm"><span className="inline-flex items-center gap-2 font-bold text-amber-300"><Flag className="h-4 w-4" /> Meta de hoy:</span> {goal.goal}</p>
      <button type="button" onClick={() => setClosing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"><LogOut className="h-3.5 w-3.5" /> Cerrar la sesión</button>
    </div>}

    {goal && !exit && closing && <div className="space-y-3">
      <p className="text-sm"><span className="font-bold text-amber-300">Salida · </span>{goal.goal}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">¿Cumplimos la meta?</span>
        {(Object.keys(SESSION_MET_LABEL) as Met[]).map(option => <button key={option} type="button" aria-pressed={met === option} onClick={() => setMet(option)} className={`rounded-lg px-3 py-1.5 font-semibold ${met === option ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 hover:bg-white/20'}`}>{SESSION_MET_LABEL[option]}</button>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={blocker} maxLength={400} onChange={event => setBlocker(event.target.value)} placeholder="¿Algo nos bloquea? (opcional)" className={fieldClass} />
        <input value={next} maxLength={400} onChange={event => setNext(event.target.value)} placeholder="¿Qué sigue la próxima vez? (opcional)" className={fieldClass} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setClosing(false)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancelar</button>
        <button type="button" disabled={!met || saving} onClick={() => met && run({ kind: 'EXIT', met, blocker: blocker.trim(), next: next.trim() }, `Salida de la sesión: meta ${SESSION_MET_LABEL[met].toLowerCase()}${blocker.trim() ? ` · bloqueo: ${blocker.trim()}` : ''}`)} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Guardar salida
        </button>
      </div>
    </div>}

    {goal && exit && <p className="flex flex-wrap items-center gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
      <span className="font-bold">Sesión cerrada.</span>
      <span className="text-slate-300">Meta: {goal.goal} · ¿Cumplida? {SESSION_MET_LABEL[exit.met]}{exit.next ? ` · Próxima vez: ${exit.next}` : ''}</span>
    </p>}
  </section>
}
