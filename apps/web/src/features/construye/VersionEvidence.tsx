import { AlertTriangle, CheckCircle2, Cloud, Eye, History, Loader2, Lock, X } from 'lucide-react'
import { useState } from 'react'
import { formatBogota } from '../../lib/datetime'
import type { ConstruyeVersionEvidence } from '../../lib/api/construye'
import { EMPTY_EVIDENCE, evidenceReady, type VersionEvidenceInput } from './journey'

export interface SavedVersionSummary {
  number: number
  label: string | null
  createdAt: string
  evidence?: ConstruyeVersionEvidence
}

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/** Guardar una versión es dejar evidencia: qué intentaron, qué probaron y qué aprendieron.
 * Lo que cambió se calcula solo. Si es la primera versión y el equipo aún no tiene plan, se
 * explica qué falta antes de intentar (el servidor igual lo verifica). */
export function SaveVersionPanel({ nextNumber, changedFiles, untested, saving, blockedBy, onApplyFirst, onConfirm, onCancel }: {
  nextNumber: number
  changedFiles: string[]
  untested: boolean
  saving: boolean
  /** Lo que falta para poder guardar la primera versión; vacío si se puede guardar. */
  blockedBy: string[]
  onApplyFirst: () => void
  onConfirm: (evidence: VersionEvidenceInput) => void
  onCancel: () => void
}) {
  const [evidence, setEvidence] = useState<VersionEvidenceInput>(EMPTY_EVIDENCE)
  const set = (key: keyof VersionEvidenceInput, value: string) => setEvidence(current => ({ ...current, [key]: value }))
  const valid = evidenceReady(evidence)
  const blocked = blockedBy.length > 0

  return <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Cloud className="h-4 w-4" /></span>
        <div>
          <p className="font-bold text-slate-900">Guardar la versión v{nextNumber} como evidencia</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Se guardan los tres archivos tal como están en el editor. Su docente verá la versión junto con lo que cuenten aquí.</p>
        </div>
      </div>
      <button type="button" onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
    </div>

    {blocked && <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
      <div>
        <p className="font-semibold">Antes de la primera versión, completen su recorrido:</p>
        <ul className="mt-1 list-disc pl-4">{blockedBy.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="mt-1 text-slate-500">Pueden seguir editando y probando mientras tanto. Si su docente lo considera, puede habilitarles guardar sin completarlo.</p>
      </div>
    </div>}

    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-500">{nextNumber === 1 ? 'Archivos de esta primera versión:' : 'Qué cambió desde la versión anterior:'}</span>
      {changedFiles.length
        ? changedFiles.map(file => <span key={file} className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{file}</span>)
        : <span className="text-slate-400">nada</span>}
    </div>

    {untested && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Hay cambios que todavía no probaron en el preview.</span>
      <button type="button" onClick={onApplyFirst} className="inline-flex items-center gap-1 rounded-lg bg-amber-900 px-2.5 py-1 font-semibold text-white hover:bg-amber-950"><Eye className="h-3 w-3" /> Aplicar y probar primero</button>
    </div>}

    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="block text-xs font-semibold text-slate-700">Qué intentamos
        <input value={evidence.attempted} maxLength={120} onChange={event => set('attempted', event.target.value)} placeholder="Ej.: que el botón agregue la tarea" className={fieldClass} autoFocus />
      </label>
      <label className="block text-xs font-semibold text-slate-700">Qué probamos y qué pasó
        <input value={evidence.tested} maxLength={600} onChange={event => set('tested', event.target.value)} placeholder="Ej.: escribimos una tarea y apareció" className={fieldClass} />
      </label>
      <label className="block text-xs font-semibold text-slate-700">Una parte del código que podemos explicar
        <input value={evidence.explained} maxLength={800} onChange={event => set('explained', event.target.value)} placeholder="Ej.: en app.js, el addEventListener del formulario crea la tarjeta" className={fieldClass} />
        <span className="mt-0.5 block text-[11px] font-normal text-slate-400">Explicar antes de pegar: “Explorar elementos” les ayuda a ubicarla.</span>
      </label>
      <label className="block text-xs font-semibold text-slate-700">Qué aprendimos o mejoraríamos <span className="font-normal text-slate-400">(opcional)</span>
        <input value={evidence.learned} maxLength={600} onChange={event => set('learned', event.target.value)} placeholder="Ej.: falta poder borrar una tarea" className={fieldClass} />
      </label>
      {nextNumber > 1 && <label className="block text-xs font-semibold text-slate-700 md:col-span-2">Qué nos dijo otro equipo al probarla <span className="font-normal text-slate-400">(opcional)</span>
        <input value={evidence.peerFeedback} maxLength={800} onChange={event => set('peerFeedback', event.target.value)} placeholder="Me gustó… · Me confundió… · Les sugiero…" className={fieldClass} />
      </label>}
    </div>
    <p className="mt-1 text-[11px] text-slate-400">¿La probaron en Computador y en Celular?</p>

    <div className="mt-3 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
      <button type="button" disabled={!valid || saving || blocked} onClick={() => onConfirm({ attempted: evidence.attempted.trim(), tested: evidence.tested.trim(), learned: evidence.learned.trim(), explained: evidence.explained.trim(), peerFeedback: evidence.peerFeedback.trim() })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />} Guardar v{nextNumber}
      </button>
    </div>
  </div>
}

/** Historial visible de lo que el equipo ya dejó como evidencia. */
export function VersionHistory({ versions, current }: { versions: SavedVersionSummary[]; current: boolean }) {
  const [showAll, setShowAll] = useState(false)
  if (!versions.length) {
    return <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
      <History className="h-4 w-4" /> Aún no han guardado versiones. Cuando la app haga lo de su plan, guárdenla y cuenten qué intentaron y qué probaron.
    </div>
  }
  const visible = showAll ? versions : versions.slice(0, 3)
  return <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-emerald-600" /> Evidencias guardadas</p>
      {current
        ? <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> El editor coincide con v{versions[0].number}</span>
        : <span className="text-[11px] font-semibold text-amber-700">Hay cambios sin guardar desde v{versions[0].number}</span>}
    </div>
    <ol className="space-y-2">
      {visible.map(version => <li key={version.number} className="text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-800">v{version.number}</span>
          <span className="text-slate-400">{formatBogota(version.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          <span className="font-medium text-slate-700">{version.evidence?.attempted || version.label || <em className="font-normal text-slate-400">Sin descripción</em>}</span>
        </div>
        {version.evidence && <div className="ml-9 mt-0.5 space-y-0.5 text-slate-500">
          <p><span className="font-semibold text-slate-600">Probamos:</span> {version.evidence.tested}</p>
          {version.evidence.explained && <p><span className="font-semibold text-slate-600">Sabemos explicar:</span> {version.evidence.explained}</p>}
          {version.evidence.peerFeedback && <p><span className="font-semibold text-slate-600">Otro equipo dijo:</span> {version.evidence.peerFeedback}</p>}
          {version.evidence.learned && <p><span className="font-semibold text-slate-600">Aprendimos:</span> {version.evidence.learned}</p>}
        </div>}
      </li>)}
    </ol>
    {versions.length > 3 && <button type="button" onClick={() => setShowAll(v => !v)} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">{showAll ? 'Ver menos' : `Ver las ${versions.length}`}</button>}
  </div>
}
