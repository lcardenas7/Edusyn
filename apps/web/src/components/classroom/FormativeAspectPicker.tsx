import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { ASPECTS } from './formativeAspects'

export interface ChosenAspect { id?: string; name: string }

/** El docente marca los aspectos que quiere evaluar (o escribe los suyos) y cuántas preguntas
 * lleva cada uno. El orden en que los marca es el orden del cuestionario. */
export default function FormativeAspectPicker({ value, onChange, perAspect, onPerAspect }: {
  value: ChosenAspect[]
  onChange: (next: ChosenAspect[]) => void
  perAspect: number
  onPerAspect: (n: number) => void
}) {
  const [custom, setCustom] = useState('')
  const isOn = (id: string) => value.some(a => a.id === id)
  const toggle = (id: string, name: string) => onChange(isOn(id) ? value.filter(a => a.id !== id) : [...value, { id, name }])
  const addCustom = () => {
    const name = custom.trim().slice(0, 80)
    if (!name || value.some(a => a.name.toLowerCase() === name.toLowerCase())) { setCustom(''); return }
    onChange([...value, { name }])
    setCustom('')
  }
  const customs = value.filter(a => !a.id)

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {ASPECTS.map(a => {
        const on = isOn(a.id)
        return <button key={a.id} type="button" aria-pressed={on} title={a.hint} onClick={() => toggle(a.id, a.name)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}>
          {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {a.name}
        </button>
      })}
      {customs.map(a => <span key={a.name} className="inline-flex items-center gap-1 rounded-full border border-teal-600 bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
        {a.name}
        <button type="button" onClick={() => onChange(value.filter(x => x !== a))} aria-label={`Quitar ${a.name}`}><X className="h-3.5 w-3.5" /></button>
      </span>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} placeholder="Otro aspecto (ej.: Uso del laboratorio)" className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-500" />
      <button type="button" onClick={addCustom} disabled={!custom.trim()} className="rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 disabled:opacity-50">Agregar aspecto</button>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <label className="flex items-center gap-2">Preguntas por aspecto
        <select value={perAspect} onChange={e => onPerAspect(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-sm">
          {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className={`text-xs font-semibold ${value.length ? 'text-teal-800' : 'text-slate-400'}`}>
        {value.length ? `${value.length} ${value.length === 1 ? 'aspecto' : 'aspectos'} · ${Math.min(value.length * perAspect, 30)} preguntas por cuestionario` : 'Marca al menos un aspecto'}
      </span>
    </div>
  </div>
}
