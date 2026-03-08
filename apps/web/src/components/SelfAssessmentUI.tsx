import { useState, useEffect, useCallback } from 'react'
import { classroomApi } from '../lib/api'
import {
  Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Star, Send, BarChart3, Users, RefreshCw, X, Sparkles,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Rubric {
  id: string
  name: string
  description?: string
  type: string
  targetProcess?: string
  isDefault: boolean
  criteria: Criterion[]
  _count?: { activities: number; submissions: number }
}

interface Criterion {
  id: string
  name: string
  description?: string
  weight: number
  order: number
  levels: CriterionLevel[]
}

interface CriterionLevel {
  id: string
  score: number
  label: string
  description?: string
  order: number
}

interface ActivityResult {
  activity: any
  submissions: any[]
  consolidatedScores: any[]
  stats: { totalSubmissions: number; averageScore: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Color por score (1-5)
// ═══════════════════════════════════════════════════════════════════════════

function scoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-600'
  if (score >= 3.5) return 'text-blue-600'
  if (score >= 2.5) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 4.5) return 'bg-emerald-50 border-emerald-200'
  if (score >= 3.5) return 'bg-blue-50 border-blue-200'
  if (score >= 2.5) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function levelBg(score: number, maxScore: number): string {
  const ratio = score / maxScore
  if (ratio >= 0.9) return 'bg-emerald-100 border-emerald-300 text-emerald-800'
  if (ratio >= 0.7) return 'bg-blue-100 border-blue-300 text-blue-800'
  if (ratio >= 0.5) return 'bg-amber-100 border-amber-300 text-amber-800'
  return 'bg-red-100 border-red-300 text-red-800'
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. TEACHER: CREATE SELF-ASSESSMENT ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════

export function CreateSelfAssessmentForm({ classroomId, sectionId, onCreated, onCancel }: {
  classroomId: string
  sectionId: string
  onCreated: () => void
  onCancel: () => void
}) {
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [selectedRubricId, setSelectedRubricId] = useState('')
  const [title, setTitle] = useState('Autoevaluación Actitudinal')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [expandedRubric, setExpandedRubric] = useState<string | null>(null)

  useEffect(() => {
    loadRubrics()
  }, [])

  const loadRubrics = async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.listRubrics('SELF_ASSESSMENT')
      setRubrics(data)
      // Auto-seleccionar la default
      const def = data.find((r: Rubric) => r.isDefault)
      if (def) setSelectedRubricId(def.id)
    } catch {
      setError('Error al cargar rúbricas')
    } finally {
      setLoading(false)
    }
  }

  const handleSeedDefaults = async () => {
    try {
      await classroomApi.seedDefaultRubrics()
      await loadRubrics()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear rúbricas por defecto')
    }
  }

  const handleCreate = async () => {
    if (!title.trim() || !sectionId || !selectedRubricId) return
    try {
      setCreating(true)
      setError('')
      await classroomApi.createActivity(classroomId, {
        sectionId,
        type: 'SELF_ASSESSMENT',
        title,
        description: description || undefined,
        dueDate: dueDate || undefined,
        maxScore: 5.0,
        rubricId: selectedRubricId,
      })
      onCreated()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear actividad')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-teal-200 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Nueva Autoevaluación</h3>
          <p className="text-sm text-slate-500">Los estudiantes evaluarán su actitud usando una rúbrica</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Título de la autoevaluación"
        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-teal-500 outline-none"
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Instrucciones para los estudiantes (opcional)"
        rows={2}
        className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-teal-500 outline-none resize-none"
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite (opcional)</label>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="w-full sm:w-64 border border-slate-300 rounded-xl px-4 py-3 text-base"
        />
      </div>

      {/* Rubric selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700">Rúbrica de evaluación</label>
          {rubrics.length === 0 && (
            <button onClick={handleSeedDefaults} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              Crear rúbricas por defecto
            </button>
          )}
        </div>

        {rubrics.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
            <Star className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No hay rúbricas de autoevaluación creadas</p>
            <button onClick={handleSeedDefaults} className="mt-2 text-sm font-medium text-teal-600 hover:text-teal-700">
              Crear rúbricas por defecto
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {rubrics.map(rubric => (
              <div key={rubric.id} className={`border-2 rounded-xl transition-all ${selectedRubricId === rubric.id ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                <button
                  onClick={() => setSelectedRubricId(rubric.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedRubricId === rubric.id ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                    {selectedRubricId === rubric.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{rubric.name}</span>
                      {rubric.isDefault && <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">Por defecto</span>}
                    </div>
                    {rubric.description && <p className="text-sm text-slate-500 truncate">{rubric.description}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">{rubric.criteria.length} criterios</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedRubric(expandedRubric === rubric.id ? null : rubric.id) }}
                    className="p-1 hover:bg-slate-100 rounded-lg"
                  >
                    {expandedRubric === rubric.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                </button>

                {/* Expanded rubric preview */}
                {expandedRubric === rubric.id && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="mt-3 space-y-2">
                      {rubric.criteria.map(c => (
                        <div key={c.id} className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-700">{c.name}</span>
                            <span className="text-xs text-slate-400">{c.weight}%</span>
                          </div>
                          {c.description && <p className="text-xs text-slate-500 mb-2">{c.description}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            {c.levels.map(l => (
                              <span key={l.id} className={`text-xs px-2 py-1 rounded-lg border ${levelBg(l.score, Math.max(...c.levels.map(x => x.score)))}`}>
                                {l.label} ({l.score})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl" style={{ minHeight: '44px' }}>
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || !selectedRubricId || creating}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
          style={{ minHeight: '44px' }}
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          {creating ? 'Creando...' : 'Crear Autoevaluación'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. STUDENT: RESPOND TO SELF-ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════

export function StudentSelfAssessment({ activity, onSubmitted }: {
  activity: any
  onSubmitted: () => void
}) {
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [responses, setResponses] = useState<Record<string, string>>({}) // criterionId -> levelId
  const [reflection, setReflection] = useState('')
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [previousSubmission, setPreviousSubmission] = useState<any>(null)

  useEffect(() => {
    loadRubric()
  }, [activity.id])

  const loadRubric = async () => {
    try {
      setLoading(true)
      // Prefer rubric already included in activity (from getActivity), fallback to API
      if (activity.rubric?.criteria?.length) {
        setRubric(activity.rubric)
      } else {
        const rubricId = activity.rubricId || activity.metadata?.rubricId
        if (!rubricId) {
          setError('Esta actividad no tiene una rúbrica asociada')
          return
        }
        const { data } = await classroomApi.getRubric(rubricId)
        setRubric(data)
      }

      // Check if already submitted via my-submission endpoint first, then results
      try {
        const { data: mySub } = await classroomApi.getMySubmission(activity.id)
        if (mySub && mySub.id) {
          setAlreadySubmitted(true)
          setPreviousSubmission(mySub)
        }
      } catch {
        // No submission yet — check attitudinal results as fallback
        try {
          const { data: results } = await classroomApi.getAttitudinalResults(activity.id)
          if (results.submissions?.length > 0) {
            setAlreadySubmitted(true)
            setPreviousSubmission(results.submissions[0])
          }
        } catch {
          // No results yet
        }
      }
    } catch {
      setError('Error al cargar la rúbrica')
    } finally {
      setLoading(false)
    }
  }

  const allCriteriaAnswered = rubric ? rubric.criteria.every(c => responses[c.id]) : false

  const handleSubmit = async () => {
    if (!rubric || !allCriteriaAnswered) return
    try {
      setSubmitting(true)
      setError('')
      await classroomApi.submitSelfAssessment(activity.id, {
        responses: Object.entries(responses).map(([criterionId, levelId]) => ({ criterionId, levelId })),
        reflection: reflection || undefined,
      })
      setSuccess(true)
      setTimeout(() => onSubmitted(), 1500)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar autoevaluación')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border-2 border-emerald-200 p-8 text-center space-y-3">
        <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
        <h3 className="text-xl font-bold text-slate-800">Autoevaluación enviada</h3>
        <p className="text-slate-500">Tu autoevaluación ha sido registrada exitosamente</p>
      </div>
    )
  }

  if (alreadySubmitted && previousSubmission) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Ya enviaste tu autoevaluación</h3>
            <p className="text-sm text-slate-500">
              Nota obtenida: <span className={`font-bold ${scoreColor(Number(previousSubmission.calculatedScore))}`}>
                {Number(previousSubmission.calculatedScore).toFixed(2)}
              </span>
            </p>
          </div>
        </div>

        {previousSubmission.responses && (
          <div className="space-y-2">
            {previousSubmission.responses.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-slate-700">{r.criterion?.name}</span>
                <span className={`text-sm font-medium px-2.5 py-1 rounded-lg border ${levelBg(r.level?.score || 0, 5)}`}>
                  {r.level?.label} ({r.level?.score})
                </span>
              </div>
            ))}
          </div>
        )}

        {previousSubmission.reflection && (
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Tu reflexión:</p>
            <p className="text-sm text-slate-700">{previousSubmission.reflection}</p>
          </div>
        )}
      </div>
    )
  }

  if (!rubric) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-slate-500">{error || 'No se pudo cargar la rúbrica'}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-teal-200 p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Autoevaluación: {rubric.name}</h3>
          {rubric.description && <p className="text-sm text-slate-500">{rubric.description}</p>}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <p className="text-sm text-slate-600 bg-teal-50/50 border border-teal-100 rounded-xl px-4 py-3">
        Evalúa honestamente tu actitud en cada criterio. Selecciona el nivel que mejor describe tu comportamiento.
      </p>

      {/* Criteria */}
      <div className="space-y-4">
        {rubric.criteria.map((criterion, idx) => {
          const maxScore = Math.max(...criterion.levels.map(l => l.score))
          const selectedLevel = criterion.levels.find(l => l.id === responses[criterion.id])

          return (
            <div key={criterion.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 text-sm font-bold flex items-center justify-center">{idx + 1}</span>
                    <span className="font-semibold text-slate-800">{criterion.name}</span>
                  </div>
                  <span className="text-xs text-slate-400">{criterion.weight}%</span>
                </div>
                {criterion.description && <p className="text-sm text-slate-500 mt-1 ml-9">{criterion.description}</p>}
              </div>

              <div className="p-3 space-y-2">
                {criterion.levels.map(level => {
                  const isSelected = responses[criterion.id] === level.id
                  return (
                    <button
                      key={level.id}
                      onClick={() => setResponses(prev => ({ ...prev, [criterion.id]: level.id }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>{level.label}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${levelBg(level.score, maxScore)}`}>
                              {level.score}
                            </span>
                          </div>
                          {level.description && (
                            <p className={`text-sm mt-0.5 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`}>{level.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedLevel && (
                <div className="px-4 pb-3">
                  <div className={`text-xs px-3 py-1.5 rounded-lg ${scoreBg(selectedLevel.score)}`}>
                    Seleccionaste: <strong>{selectedLevel.label}</strong> ({selectedLevel.score} pts)
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reflection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Reflexión personal <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          placeholder="¿Qué puedes mejorar? ¿Qué haces bien? Escribe tu reflexión..."
          rows={3}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-teal-500 outline-none resize-none"
        />
      </div>

      {/* Progress & Submit */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-sm text-slate-500">
          {Object.keys(responses).length} de {rubric.criteria.length} criterios respondidos
        </div>
        <button
          onClick={handleSubmit}
          disabled={!allCriteriaAnswered || submitting}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
          style={{ minHeight: '44px' }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? 'Enviando...' : 'Enviar Autoevaluación'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. TEACHER: VIEW RESULTS
// ═══════════════════════════════════════════════════════════════════════════

export function SelfAssessmentResults({ activity, onSync }: {
  activity: any
  onSync?: () => void
}) {
  const [results, setResults] = useState<ActivityResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState('')
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  const loadResults = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await classroomApi.getAttitudinalResults(activity.id)
      setResults(data)
    } catch {
      setError('Error al cargar resultados')
    } finally {
      setLoading(false)
    }
  }, [activity.id])

  useEffect(() => { loadResults() }, [loadResults])

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError('')
      // We need an academicTermId — get it from the classroom context
      // For now we'll prompt or use the first available
      const { data } = await classroomApi.syncAttitudinalToGradebook(activity.id, '')
      setSyncSuccess(`${data.synced} nota(s) sincronizada(s) al libro de calificaciones`)
      setTimeout(() => setSyncSuccess(''), 4000)
      onSync?.()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    )
  }

  if (!results) {
    return (
      <div className="text-center py-8 bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-slate-500">{error || 'No se encontraron resultados'}</p>
      </div>
    )
  }

  const { submissions, stats } = results
  const rubric = results.activity?.rubric

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {syncSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {syncSuccess}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <Users className="w-6 h-6 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold text-slate-800">{stats.totalSubmissions}</p>
          <p className="text-xs text-slate-500">Respuestas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${scoreBg(stats.averageScore)}`}>
          <BarChart3 className="w-6 h-6 mx-auto text-slate-500 mb-1" />
          <p className={`text-2xl font-bold ${scoreColor(stats.averageScore)}`}>{stats.averageScore.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Promedio</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center col-span-2 sm:col-span-1">
          <Star className="w-6 h-6 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-slate-800">{rubric?.criteria?.length || 0}</p>
          <p className="text-xs text-slate-500">Criterios</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={loadResults} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Submissions list */}
      {submissions.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
          <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay respuestas</p>
          <p className="text-sm text-slate-400 mt-1">Los estudiantes verán la rúbrica cuando publiques la actividad</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700">Respuestas de estudiantes</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {submissions.map((sub: any) => {
              const student = sub.evaluatorEnrollment?.student
              const score = Number(sub.calculatedScore || 0)
              const isExpanded = expandedStudent === sub.id

              return (
                <div key={sub.id}>
                  <button
                    onClick={() => setExpandedStudent(isExpanded ? null : sub.id)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700 shrink-0">
                      {student?.firstName?.[0]}{student?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {student?.firstName} {student?.lastName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(sub.submittedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-lg font-bold ${scoreColor(score)}`}>{score.toFixed(2)}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 ml-12 space-y-2">
                      {sub.responses?.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-slate-600">{r.criterion?.name}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${levelBg(r.level?.score || 0, 5)}`}>
                            {r.level?.label} ({r.level?.score})
                          </span>
                        </div>
                      ))}
                      {sub.reflection && (
                        <div className="bg-teal-50/50 rounded-lg px-3 py-2 border border-teal-100">
                          <p className="text-xs font-medium text-teal-600 mb-0.5">Reflexión:</p>
                          <p className="text-sm text-slate-700">{sub.reflection}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Criteria breakdown */}
      {submissions.length > 0 && rubric?.criteria && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h4 className="text-sm font-semibold text-slate-700">Promedio por criterio</h4>
          </div>
          <div className="p-4 space-y-3">
            {rubric.criteria.map((c: Criterion) => {
              // Calculate average for this criterion
              const criterionScores = submissions
                .flatMap((s: any) => s.responses || [])
                .filter((r: any) => r.criterionId === c.id)
                .map((r: any) => Number(r.level?.score || 0))
              const avg = criterionScores.length > 0
                ? criterionScores.reduce((a: number, b: number) => a + b, 0) / criterionScores.length
                : 0
              const maxScore = Math.max(...c.levels.map(l => l.score))
              const pct = maxScore > 0 ? (avg / maxScore) * 100 : 0

              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    <span className={`text-sm font-bold ${scoreColor(avg)}`}>{avg.toFixed(1)}/{maxScore}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${avg >= maxScore * 0.7 ? 'bg-emerald-500' : avg >= maxScore * 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
