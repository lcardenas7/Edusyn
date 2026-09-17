import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, CheckCircle2, ChevronLeft, ClipboardCheck, Eye, ExternalLink, Loader2, PenLine, Send, Sparkles, Trash2, Upload, UserRound, Users } from 'lucide-react'
import { classroomApi } from '../../lib/api'
import { confirmDialog } from '../ui/confirm'
import { toast } from '../../lib/toast'
import FormativeCreatePanel, { type CreateMode, type EditingDraft } from './FormativeCreatePanel'
import { DimensionPreview } from './FormativeRubricPreview'
import PeerAssignmentPanel, { type PeerPlan } from './PeerAssignmentPanel'
import { draftFromSaved, type GradebookComponent as Component, type OpenTerm as Term } from './formativeDraft'

/** Rúbricas, autoevaluación y coevaluación. La IA propone un borrador; el docente lo revisa,
 * lo publica, consolida y decide si envía los resultados a la planilla (con previsualización). */

type Props = { classroom: { id: string }; isTeacher: boolean; isStudent: boolean; setError?: (message: string) => void }


const STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Borrador', className: 'bg-slate-100 text-slate-700' },
  PUBLISHED: { label: 'Publicada', className: 'bg-sky-100 text-sky-800' },
  IN_PROGRESS: { label: 'En curso', className: 'bg-sky-100 text-sky-800' },
  CLOSED: { label: 'Cerrada', className: 'bg-slate-100 text-slate-700' },
  CONSOLIDATED: { label: 'Consolidada', className: 'bg-amber-100 text-amber-800' },
  SYNCED: { label: 'En la planilla', className: 'bg-emerald-100 text-emerald-800' },
  CHANGED_AFTER_SYNC: { label: 'Cambió tras sincronizar', className: 'bg-rose-100 text-rose-800' },
}

const TYPE_LABEL: Record<string, string> = { SELF: 'Autoevaluación', PEER: 'Coevaluación', TEACHER: 'Docente' }

const errorMessage = (e: any, fallback: string) => {
  const message = e?.response?.data?.message
  return Array.isArray(message) ? message.join(', ') : message || fallback
}

const fieldClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

export default function FormativeEvaluationsTab({ classroom, isTeacher, isStudent, setError }: Props) {
  const fail = useCallback((e: any, fallback: string) => {
    const message = errorMessage(e, fallback)
    if (setError) setError(message)
    else toast.error(message)
  }, [setError])

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try {
      const { data } = await classroomApi.listFormativeEvaluations(classroom.id, isStudent ? 'student' : 'teacher')
      setItems(data || [])
    } catch (e) {
      fail(e, 'No se pudieron cargar las evaluaciones formativas')
    } finally {
      setLoading(false)
    }
  }, [classroom.id, isStudent, fail])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando evaluación formativa…</div>

  return <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-slate-800">Autoevaluación y coevaluación</h2>
      <p className="text-sm text-slate-500">{isTeacher
        ? 'Rúbricas para que cada estudiante reflexione sobre su proceso y el de sus compañeros. Tú decides qué llega a la planilla.'
        : 'Reflexiona con honestidad sobre tu trabajo y el de tus compañeros. Sirve para mejorar, no para castigar.'}</p>
    </div>
    {isTeacher
      ? <TeacherView classroomId={classroom.id} items={items} reload={load} fail={fail} />
      : <StudentView items={items} reload={load} fail={fail} />}
  </div>
}

// ─── Docente ─────────────────────────────────────────────────────────────────

function TeacherView({ classroomId, items, reload, fail }: { classroomId: string; items: any[]; reload: () => Promise<void>; fail: (e: any, m: string) => void }) {
  const [creating, setCreating] = useState<CreateMode | null>(null)
  const [components, setComponents] = useState<Component[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [scale, setScale] = useState<{ min: number; max: number } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingDraft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    classroomApi.getGradebookConfig(classroomId).then(({ data }: any) => {
      setTerms((data?.availableTerms || []).filter((t: Term) => t.status === 'OPEN'))
      if (data?.scale && Number.isFinite(data.scale.min) && Number.isFinite(data.scale.max)) setScale({ min: Number(data.scale.min), max: Number(data.scale.max) })
    }).catch(() => {})
    classroomApi.getFormativeComponents(classroomId).then(({ data }: any) => setComponents(data || [])).catch(() => {})
  }, [classroomId])

  const run = async (id: string, action: () => Promise<unknown>, fallback: string, success?: string) => {
    setBusy(id)
    try {
      await action()
      if (success) toast.success(success)
      await reload()
    } catch (e) {
      fail(e, fallback)
    } finally {
      setBusy(null)
    }
  }

  // Con coevaluación, primero se revisa quién evalúa a quién; sin ella basta con confirmar.
  const publish = async (item: any) => {
    if (item.dimensions?.some((d: any) => d.evaluatorType === 'PEER')) { setPublishingId(item.id); return }
    if (!(await confirmDialog('Al publicar, cada estudiante verá su autoevaluación. Después ya no se puede editar la rúbrica.', { title: 'Publicar evaluación', confirmLabel: 'Publicar' }))) return
    await run(item.id, () => classroomApi.publishFormativeEvaluation(item.id), 'No se pudo publicar', 'Evaluación publicada')
  }
  const publishWithPlan = async (item: any, plan: PeerPlan) => {
    if (!(await confirmDialog('Cada estudiante verá su autoevaluación y a los compañeros que le tocan evaluar. Después ya no se puede cambiar la rúbrica ni el reparto.', { title: 'Publicar evaluación', confirmLabel: 'Publicar' }))) return
    await run(item.id, async () => { await classroomApi.publishFormativeEvaluation(item.id, { peer: plan }); setPublishingId(null) }, 'No se pudo publicar', 'Evaluación publicada')
  }

  const startEdit = (item: any) => run(item.id, async () => {
    const { data } = await classroomApi.getFormativeEvaluation(item.id)
    setViewingId(null)
    setPublishingId(null)
    setEditing({ id: item.id, draft: draftFromSaved(data), termId: data.academicTermId })
  }, 'No se pudo abrir el borrador')
  const remove = async (item: any) => {
    if (!(await confirmDialog(`Se eliminará «${item.title}». Todavía no lo ven los estudiantes.`, { title: 'Eliminar borrador', confirmLabel: 'Eliminar', danger: true }))) return
    await run(item.id, () => classroomApi.deleteFormativeDraft(item.id), 'No se pudo eliminar el borrador', 'Borrador eliminado')
  }

  return <div className="space-y-4">
    {!creating && <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">Nueva evaluación: ¿cómo quieres crear la rúbrica?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => setCreating('manual')} className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-left hover:bg-teal-50"><PenLine className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span><span className="block text-sm font-bold text-slate-800">Crear manualmente</span><span className="block text-xs text-slate-500">Escribes tus propias preguntas.</span></span></button>
        <button type="button" onClick={() => setCreating('external')} className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-left hover:bg-teal-50"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span><span className="block text-sm font-bold text-slate-800">Con IA externa</span><span className="block text-xs text-slate-500">Copias una petición a ChatGPT, Gemini u otra y pegas la respuesta.</span></span></button>
        <button type="button" onClick={() => setCreating('internal')} className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-left hover:bg-teal-50"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span><span className="block text-sm font-bold text-slate-800">Con la IA de Edusyn</span><span className="block text-xs text-slate-500">Edusyn propone un borrador automático.</span></span></button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">En los tres casos revisas y ajustas todo antes de crear; nada se publica sin tu aprobación.</p>
    </div>}
    {creating && <FormativeCreatePanel mode={creating} classroomId={classroomId} terms={terms} components={components} scale={scale} fail={fail} onCancel={() => setCreating(null)} onCreated={async () => { setCreating(null); await reload() }} />}

    {items.length === 0 && !creating && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Todavía no hay evaluaciones formativas en este curso.</div>}

    {items.map(item => {
      const status = STATUS[item.status] || { label: item.status, className: 'bg-slate-100 text-slate-700' }
      return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800">{item.title}</h3>
            {item.description && <p className="text-sm text-slate-500">{item.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
              {item.academicTerm?.name && <span className="text-slate-500">{item.academicTerm.name}</span>}
              {item._count?.assignments > 0 && <span className="text-slate-500">{item._count.assignments} evaluaciones asignadas</span>}
            </div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5">
          {(item.dimensions || []).map((d: any) => <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">{d.label}</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">{TYPE_LABEL[d.evaluatorType] || d.evaluatorType}{d.evaluatorType === 'PEER' && d.peersPerStudent ? ` · ${d.peersPerStudent} por estudiante` : ''}</span>
            {item.status === 'SYNCED' && d.evaluationComponent && <span className="text-xs text-slate-500">En la planilla: {d.evaluationComponent.name}</span>}
          </li>)}
        </ul>
        {editing?.id === item.id
          ? <div className="mt-4"><FormativeCreatePanel mode="manual" editing={editing ?? undefined} classroomId={classroomId} terms={terms} scale={scale} fail={fail} onCancel={() => setEditing(null)} onCreated={async () => { setEditing(null); await reload() }} /></div>
          : <>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewingId(viewingId === item.id ? null : item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> {viewingId === item.id ? 'Ocultar preguntas' : 'Ver preguntas'}</button>
          {item.status === 'DRAFT' && <button type="button" disabled={!!busy} onClick={() => void startEdit(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><PenLine className="h-4 w-4" /> Editar</button>}
          {item.status === 'DRAFT' && <button type="button" disabled={!!busy} onClick={() => void remove(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Eliminar</button>}
          {item.status === 'DRAFT' && publishingId !== item.id && <button disabled={!!busy} onClick={() => publish(item)} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">Publicar</button>}
          {['PUBLISHED', 'IN_PROGRESS', 'CLOSED', 'CONSOLIDATED', 'CHANGED_AFTER_SYNC'].includes(item.status) && <button disabled={!!busy} onClick={() => run(item.id, () => classroomApi.consolidateFormativeEvaluation(item.id), 'No se pudo consolidar', 'Resultados consolidados')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{item.status === 'CONSOLIDATED' ? 'Volver a consolidar' : 'Consolidar resultados'}</button>}
          {item.status !== 'DRAFT' && <button onClick={() => setOpenId(openId === item.id ? null : item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><BarChart3 className="h-4 w-4" /> {openId === item.id ? 'Ocultar resultados' : 'Ver resultados'}</button>}
          {busy === item.id && <Loader2 className="h-5 w-5 animate-spin self-center text-teal-600" />}
        </div>
        {viewingId === item.id && <SavedQuestions id={item.id} fail={fail} />}
        {publishingId === item.id && <PeerAssignmentPanel activityId={item.id} busy={busy === item.id} fail={fail} onCancel={() => setPublishingId(null)} onPublish={plan => void publishWithPlan(item, plan)} />}
        {openId === item.id && <ResultsPanel item={item} components={components} fail={fail} onSynced={reload} />}
          </>}
      </article>
    })}
  </div>
}

/** Las preguntas guardadas, tal como las verá el estudiante. */
function SavedQuestions({ id, fail }: { id: string; fail: (e: any, m: string) => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    classroomApi.getFormativeEvaluation(id).then(({ data }: any) => setData(data)).catch(e => fail(e, 'No se pudieron cargar las preguntas'))
  }, [id, fail])
  if (!data) return <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando preguntas…</p>
  return <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
    {draftFromSaved(data).dimensions.map((d, i) => <DimensionPreview key={i} dimension={d} />)}
  </div>
}

function ResultsPanel({ item, components, fail, onSynced }: { item: any; components: Component[]; fail: (e: any, m: string) => void; onSynced: () => Promise<void> }) {
  const [data, setData] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [destinations, setDestinations] = useState<Record<string, string>>({})
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    if (data) setDestinations(Object.fromEntries(data.dimensions.map((d: any) => [d.id, d.evaluationComponentId || ''])))
  }, [data])

  useEffect(() => {
    classroomApi.getFormativeDashboard(item.id).then(({ data }: any) => setData(data)).catch(e => fail(e, 'No se pudieron cargar los resultados'))
  }, [item.id, item.status, fail])

  if (!data) return <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando resultados…</p>

  const total = data.assignments?.length || 0
  const submitted = data.assignments?.filter((a: any) => a.status === 'SUBMITTED').length || 0
  const students = new Map<string, string>()
  for (const r of data.results || []) students.set(r.studentEnrollmentId, `${r.studentEnrollment.student.firstName} ${r.studentEnrollment.student.lastName}`)
  const resultOf = (dimensionId: string, studentId: string) => data.results.find((r: any) => r.dimensionId === dimensionId && r.studentEnrollmentId === studentId)
  const comments = (data.assignments || []).flatMap((a: any) => (Array.isArray(a.qualitativeComments) ? a.qualitativeComments : []).map((c: any) => c.text)).filter(Boolean)

  const loadPreview = async () => {
    setBusy(true)
    try {
      // Guarda primero el destino elegido para cada dimensión (solo si cambió).
      for (const d of data.dimensions) {
        const chosen = destinations[d.id] || ''
        if (chosen !== (d.evaluationComponentId || '') && d.gradebookActivityIndex == null) {
          await classroomApi.setFormativeDimensionComponent(item.id, d.id, chosen || null)
        }
      }
      const { data: p } = await classroomApi.previewFormativeSync(item.id)
      setPreview(p)
      setChoosing(false)
    } catch (e) {
      fail(e, 'No se pudo preparar la sincronización')
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    if (!preview?.summary?.ready) return
    if (!(await confirmDialog(`Se escribirán ${preview.summary.ready} notas en la planilla del período ${preview.term}. Los resultados incompletos o sin destino no se envían.`, { title: 'Enviar a la planilla', confirmLabel: 'Enviar' }))) return
    setBusy(true)
    try {
      const { data: result } = await classroomApi.syncFormativeEvaluation(item.id, { previewHash: preview.hash, idempotencyKey: crypto.randomUUID() })
      if (result?.status === 'COMPLETED') toast.success('Notas enviadas a la planilla')
      else toast.warning('Algunas notas no se pudieron enviar', result?.errorSummary || undefined)
      setPreview(null)
      await onSynced()
    } catch (e) {
      fail(e, 'No se pudo sincronizar con la planilla')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-semibold text-slate-800">Respuestas: {submitted} de {total}</span>
      <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-500" style={{ width: `${total ? Math.round((submitted / total) * 100) : 0}%` }} /></div>
    </div>

    {students.size === 0
      ? <p className="text-sm text-slate-500">Consolida para ver los resultados por estudiante. Los que no tengan todas sus respuestas quedan incompletos, nunca en cero.</p>
      : <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-4">Estudiante</th>{data.dimensions.map((d: any) => <th key={d.id} className="py-1 pr-4">{d.label}</th>)}</tr></thead>
          <tbody>{[...students.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <tr key={id} className="border-t border-slate-200">
            <td className="py-1.5 pr-4 text-slate-700">{name}</td>
            {data.dimensions.map((d: any) => {
              const r = resultOf(d.id, id)
              return <td key={d.id} className="py-1.5 pr-4">{!r ? '—' : r.isReady ? <b className="text-slate-800">{Number(r.quantitativeScore).toFixed(2)}</b> : <span className="text-xs text-amber-700">Incompleto ({r.receivedResponses}/{r.expectedResponses})</span>}</td>
            })}
          </tr>)}</tbody>
        </table>
      </div>}

    {comments.length > 0 && <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-slate-700">Comentarios de los estudiantes ({comments.length})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">{comments.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
    </details>}

    {['CONSOLIDATED', 'CHANGED_AFTER_SYNC'].includes(item.status) && !preview && !choosing && <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setChoosing(true)} className="inline-flex items-center gap-2 rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-white"><Upload className="h-4 w-4" /> Enviar a la planilla de notas</button>
      <span className="text-xs text-slate-500">Opcional: la evaluación formativa vale por sí misma; envíala solo si quieres que cuente en la planilla.</span>
    </div>}
    {choosing && !preview && <div className="space-y-2 rounded-lg border border-teal-200 bg-white p-3 text-sm">
      <p className="font-semibold text-slate-800">¿En qué parte de la planilla va cada dimensión?</p>
      {data.dimensions.map((d: any) => <label key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
        <span className="min-w-[140px] font-medium">{d.label}</span>
        <select value={destinations[d.id] ?? ''} disabled={d.gradebookActivityIndex != null} onChange={e => setDestinations(x => ({ ...x, [d.id]: e.target.value }))} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
          <option value="">No enviar esta dimensión</option>
          {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>)}
      {!components.length && <p className="text-xs text-rose-700">Tu institución no tiene componentes de evaluación configurados; no se puede enviar a la planilla.</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setChoosing(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Cancelar</button>
        <button type="button" disabled={busy || !Object.values(destinations).some(Boolean)} onClick={loadPreview} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ver vista previa</button>
      </div>
    </div>}
    {preview && <div className="rounded-lg border border-teal-200 bg-white p-3 text-sm">
      <p className="font-semibold text-slate-800">Vista previa · {preview.term}</p>
      <p className="text-slate-600">{preview.summary.ready} listas para enviar · {preview.summary.incomplete} incompletas · {preview.summary.withoutComponent} que no se envían</p>
      <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto text-xs text-slate-600">
        {preview.rows.map((r: any) => <li key={r.resultId}>{r.studentName} · {r.dimensionLabel}: {r.ready && r.score !== null ? r.score.toFixed(2) : 'incompleto'} → {r.componentName || 'no va a la planilla'}</li>)}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Cancelar</button>
        <button type="button" disabled={busy || !preview.summary.ready} onClick={sync} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar {preview.summary.ready} notas</button>
      </div>
    </div>}
    {item.status === 'SYNCED' && <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Los resultados ya están en la planilla.</p>}
  </div>
}

// ─── Estudiante ──────────────────────────────────────────────────────────────

function StudentView({ items, reload, fail }: { items: any[]; reload: () => Promise<void>; fail: (e: any, m: string) => void }) {
  const [current, setCurrent] = useState<{ activity: any; assignment: any } | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // Al abrir una evaluación (también la siguiente tras enviar) se empieza a leer desde arriba.
  useEffect(() => { if (current) cardRef.current?.scrollIntoView({ block: 'start' }) }, [current?.assignment.id])

  const pending = items.flatMap(item => (item.assignments || []).filter((a: any) => a.status === 'PENDING').map((a: any) => ({ activity: item, assignment: a })))

  const open = (entry: { activity: any; assignment: any }) => { setCurrent(entry); setAnswers({}); setComment('') }

  if (current) {
    const { activity, assignment } = current
    const rubric = assignment.dimension?.rubricSnapshot || { criteria: [] }
    const criteria: any[] = rubric.criteria || []
    const answered = criteria.filter(c => answers[c.id]).length
    const isSelf = assignment.dimension?.evaluatorType === 'SELF'
    const submit = async () => {
      setBusy(true)
      try {
        await classroomApi.submitFormativeAssignment(assignment.id, {
          answers: Object.entries(answers).map(([criterionId, levelId]) => ({ criterionId, levelId })),
          comments: comment.trim() ? [{ prompt: isSelf ? '¿Qué puedo mejorar?' : 'Mensaje para mi compañero', text: comment.trim() }] : [],
        })
        toast.success('Evaluación enviada', 'Gracias por tu reflexión.')
        const next = pending.find(p => p.assignment.id !== assignment.id)
        await reload()
        if (next) open(next)
        else setCurrent(null)
      } catch (e) {
        fail(e, 'No se pudo enviar la evaluación')
      } finally {
        setBusy(false)
      }
    }
    return <div ref={cardRef} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <button type="button" onClick={() => setCurrent(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ChevronLeft className="h-4 w-4" /> Volver</button>
      <h3 className="mt-2 text-lg font-bold text-slate-800">{activity.title} · {assignment.dimension.label}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
        {isSelf
          ? <><UserRound className="h-4 w-4 text-teal-700" /> Te evalúas a ti mismo. Piensa en lo que hiciste de verdad, no en lo que quisieras haber hecho.</>
          : <><Users className="h-4 w-4 text-teal-700" /> Evalúas a <b className="text-slate-800">{assignment.targetEnrollment?.student?.firstName} {assignment.targetEnrollment?.student?.lastName}</b>. Sé justo y respetuoso.</>}
      </p>
      {activity.description && <p className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">{activity.description}</p>}
      <p className="mt-3 text-xs font-semibold text-slate-500">{answered} de {criteria.length} preguntas respondidas</p>
      {criteria.map(c => <fieldset key={c.id} className="mt-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 font-semibold text-slate-800">{c.name}</legend>
        {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(c.levels || []).map((l: any) => <button key={l.id} type="button" aria-pressed={answers[c.id] === l.id} onClick={() => setAnswers(a => ({ ...a, [c.id]: l.id }))} className={`rounded-lg border p-3 text-left text-sm transition ${answers[c.id] === l.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 hover:bg-slate-50'}`}>
            <b className="text-slate-800">{l.label}</b>
            {l.description && <span className="mt-0.5 block text-slate-500">{l.description}</span>}
          </button>)}
        </div>
      </fieldset>)}
      <label className="mt-4 block text-sm font-semibold text-slate-700">{isSelf ? '¿Qué puedo mejorar? (opcional)' : 'Un mensaje para tu compañero (opcional)'}
        <textarea value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} rows={3} className={`${fieldClass} mt-1`} placeholder={isSelf ? 'Ej.: entregar a tiempo mis partes del proyecto' : 'Ej.: me ayudó mucho cuando… / podría mejorar en…'} />
      </label>
      <button type="button" disabled={busy || answered !== criteria.length || !criteria.length} onClick={submit} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar evaluación
      </button>
    </div>
  }

  if (!items.length) return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No tienes evaluaciones formativas pendientes.</div>

  return <div className="space-y-3">
    {items.map(item => {
      const mine = item.assignments || []
      const left = mine.filter((a: any) => a.status === 'PENDING')
      return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-800">{item.title}</h3>
        {item.description && <p className="text-sm text-slate-500">{item.description}</p>}
        <p className="mt-2 text-sm text-slate-600">{left.length ? `Te faltan ${left.length} de ${mine.length}` : 'Ya respondiste todo. ¡Gracias!'}</p>
        <ul className="mt-2 space-y-1.5">
          {mine.map((a: any) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">{a.dimension.label}{a.dimension.evaluatorType === 'PEER' ? ` · ${a.targetEnrollment?.student?.firstName} ${a.targetEnrollment?.student?.lastName}` : ''}</span>
            {a.status === 'PENDING'
              ? <button type="button" onClick={() => open({ activity: item, assignment: a })} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"><ClipboardCheck className="h-3.5 w-3.5" /> Responder</button>
              : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Enviada</span>}
          </li>)}
        </ul>
      </article>
    })}
  </div>
}
