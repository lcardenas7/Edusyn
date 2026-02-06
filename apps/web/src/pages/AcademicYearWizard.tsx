import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Check, AlertCircle, Calendar, Users, Settings, Play, Square,
  Trash2, Plus, ArrowLeft, BookOpen, GraduationCap, UserCheck,
  ChevronRight, Loader2, Info, ExternalLink, RefreshCw, ClipboardList
} from 'lucide-react'
import { academicYearLifecycleApi, academicTermsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'

interface AcademicYear {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  startDate?: string
  endDate?: string
  activatedAt?: string
  closedAt?: string
  calendar?: any
  terms: any[]
  _count: {
    studentEnrollments: number
    teacherAssignments: number
  }
}

interface AcademicTerm {
  id: string
  name: string
  type: string
  order: number
  weightPercentage: number
  startDate?: string
  endDate?: string
}

type ViewMode = 'loading' | 'dashboard' | 'create' | 'periods' | 'review'

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

const AcademicYearWizard: React.FC = () => {
  const navigate = useNavigate()
  const { institution } = useAuth()
  const { loadPeriodsFromActiveYear } = useAcademic()

  // Estado principal
  const [view, setView] = useState<ViewMode>('loading')
  const [existingYears, setExistingYears] = useState<AcademicYear[]>([])
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null)
  const [draftYear, setDraftYear] = useState<AcademicYear | null>(null)
  const [activeYearTerms, setActiveYearTerms] = useState<AcademicTerm[]>([])

  // Estado de creación
  const [yearData, setYearData] = useState({
    year: new Date().getFullYear(),
    name: '',
    startDate: '',
    endDate: ''
  })
  const [terms, setTerms] = useState<AcademicTerm[]>([
    { id: '1', name: 'Primer Período', type: 'PERIOD', order: 1, weightPercentage: 25 },
    { id: '2', name: 'Segundo Período', type: 'PERIOD', order: 2, weightPercentage: 25 },
    { id: '3', name: 'Tercer Período', type: 'PERIOD', order: 3, weightPercentage: 25 },
    { id: '4', name: 'Cuarto Período', type: 'PERIOD', order: 4, weightPercentage: 25 }
  ])
  const [useFinalComponents, setUseFinalComponents] = useState(false)
  const [finalComponents, setFinalComponents] = useState<Array<{ id: string; name: string; weightPercentage: number }>>([
    { id: 'fc-1', name: 'Examen Semestral 1', weightPercentage: 10 },
    { id: 'fc-2', name: 'Examen Semestral 2', weightPercentage: 10 }
  ])

  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // ═══════════════════════════════════════════════════════════════
  // CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════

  const loadData = useCallback(async () => {
    if (!institution?.id) return
    setView('loading')
    try {
      const [yearsRes, currentRes] = await Promise.allSettled([
        academicYearLifecycleApi.getByInstitution(institution.id),
        academicYearLifecycleApi.getCurrent(institution.id)
      ])

      const years: AcademicYear[] = yearsRes.status === 'fulfilled' ? yearsRes.value.data : []
      const current: AcademicYear | null = currentRes.status === 'fulfilled' ? currentRes.value.data : null

      setExistingYears(years)
      setActiveYear(current)
      setDraftYear(years.find(y => y.status === 'DRAFT') || null)

      // Cargar términos del año activo
      if (current?.id) {
        try {
          const termsRes = await academicTermsApi.getByAcademicYear(current.id)
          setActiveYearTerms(termsRes.data || [])
        } catch { setActiveYearTerms([]) }
      }

      // Decidir vista inicial
      if (current) {
        setView('dashboard')
      } else if (years.find(y => y.status === 'DRAFT')) {
        setView('dashboard')
      } else {
        setView(years.length === 0 ? 'create' : 'dashboard')
      }
    } catch (err) {
      console.error('[AcademicYearCenter] Error loading data:', err)
      setView('create')
    }
  }, [institution?.id])

  useEffect(() => { loadData() }, [loadData])

  // ═══════════════════════════════════════════════════════════════
  // ACCIONES
  // ═══════════════════════════════════════════════════════════════

  const handleCreateYear = async () => {
    if (!institution?.id) return
    setError('')

    if (existingYears.some(y => y.year === yearData.year)) {
      setError(`Ya existe un año lectivo para ${yearData.year}. Selecciónalo desde el panel principal.`)
      return
    }
    if (!yearData.year || yearData.year < 2000) {
      setError('Ingresa un año válido.')
      return
    }
    if (yearData.startDate && yearData.endDate && yearData.startDate >= yearData.endDate) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin.')
      return
    }

    setIsCreating(true)
    try {
      const res = await academicYearLifecycleApi.create({
        institutionId: institution.id,
        year: yearData.year,
        name: yearData.name || `Año Lectivo ${yearData.year}`,
        startDate: yearData.startDate || undefined,
        endDate: yearData.endDate || undefined
      })
      const newYear = res.data
      if (!newYear?.id) throw new Error('No se recibió el ID del año')

      setDraftYear(newYear)
      setSuccess('Año lectivo creado. Ahora configura los períodos académicos.')
      setView('periods')
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al crear el año lectivo.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSaveTerms = async () => {
    if (!draftYear?.id) return
    setError('')

    const termsWeight = terms.reduce((s, t) => s + t.weightPercentage, 0)
    const fcWeight = useFinalComponents ? finalComponents.reduce((s, f) => s + f.weightPercentage, 0) : 0
    const total = termsWeight + fcWeight

    if (terms.length < 1) { setError('Debe haber al menos 1 período.'); return }
    if (terms.some(t => !t.name.trim())) { setError('Todos los períodos deben tener nombre.'); return }
    if (terms.some(t => t.weightPercentage <= 0)) { setError('Ningún período puede tener peso 0%.'); return }
    if (total !== 100) { setError(`El peso total debe ser 100%. Actual: ${total}%`); return }

    setIsCreating(true)
    try {
      for (const term of terms) {
        await academicTermsApi.create({
          academicYearId: draftYear.id,
          type: 'PERIOD',
          name: term.name,
          order: term.order,
          weightPercentage: term.weightPercentage
        })
      }
      if (useFinalComponents) {
        for (let i = 0; i < finalComponents.length; i++) {
          const fc = finalComponents[i]
          await academicTermsApi.create({
            academicYearId: draftYear.id,
            type: 'SEMESTER_EXAM',
            name: fc.name,
            order: terms.length + i + 1,
            weightPercentage: fc.weightPercentage
          })
        }
      }
      setSuccess('Períodos guardados correctamente.')
      setView('review')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar los períodos.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleActivateYear = async () => {
    const yearToActivate = draftYear
    if (!yearToActivate?.id) return
    setError('')
    setIsActivating(true)
    try {
      const validation = await academicYearLifecycleApi.validateActivation(yearToActivate.id)
      if (!validation.data.isValid) {
        setError(validation.data.errors?.join(', ') || 'El año no cumple los requisitos para ser activado.')
        return
      }
      await academicYearLifecycleApi.activate(yearToActivate.id)
      setSuccess('¡Año lectivo activado exitosamente!')
      if (institution?.id) await loadPeriodsFromActiveYear(institution.id)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al activar el año.')
    } finally {
      setIsActivating(false)
    }
  }

  const handleCloseYear = async () => {
    if (!activeYear?.id) return
    setError('')
    setIsClosing(true)
    try {
      const validation = await academicYearLifecycleApi.validateClosure(activeYear.id)
      if (!validation.data.isValid) {
        setError(validation.data.errors?.join(', ') || 'El año no cumple los requisitos para ser cerrado.')
        return
      }
      await academicYearLifecycleApi.close(activeYear.id, { calculatePromotions: true })
      setSuccess('Año lectivo cerrado exitosamente.')
      setShowCloseConfirm(false)
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cerrar el año.')
    } finally {
      setIsClosing(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHECKLIST DE PROGRESO
  // ═══════════════════════════════════════════════════════════════

  const getChecklist = () => {
    const yr = activeYear || draftYear
    const enrollments = yr?._count?.studentEnrollments || 0
    const assignments = yr?._count?.teacherAssignments || 0
    const termsCount = activeYearTerms.length || yr?.terms?.length || 0

    return [
      {
        label: 'Año lectivo creado',
        done: !!yr,
        hint: 'Se necesita un año lectivo para comenzar.',
        action: !yr ? { label: 'Crear año', onClick: () => setView('create') } : undefined
      },
      {
        label: `Períodos configurados (${termsCount})`,
        done: termsCount > 0,
        hint: 'Define los períodos académicos y sus porcentajes.',
        action: undefined
      },
      {
        label: 'Año activado',
        done: yr?.status === 'ACTIVE',
        hint: 'Activa el año para habilitar matrículas, notas y asistencia.',
        action: yr?.status === 'DRAFT' ? { label: 'Activar', onClick: handleActivateYear } : undefined
      },
      {
        label: `Estudiantes matriculados (${enrollments})`,
        done: enrollments > 0,
        hint: 'Registra las matrículas de los estudiantes para este año.',
        link: '/enrollments'
      },
      {
        label: `Carga académica asignada (${assignments})`,
        done: assignments > 0,
        hint: 'Asigna docentes a grupos y asignaturas.',
        link: '/academic-load'
      },
    ]
  }

  // ═══════════════════════════════════════════════════════════════
  // VISTAS
  // ═══════════════════════════════════════════════════════════════

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Cargando información del año académico...</p>
        </div>
      </div>
    )
  }

  const totalWeight = terms.reduce((s, t) => s + t.weightPercentage, 0) +
    (useFinalComponents ? finalComponents.reduce((s, f) => s + f.weightPercentage, 0) : 0)

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Asistente de Año Académico</h1>
              <p className="text-sm text-slate-500">
                {view === 'dashboard' ? 'Resumen y estado de tu año lectivo' :
                 view === 'create' ? 'Paso 1: Información básica del año' :
                 view === 'periods' ? 'Paso 2: Configurar períodos académicos' :
                 'Paso 3: Revisar y activar'}
              </p>
            </div>
          </div>
        </div>

        {/* Mensajes de feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-green-700 text-sm">{success}</p>
            </div>
            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600 text-lg leading-none">&times;</button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* VISTA: DASHBOARD                                        */}
        {/* ════════════════════════════════════════════════════════ */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Tarjeta del año actual/borrador */}
            {(activeYear || draftYear) && (
              <div className={`rounded-xl border-2 p-6 ${
                activeYear ? 'bg-green-50 border-green-200' :
                'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${activeYear ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                    <h2 className="text-lg font-bold text-slate-900">
                      {(activeYear || draftYear)!.name}
                    </h2>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      activeYear ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {activeYear ? 'Activo' : 'Borrador'}
                    </span>
                  </div>
                  <button onClick={loadData} className="p-2 hover:bg-white/60 rounded-lg transition-colors" title="Actualizar">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/80 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {(activeYear || draftYear)!.year}
                    </p>
                    <p className="text-xs text-slate-500">Año</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {activeYearTerms.filter(t => t.type === 'PERIOD').length || (activeYear || draftYear)!.terms?.filter((t: any) => t.type === 'PERIOD').length || 0}
                    </p>
                    <p className="text-xs text-slate-500">Períodos</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {(activeYear || draftYear)!._count?.studentEnrollments || 0}
                    </p>
                    <p className="text-xs text-slate-500">Matrículas</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-900">
                      {(activeYear || draftYear)!._count?.teacherAssignments || 0}
                    </p>
                    <p className="text-xs text-slate-500">Asignaciones</p>
                  </div>
                </div>

                {/* Períodos del año */}
                {activeYearTerms.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Períodos configurados:</h3>
                    <div className="flex flex-wrap gap-2">
                      {activeYearTerms.sort((a, b) => a.order - b.order).map(term => (
                        <span key={term.id} className="px-3 py-1.5 bg-white rounded-lg text-sm border border-slate-200">
                          {term.name} <span className="text-slate-400">({term.weightPercentage}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fechas */}
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  {(activeYear || draftYear)!.startDate && (
                    <span>Inicio: <b>{new Date((activeYear || draftYear)!.startDate!).toLocaleDateString()}</b></span>
                  )}
                  {(activeYear || draftYear)!.endDate && (
                    <span>Fin: <b>{new Date((activeYear || draftYear)!.endDate!).toLocaleDateString()}</b></span>
                  )}
                  {(activeYear || draftYear)!.activatedAt && (
                    <span>Activado: <b>{new Date((activeYear || draftYear)!.activatedAt!).toLocaleDateString()}</b></span>
                  )}
                </div>
              </div>
            )}

            {/* Checklist de progreso */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-slate-900">Progreso de configuración</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Sigue estos pasos en orden para dejar tu año académico completamente configurado.
              </p>
              <div className="space-y-3">
                {getChecklist().map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    item.done ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.done ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'
                    }`}>
                      {item.done ? <Check className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${item.done ? 'text-green-800' : 'text-slate-800'}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.hint}</p>
                    </div>
                    {item.action && !item.done && (
                      <button
                        onClick={item.action.onClick}
                        disabled={isActivating}
                        className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {isActivating && item.action.label === 'Activar' ? 'Activando...' : item.action.label}
                      </button>
                    )}
                    {item.link && !item.done && (
                      <Link
                        to={item.link}
                        className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shrink-0 flex items-center gap-1"
                      >
                        Ir <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Accesos rápidos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link to="/enrollments" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-center">
                  <Users className="w-6 h-6 text-teal-600" />
                  <span className="text-sm font-medium text-slate-700">Matrículas</span>
                </Link>
                <Link to="/academic-load" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-center">
                  <UserCheck className="w-6 h-6 text-teal-600" />
                  <span className="text-sm font-medium text-slate-700">Carga Académica</span>
                </Link>
                <Link to="/institution/structure" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-center">
                  <GraduationCap className="w-6 h-6 text-teal-600" />
                  <span className="text-sm font-medium text-slate-700">Estructura</span>
                </Link>
                <Link to="/institution" className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-colors text-center">
                  <Settings className="w-6 h-6 text-teal-600" />
                  <span className="text-sm font-medium text-slate-700">Configuración</span>
                </Link>
              </div>
            </div>

            {/* Historial de años */}
            {existingYears.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Historial de años lectivos</h2>
                <div className="space-y-2">
                  {existingYears.map(yr => (
                    <div key={yr.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          yr.status === 'ACTIVE' ? 'bg-green-500' :
                          yr.status === 'CLOSED' ? 'bg-slate-400' : 'bg-amber-500'
                        }`} />
                        <div>
                          <span className="font-medium text-slate-800">{yr.name}</span>
                          <span className="text-sm text-slate-500 ml-2">
                            ({yr._count?.studentEnrollments || 0} matrículas)
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        yr.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        yr.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {yr.status === 'ACTIVE' ? 'Activo' : yr.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones avanzadas */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Acciones</h2>
              <div className="flex flex-wrap gap-3">
                {!activeYear && !draftYear && (
                  <button
                    onClick={() => { setError(''); setSuccess(''); setView('create') }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Crear nuevo año lectivo
                  </button>
                )}
                {draftYear && !activeYear && (
                  <button
                    onClick={handleActivateYear}
                    disabled={isActivating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> {isActivating ? 'Activando...' : 'Activar año en borrador'}
                  </button>
                )}
                {activeYear && (
                  <>
                    {!showCloseConfirm ? (
                      <button
                        onClick={() => setShowCloseConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Square className="w-4 h-4" /> Cerrar año lectivo
                      </button>
                    ) : (
                      <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700 mb-3">
                          <b>¿Estás seguro?</b> Cerrar el año calculará promociones y ya no se podrán registrar notas ni asistencia para este año.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCloseYear}
                            disabled={isClosing}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                          >
                            {isClosing ? 'Cerrando...' : 'Sí, cerrar año'}
                          </button>
                          <button
                            onClick={() => setShowCloseConfirm(false)}
                            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setError(''); setSuccess(''); setView('create') }}
                      className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Preparar siguiente año
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* VISTA: CREAR AÑO                                       */}
        {/* ════════════════════════════════════════════════════════ */}
        {view === 'create' && (
          <div className="space-y-6">
            {/* Info tutorial */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">¿Qué es el año lectivo?</h3>
                  <p className="text-sm text-blue-700">
                    El año lectivo es el período anual que organiza toda la actividad académica: matrículas, notas, asistencia y reportes. 
                    Primero lo creas, luego configuras los períodos, y finalmente lo activas para comenzar a usarlo.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Crear año lectivo</h2>
              <p className="text-sm text-slate-500 mb-6">Ingresa la información básica. Podrás modificarla después si el año está en borrador.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Año *</label>
                  <input
                    type="number"
                    value={yearData.year}
                    onChange={(e) => setYearData({ ...yearData, year: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    min="2000" max="2100"
                  />
                  {existingYears.some(y => y.year === yearData.year) && (
                    <p className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Este año ya existe. Vuelve al panel para verlo.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre (opcional)</label>
                  <input
                    type="text"
                    value={yearData.name}
                    onChange={(e) => setYearData({ ...yearData, name: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder={`Año Lectivo ${yearData.year}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha de inicio (opcional)</label>
                  <input
                    type="date" value={yearData.startDate}
                    onChange={(e) => setYearData({ ...yearData, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha de fin (opcional)</label>
                  <input
                    type="date" value={yearData.endDate}
                    onChange={(e) => setYearData({ ...yearData, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => { setError(''); setView('dashboard') }}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Volver al panel
                </button>
                <button
                  onClick={handleCreateYear}
                  disabled={isCreating || existingYears.some(y => y.year === yearData.year)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : <>Crear y continuar <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* VISTA: PERÍODOS                                        */}
        {/* ════════════════════════════════════════════════════════ */}
        {view === 'periods' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">¿Qué son los períodos académicos?</h3>
                  <p className="text-sm text-blue-700">
                    Los períodos dividen el año en bloques de evaluación. En Colombia, la mayoría de colegios usan 4 períodos de 25% cada uno. 
                    La suma de todos los porcentajes debe ser <b>exactamente 100%</b>.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Períodos académicos</h2>
              <p className="text-sm text-slate-500 mb-5">Define cuántos períodos tendrá el año y qué peso tiene cada uno en la nota final.</p>

              <div className="space-y-3">
                {terms.map((term, index) => (
                  <div key={term.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_40px] gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                        <input type="text" value={term.name}
                          onChange={(e) => { const n = [...terms]; n[index].name = e.target.value; setTerms(n) }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Orden</label>
                        <input type="number" value={term.order} min={1}
                          onChange={(e) => { const n = [...terms]; n[index].order = parseInt(e.target.value) || 1; setTerms(n) }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Peso %</label>
                        <input type="number" value={term.weightPercentage} min={1} max={100}
                          onChange={(e) => { const n = [...terms]; n[index].weightPercentage = parseInt(e.target.value) || 0; setTerms(n) }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                        />
                      </div>
                      {terms.length > 1 && (
                        <button onClick={() => setTerms(terms.filter((_, i) => i !== index))}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end"
                          title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setTerms([...terms, { id: Date.now().toString(), name: `Período ${terms.length + 1}`, type: 'PERIOD', order: terms.length + 1, weightPercentage: 20 }])}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar período
                </button>
                <div className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${totalWeight === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  Total: {totalWeight}%
                </div>
              </div>
            </div>

            {/* Componentes finales */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Componentes finales (opcional)</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Evaluaciones globales como pruebas semestrales que complementan la nota final.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useFinalComponents}
                    onChange={(e) => setUseFinalComponents(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Habilitar</span>
                </label>
              </div>
              {useFinalComponents && (
                <div className="space-y-3">
                  {finalComponents.map((fc, index) => (
                    <div key={fc.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_40px] gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-amber-700 mb-1">Nombre</label>
                          <input type="text" value={fc.name}
                            onChange={(e) => { const n = [...finalComponents]; n[index].name = e.target.value; setFinalComponents(n) }}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-amber-700 mb-1">Peso %</label>
                          <input type="number" value={fc.weightPercentage} min={1} max={100}
                            onChange={(e) => { const n = [...finalComponents]; n[index].weightPercentage = parseInt(e.target.value) || 0; setFinalComponents(n) }}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                          />
                        </div>
                        {finalComponents.length > 1 && (
                          <button onClick={() => setFinalComponents(finalComponents.filter((_, i) => i !== index))}
                            className="p-2 text-red-400 hover:text-red-600 rounded-lg self-end"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setFinalComponents([...finalComponents, { id: `fc-${Date.now()}`, name: `Componente ${finalComponents.length + 1}`, weightPercentage: 5 }])}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Agregar componente
                  </button>
                </div>
              )}
            </div>

            {/* Navegación */}
            <div className="flex justify-between items-center">
              <button onClick={() => { setError(''); setView('dashboard') }}
                className="px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                Volver al panel
              </button>
              <button onClick={handleSaveTerms} disabled={isCreating || totalWeight !== 100}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 text-sm font-medium">
                {isCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <>Guardar y revisar <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* VISTA: REVIEW Y ACTIVAR                                */}
        {/* ════════════════════════════════════════════════════════ */}
        {view === 'review' && draftYear && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">¡Todo listo!</h3>
                  <p className="text-sm text-green-700">
                    El año <b>{draftYear.name}</b> está creado con sus períodos configurados. 
                    Puedes <b>activarlo ahora</b> para comenzar a matricular estudiantes y registrar notas, 
                    o dejarlo en borrador y activarlo después.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Resumen de configuración</h2>

              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-slate-500">Año:</span>
                  <span className="ml-2 font-semibold">{draftYear.year}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-slate-500">Nombre:</span>
                  <span className="ml-2 font-semibold">{draftYear.name}</span>
                </div>
              </div>

              <h3 className="text-sm font-medium text-slate-700 mb-2">Períodos:</h3>
              <div className="space-y-1.5 mb-4">
                {terms.sort((a, b) => a.order - b.order).map(t => (
                  <div key={t.id} className="flex justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                    <span>{t.name}</span>
                    <span className="font-semibold">{t.weightPercentage}%</span>
                  </div>
                ))}
                {useFinalComponents && finalComponents.map(fc => (
                  <div key={fc.id} className="flex justify-between p-2.5 bg-amber-50 rounded-lg text-sm">
                    <span className="text-amber-700">{fc.name}</span>
                    <span className="font-semibold text-amber-700">{fc.weightPercentage}%</span>
                  </div>
                ))}
                <div className="flex justify-between p-2.5 bg-teal-50 rounded-lg text-sm font-bold">
                  <span className="text-teal-800">Total</span>
                  <span className="text-teal-800">{totalWeight}%</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">¿Qué pasa al activar?</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Se habilitan las matrículas de estudiantes para este año</li>
                    <li>• Los docentes podrán registrar notas y asistencia</li>
                    <li>• Los períodos quedan fijados (no se podrán cambiar porcentajes)</li>
                    <li>• <b>Siguiente paso:</b> ir a <b>Matrículas</b> para inscribir estudiantes</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => { setError(''); setView('dashboard') }}
                className="px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                Dejar en borrador
              </button>
              <button onClick={handleActivateYear} disabled={isActivating}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium">
                {isActivating ? <><Loader2 className="w-4 h-4 animate-spin" /> Activando...</> : <><Play className="w-4 h-4" /> Activar año lectivo</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AcademicYearWizard
