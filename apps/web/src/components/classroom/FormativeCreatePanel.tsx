import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Clipboard, Loader2, Plus, ShieldCheck, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react'
import { classroomApi } from '../../lib/api'
import { toast } from '../../lib/toast'
import {
  blankCriterion, blankDimension, blankDraft, blankLevels, buildRubricPrompt, draftProblems, evenWeights, parseRubricDraft,
  sanitizeDraft, weightSum, TYPE_NAMES,
  type Draft, type DraftCriterion, type DraftDimension, type DraftLevel, type EvaluatorType, type GradebookComponent, type OpenTerm,
} from './formativeDraft'

export type CreateMode = 'manual' | 'external' | 'internal'

const fieldClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

const MODE_TITLE: Record<CreateMode, string> = {
  manual: 'Crear la rúbrica a mano',
  external: 'Crear con una IA externa',
  internal: 'Crear con la IA de Edusyn',
}

/** Crear una evaluación formativa por uno de tres caminos. Los tres terminan en el mismo editor,
 * donde el docente revisa y ajusta todo antes de crear el borrador (que aún no se publica). */
export default function FormativeCreatePanel({ mode, classroomId, terms, components, scale, fail, onCancel, onCreated }: {
  mode: CreateMode
  classroomId: string
  terms: OpenTerm[]
  components: GradebookComponent[]
  scale: { min: number; max: number } | null
  fail: (e: any, m: string) => void
  onCancel: () => void
  onCreated: () => Promise<void>
}) {
  const min = scale?.min ?? 1
  const max = scale?.max ?? 5
  const [types, setTypes] = useState<Record<EvaluatorType, boolean>>({ SELF: true, PEER: true })
  const selectedTypes = (['SELF', 'PEER'] as EvaluatorType[]).filter(t => types[t])
  const [purpose, setPurpose] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [termId, setTermId] = useState('')
  const [busy, setBusy] = useState(false)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (!termId && terms.length) setTermId(terms[terms.length - 1].id) }, [terms, termId])

  const prompt = useMemo(() => buildRubricPrompt({ purpose, types: selectedTypes, minScore: scale?.min, maxScore: scale?.max }), [purpose, selectedTypes.join(), scale])

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.')
    }
  }

  const readPasted = () => {
    const result = parseRubricDraft(pasted)
    if ('error' in result) { setPasteError(result.error); return }
    setPasteError('')
    setDraft(result.draft)
  }

  const generate = async () => {
    if (!purpose.trim() || !selectedTypes.length) return
    setBusy(true)
    try {
      const { data } = await classroomApi.generateFormativeEvaluationAI({ classroomId, purpose: purpose.trim(), dimensions: selectedTypes.map(t => TYPE_NAMES[t]), minScore: scale?.min, maxScore: scale?.max })
      setDraft(sanitizeDraft(data))
    } catch (e) {
      fail(e, 'La IA no pudo generar el borrador')
    } finally {
      setBusy(false)
    }
  }

  const problems = draft ? draftProblems(draft, termId) : []

  const create = async () => {
    if (!draft || problems.length) return
    setBusy(true)
    try {
      await classroomApi.createFormativeEvaluationFromAIDraft({ ...draft, classroomId, academicTermId: termId })
      toast.success('Borrador creado', 'Revísalo en la lista y publícalo cuando esté listo.')
      await onCreated()
    } catch (e) {
      fail(e, 'No se pudo crear la evaluación')
    } finally {
      setBusy(false)
    }
  }

  const typePicker = <div className="flex flex-wrap gap-4 text-sm">
    <label className="flex items-center gap-2"><input type="checkbox" checked={types.SELF} onChange={e => setTypes(t => ({ ...t, SELF: e.target.checked }))} /><UserRound className="h-4 w-4 text-teal-700" /> Autoevaluación</label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={types.PEER} onChange={e => setTypes(t => ({ ...t, PEER: e.target.checked }))} /><Users className="h-4 w-4 text-teal-700" /> Coevaluación entre compañeros</label>
  </div>

  const purposeField = <label className="block text-sm font-semibold text-slate-700">¿Qué quieres que los estudiantes evalúen?
    <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} className={`${fieldClass} mt-1`} placeholder="Ej.: participación, responsabilidad y trabajo colaborativo durante el proyecto de ciencias." />
  </label>

  return <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold text-slate-800">{draft ? 'Revisa y ajusta la rúbrica' : MODE_TITLE[mode]}</h3>
      <button type="button" onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-1 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>

    {!draft && mode === 'manual' && <>
      <p className="text-sm text-slate-600">Elige qué tipo de evaluación quieres. Te damos una plantilla con niveles en la escala de tu institución ({min} a {max}) para que escribas tus propios criterios.</p>
      {typePicker}
      <button type="button" disabled={!selectedTypes.length} onClick={() => setDraft(blankDraft(selectedTypes, min, max))} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Empezar a escribir</button>
    </>}

    {!draft && mode === 'external' && <>
      {purposeField}
      {typePicker}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-[#0d1822] p-3 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">1. Copia esta petición y llévala a tu IA</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-200 [overflow-wrap:anywhere]">{prompt}</pre>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Solo lleva lo que escribiste arriba: sin nombres ni datos de estudiantes.</p>
          <button type="button" disabled={!purpose.trim() || !selectedTypes.length} onClick={copyPrompt} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:opacity-50">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? 'Copiada' : 'Copiar petición'}
          </button>
        </div>
        <div className="flex flex-col">
          <label className="block text-xs font-bold uppercase tracking-wider text-teal-800" htmlFor="formative-pasted">2. Pega aquí la respuesta de tu IA</label>
          <textarea id="formative-pasted" value={pasted} onChange={e => { setPasted(e.target.value); setPasteError('') }} rows={9} className={`${fieldClass} mt-2 flex-1 font-mono text-xs`} placeholder='{"title": "...", "dimensions": [...]}' />
          {pasteError && <p className="mt-1 flex items-start gap-1.5 text-xs text-rose-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {pasteError}</p>}
          <button type="button" disabled={!pasted.trim()} onClick={readPasted} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">3. Revisar la respuesta</button>
        </div>
      </div>
    </>}

    {!draft && mode === 'internal' && <>
      {purposeField}
      {typePicker}
      <p className="text-xs text-slate-500">La IA de Edusyn propone criterios y niveles en la escala de tu institución ({min} a {max}). Nada se publica hasta que tú lo revises.</p>
      <button type="button" disabled={busy || !purpose.trim() || !selectedTypes.length} onClick={generate} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? 'Generando…' : 'Generar borrador'}
      </button>
    </>}

    {draft && <DraftEditor draft={draft} setDraft={setDraft} terms={terms} termId={termId} setTermId={setTermId} min={min} max={max} purpose={purpose} scale={scale} />}

    {draft && <div className="space-y-2">
      {problems.length > 0 && <ul className="space-y-0.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {problems.map(p => <li key={p} className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p}</li>)}
      </ul>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Volver a empezar</button>
        <button type="button" disabled={busy || problems.length > 0} onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear como borrador</button>
      </div>
    </div>}
  </div>
}

function DraftEditor({ draft, setDraft, terms, termId, setTermId, min, max, purpose, scale }: {
  draft: Draft
  setDraft: (updater: (d: Draft | null) => Draft | null) => void
  terms: OpenTerm[]
  termId: string
  setTermId: (id: string) => void
  min: number
  max: number
  purpose: string
  scale: { min: number; max: number } | null
}) {
  const [aiFor, setAiFor] = useState<number | null>(null)
  const [copiedFrom, setCopiedFrom] = useState<Record<number, string>>({})
  const update = (fn: (d: Draft) => Draft) => setDraft(d => (d ? fn(d) : d))
  const setDimension = (di: number, patch: Partial<DraftDimension>) => update(d => ({ ...d, dimensions: d.dimensions.map((x, i) => i === di ? { ...x, ...patch } : x) }))
  const setCriteria = (di: number, fn: (c: DraftCriterion[]) => DraftCriterion[]) => update(d => ({ ...d, dimensions: d.dimensions.map((x, i) => i === di ? { ...x, criteria: fn(x.criteria) } : x) }))
  const setCriterion = (di: number, ci: number, patch: Partial<DraftCriterion>) => setCriteria(di, cs => cs.map((c, j) => j === ci ? { ...c, ...patch } : c))
  const setLevel = (di: number, ci: number, li: number, patch: Partial<DraftLevel>) => setCriteria(di, cs => cs.map((c, j) => j !== ci ? c : { ...c, levels: c.levels.map((l, k) => k === li ? { ...l, ...patch } : l) }))
  // Una dimensión nueva no arranca en blanco si ya hay otra: copia sus criterios para ajustarlos
  // (o se pide a la IA externa con el botón de la propia dimensión).
  const addDimension = (type: EvaluatorType) => {
    const base = draft.dimensions[0]
    const fresh = blankDimension(type, min, max)
    const dimension = base ? { ...fresh, criteria: base.criteria.map(c => ({ ...c, levels: c.levels.map(l => ({ ...l })) })) } : fresh
    if (base) setCopiedFrom(x => ({ ...x, [draft.dimensions.length]: base.label || 'la primera dimensión' }))
    update(d => ({ ...d, dimensions: [...d.dimensions, dimension] }))
  }
  const replaceFromAI = (di: number, incoming: DraftDimension) => {
    setDimension(di, { criteria: incoming.criteria, peersPerStudent: draft.dimensions[di].evaluatorType === 'PEER' ? (incoming.peersPerStudent ?? draft.dimensions[di].peersPerStudent) : null })
    setCopiedFrom(x => { const next = { ...x }; delete next[di]; return next })
    setAiFor(null)
  }
  const spreadWeights = (di: number) => setCriteria(di, cs => { const w = evenWeights(cs.length); return cs.map((c, i) => ({ ...c, weight: w[i] })) })

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-semibold text-slate-600">Título<input value={draft.title} onChange={e => update(d => ({ ...d, title: e.target.value }))} className={`${fieldClass} mt-1`} placeholder="Ej.: Trabajo en equipo — proyecto de ciencias" /></label>
      <label className="block text-xs font-semibold text-slate-600">Período
        <select value={termId} onChange={e => setTermId(e.target.value)} className={`${fieldClass} mt-1`}>
          <option value="">Selecciona un período abierto</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Instrucciones para los estudiantes<textarea value={draft.description} onChange={e => update(d => ({ ...d, description: e.target.value }))} rows={2} className={`${fieldClass} mt-1`} placeholder="Ej.: piensa con honestidad en lo que hiciste durante el proyecto." /></label>
    </div>
    {!terms.length && <p className="flex items-center gap-1.5 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> No hay períodos abiertos: no se puede crear la evaluación.</p>}

    {draft.dimensions.map((d, di) => {
      const sum = weightSum(d)
      return <section key={di} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[180px] flex-1 text-xs font-semibold text-slate-600">Dimensión<input value={d.label} onChange={e => setDimension(di, { label: e.target.value })} className={`${fieldClass} mt-1`} /></label>
          <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">{TYPE_NAMES[d.evaluatorType]}</span>
          {d.evaluatorType === 'PEER' && <label className="block text-xs font-semibold text-slate-600">Compañeros por estudiante<input type="number" min={1} max={10} value={d.peersPerStudent ?? 2} onChange={e => setDimension(di, { peersPerStudent: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className={`${fieldClass} mt-1 w-24`} /></label>}
          <button type="button" onClick={() => setAiFor(aiFor === di ? null : di)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Traer esta dimensión de una IA externa</button>
          <button type="button" onClick={() => { setCopiedFrom({}); setAiFor(null); update(x => ({ ...x, dimensions: x.dimensions.filter((_, i) => i !== di) })) }} disabled={draft.dimensions.length === 1} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Quitar dimensión</button>
        </div>

        {copiedFrom[di] && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Copiamos los criterios de «{copiedFrom[di]}». Ajústalos para que {d.evaluatorType === 'PEER' ? 'un compañero pueda observarlos' : 'el estudiante los piense sobre sí mismo'}, o tráelos de una IA externa.</p>}
        {aiFor === di && <DimensionFromAI dimension={d} purpose={purpose || draft.description || draft.title} scale={scale} onUse={incoming => replaceFromAI(di, incoming)} onClose={() => setAiFor(null)} />}
        <div className="mt-3 space-y-3">
          {d.criteria.map((c, ci) => <div key={ci} className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={c.name} onChange={e => setCriterion(di, ci, { name: e.target.value })} className={`${fieldClass} min-w-[160px] flex-1 font-semibold`} placeholder={`Criterio ${ci + 1} (ej.: Responsabilidad)`} aria-label="Criterio" />
              <label className="flex items-center gap-1 text-xs text-slate-600"><input type="number" min={0} max={100} value={c.weight} onChange={e => setCriterion(di, ci, { weight: Number(e.target.value) || 0 })} className={`${fieldClass} w-20`} aria-label="Peso" /> %</label>
              <button type="button" onClick={() => setCriteria(di, cs => cs.filter((_, j) => j !== ci))} disabled={d.criteria.length === 1} aria-label="Quitar criterio" className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </div>
            <input value={c.description} onChange={e => setCriterion(di, ci, { description: e.target.value })} className={`${fieldClass} mt-2 text-xs`} placeholder="Qué se observa (opcional)" aria-label="Descripción del criterio" />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {c.levels.map((l, li) => <div key={li} className="rounded-md bg-white p-2">
                <div className="flex gap-2">
                  <input type="number" step="0.1" value={Number.isFinite(l.score) ? l.score : ''} onChange={e => setLevel(di, ci, li, { score: e.target.value === '' ? NaN : Number(e.target.value) })} className={`${fieldClass} w-20 text-xs`} aria-label="Puntaje del nivel" />
                  <input value={l.label} onChange={e => setLevel(di, ci, li, { label: e.target.value })} className={`${fieldClass} flex-1 text-xs font-semibold`} placeholder="Nombre del nivel" aria-label="Nombre del nivel" />
                  <button type="button" onClick={() => setCriterion(di, ci, { levels: c.levels.filter((_, k) => k !== li) })} disabled={c.levels.length <= 2} aria-label="Quitar nivel" className="rounded-md p-1 text-slate-400 hover:text-rose-700 disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                </div>
                <input value={l.description} onChange={e => setLevel(di, ci, li, { description: e.target.value })} className={`${fieldClass} mt-1 text-xs`} placeholder="Cómo se ve este nivel (opcional)" aria-label="Descripción del nivel" />
              </div>)}
            </div>
            {c.levels.length < 7 && <button type="button" onClick={() => setCriterion(di, ci, { levels: [...c.levels, { label: '', description: '', score: max }] })} className="mt-2 text-xs font-semibold text-teal-700 hover:underline">+ Agregar nivel</button>}
          </div>)}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setCriteria(di, cs => [...cs, blankCriterion(min, max, 0)])} disabled={d.criteria.length >= 8} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Agregar criterio</button>
          <button type="button" onClick={() => spreadWeights(di)} className="text-xs font-semibold text-slate-600 hover:underline">Repartir pesos por igual</button>
          <span className={`text-xs font-semibold ${Math.abs(sum - 100) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>Los pesos suman {sum}%{Math.abs(sum - 100) < 0.01 ? '' : ' — deben sumar 100%'}</span>
        </div>
      </section>
    })}

    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => addDimension('SELF')} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /> Agregar autoevaluación</button>
      <button type="button" onClick={() => addDimension('PEER')} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /> Agregar coevaluación</button>
    </div>
    <p className="text-[11px] text-slate-400">Los niveles se muestran al estudiante en este orden. Escala de tu institución: {min} a {max}. {blankLevels(min, max).length} niveles por defecto.</p>
  </div>
}

/** Pide a una IA externa solo una dimensión (p. ej. la coevaluación que se agregó después) y
 * reemplaza sus criterios con la respuesta pegada. */
function DimensionFromAI({ dimension, purpose, scale, onUse, onClose }: {
  dimension: DraftDimension
  purpose: string
  scale: { min: number; max: number } | null
  onUse: (incoming: DraftDimension) => void
  onClose: () => void
}) {
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const prompt = useMemo(() => buildRubricPrompt({ purpose: purpose || dimension.label, types: [dimension.evaluatorType], minScore: scale?.min, maxScore: scale?.max }), [purpose, dimension.label, dimension.evaluatorType, scale])
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.') }
  }
  const use = () => {
    const result = parseRubricDraft(pasted)
    if ('error' in result) { setError(result.error); return }
    const match = result.draft.dimensions.find(x => x.evaluatorType === dimension.evaluatorType) ?? result.draft.dimensions[0]
    onUse(match)
  }
  return <div className="mt-3 grid gap-3 rounded-lg border border-teal-200 bg-teal-50/40 p-3 lg:grid-cols-2">
    <div className="rounded-lg bg-[#0d1822] p-3 text-white">
      <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">1. Petición para «{dimension.label}»</p>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-200 [overflow-wrap:anywhere]">{prompt}</pre>
      <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300">{copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? 'Copiada' : 'Copiar petición'}</button>
    </div>
    <div className="flex flex-col">
      <label className="text-[11px] font-bold uppercase tracking-wider text-teal-800">2. Pega la respuesta</label>
      <textarea value={pasted} onChange={e => { setPasted(e.target.value); setError('') }} rows={6} className={`${fieldClass} mt-1 flex-1 font-mono text-xs`} />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Cerrar</button>
        <button type="button" disabled={!pasted.trim()} onClick={use} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Usar estos criterios</button>
      </div>
    </div>
  </div>
}
