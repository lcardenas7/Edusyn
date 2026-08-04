import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from './ui/confirm'
import { Route, Plus, Target, Trash2, X, BookOpen, Headphones, Mic, PenLine, Circle, ChevronLeft, Check, Loader2, Sparkles, Eye, Pencil } from 'lucide-react'
import { learningRouteApi, classroomApi, type RouteSummary, type RouteView, type CompetencyView, type RouteProgress, type RoutePlan } from '../lib/api'
import LessonPlayer from './LessonPlayer'
import LessonEditor from './LessonEditor'

const SKILL_ICON: Record<string, any> = { READING: BookOpen, LISTENING: Headphones, SPEAKING: Mic, WRITING: PenLine }
const SKILL_LABEL: Record<string, string> = { READING: 'Lectura', LISTENING: 'Escucha', SPEAKING: 'Habla', WRITING: 'Escritura' }
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const SKILLS = ['READING', 'LISTENING', 'SPEAKING', 'WRITING']
// Formato sugerido por Valeria según la habilidad (el docente puede cambiarlo)
const SUGGESTED_FORMAT: Record<string, string> = { READING: 'Lección', LISTENING: 'Lección', WRITING: 'Tarea', SPEAKING: 'Grabación' }

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
  const [instructions, setInstructions] = useState('')
  const [sourceMaterial, setSourceMaterial] = useState('')
  const [plan, setPlan] = useState<RoutePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const generate = async () => {
    if (!objective.trim()) { setErr('Escribe qué quieres que logren'); return }
    try {
      setErr(''); setLoading(true)
      const { data } = await learningRouteApi.generate({
        objective: objective.trim(),
        instructions: instructions.trim() || undefined,
        sourceMaterial: sourceMaterial.trim() || undefined,
      })
      setPlan(data)
    } catch { setErr('Valeria no pudo generar la ruta. Intenta de nuevo.') } finally { setLoading(false) }
  }
  const accept = async () => {
    if (!plan) return
    try {
      setSaving(true)
      const { data } = await learningRouteApi.fromPlan({
        classroomId, plan,
        instructions: instructions.trim() || undefined,
        sourceMaterial: sourceMaterial.trim() || undefined,
      })
      onCreated(data)
    } catch { setErr('No se pudo crear la ruta'); setSaving(false) }
  }

  return (
    <ModalShell title="Armar ruta con Valeria" onClose={onClose}>
      {!plan ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Dile a Valeria qué quieres lograr y <strong>cómo</strong>. Puedes pegar tu guía o documento base: la ruta y los ejercicios de cada paso se derivarán de él.</p>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">¿Qué quieres que logren? *</label>
            <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} placeholder="Ej. Que puedan describir su familia y su rutina diaria en inglés" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Indicaciones para Valeria (opcional)</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} placeholder="Ej. Usa vocabulario de la unidad 3, empieza por escucha, ejercicios cortos, incluye ejemplos de Colombia, nada de pasado simple aún…" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">Tienen prioridad sobre los valores por defecto y se aplican también a cada paso.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Material base / documento (opcional)</label>
            <textarea value={sourceMaterial} onChange={e => setSourceMaterial(e.target.value)} rows={4} placeholder="Pega aquí tu guía, taller o documento. Valeria derivará la ruta y las actividades de este material." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-xs" />
            {sourceMaterial.trim() && <p className="text-[11px] text-emerald-600 mt-1">✓ {sourceMaterial.trim().length.toLocaleString()} caracteres — se usará como base de la ruta y de cada paso.</p>}
          </div>
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
  const [doing, setDoing] = useState<{ id: string; type: string } | null>(null)
  const [generatingStep, setGeneratingStep] = useState<string | null>(null)
  const [attachingStep, setAttachingStep] = useState<string | null>(null)
  const [genStep, setGenStep] = useState<{ id: string; title: string; hasLesson: boolean } | null>(null)
  const [editingLesson, setEditingLesson] = useState<string | null>(null)

  // Estudiante: cargar su progreso (% dominado + estado por paso)
  const loadProgress = useCallback(() => {
    if (isTeacher) return
    learningRouteApi.progress(route.id).then(({ data }) => setProgress(data)).catch(() => setProgress(null))
  }, [isTeacher, route.id])
  useEffect(() => { loadProgress() }, [loadProgress])

  const stepProgress = (stepId: string) => progress?.steps.find(s => s.id === stepId)

  const publish = async () => { await learningRouteApi.update(route.id, { isPublished: !route.isPublished }); onReload() }
  const removeRoute = async () => { if ((await confirmDialog('¿Eliminar esta ruta y sus pasos?', { danger: true }))) { await learningRouteApi.remove(route.id); onBack() } }
  const removeStep = async (stepId: string) => { await learningRouteApi.removeStep(stepId); onReload() }
  const generateLesson = async (stepId: string, instructions?: string) => {
    try {
      setGenStep(null); setGeneratingStep(stepId)
      await learningRouteApi.generateStepLesson(stepId, instructions ? { instructions } : undefined)
      onReload()
    } catch { /* noop */ } finally { setGeneratingStep(null) }
  }

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
                      <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        {s.competency && <span>{s.competency.level} {s.competency.skill && SKILL_LABEL[s.competency.skill]}</span>}
                        {isTeacher && (s.activity
                          ? <span className="text-emerald-600">· {s.activity.type === 'LESSON' ? 'Lección' : s.activity.title}</span>
                          : <span className="text-violet-400">· Valeria sugiere: {(s.competency?.skill && SUGGESTED_FORMAT[s.competency.skill]) || 'Lección'}</span>)}
                        {!isTeacher && sp && sp.mastery > 0 && <span className="text-violet-600">· {sp.mastery}%</span>}
                      </div>
                    </div>
                    {!isTeacher && s.activity && (
                      <button onClick={() => setDoing({ id: s.activity!.id, type: s.activity!.type })} className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg ${done ? 'text-slate-500 bg-slate-100' : 'text-white bg-violet-600 hover:bg-violet-700'}`}>
                        {done ? 'Ver' : 'Hacer'}
                      </button>
                    )}
                    {isTeacher && (
                      <div className="flex items-center gap-1 shrink-0">
                        {s.activity && (
                          <button onClick={() => setDoing({ id: s.activity!.id, type: s.activity!.type })} title="Previsualizar"
                            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                        )}
                        {s.activity?.type === 'LESSON' && (
                          <button onClick={() => setEditingLesson(s.activity!.id)} title="Editar la lección"
                            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                        )}
                        <button onClick={() => setGenStep({ id: s.id, title: s.title, hasLesson: s.activity?.type === 'LESSON' })} disabled={generatingStep === s.id} title="Generar ejercicios interactivos con Valeria (con indicaciones)"
                          className="text-xs font-medium px-2 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-60 flex items-center gap-1">
                          {generatingStep === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {s.activity?.type === 'LESSON' ? 'Regenerar' : 'Valeria'}
                        </button>
                        {!s.activity && (
                          <button onClick={() => setAttachingStep(s.id)} title="Añadir/enlazar actividad manualmente"
                            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Actividad
                          </button>
                        )}
                        <button onClick={() => removeStep(s.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
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
      {doing && doing.type === 'LESSON' && (
        <LessonPlayer activityId={doing.id} isTeacher={isTeacher} onClose={() => { setDoing(null); loadProgress() }} />
      )}
      {doing && doing.type !== 'LESSON' && (
        <StepActivityModal activityId={doing.id} isTeacher={isTeacher} onClose={() => setDoing(null)} onSubmitted={() => { setDoing(null); loadProgress() }} />
      )}
      {attachingStep && (
        <AttachActivityModal stepId={attachingStep} classroomId={classroomId} onClose={() => setAttachingStep(null)} onDone={() => { setAttachingStep(null); onReload() }} />
      )}
      {editingLesson && (
        <div className="fixed inset-0 z-[100] bg-white">
          <LessonEditor
            activityId={editingLesson}
            classroomTitle={route.title}
            onClose={() => { setEditingLesson(null); onReload() }}
            onPreview={() => { setDoing({ id: editingLesson, type: 'LESSON' }); setEditingLesson(null) }}
          />
        </div>
      )}
      {genStep && (
        <GenerateStepModal step={genStep} hasRouteMaterial={!!route.hasSourceMaterial} hasRouteInstructions={!!route.hasInstructions}
          onClose={() => setGenStep(null)} onGenerate={(instr) => generateLesson(genStep.id, instr)} />
      )}
    </div>
  )
}

// ─── Generar los ejercicios de un paso con indicaciones (docente) ─────────────
function GenerateStepModal({ step, hasRouteMaterial, hasRouteInstructions, onClose, onGenerate }: {
  step: { id: string; title: string; hasLesson: boolean }
  hasRouteMaterial: boolean; hasRouteInstructions: boolean
  onClose: () => void; onGenerate: (instructions?: string) => void
}) {
  const [instructions, setInstructions] = useState('')
  return (
    <ModalShell title={step.hasLesson ? 'Regenerar ejercicios' : 'Generar ejercicios con Valeria'} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-xs text-slate-600"><strong>Paso:</strong> {step.title}</p>
          {(hasRouteMaterial || hasRouteInstructions) && (
            <p className="text-[11px] text-emerald-600 mt-1">
              ✓ Valeria usará {hasRouteMaterial && 'el material base'}{hasRouteMaterial && hasRouteInstructions && ' y '}{hasRouteInstructions && 'las indicaciones'} de la ruta.
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1 block">Indicaciones para este paso (opcional)</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4}
            placeholder="Ej. Céntrate en el vocabulario de la familia, 4 ejercicios, incluye un texto corto, evita el pasado…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <p className="text-[11px] text-slate-400 mt-1">Se suman a las de la ruta. Déjalo vacío para usar solo las de la ruta.</p>
        </div>
        {step.hasLesson && <p className="text-xs text-amber-600">⚠ Regenerar reemplaza los ejercicios actuales de este paso.</p>}
        <button onClick={() => onGenerate(instructions.trim() || undefined)}
          className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> {step.hasLesson ? 'Regenerar' : 'Generar'} ejercicios
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Adjuntar/enlazar una actividad a un paso existente (docente) ─────────────
function AttachActivityModal({ stepId, classroomId, onClose, onDone }: { stepId: string; classroomId: string; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [activityId, setActivityId] = useState('')
  const [activities, setActivities] = useState<{ id: string; title: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (mode !== 'link') return
    classroomApi.listActivities(classroomId).then(({ data }) => {
      setActivities((Array.isArray(data) ? data : []).map((a: any) => ({ id: a.id, title: a.title })))
    }).catch(() => setActivities([]))
  }, [classroomId, mode])

  const save = async () => {
    try {
      setSaving(true)
      if (mode === 'new') await learningRouteApi.createStepActivity(stepId, { activityType: 'TASK' })
      else { if (!activityId) { setErr('Elige una actividad'); setSaving(false); return } await learningRouteApi.updateStep(stepId, { activityId }) }
      onDone()
    } catch { setErr('No se pudo adjuntar'); setSaving(false) }
  }

  return (
    <ModalShell title="Añadir actividad al paso" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <button onClick={() => setMode('new')} className={`flex-1 py-1.5 rounded-md font-medium ${mode === 'new' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Crear tarea</button>
          <button onClick={() => setMode('link')} className={`flex-1 py-1.5 rounded-md font-medium ${mode === 'link' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Enlazar existente</button>
        </div>
        {mode === 'new' ? (
          <p className="text-xs text-slate-500">Crea una <strong>Tarea propia de la ruta</strong> (consigna de escritura) con el título del paso. No aparece en la pestaña Actividades. Para ejercicios interactivos, usa "Valeria".</p>
        ) : (
          <select value={activityId} onChange={e => setActivityId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">— Elige una actividad —</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button onClick={save} disabled={saving} className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Adjuntar al paso'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── El estudiante hace la actividad del paso (Writing/Tarea inline) ──────────
function StepActivityModal({ activityId, isTeacher, onClose, onSubmitted }: { activityId: string; isTeacher?: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [activity, setActivity] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([
      classroomApi.getActivity(activityId, 'student').then(r => r.data).catch(() => null),
      classroomApi.getMySubmission(activityId).then(r => r.data).catch(() => null),
    ]).then(([a, s]: any[]) => {
      setActivity(a)
      setSubmission(s)
      if (s?.content) setContent(s.content)
    }).finally(() => setLoading(false))
  }, [activityId])

  const isTask = (activity?.type || 'TASK') === 'TASK'
  const graded = submission && (submission.status === 'GRADED' || submission.status === 'AUTO_GRADED')
  const submitted = submission && submission.status && submission.status !== 'DRAFT'

  const submit = async () => {
    if (!content.trim()) { setErr('Escribe tu respuesta'); return }
    try { setSaving(true); await classroomApi.submitTask(activityId, { content: content.trim() }); onSubmitted() }
    catch { setErr('No se pudo enviar'); setSaving(false) }
  }

  return (
    <ModalShell title={activity?.title || 'Actividad'} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : isTeacher ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Vista previa (docente)</p>
          {activity?.description ? <p className="text-sm text-slate-600 whitespace-pre-wrap">{activity.description}</p> : <p className="text-sm text-slate-400">Consigna: {activity?.title}</p>}
          <p className="text-xs text-slate-400">El estudiante escribe su respuesta y la envía desde la ruta.</p>
        </div>
      ) : !isTask ? (
        <p className="text-sm text-slate-500">Este tipo de actividad se realiza desde la pestaña Actividades por ahora.</p>
      ) : (
        <div className="space-y-3">
          {activity?.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{activity.description}</p>}
          {graded ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                Calificada: <strong>{Number(submission.score)}</strong>{activity?.maxScore ? ` / ${Number(activity.maxScore)}` : ''}
              </div>
              {submission.feedback && <p className="text-sm text-slate-600"><strong>Retroalimentación:</strong> {submission.feedback}</p>}
              <div className="text-sm text-slate-500 whitespace-pre-wrap border border-slate-100 rounded-lg p-3">{content}</div>
            </div>
          ) : (
            <>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="Escribe tu respuesta aquí…" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              {submitted && <p className="text-xs text-amber-600">Ya enviaste esta actividad. Enviar de nuevo actualiza tu respuesta.</p>}
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button onClick={submit} disabled={saving} className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
                {saving ? 'Enviando…' : submitted ? 'Reenviar' : 'Enviar'}
              </button>
            </>
          )}
        </div>
      )}
    </ModalShell>
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
  const [mode, setMode] = useState<'new' | 'link'>('new')
  const [title, setTitle] = useState('')
  const [comp, setComp] = useState<CompetencyView | null>(null)
  const [activityId, setActivityId] = useState('')
  const [activities, setActivities] = useState<{ id: string; title: string; type: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (mode !== 'link') return
    classroomApi.listActivities(classroomId).then(({ data }) => {
      const list = Array.isArray(data) ? data : []
      setActivities(list.map((a: any) => ({ id: a.id, title: a.title, type: a.type })))
    }).catch(() => setActivities([]))
  }, [classroomId, mode])

  const onPickActivity = (id: string) => {
    setActivityId(id)
    if (id && !title.trim()) { const a = activities.find(x => x.id === id); if (a) setTitle(a.title) }
  }

  const save = async () => {
    if (!title.trim()) { setErr('El título del paso es obligatorio'); return }
    try {
      setSaving(true)
      if (mode === 'new') {
        // Crea una actividad propia de la ruta (no aparece en Actividades)
        await learningRouteApi.addStepWithActivity(routeId, { title: title.trim(), activityType: 'TASK', competencyId: comp?.id })
      } else {
        await learningRouteApi.addStep(routeId, { title: title.trim(), competencyId: comp?.id, activityId: activityId || undefined })
      }
      onAdded()
    } catch { setErr('No se pudo añadir el paso') } finally { setSaving(false) }
  }

  return (
    <ModalShell title="Añadir paso" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
          <button onClick={() => setMode('new')} className={`flex-1 py-1.5 rounded-md font-medium ${mode === 'new' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Crear para la ruta</button>
          <button onClick={() => setMode('link')} className={`flex-1 py-1.5 rounded-md font-medium ${mode === 'link' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Enlazar existente</button>
        </div>

        {mode === 'new' ? (
          <p className="text-xs text-slate-500">Se crea una actividad <strong>propia de esta ruta</strong> (no aparece en la pestaña Actividades). El estudiante la hace desde el mapa de la ruta.</p>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">Actividad del aula (produce la evidencia)</label>
            <select value={activityId} onChange={e => onPickActivity(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— Sin actividad (solo hito) —</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        )}

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={mode === 'new' ? 'Consigna (ej. Describe tu familia en 80 palabras)' : 'Título del paso'} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
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
