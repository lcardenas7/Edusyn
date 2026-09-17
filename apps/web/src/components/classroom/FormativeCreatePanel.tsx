import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronUp, Clipboard, Eye, Loader2, Plus, ShieldCheck, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react'
import { classroomApi } from '../../lib/api'
import { toast } from '../../lib/toast'
import {
  blankCriterion, blankDimension, blankDraft, buildRubricPrompt, draftProblems, evenWeights, hasEvenWeights, parseRubricDraft,
  sanitizeDraft, starterFrom, weightSum, PERSON_HINT, TYPE_NAMES,
  type Draft, type DraftCriterion, type DraftDimension, type DraftLevel, type EvaluatorType, type GradebookComponent, type OpenTerm,
} from './formativeDraft'
import { DimensionPreview } from './FormativeRubricPreview'

export type CreateMode = 'manual' | 'external' | 'internal'

/** Un borrador ya guardado que se abre para editarlo. */
export interface EditingDraft { id: string; draft: Draft; termId: string }

const fieldClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

const MODE_TITLE: Record<CreateMode, string> = {
  manual: 'Crear la rúbrica a mano',
  external: 'Crear con una IA externa',
  internal: 'Crear con la IA de Edusyn',
}

const TYPE_ICON: Record<EvaluatorType, typeof UserRound> = { SELF: UserRound, PEER: Users }

/** Crear una evaluación formativa por uno de tres caminos, o editar un borrador guardado. Todos
 * terminan en el mismo editor, donde el docente revisa y ajusta todo antes de guardar (aún sin
 * publicar). */
export default function FormativeCreatePanel({ mode, classroomId, terms, scale, fail, onCancel, onCreated, editing }: {
  mode: CreateMode
  classroomId: string
  terms: OpenTerm[]
  components?: GradebookComponent[]
  scale: { min: number; max: number } | null
  fail: (e: any, m: string) => void
  onCancel: () => void
  onCreated: () => Promise<void>
  editing?: EditingDraft
}) {
  const min = scale?.min ?? 1
  const max = scale?.max ?? 5
  const [types, setTypes] = useState<Record<EvaluatorType, boolean>>({ SELF: true, PEER: true })
  const selectedTypes = (['SELF', 'PEER'] as EvaluatorType[]).filter(t => types[t])
  const [purpose, setPurpose] = useState('')
  const [draft, setDraft] = useState<Draft | null>(editing?.draft ?? null)
  const [termId, setTermId] = useState(editing?.termId ?? '')
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

  const save = async () => {
    if (!draft || problems.length) return
    setBusy(true)
    try {
      if (editing) {
        await classroomApi.updateFormativeDraft(editing.id, { ...draft, academicTermId: termId })
        toast.success('Cambios guardados')
      } else {
        await classroomApi.createFormativeEvaluationFromAIDraft({ ...draft, classroomId, academicTermId: termId })
        toast.success('Borrador creado', 'Revísalo en la lista y publícalo cuando esté listo.')
      }
      await onCreated()
    } catch (e) {
      fail(e, editing ? 'No se pudieron guardar los cambios' : 'No se pudo crear la evaluación')
    } finally {
      setBusy(false)
    }
  }

  const typePicker = <div className="flex flex-wrap gap-4 text-sm">
    <label className="flex items-center gap-2"><input type="checkbox" checked={types.SELF} onChange={e => setTypes(t => ({ ...t, SELF: e.target.checked }))} /><UserRound className="h-4 w-4 text-teal-700" /> Autoevaluación <span className="text-xs text-slate-500">(cada uno sobre sí mismo)</span></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={types.PEER} onChange={e => setTypes(t => ({ ...t, PEER: e.target.checked }))} /><Users className="h-4 w-4 text-teal-700" /> Coevaluación <span className="text-xs text-slate-500">(cada uno sobre sus compañeros)</span></label>
  </div>

  const purposeField = <label className="block text-sm font-semibold text-slate-700">¿Qué quieres que los estudiantes evalúen?
    <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} className={`${fieldClass} mt-1`} placeholder="Ej.: participación, responsabilidad y trabajo colaborativo durante el proyecto de ciencias." />
  </label>

  return <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold text-slate-800">{editing ? 'Editar borrador' : draft ? 'Revisa y ajusta las preguntas' : MODE_TITLE[mode]}</h3>
      <button type="button" onClick={onCancel} aria-label="Cancelar" className="rounded-lg p-1 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>

    {!draft && mode === 'manual' && <>
      <p className="text-sm text-slate-600">Elige qué quieres evaluar. Te damos preguntas en blanco con niveles en la escala de tu institución ({min} a {max}).</p>
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
      <p className="text-xs text-slate-500">La IA de Edusyn propone preguntas y niveles en la escala de tu institución ({min} a {max}). Nada se publica hasta que tú lo revises.</p>
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
        {editing
          ? <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Cancelar</button>
          : <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Volver a empezar</button>}
        <button type="button" disabled={busy || problems.length > 0} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? 'Guardar cambios' : 'Guardar borrador'}</button>
      </div>
      <p className="text-right text-[11px] text-slate-400">El borrador no lo ven los estudiantes hasta que lo publiques. Puedes volver a abrirlo y editarlo.</p>
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
  const update = (fn: (d: Draft) => Draft) => setDraft(d => (d ? fn(d) : d))
  const setDimension = (di: number, patch: Partial<DraftDimension>) => update(d => ({ ...d, dimensions: d.dimensions.map((x, i) => i === di ? { ...x, ...patch } : x) }))
  const [starterNote, setStarterNote] = useState<EvaluatorType | null>(null)

  // Una sola dimensión por tipo: la segunda coevaluación confundía al docente y a los estudiantes.
  const missing = (['SELF', 'PEER'] as EvaluatorType[]).filter(t => !draft.dimensions.some(d => d.evaluatorType === t))
  const addDimension = (type: EvaluatorType) => {
    const base = draft.dimensions[0]
    update(d => ({ ...d, dimensions: [...d.dimensions, base ? starterFrom(base, type, min, max) : blankDimension(type, min, max)] }))
    if (base) setStarterNote(type)
  }

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-semibold text-slate-600">Título<input value={draft.title} onChange={e => update(d => ({ ...d, title: e.target.value }))} className={`${fieldClass} mt-1`} placeholder="Ej.: Trabajo en equipo — proyecto de ciencias" /></label>
      <label className="block text-xs font-semibold text-slate-600">Período
        <select value={termId} onChange={e => setTermId(e.target.value)} className={`${fieldClass} mt-1`}>
          <option value="">Selecciona un período abierto</option>
          {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Instrucciones para los estudiantes<textarea value={draft.description} onChange={e => update(d => ({ ...d, description: e.target.value }))} rows={2} className={`${fieldClass} mt-1`} placeholder="Ej.: piensa con honestidad en lo que pasó durante el proyecto." /></label>
    </div>
    {!terms.length && <p className="flex items-center gap-1.5 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> No hay períodos abiertos: no se puede crear la evaluación.</p>}

    {draft.dimensions.map((d, di) => <DimensionCard
      key={`${d.evaluatorType}-${di}`}
      dimension={d}
      min={min}
      max={max}
      canRemove={draft.dimensions.length > 1}
      starter={starterNote === d.evaluatorType}
      purpose={purpose || draft.description || draft.title}
      scale={scale}
      onChange={patch => setDimension(di, patch)}
      onRemove={() => { setStarterNote(null); update(x => ({ ...x, dimensions: x.dimensions.filter((_, i) => i !== di) })) }}
    />)}

    {missing.length > 0 && <div className="flex flex-wrap gap-2">
      {missing.map(t => <button key={t} type="button" onClick={() => addDimension(t)} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"><Plus className="h-3.5 w-3.5" /> Agregar {TYPE_NAMES[t].toLowerCase()}</button>)}
    </div>}
  </div>
}

function DimensionCard({ dimension: d, min, max, canRemove, starter, purpose, scale, onChange, onRemove }: {
  dimension: DraftDimension
  min: number
  max: number
  canRemove: boolean
  starter: boolean
  purpose: string
  scale: { min: number; max: number } | null
  onChange: (patch: Partial<DraftDimension>) => void
  onRemove: () => void
}) {
  const [customWeights, setCustomWeights] = useState(() => !hasEvenWeights(d))
  const [openLevels, setOpenLevels] = useState<number | null>(null)
  const [preview, setPreview] = useState(false)
  const [fromAI, setFromAI] = useState(false)
  const hint = PERSON_HINT[d.evaluatorType]
  const Icon = TYPE_ICON[d.evaluatorType]
  const sum = weightSum(d)

  // Mientras el docente no personalice los pesos, todas las preguntas valen lo mismo.
  const setCriteria = (next: DraftCriterion[]) => {
    const w = evenWeights(next.length)
    onChange({ criteria: customWeights ? next : next.map((c, i) => ({ ...c, weight: w[i] })) })
  }
  const setCriterion = (ci: number, patch: Partial<DraftCriterion>) => setCriteria(d.criteria.map((c, j) => j === ci ? { ...c, ...patch } : c))
  const setLevel = (ci: number, li: number, patch: Partial<DraftLevel>) => setCriterion(ci, { levels: d.criteria[ci].levels.map((l, k) => k === li ? { ...l, ...patch } : l) })
  const toggleCustom = (custom: boolean) => {
    setCustomWeights(custom)
    if (!custom) { const w = evenWeights(d.criteria.length); onChange({ criteria: d.criteria.map((c, i) => ({ ...c, weight: w[i] })) }) }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="rounded-lg bg-teal-50 p-2 text-teal-700"><Icon className="h-5 w-5" /></span>
        <div>
          <p className="font-bold text-slate-800">{TYPE_NAMES[d.evaluatorType]}</p>
          {d.evaluatorType === 'PEER'
            ? <p className="flex flex-wrap items-center gap-1 text-sm text-slate-600">Cada estudiante evalúa a
              <select value={d.peersPerStudent ?? 2} onChange={e => onChange({ peersPerStudent: Number(e.target.value) })} aria-label="Compañeros por estudiante" className="rounded-md border border-slate-200 px-1.5 py-0.5 text-sm">
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {(d.peersPerStudent ?? 2) === 1 ? 'compañero' : 'compañeros'}. Tú decides quién a quién al publicar.</p>
            : <p className="text-sm text-slate-600">{hint.who}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <button type="button" onClick={() => setPreview(p => !p)} className="inline-flex items-center gap-1 text-slate-600 hover:underline"><Eye className="h-3.5 w-3.5" /> {preview ? 'Volver a editar' : 'Ver como estudiante'}</button>
        <button type="button" onClick={() => setFromAI(v => !v)} className="inline-flex items-center gap-1 text-teal-700 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Traer de una IA externa</button>
        {canRemove && <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-rose-700 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Quitar</button>}
      </div>
    </div>

    {starter && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Usamos los mismos aspectos para empezar. Escribe cada frase {d.evaluatorType === 'PEER' ? 'sobre el compañero (ej.: «Mi compañero…»)' : 'en primera persona (ej.: «Cumplí…»)'} o tráelas de una IA externa.</p>}
    {fromAI && <DimensionFromAI dimension={d} purpose={purpose} scale={scale} onUse={incoming => { onChange({ criteria: incoming.criteria, peersPerStudent: d.evaluatorType === 'PEER' ? (incoming.peersPerStudent ?? d.peersPerStudent) : null }); setCustomWeights(!hasEvenWeights(incoming)); setFromAI(false) }} onClose={() => setFromAI(false)} />}

    {preview
      ? <div className="mt-3"><DimensionPreview dimension={d} /></div>
      : <>
        <label className="mt-3 block text-xs font-semibold text-slate-600">Nombre que verán los estudiantes
          <input value={d.label} onChange={e => onChange({ label: e.target.value })} className={`${fieldClass} mt-1`} />
        </label>

        <ol className="mt-3 space-y-3">
          {d.criteria.map((c, ci) => <li key={ci} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Pregunta {ci + 1}</span>
              <div className="flex items-center gap-2">
                {customWeights && <label className="flex items-center gap-1 text-xs text-slate-600">Peso <input type="number" min={0} max={100} value={c.weight} onChange={e => setCriterion(ci, { weight: Number(e.target.value) || 0 })} className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5" aria-label="Peso" />%</label>}
                <button type="button" onClick={() => setCriteria(d.criteria.filter((_, j) => j !== ci))} disabled={d.criteria.length === 1} aria-label="Quitar pregunta" className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-rose-700 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <input value={c.name} onChange={e => setCriterion(ci, { name: e.target.value })} className={`${fieldClass} mt-1 font-semibold`} placeholder="Aspecto (ej.: Responsabilidad)" aria-label="Aspecto" />
            <textarea value={c.description} onChange={e => setCriterion(ci, { description: e.target.value })} rows={2} className={`${fieldClass} mt-2`} placeholder={hint.statement} aria-label="Frase que lee el estudiante" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500">Respuestas:</span>
              {c.levels.map((l, li) => <span key={li} className="rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">{l.label || '—'} · {Number.isFinite(l.score) ? l.score : '?'}</span>)}
              <button type="button" onClick={() => setOpenLevels(openLevels === ci ? null : ci)} className="inline-flex items-center gap-0.5 font-semibold text-teal-700 hover:underline">{openLevels === ci ? <><ChevronUp className="h-3.5 w-3.5" /> Cerrar</> : <><ChevronDown className="h-3.5 w-3.5" /> Editar respuestas</>}</button>
            </div>
            {openLevels === ci && <div className="mt-2 space-y-2">
              {c.levels.map((l, li) => <div key={li} className="grid gap-2 rounded-md bg-white p-2 sm:grid-cols-[5rem_10rem_1fr_auto]">
                <input type="number" step="0.1" value={Number.isFinite(l.score) ? l.score : ''} onChange={e => setLevel(ci, li, { score: e.target.value === '' ? NaN : Number(e.target.value) })} className={`${fieldClass} text-xs`} aria-label="Puntaje" />
                <input value={l.label} onChange={e => setLevel(ci, li, { label: e.target.value })} className={`${fieldClass} text-xs font-semibold`} placeholder="Nombre" aria-label="Nombre de la respuesta" />
                <input value={l.description} onChange={e => setLevel(ci, li, { description: e.target.value })} className={`${fieldClass} text-xs`} placeholder={`Cómo se ve (opcional). ${hint.level}`} aria-label="Cómo se ve esta respuesta" />
                <button type="button" onClick={() => setCriterion(ci, { levels: c.levels.filter((_, k) => k !== li) })} disabled={c.levels.length <= 2} aria-label="Quitar respuesta" className="rounded-md p-1 text-slate-400 hover:text-rose-700 disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
              </div>)}
              {c.levels.length < 7 && <button type="button" onClick={() => setCriterion(ci, { levels: [...c.levels, { label: '', description: '', score: max }] })} className="text-xs font-semibold text-teal-700 hover:underline">+ Agregar respuesta</button>}
              <p className="text-[11px] text-slate-400">Escala de tu institución: {min} a {max}. El estudiante ve las respuestas en este orden.</p>
            </div>}
          </li>)}
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <button type="button" onClick={() => setCriteria([...d.criteria, blankCriterion(min, max, 0)])} disabled={d.criteria.length >= 8} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Agregar pregunta</button>
          <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={customWeights} onChange={e => toggleCustom(e.target.checked)} /> Dar más peso a algunas preguntas</label>
          {customWeights
            ? <span className={`font-semibold ${Math.abs(sum - 100) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>Suman {sum}%{Math.abs(sum - 100) < 0.01 ? '' : ' (deben sumar 100%)'}</span>
            : <span className="text-slate-400">Todas valen lo mismo.</span>}
        </div>
      </>}
  </section>
}

/** Pide a una IA externa solo una dimensión (p. ej. la coevaluación que se agregó después) y
 * reemplaza sus preguntas con la respuesta pegada. */
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
      <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">1. Petición para la {TYPE_NAMES[dimension.evaluatorType].toLowerCase()}</p>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-slate-200 [overflow-wrap:anywhere]">{prompt}</pre>
      <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-teal-300">{copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />} {copied ? 'Copiada' : 'Copiar petición'}</button>
    </div>
    <div className="flex flex-col">
      <label className="text-[11px] font-bold uppercase tracking-wider text-teal-800">2. Pega la respuesta</label>
      <textarea value={pasted} onChange={e => { setPasted(e.target.value); setError('') }} rows={6} className={`${fieldClass} mt-1 flex-1 font-mono text-xs`} />
      {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Cerrar</button>
        <button type="button" disabled={!pasted.trim()} onClick={use} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Usar estas preguntas</button>
      </div>
    </div>
  </div>
}
