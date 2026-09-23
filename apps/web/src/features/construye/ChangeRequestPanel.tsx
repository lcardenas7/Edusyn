import { Check, Clipboard, ShieldCheck, Wand2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ConstruyeTeamBrief } from '../../lib/api/construye'
import { changePrompt, changeRequestReady, EMPTY_CHANGE_REQUEST, EMPTY_BRIEF, type ChangeRequest, type ProjectKind } from './journey'
import type { PreviewProject } from './protocol'

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100'

const FIELDS: { key: keyof ChangeRequest; label: string; placeholder: string; optional?: boolean }[] = [
  { key: 'change', label: '¿Qué quieren cambiar o agregar?', placeholder: 'Ej.: un botón para borrar una tarea' },
  { key: 'reason', label: '¿Por qué?', placeholder: 'Ej.: a veces escribimos mal y no se puede quitar', optional: true },
  { key: 'keep', label: '¿Qué debe seguir igual?', placeholder: 'Ej.: el formulario y los colores', optional: true },
  { key: 'check', label: '¿Cómo sabrán que salió bien?', placeholder: 'Ej.: al pulsar Borrar, la tarea desaparece y el contador baja' },
]

/** Ayuda a formular una petición concreta a la IA externa en vez de "hazme…". Nada se envía
 * desde Edusyn: el equipo lee la petición y decide si la copia. */
export default function ChangeRequestPanel({ brief, project, kind = 'WEB', onCopied, onClose }: {
  brief?: ConstruyeTeamBrief
  /** Página web o app de celular: la petición lo dice y conserva el formato. */
  kind?: ProjectKind
  project: PreviewProject
  onCopied?: (request: ChangeRequest) => void
  onClose: () => void
}) {
  const [request, setRequest] = useState<ChangeRequest>(EMPTY_CHANGE_REQUEST)
  const [includeCode, setIncludeCode] = useState(true)
  const [copied, setCopied] = useState(false)
  const ready = changeRequestReady(request)
  const prompt = useMemo(() => changePrompt(request, brief ?? EMPTY_BRIEF, includeCode ? project : null, kind), [request, brief, includeCode, project, kind])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      onCopied?.(request)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return <div className="mb-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Wand2 className="h-4 w-4" /></span>
        <div>
          <p className="font-bold text-slate-900">Pedir un cambio a la IA</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Una buena petición dice qué quieren, por qué, qué no debe romperse y cómo lo van a comprobar.</p>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
    </div>
    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(field => <label key={field.key} className="block text-xs font-semibold text-slate-700">
          {field.label}{field.optional && <span className="font-normal text-slate-400"> (opcional)</span>}
          <textarea rows={2} value={request[field.key]} onChange={event => setRequest(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className={`${fieldClass} resize-y`} />
        </label>)}
        <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
          <input type="checkbox" checked={includeCode} onChange={event => setIncludeCode(event.target.checked)} />
          Incluir nuestro código actual (así la IA sabe de qué parte)
        </label>
      </div>
      <div className="flex flex-col">
        {ready
          ? <pre className="max-h-64 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-[#0d1822] p-3 text-[11px] leading-5 text-slate-200">{prompt}</pre>
          : <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Escriban qué quieren cambiar y cómo sabrán que salió bien para ver la petición.</div>}
        {copied && <p className="mt-2 rounded-lg bg-violet-50 px-2 py-1.5 text-[11px] text-violet-800">Cuando la IA responda: antes de pegar, ubiquen qué parte de su código cambia y prueben lo que escribieron en “¿cómo sabrán que salió bien?”.</p>}
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Revisen que no haya nombres ni datos personales antes de copiarla.</p>
        <button type="button" disabled={!ready} onClick={copy} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied ? 'Petición copiada' : 'Copiar petición'}
        </button>
      </div>
    </div>
  </div>
}
