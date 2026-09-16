import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Shuffle, Users, X } from 'lucide-react'
import { classroomApi } from '../../lib/api'

interface Student { id: string; name: string }
interface Pair { evaluator: string; target: string }
interface PeerDimension { id: string; label: string; peersPerStudent: number; pairs: Pair[] }
interface Preview { seed: string; students: Student[]; dimensions: PeerDimension[] }

export type PeerPlan = { mode: 'auto'; seed: string } | { mode: 'manual'; pairs: Array<Pair & { dimensionId: string }> }

/** Antes de publicar una coevaluación, el docente decide quién evalúa a quién: reparto automático
 * (al azar, pero cada estudiante da y recibe el mismo número) o manual, partiendo de la propuesta. */
export default function PeerAssignmentPanel({ activityId, busy, fail, onCancel, onPublish }: {
  activityId: string
  busy: boolean
  fail: (e: any, m: string) => void
  onCancel: () => void
  onPublish: (plan: PeerPlan) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [manual, setManual] = useState<Record<string, Pair[]>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await classroomApi.getFormativePeerPreview(activityId)
      setPreview(data)
      setManual(Object.fromEntries(data.dimensions.map((d: PeerDimension) => [d.id, d.pairs])))
    } catch (e) {
      fail(e, 'No se pudo preparar el reparto de la coevaluación')
    } finally {
      setLoading(false)
    }
  }, [activityId, fail])
  useEffect(() => { void load() }, [load])

  const names = useMemo(() => new Map((preview?.students ?? []).map(s => [s.id, s.name])), [preview])
  const shown = (d: PeerDimension) => (mode === 'auto' ? d.pairs : manual[d.id] ?? [])

  const warnings = useMemo(() => {
    if (!preview || mode === 'auto') return []
    const out: string[] = []
    for (const d of preview.dimensions) {
      const pairs = manual[d.id] ?? []
      if (!pairs.length) out.push(`"${d.label}" no tiene parejas.`)
      const sinEvaluar = preview.students.filter(s => !pairs.some(p => p.target === s.id))
      if (sinEvaluar.length) out.push(`En "${d.label}", nadie evalúa a: ${sinEvaluar.map(s => s.name).join(', ')}.`)
    }
    return out
  }, [preview, manual, mode])

  const addPair = (dimensionId: string, evaluator: string, target: string) => {
    if (!target || evaluator === target) return
    setManual(m => {
      const list = m[dimensionId] ?? []
      if (list.some(p => p.evaluator === evaluator && p.target === target)) return m
      return { ...m, [dimensionId]: [...list, { evaluator, target }] }
    })
  }
  const removePair = (dimensionId: string, evaluator: string, target: string) =>
    setManual(m => ({ ...m, [dimensionId]: (m[dimensionId] ?? []).filter(p => !(p.evaluator === evaluator && p.target === target)) }))

  const publish = () => {
    if (!preview) return
    if (mode === 'auto') onPublish({ mode: 'auto', seed: preview.seed })
    else onPublish({ mode: 'manual', pairs: preview.dimensions.flatMap(d => (manual[d.id] ?? []).map(p => ({ ...p, dimensionId: d.id }))) })
  }

  const canPublish = !!preview && preview.dimensions.every(d => shown(d).length > 0)

  return <div className="mt-4 space-y-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 font-bold text-slate-800"><Users className="h-4 w-4 text-teal-700" /> ¿Quién evalúa a quién?</p>
        <p className="text-xs text-slate-500">Revisa el reparto de la coevaluación antes de publicar. Los estudiantes solo ven a quién les toca evaluar.</p>
      </div>
      <button type="button" onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-1 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>

    {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Preparando el reparto…</p>}

    {preview && !loading && <>
      {preview.students.length < 2 && <p className="flex items-center gap-1.5 text-sm text-rose-700"><AlertCircle className="h-4 w-4" /> Se necesitan al menos dos estudiantes activos para la coevaluación.</p>}

      <div className="inline-flex overflow-hidden rounded-xl border border-teal-200 bg-white text-xs font-semibold" role="group" aria-label="Forma de repartir">
        <button type="button" aria-pressed={mode === 'auto'} onClick={() => setMode('auto')} className={`px-3 py-2 ${mode === 'auto' ? 'bg-teal-600 text-white' : 'text-teal-800 hover:bg-teal-50'}`}>Automático</button>
        <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')} className={`border-l border-teal-200 px-3 py-2 ${mode === 'manual' ? 'bg-teal-600 text-white' : 'text-teal-800 hover:bg-teal-50'}`}>Manual</button>
      </div>
      <p className="text-xs text-slate-600">{mode === 'auto'
        ? 'Reparto al azar pero equilibrado: cada estudiante evalúa y es evaluado por el mismo número de compañeros. Puedes volver a sortear.'
        : 'Parte de la propuesta automática: quita o agrega compañeros a cada estudiante.'}</p>
      {mode === 'auto' && <button type="button" disabled={loading} onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Shuffle className="h-3.5 w-3.5" /> Volver a sortear</button>}

      {preview.dimensions.map(d => {
        const pairs = shown(d)
        return <section key={d.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">{d.label} <span className="font-normal text-slate-500">· {d.peersPerStudent} compañero{d.peersPerStudent === 1 ? '' : 's'} por estudiante</span></p>
          <ul className="mt-2 max-h-80 space-y-1.5 overflow-auto">
            {preview.students.map(s => {
              const targets = pairs.filter(p => p.evaluator === s.id).map(p => p.target)
              const received = pairs.filter(p => p.target === s.id).length
              return <li key={s.id} className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-1.5 text-xs last:border-0">
                <span className="min-w-[140px] font-medium text-slate-700">{s.name}</span>
                <span className="text-slate-400">evalúa a</span>
                {targets.length === 0 && <span className="text-slate-400">nadie</span>}
                {targets.map(t => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-teal-800">
                  {names.get(t)}
                  {mode === 'manual' && <button type="button" onClick={() => removePair(d.id, s.id, t)} aria-label={`Quitar a ${names.get(t)}`} className="text-teal-600 hover:text-rose-700"><X className="h-3 w-3" /></button>}
                </span>)}
                {mode === 'manual' && <select value="" onChange={e => addPair(d.id, s.id, e.target.value)} aria-label={`Agregar compañero para ${s.name}`} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                  <option value="">+ Agregar</option>
                  {preview.students.filter(o => o.id !== s.id && !targets.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>}
                <span className={`ml-auto ${received ? 'text-slate-400' : 'font-semibold text-amber-700'}`}>lo evalúan {received}</span>
              </li>
            })}
          </ul>
        </section>
      })}

      {warnings.length > 0 && <ul className="space-y-0.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {warnings.map(w => <li key={w} className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}</li>)}
      </ul>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
        <button type="button" disabled={busy || !canPublish} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Publicar con este reparto</button>
      </div>
    </>}
  </div>
}
