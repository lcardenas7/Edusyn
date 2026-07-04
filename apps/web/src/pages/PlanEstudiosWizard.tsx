import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, Calendar, Plus, Trash2, ChevronRight, ChevronLeft,
  CheckCircle2, Loader2, BookOpen, Clock, Sparkles, ArrowLeft
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { academicGradesApi, academicYearLifecycleApi, areasApi, academicTemplatesApi } from '../lib/api'

interface SubjectRow { name: string; weeklyHours: number }
interface AreaRow { name: string; subjects: SubjectRow[] }
interface CatalogArea { id: string; name: string; subjects?: { id: string; name: string }[] }

export default function PlanEstudiosWizard() {
  const { institution } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [years, setYears] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [catalog, setCatalog] = useState<CatalogArea[]>([])
  const [yearId, setYearId] = useState('')
  const [gradeId, setGradeId] = useState('')

  const [areas, setAreas] = useState<AreaRow[]>([{ name: '', subjects: [{ name: '', weeklyHours: 1 }] }])

  const [loading, setLoading] = useState(true)
  const [prefilling, setPrefilling] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!institution?.id) return
    ;(async () => {
      try {
        const [y, g, c] = await Promise.all([
          academicYearLifecycleApi.getByInstitution(institution.id),
          academicGradesApi.getAll(institution.id),
          areasApi.getAll(institution.id),
        ])
        const yearsList = y.data || []
        setYears(yearsList)
        setGrades((g.data || []).filter((gr: any) => gr.stage !== 'PREESCOLAR'))
        setCatalog(c.data || [])
        const active = yearsList.find((yy: any) => yy.status === 'ACTIVE') || yearsList[0]
        if (active) setYearId(active.id)
      } finally {
        setLoading(false)
      }
    })()
  }, [institution?.id])

  // Precargar el plan existente del grado (modo edición)
  useEffect(() => {
    if (!gradeId || !yearId) return
    ;(async () => {
      setPrefilling(true)
      try {
        const res = await academicTemplatesApi.getGradeTemplate(gradeId, yearId)
        const tmpl = res.data?.template ?? res.data
        const tas = tmpl?.templateAreas ?? []
        if (Array.isArray(tas) && tas.length > 0) {
          setAreas(tas.map((ta: any) => ({
            name: ta.area?.name ?? '',
            subjects: (ta.templateSubjects ?? []).map((ts: any) => ({
              name: ts.subject?.name ?? '',
              weeklyHours: ts.weeklyHours ?? 1,
            })) || [],
          })).filter((a: AreaRow) => a.name))
        } else {
          setAreas([{ name: '', subjects: [{ name: '', weeklyHours: 1 }] }])
        }
      } catch {
        setAreas([{ name: '', subjects: [{ name: '', weeklyHours: 1 }] }])
      } finally {
        setPrefilling(false)
      }
    })()
  }, [gradeId, yearId])

  const subjectSuggestions = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach(a => a.subjects?.forEach(s => set.add(s.name)))
    return Array.from(set)
  }, [catalog])

  const totalHours = useMemo(
    () => areas.reduce((sum, a) => sum + a.subjects.reduce((s, sub) => s + (Number(sub.weeklyHours) || 0), 0), 0),
    [areas]
  )

  const validPlan = areas.some(a => a.name.trim() && a.subjects.some(s => s.name.trim()))
  const gradeName = grades.find(g => g.id === gradeId)?.name || ''
  const yearName = years.find(y => y.id === yearId)?.name || years.find(y => y.id === yearId)?.year || ''

  // Mutadores
  const setArea = (i: number, patch: Partial<AreaRow>) => setAreas(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  const setSubject = (ai: number, si: number, patch: Partial<SubjectRow>) =>
    setAreas(prev => prev.map((a, idx) => idx !== ai ? a : { ...a, subjects: a.subjects.map((s, j) => j === si ? { ...s, ...patch } : s) }))
  const addArea = () => setAreas(prev => [...prev, { name: '', subjects: [{ name: '', weeklyHours: 1 }] }])
  const removeArea = (i: number) => setAreas(prev => prev.filter((_, idx) => idx !== i))
  const addSubject = (ai: number) => setAreas(prev => prev.map((a, idx) => idx === ai ? { ...a, subjects: [...a.subjects, { name: '', weeklyHours: 1 }] } : a))
  const removeSubject = (ai: number, si: number) => setAreas(prev => prev.map((a, idx) => idx === ai ? { ...a, subjects: a.subjects.filter((_, j) => j !== si) } : a))

  const submit = async () => {
    setSubmitting(true)
    setResult(null)
    try {
      const payload = {
        institutionId: institution!.id,
        academicYearId: yearId,
        gradeId,
        areas: areas
          .filter(a => a.name.trim() && a.subjects.some(s => s.name.trim()))
          .map(a => ({
            newAreaName: a.name.trim(),
            subjects: a.subjects
              .filter(s => s.name.trim())
              .map(s => ({ newSubjectName: s.name.trim(), weeklyHours: Math.max(0, Math.trunc(Number(s.weeklyHours) || 0)) })),
          })),
      }
      await academicTemplatesApi.quickSetup(payload)
      setResult({ ok: true, msg: `Plan de estudios de ${gradeName} guardado y asignado (${yearName}).` })
    } catch (e: any) {
      setResult({ ok: false, msg: e?.response?.data?.message || 'No se pudo guardar el plan. Intenta de nuevo.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando…</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/academic" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asistente: Plan de Estudios</h1>
          <p className="text-gray-500 text-sm">Arma el plan de un grado en 3 pasos. Nosotros creamos el catálogo, la plantilla y la asignación por ti.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {[{ n: 1, t: 'Grado y año' }, { n: 2, t: 'Materias y horas' }, { n: 3, t: 'Confirmar' }].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${step === s.n ? 'bg-purple-600 text-white' : step > s.n ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
              <span className="font-semibold">{s.n}</span> {s.t}
            </div>
            {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {result?.ok ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          <p className="font-medium text-green-900">{result.msg}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setStep(1); setGradeId(''); setResult(null) }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Armar otro grado</button>
            <Link to="/academic-templates" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Ver plantillas</Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {/* PASO 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><Calendar className="w-4 h-4" /> Año académico</label>
                <select value={yearId} onChange={e => setYearId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  {years.map(y => <option key={y.id} value={y.id}>{y.name || `Año ${y.year}`} {y.status === 'ACTIVE' ? '(Activo)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1"><GraduationCap className="w-4 h-4" /> Grado</label>
                <select value={gradeId} onChange={e => setGradeId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Selecciona un grado…</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Preescolar no aparece: se evalúa por dimensiones, no por asignaturas.</p>
              </div>
              <div className="flex justify-end">
                <button disabled={!gradeId || !yearId} onClick={() => setStep(2)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Plan de <strong>{gradeName}</strong> — {yearName}{prefilling && <span className="text-gray-400"> · cargando plan actual…</span>}</p>
                <span className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-4 h-4" /> {totalHours} h/semana</span>
              </div>

              <datalist id="area-suggestions">{catalog.map(a => <option key={a.id} value={a.name} />)}</datalist>
              <datalist id="subject-suggestions">{subjectSuggestions.map((s, i) => <option key={i} value={s} />)}</datalist>

              {areas.map((area, ai) => (
                <div key={ai} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <input list="area-suggestions" value={area.name} onChange={e => setArea(ai, { name: e.target.value })}
                      placeholder="Área (ej. Matemáticas)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-medium" />
                    <button onClick={() => removeArea(ai)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="pl-6 space-y-2">
                    {area.subjects.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <input list="subject-suggestions" value={s.name} onChange={e => setSubject(ai, si, { name: e.target.value })}
                          placeholder="Asignatura (ej. Álgebra)" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                        <input type="number" min={0} max={40} value={s.weeklyHours} onChange={e => setSubject(ai, si, { weeklyHours: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center" />
                        <span className="text-xs text-gray-400 w-10">h/sem</span>
                        <button onClick={() => removeSubject(ai, si)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <button onClick={() => addSubject(ai)} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar asignatura</button>
                  </div>
                </div>
              ))}

              <button onClick={addArea} className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Agregar área</button>

              <div className="flex justify-between pt-4 border-t border-gray-100">
                <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Atrás</button>
                <button disabled={!validPlan} onClick={() => setStep(3)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">Revisar <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Confirma el plan de <strong>{gradeName}</strong> — {yearName}</h3>
              <div className="border border-gray-200 rounded-lg divide-y">
                {areas.filter(a => a.name.trim() && a.subjects.some(s => s.name.trim())).map((a, i) => (
                  <div key={i} className="p-3">
                    <p className="font-medium text-gray-800">{a.name}</p>
                    <ul className="text-sm text-gray-600 mt-1 space-y-0.5">
                      {a.subjects.filter(s => s.name.trim()).map((s, j) => (
                        <li key={j} className="flex justify-between"><span>{s.name}</span><span className="text-gray-400">{s.weeklyHours} h/sem</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">Total: <strong>{totalHours} horas/semana</strong>. Las materias nuevas se crean en el catálogo; las existentes se reutilizan. Luego asigna docentes en Carga Académica.</p>
              {result && !result.ok && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{result.msg}</p>}
              <div className="flex justify-between pt-4 border-t border-gray-100">
                <button onClick={() => setStep(2)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"><ChevronLeft className="w-4 h-4" /> Atrás</button>
                <button disabled={submitting} onClick={submit} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><CheckCircle2 className="w-4 h-4" /> Guardar plan de estudios</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
