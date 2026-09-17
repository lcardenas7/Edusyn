import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, EyeOff, MessageSquare, ShieldCheck, TriangleAlert, UserRound, Users } from 'lucide-react'
import { groupByAspect } from './formativeDraft'

/** Forma de `GET /formative-evaluations/:id/insights`. */
export interface InsightLevel { id: string; label: string; score: number }
export interface InsightCriterion { id: string; name: string; description: string | null; weight: number; levels: InsightLevel[] }
export interface InsightDimension { id: string; label: string; evaluatorType: string; criteria: InsightCriterion[] }
export interface CriterionStat { average: number | null; responses: number; levels: Record<string, number> }
export interface StudentDimension { expected: number; received: number; provisionalScore: number | null; consolidatedScore: number | null; consolidated: boolean; byCriterion: Record<string, CriterionStat> }
export interface InsightComment { assignmentId: string; dimensionId: string; fromSelf: boolean; author: string; prompt: string | null; text: string; status: string }
export interface InsightStudent { id: string; name: string; perDimension: Record<string, StudentDimension>; peerTasks: { assigned: number; submitted: number }; comments: InsightComment[] }
export interface Insights {
  dimensions: InsightDimension[]
  students: InsightStudent[]
  byDimension: Array<{ dimensionId: string; byCriterion: Record<string, CriterionStat> }>
  totals: { assignments: number; submitted: number }
}

type Tab = 'students' | 'questions' | 'comments'

const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2).replace(/\.?0+$/, ''))

/** Nota que se muestra: la consolidada si existe; si no, la provisional (solo con lo enviado). */
function scoreOf(d?: StudentDimension) {
  if (!d) return { value: null as number | null, provisional: false }
  if (d.consolidatedScore != null) return { value: d.consolidatedScore, provisional: false }
  return { value: d.provisionalScore, provisional: d.provisionalScore != null }
}

function scaleOf(dimensions: InsightDimension[]) {
  const scores = dimensions.flatMap(d => d.criteria.flatMap(c => c.levels.map(l => l.score)))
  return scores.length ? { min: Math.min(...scores), max: Math.max(...scores) } : { min: 0, max: 5 }
}

export default function FormativeInsights({ insights, onReviewComment, busyComment }: {
  insights: Insights
  onReviewComment: (assignmentId: string, status: 'APPROVED' | 'REJECTED') => void
  busyComment: string | null
}) {
  const [tab, setTab] = useState<Tab>('students')
  const [onlyPending, setOnlyPending] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const self = insights.dimensions.find(d => d.evaluatorType === 'SELF')
  const peer = insights.dimensions.find(d => d.evaluatorType === 'PEER')
  const scale = useMemo(() => scaleOf(insights.dimensions), [insights.dimensions])
  const gap = Math.max((scale.max - scale.min) * 0.2, 0.5)
  const { assignments, submitted } = insights.totals
  const pct = assignments ? Math.round((submitted / assignments) * 100) : 0
  const count = (dim?: InsightDimension) => {
    if (!dim) return null
    const cells = insights.students.map(s => s.perDimension[dim.id]).filter(Boolean)
    return { done: cells.reduce((n, c) => n + c.received, 0), total: cells.reduce((n, c) => n + c.expected, 0) }
  }
  const allComments = insights.students.flatMap(s => s.comments.map(c => ({ ...c, target: s.name })))
  const pendingComments = allComments.filter(c => !c.fromSelf && c.status === 'PENDING_REVIEW').length
  const anyConsolidated = insights.students.some(s => Object.values(s.perDimension).some(d => d.consolidated))

  const rows = insights.students.filter(s => {
    if (!onlyPending) return true
    return Object.values(s.perDimension).some(d => d.received < d.expected) || s.peerTasks.submitted < s.peerTasks.assigned
  })

  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-3">
      <Stat label="Respuestas recibidas" value={`${submitted} de ${assignments}`} hint={`${pct}%`} bar={pct} />
      {self && <Stat label="Autoevaluaciones" value={`${count(self)!.done} de ${count(self)!.total}`} icon={<UserRound className="h-4 w-4" />} />}
      {peer && <Stat label="Coevaluaciones" value={`${count(peer)!.done} de ${count(peer)!.total}`} icon={<Users className="h-4 w-4" />} />}
    </div>
    <p className="text-xs text-slate-500">{anyConsolidated
      ? 'Las notas consolidadas son las que se pueden enviar a la planilla. Las marcadas «prov.» aún no se han consolidado.'
      : 'Las notas son provisionales: se calculan con lo que ya enviaron. Consolida cuando termine el plazo; lo que falte nunca cuenta como cero.'}</p>

    <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
      {([['students', 'Estudiantes'], ['questions', 'Preguntas'], ['comments', `Comentarios${allComments.length ? ` (${allComments.length})` : ''}`]] as const).map(([key, label]) =>
        <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          {label}{key === 'comments' && pendingComments > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{pendingComments} por revisar</span>}
        </button>)}
    </div>

    {tab === 'students' && <>
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} /> Solo quienes tienen algo pendiente</label>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Estudiante</th>
              {self && <th className="px-3 py-2">{self.label}</th>}
              {peer && <th className="px-3 py-2">{peer.label}</th>}
              {self && peer && <th className="px-3 py-2">Cómo se ve vs. cómo lo ven</th>}
              {peer && <th className="px-3 py-2">Coevaluaciones que hizo</th>}
              <th className="px-3 py-2"><span className="sr-only">Detalle</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const sd = self && s.perDimension[self.id]
              const pd = peer && s.perDimension[peer.id]
              const sv = scoreOf(sd), pv = scoreOf(pd)
              const diff = sv.value != null && pv.value != null ? sv.value - pv.value : null
              const isOpen = open === s.id
              return <Fragment key={s.id}>
                <tr className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                  {self && <td className="px-3 py-2"><Score v={sv} d={sd} /></td>}
                  {peer && <td className="px-3 py-2"><Score v={pv} d={pd} showCount /></td>}
                  {self && peer && <td className="px-3 py-2"><Gap diff={diff} gap={gap} /></td>}
                  {peer && <td className="px-3 py-2 text-xs"><span className={s.peerTasks.submitted < s.peerTasks.assigned ? 'font-semibold text-amber-700' : 'text-slate-600'}>{s.peerTasks.submitted} de {s.peerTasks.assigned}</span></td>}
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Ver respuestas
                    </button>
                  </td>
                </tr>
                {isOpen && <tr className="bg-slate-50/70"><td colSpan={6} className="px-3 py-3">
                  <StudentDetail student={s} self={self} peer={peer} gap={gap} onReviewComment={onReviewComment} busyComment={busyComment} />
                </td></tr>}
              </Fragment>
            })}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">Nadie tiene pendientes.</td></tr>}
          </tbody>
        </table>
      </div>
    </>}

    {tab === 'questions' && <div className="space-y-4">
      {insights.dimensions.map(d => {
        const stats = insights.byDimension.find(b => b.dimensionId === d.id)?.byCriterion ?? {}
        const answered = d.criteria.filter(c => stats[c.id]?.average != null)
        // Solo lo que de verdad está bajo (menos del 60 % de la escala), no siempre «las tres peores».
        const threshold = scale.min + (scale.max - scale.min) * 0.6
        const weakest = answered.filter(c => stats[c.id].average! < threshold).sort((a, b) => stats[a.id].average! - stats[b.id].average!).slice(0, 3)
        return <section key={d.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-800">{d.label} <span className="text-xs font-normal text-slate-500">· promedio del grupo por pregunta</span></p>
          {weakest.length > 0 && <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-amber-800"><TriangleAlert className="h-3.5 w-3.5" /> Para reforzar: {weakest.map(c => `${d.criteria.indexOf(c) + 1}. ${c.name}`).join(' · ')}</p>}
          <div className="mt-2 space-y-3">
            {groupByAspect(d.criteria).map((group, g) => {
              const aspectAvg = avgOf(group.items.map(i => stats[i.criterion.id]?.average))
              return <div key={g}>
                <p className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-teal-800"><span>{group.aspect}</span><span className="font-semibold normal-case text-slate-500">promedio {fmt(aspectAvg)}</span></p>
                <ul className="mt-1 space-y-1.5">
                  {group.items.map(({ criterion: c, index }) => {
                    const st = stats[c.id]
                    return <li key={c.id} className="grid gap-1 sm:grid-cols-[1fr_12rem]">
                      <span className="text-sm text-slate-700"><span className="text-slate-400">{index + 1}.</span> {c.description || c.name}</span>
                      <span className="flex flex-col gap-0.5">
                        <Bar value={st?.average ?? null} scale={scale} />
                        <Distribution criterion={c} stat={st} />
                      </span>
                    </li>
                  })}
                </ul>
              </div>
            })}
          </div>
        </section>
      })}
    </div>}

    {tab === 'comments' && <div className="space-y-2">
      {!allComments.length && <p className="text-sm text-slate-500">Todavía no hay comentarios.</p>}
      {allComments.map((c, i) => <CommentRow key={`${c.assignmentId}-${i}`} comment={c} target={c.target} dimension={insights.dimensions.find(d => d.id === c.dimensionId)?.label} onReviewComment={onReviewComment} busy={busyComment === c.assignmentId} />)}
    </div>}
  </div>
}

function avgOf(values: Array<number | null | undefined>) {
  const v = values.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function Stat({ label, value, hint, bar, icon }: { label: string; value: string; hint?: string; bar?: number; icon?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</p>
    <p className="text-lg font-bold text-slate-800">{value} {hint && <span className="text-xs font-semibold text-slate-500">{hint}</span>}</p>
    {bar != null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-500" style={{ width: `${bar}%` }} /></div>}
  </div>
}

function Score({ v, d, showCount }: { v: { value: number | null; provisional: boolean }; d?: StudentDimension; showCount?: boolean }) {
  if (!d || !d.expected) return <span className="text-xs text-slate-400">No aplica</span>
  // En coevaluación la cuenta es de lo que RECIBIÓ: «sin responder» sonaba a culpa del estudiante.
  if (v.value == null) return <span className="text-xs font-semibold text-amber-700">{showCount ? `Aún sin evaluaciones (${d.received}/${d.expected})` : 'Sin responder'}</span>
  return <span className="whitespace-nowrap">
    <b className="text-slate-800">{fmt(v.value)}</b>
    {v.provisional && (d.consolidated
      ? <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700" title="Faltan respuestas: esta nota no se enviará a la planilla">incompleta</span>
      : <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500" title="Calculada con lo que ya enviaron; aún no se ha consolidado">prov.</span>)}
    {showCount && <span className={`ml-1 text-xs ${d.received < d.expected ? 'text-amber-700' : 'text-slate-400'}`}>{d.received}/{d.expected}</span>}
  </span>
}

function Gap({ diff, gap }: { diff: number | null; gap: number }) {
  if (diff == null) return <span className="text-xs text-slate-400">—</span>
  if (diff >= gap) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Se ve {fmt(diff)} más alto</span>
  if (diff <= -gap) return <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">Se ve {fmt(-diff)} más bajo</span>
  return <span className="text-xs text-emerald-700">Coinciden</span>
}

function Bar({ value, scale }: { value: number | null; scale: { min: number; max: number } }) {
  if (value == null) return <span className="text-xs text-slate-400">Sin respuestas</span>
  const pct = scale.max > scale.min ? ((value - scale.min) / (scale.max - scale.min)) * 100 : 100
  const tone = pct < 40 ? 'bg-rose-400' : pct < 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return <span className="flex items-center gap-2">
    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><span className={`block h-full ${tone}`} style={{ width: `${Math.max(pct, 3)}%` }} /></span>
    <b className="w-8 text-right text-xs text-slate-700">{fmt(value)}</b>
  </span>
}

function Distribution({ criterion, stat }: { criterion: InsightCriterion; stat?: CriterionStat }) {
  if (!stat?.responses) return null
  return <span className="text-[11px] text-slate-500">{criterion.levels.filter(l => stat.levels[l.id]).map(l => `${l.label} ${stat.levels[l.id]}`).join(' · ')}</span>
}

function StudentDetail({ student, self, peer, gap, onReviewComment, busyComment }: {
  student: InsightStudent; self?: InsightDimension; peer?: InsightDimension; gap: number
  onReviewComment: (assignmentId: string, status: 'APPROVED' | 'REJECTED') => void; busyComment: string | null
}) {
  const base = self ?? peer
  if (!base) return null
  const sd = self && student.perDimension[self.id]
  const pd = peer && student.perDimension[peer.id]
  // Con preguntas relacionadas se comparan en la misma fila (mismo orden y aspecto).
  const mirrored = !!self && !!peer && self.criteria.length === peer.criteria.length && self.criteria.every((c, i) => c.name.trim().toLowerCase() === peer.criteria[i].name.trim().toLowerCase())
  const selfLevel = (c: InsightCriterion) => {
    const id = Object.keys(sd?.byCriterion[c.id]?.levels ?? {})[0]
    return c.levels.find(l => l.id === id)
  }
  const table = (dim: InsightDimension, withPeer: boolean) => <table className="w-full text-xs">
    <thead className="text-left text-slate-500"><tr>
      <th className="py-1 pr-2">Pregunta</th>
      {dim === self && <th className="py-1 pr-2">Se calificó</th>}
      {withPeer && <th className="py-1 pr-2">Sus compañeros (promedio)</th>}
      {dim === peer && !withPeer && <th className="py-1 pr-2">Sus compañeros (promedio)</th>}
    </tr></thead>
    <tbody>
      {groupByAspect(dim.criteria).map((group, g) => <Fragment key={g}>
        <tr><td colSpan={3} className="pt-2 text-[11px] font-bold uppercase tracking-wide text-teal-800">{group.aspect}</td></tr>
        {group.items.map(({ criterion: c, index }) => {
          const own = dim === self ? selfLevel(c) : undefined
          const peerCriterion = withPeer ? peer!.criteria[index] : dim === peer ? c : undefined
          const peerStat = peerCriterion ? pd?.byCriterion[peerCriterion.id] : undefined
          const off = own && peerStat?.average != null ? own.score - peerStat.average : null
          return <tr key={c.id} className="border-t border-slate-200/70">
            <td className="py-1 pr-2 text-slate-700"><span className="text-slate-400">{index + 1}.</span> {c.description || c.name}</td>
            {dim === self && <td className="py-1 pr-2 whitespace-nowrap">{own ? <><b>{own.label}</b> <span className="text-slate-400">({fmt(own.score)})</span></> : <span className="text-slate-400">—</span>}</td>}
            {peerCriterion && <td className="py-1 pr-2 whitespace-nowrap">
              {peerStat?.average != null
                ? <><b>{fmt(peerStat.average)}</b> <span className="text-slate-400">· {peerStat.responses} resp.</span>{off != null && Math.abs(off) >= gap && <span className={`ml-1 font-semibold ${off > 0 ? 'text-amber-700' : 'text-sky-700'}`}>{off > 0 ? '▲' : '▼'}</span>}</>
                : <span className="text-slate-400">—</span>}
            </td>}
          </tr>
        })}
      </Fragment>)}
    </tbody>
  </table>

  return <div className="space-y-3">
    {mirrored
      ? table(self!, true)
      : <div className="grid gap-3 lg:grid-cols-2">
        {self && <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><UserRound className="h-3.5 w-3.5" /> {self.label}</p>{table(self, false)}</div>}
        {peer && <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><Users className="h-3.5 w-3.5" /> {peer.label}</p>{table(peer, false)}</div>}
      </div>}
    {mirrored && <p className="text-[11px] text-slate-500">▲ se calificó más alto que sus compañeros · ▼ más bajo.</p>}
    <div>
      <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><MessageSquare className="h-3.5 w-3.5" /> Comentarios</p>
      {student.comments.length
        ? <div className="space-y-1.5">{student.comments.map((c, i) => <CommentRow key={i} comment={c} dimension={c.fromSelf ? self?.label : peer?.label} onReviewComment={onReviewComment} busy={busyComment === c.assignmentId} />)}</div>
        : <p className="text-xs text-slate-400">Sin comentarios.</p>}
    </div>
  </div>
}

function CommentRow({ comment: c, target, dimension, onReviewComment, busy }: {
  comment: InsightComment; target?: string; dimension?: string
  onReviewComment: (assignmentId: string, status: 'APPROVED' | 'REJECTED') => void; busy: boolean
}) {
  return <div className={`rounded-lg border bg-white p-2.5 text-sm ${c.status === 'REJECTED' ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
    <p className="text-xs text-slate-500">
      {c.fromSelf ? <><b className="text-slate-700">{c.author}</b> sobre sí mismo</> : <><b className="text-slate-700">{c.author}</b>{target ? <> sobre <b className="text-slate-700">{target}</b></> : ' (compañero)'}</>}
      {dimension && <> · {dimension}</>}{c.prompt && <> · «{c.prompt}»</>}
    </p>
    <p className="mt-0.5 text-slate-800">{c.text}</p>
    {!c.fromSelf && <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      {c.status === 'PENDING_REVIEW' && <span className="font-semibold text-amber-700">Sin revisar</span>}
      {c.status === 'APPROVED' && <span className="font-semibold text-emerald-700">Aprobado</span>}
      {c.status === 'REJECTED' && <span className="font-semibold text-slate-500">Oculto</span>}
      {c.status !== 'APPROVED' && <button type="button" disabled={busy} onClick={() => onReviewComment(c.assignmentId, 'APPROVED')} className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5" /> Aprobar</button>}
      {c.status !== 'REJECTED' && <button type="button" disabled={busy} onClick={() => onReviewComment(c.assignmentId, 'REJECTED')} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline disabled:opacity-50"><EyeOff className="h-3.5 w-3.5" /> Ocultar</button>}
    </div>}
  </div>
}
