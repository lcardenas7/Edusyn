import { useCallback, useEffect, useState } from 'react'
import { Route, Plus, Target, Trash2, X, BookOpen, Headphones, Mic, PenLine, Circle, ChevronLeft, Check, Loader2, Sparkles } from 'lucide-react'
import { learningRouteApi, classroomApi, type RouteSummary, type RouteView, type CompetencyView, type RouteProgress, type RoutePlan } from '../lib/api'

const SKILL_ICON: Record<string, any> = { READING: BookOpen, LISTENING: Headphones, SPEAKING: Mic, WRITING: PenLine }
const SKILL_LABEL: Record<string, string> = { READING: 'Lectura', LISTENING: 'Escucha', SPEAKING: 'Habla', WRITING: 'Escritura' }
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const SKILLS = ['READING', 'LISTENING', 'SPEAKING', 'WRITING']

function stepIcon(skill?: string | null) { return (skill && SKILL_ICON[skill]) || Circle }

export default function LearningRoutesTab({ classroomId, isTeacher }: { classroomId: string; isTeacher: boolean }) {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [selected, setSelected] = useState<RouteView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showValeria, setShowValeria] = useState(false)

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await learningRouteApi.listByClassroom(classroomId)
      setRoutes(data)
    } catch { setError('No se pudieron cargar las rutas') } finally { setLoading(false) }
  }, [classroomId])

  useEffect(() => { loadRoutes() }, [loadRoutes])

  const openRoute = async (id: string) => {
    try { const { data } = await learningRouteApi.get(id); setSelected(data) } catch { setError('No se pudo abrir la ruta') }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>

  if (selected) {
    return <RouteDetail route={selected} classroomId={classroomId} isTeacher={isTeacher} onBack={() => { setSelected(null); loadRoutes() }} onReload={() => openRoute(selected.id)} />
  }

  const visible = isTeacher ? routes : routes.filter(r => r.isPublished)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Route className="w-5 h-5 text-violet-600" /> Rutas de aprendizaje</h3>
          <p className="text-sm text-slate-500">Pasos que convergen en una competencia</p>
        </div>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowValeria(true)} className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 text-sm font-medium">
              <Sparkles className="w-4 h-4" /> Armar con Valeria
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Crear ruta
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {visible.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          {isTeacher ? 'Aún no has creado rutas. Crea la primera para organizar el aprendizaje por competencias.' : 'Tu docente aún no ha publicado rutas.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map(r => (
            <button key={r.id} onClick={() => openRoute(r.id)} className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-violet-200 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    {r.title}
                    {!r.isPublished && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Borrador</span>}
                  </div>
                  {r.targetCompetency && (
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-amber-500" /> {r.targetCompetency.statement}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.targetLevel && <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{r.targetLevel}</span>}
                  <span className="text-xs text-slate-400">{r.stepsCount} pasos</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && <CreateRouteModal classroomId={classroomId} onClose={() => setShowCreate(false)} onCreated={(r) => { setShowCreate(false); loadRoutes(); openRoute(r.id) }} />}
      {showValeria && <ValeriaRouteModal classroomId={classroomId} onClose={() => setShowValeria(false)} onCreated={(r) => { setShowValeria(false); loadRoutes(); openRoute(r.id) }} />}
    </div>
  )
}

// ─── Armar ruta con Valeria (IA) ─────────────────────────────────────────────
function ValeriaRouteModal({ classroomId, onClose, onCreated }: { classroomId: string; onClose: () => void; onCreated: (r: RouteView) => void }) {
  const [objective, setObjective] = useState('')
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const generate = async () => {
    if (!objective.trim()) { setErr('Escribe qué quieres que logren'); return }
    try { setErr(''); setLoading(true); const { data } = await learningRouteApi.generate({ objective: objective.trim() }); setPlan(data) }
    catch { setErr('Valeria no pudo generar la ruta. Intenta de nuevo.') } finally { setLoading(false) }
  }
  const accept = async () => {
    if (!plan) return
    try { setSaving(true); const { data } = await learningRouteApi.fromPlan({ classroomId, plan }); onCreated(data) }
    catch { setErr('No se pudo crear la ruta'); setSaving(false) }
  }

  return (
    <ModalShell title="Armar ruta con Valeria" onClose={onClose}>
      {!plan ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Describe qué quieres que logren tus estudiantes y Valeria propondrá una ruta alineada al CEFR.</p>
          <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3} placeholder="Ej. Que puedan describir su familia y su rutina diaria en inglés" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button onClick={generate} disabled={loading} className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Valeria está diseñando…</> : <><Sparkles className="w-4 h-4" /> Generar ruta</>}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="font-medium text-slate-800">{plan.title}</div>
            {plan.description && <p className="text-xs text-slate-500">{plan.description}</p>}
            <span className="inline-block mt-1 text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">Objetivo {plan.targetLevel} · {SKILL_LABEL[plan.targetSkill] || plan.targetSkill}</span>
          </div>
          <ol className="space-y-2">
            {plan.steps.map((s, i) => {
              const Icon = stepIcon(s.skill)
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600"><Icon className="w-4 h-4" /></div>
                  <span className="text-slate-700">{s.title}</span>
                  <span className="text-xs text-slate-400 ml-auto">{SKILL_LABEL[s.skill] || s.skill}</span>
                </li>
              )
            })}
          </ol>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setPlan(null)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-50">Reintentar</button>
            <button onClick={accept} disabled={saving} className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">{saving ? 'Creando…' : 'Crear esta ruta'}</button>
          </div>
        </div>
      )}
    </ModalShell>
  )
}

// ─── Detalle de la ruta (mapa de pasos) ──────────────────────────────────────
function RouteDetail({ route, classroomId, isTeacher, onBack, onReload }: { route: RouteView; classroomId: string; isTeacher: boolean; onBack: () => void; onReload: () => void }) {
  const [showAddStep, setShowAddStep] = useState(false)
  const [progress, setProgress] = useState<RouteProgress | null>(null)

  // Estudiante: cargar su progreso (% dominado + estado por paso)
  useEffect(() => {
    if (isTeacher) return
    learningRouteApi.progress(route.id).then(({ data }) => setProgress(data)).catch(() => setProgress(null))
  }, [isTeacher, route.id])

  const stepProgress = (stepId: string) => progress?.steps.find(s => s.id === stepId)

  const publish = async () => { await learningRouteApi.update(route.id, { isPublished: !route.isPublished }); onReload() }
  const removeRoute = async () => { if (confirm('¿Eliminar esta ruta y sus pasos?')) { await learningRouteApi.remove(route.id); onBack() } }
  const removeStep = async (stepId: string) => { await learningRouteApi.removeStep(stepId); onReload() }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /> Todas las rutas</button>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{route.title}</h3>
            {route.description && <p className="text-sm text-slate-500 mt-1">{route.description}</p>}
          </div>
          {route.targetLevel && <span className="text-sm font-medium text-violet-700 bg-violet-50 px-3 py-1 rounded-full shrink-0">Nivel {route.targetLevel}</span>}
        </div>

        {route.targetCompetency && (
          <div className="mt-3 flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
            <Target className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-sm text-amber-900">{route.targetCompetency.statement}
              <span className="text-xs text-amber-700 ml-1">· {route.targetCompetency.level} {route.targetCompetency.skill && SKILL_LABEL[route.targetCompetency.skill]}</span>
            </div>
          </div>
        )}

        {!isTeacher && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Tu dominio</span>
              <span className="flex items-center gap-2 text-slate-500">
                {progress.demonstrated && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">¡Demostrado!</span>}
                {progress.targetMastery}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700" style={{ width: `${progress.targetMastery}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{progress.completedSteps} de {progress.totalSteps} pasos con evidencia</p>
          </div>
        )}

        {isTeacher && (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={publish} className={`text-sm font-medium px-3 py-1.5 rounded-lg ${route.isPublished ? 'bg-slate-100 text-slate-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              {route.isPublished ? 'Despublicar' : 'Publicar'}
            </button>
            <button onClick={removeRoute} className="text-sm text-red-600 hover:text-red-700 px-2 py-1.5 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Eliminar</button>
          </div>
        )}
      </div>

      {/* Mapa de pasos */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-700">Pasos ({route.steps.length})</h4>
          {isTeacher && <button onClick={() => setShowAddStep(true)} className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1"><Plus className="w-4 h-4" /> Añadir paso</button>}
        </div>

        {route.steps.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aún no hay pasos. {isTeacher && 'Añade el primero.'}</p>
        ) : (
          <ol className="relative space-y-3">
            {route.steps.map((s, i) => {
              const Icon = stepIcon(s.competency?.skill)
              const sp = stepProgress(s.id)
              const done = !isTeacher && sp?.done
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${done ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-violet-50 border-violet-200 text-violet-600'}`}>
                      {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    {i < route.steps.length - 1 && <div className={`w-0.5 h-4 mt-1 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                  </div>
                  <div className="flex-1 min-w-0 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{s.title}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        {s.competency && <span>{s.competency.level} {s.competency.skill && SKILL_LABEL[s.competency.skill]}</span>}
                        {isTeacher && (s.activity ? <span className="text-emerald-600">· {s.activity.title}</span> : <span className="text-slate-300">· sin actividad</span>)}
                        {!isTeacher && sp && sp.mastery > 0 && <span className="text-violet-600">· {sp.mastery}%</span>}
                      </div>
                    </div>
                    {isTeacher && <button onClick={() => removeStep(s.id)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </li>
              )
            })}
            <li className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600"><Target className="w-5 h-5" /></div>
              <div className="text-sm font-medium text-amber-800">Competencia alcanzada</div>
            </li>
          </ol>
        )}
      </div>

      {showAddStep && <AddStepModal routeId={route.id} classroomId={classroomId} onClose={() => setShowAddStep(false)} onAdded={() => { setShowAddStep(false); onReload() }} />}
    </div>
  )
}

// ─── Selector de competencia (grafo CEFR) ────────────────────────────────────
function CompetencyPicker({ value, onChange }: { value?: CompetencyView | null; onChange: (c: CompetencyView | null) => void }) {
  const [level, setLevel] = useState('A2')
  const [skill, setSkill] = useState('SPEAKING')
  const [options, setOptions] = useState<CompetencyView[]>([])

  useEffect(() => {
    learningRouteApi.competencies(level, skill).then(({ data }) => setOptions(data)).catch(() => setOptions([]))
  }, [level, skill])

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={level} onChange={e => setLevel(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={skill} onChange={e => setSkill(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
          {SKILLS.map(s => <option key={s} value={s}>{SKILL_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
        {options.map(o => (
          <button key={o.id} type="button" onClick={() => onChange(o)} className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 ${value?.id === o.id ? 'bg-violet-50 text-violet-800' : 'text-slate-600'}`}>
            {value?.id === o.id && <Check className="w-3.5 h-3.5 inline mr-1 text-violet-600" />}{o.statement}
          </button>
        ))}
        {options.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Sin competencias para este filtro</div>}
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CreateRouteModal({ classroomId, onClose, onCreated }: { classroomId: string; onClose: () => void; onCreated: (r: RouteView) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [comp, setComp] = useState<CompetencyView | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!title.trim()) { setErr('El título es obligatorio'); return }
    try {
      setSaving(true)
      const { data } = await learningRouteApi.create({ classroomId, title: title.trim(), description: description.trim() || undefined, targetCompetencyId: comp?.id })
      onCreated(data)
    } catch { setErr('No se pudo crear la ruta') } finally { setSaving(false) }
  }

  return (
    <ModalShell title="Crear ruta de aprendizaje" onClose={onClose}>
      <div className="space-y-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (ej. My family & routines)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción (opcional)" rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-sm font-medium text-slate-600 flex items-center gap-1 mb-1"><Target className="w-4 h-4 text-amber-500" /> Competencia objetivo</label>
          <CompetencyPicker value={comp} onChange={setComp} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
          {saving ? 'Creando…' : 'Crear ruta'}
        </button>
      </div>
    </ModalShell>
  )
}

function AddStepModal({ routeId, classroomId, onClose, onAdded }: { routeId: string; classroomId: string; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [comp, setComp] = useState<CompetencyView | null>(null)
  const [activityId, setActivityId] = useState('')
  const [activities, setActivities] = useState<{ id: string; title: string; type: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    classroomApi.listActivities(classroomId).then(({ data }) => {
      const list = Array.isArray(data) ? data : []
      setActivities(list.map((a: any) => ({ id: a.id, title: a.title, type: a.type })))
    }).catch(() => setActivities([]))
  }, [classroomId])

  // Al elegir actividad, autocompletar el título del paso si está vacío
  const onPickActivity = (id: string) => {
    setActivityId(id)
    if (id && !title.trim()) { const a = activities.find(x => x.id === id); if (a) setTitle(a.title) }
  }

  const save = async () => {
    if (!title.trim()) { setErr('El título del paso es obligatorio'); return }
    try {
      setSaving(true)
      await learningRouteApi.addStep(routeId, { title: title.trim(), competencyId: comp?.id, activityId: activityId || undefined })
      onAdded()
    } catch { setErr('No se pudo añadir el paso') } finally { setSaving(false) }
  }

  return (
    <ModalShell title="Añadir paso" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1 block">Actividad del aula (produce la evidencia)</label>
          <select value={activityId} onChange={e => onPickActivity(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">— Sin actividad (solo hito) —</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del paso (ej. Escucha · diálogo)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1 block">Competencia que trabaja (para medir el dominio)</label>
          <CompetencyPicker value={comp} onChange={setComp} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
          {saving ? 'Añadiendo…' : 'Añadir paso'}
        </button>
      </div>
    </ModalShell>
  )
}
