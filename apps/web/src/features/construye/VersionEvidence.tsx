import { AlertTriangle, CheckCircle2, Cloud, Eye, History, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { formatBogota } from '../../lib/datetime'

export interface SavedVersionSummary {
  number: number
  label: string | null
  createdAt: string
}

export const VERSION_NOTE_MAX = 120
const VERSION_NOTE_MIN = 5

/** Paso previo a guardar: el equipo ve qué se guarda, quién lo verá, y deja escrito qué
 * lograron. Guardar sin esa frase no deja evidencia útil para el docente. */
export function SaveVersionPanel({ nextNumber, changedFiles, untested, saving, onApplyFirst, onConfirm, onCancel }: {
  nextNumber: number
  /** Archivos que cambiaron frente a la última versión guardada (todos si es la primera). */
  changedFiles: string[]
  /** Hay cambios en el editor que el preview todavía no muestra. */
  untested: boolean
  saving: boolean
  onApplyFirst: () => void
  onConfirm: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const trimmed = note.trim()
  const valid = trimmed.length >= VERSION_NOTE_MIN

  return <div className="mb-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Cloud className="h-4 w-4" /></span>
        <div>
          <p className="font-bold text-slate-900">Guardar la versión v{nextNumber} como evidencia</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Se guardan los tres archivos tal como están en el editor. Su docente verá esta versión en su panel, con la fecha y la descripción que escriban aquí.</p>
        </div>
      </div>
      <button type="button" onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-500">Cambió desde la versión anterior:</span>
      {changedFiles.length
        ? changedFiles.map(file => <span key={file} className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{file}</span>)
        : <span className="text-slate-400">nada</span>}
    </div>

    {untested && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Hay cambios que todavía no probaron en el preview.</span>
      <button type="button" onClick={onApplyFirst} className="inline-flex items-center gap-1 rounded-lg bg-amber-900 px-2.5 py-1 font-semibold text-white hover:bg-amber-950"><Eye className="h-3 w-3" /> Aplicar y probar primero</button>
    </div>}

    <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="crea-version-note">¿Qué lograron o cambiaron en esta versión?</label>
    <input
      id="crea-version-note"
      value={note}
      onChange={event => setNote(event.target.value.slice(0, VERSION_NOTE_MAX))}
      onKeyDown={event => { if (event.key === 'Enter' && valid && !saving) onConfirm(trimmed) }}
      placeholder="Ej.: el botón Agregar tarea ya crea la tarjeta"
      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      autoFocus
    />
    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
      <span>Antes de guardar: ¿la probaron en Computador y en Celular?</span>
      <span>{note.length}/{VERSION_NOTE_MAX}</span>
    </div>

    <div className="mt-3 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
      <button type="button" disabled={!valid || saving} onClick={() => onConfirm(trimmed)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
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
      <History className="h-4 w-4" /> Aún no han guardado evidencias. Cuando la app funcione, guarden una versión y cuenten qué lograron.
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
    <ol className="space-y-1.5">
      {visible.map(version => <li key={version.number} className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-800">v{version.number}</span>
        <span className="text-slate-400">{formatBogota(version.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-slate-700">{version.label || <em className="text-slate-400">Sin descripción</em>}</span>
      </li>)}
    </ol>
    {versions.length > 3 && <button type="button" onClick={() => setShowAll(v => !v)} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">{showAll ? 'Ver menos' : `Ver las ${versions.length}`}</button>}
  </div>
}
