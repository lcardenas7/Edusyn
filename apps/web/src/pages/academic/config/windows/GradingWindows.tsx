import { useState, useEffect } from 'react'
import { 
  Calendar,
  Lock,
  Unlock,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../../contexts/AuthContext'
import { gradingPeriodConfigApi, academicYearsApi, reportsApi, academicTermsApi } from '../../../../lib/api'

interface GradingPeriodConfig {
  id: string
  name: string
  order: number
  isOpen: boolean
  openDate: string | null
  closeDate: string | null
  allowLateEntry: boolean
  lateEntryDays: number
}

export default function GradingWindows() {
  const { institution: authInstitution } = useAuth()
  
  const [gradingPeriods, setGradingPeriods] = useState<GradingPeriodConfig[]>([])
  const [loadingGradingPeriods, setLoadingGradingPeriods] = useState(false)
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null)
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: number; status?: string }>>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')

  // Estado del ciclo de vida de períodos
  const [termStatuses, setTermStatuses] = useState<Record<string, 'OPEN' | 'CLOSED' | 'FINALIZED'>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState<string | null>(null)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState<string | null>(null)
  const [showReopenConfirm, setShowReopenConfirm] = useState<string | null>(null)
  const [reopenReason, setReopenReason] = useState('')
  const [termActionError, setTermActionError] = useState('')
  const [termActionSuccess, setTermActionSuccess] = useState('')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [validatingTerm, setValidatingTerm] = useState<string | null>(null)

  // Cargar años académicos
  useEffect(() => {
    const fetchAcademicYears = async () => {
      if (!authInstitution?.id) return
      try {
        const response = await academicYearsApi.getAll(authInstitution.id)
        const years = response.data || []
        setAcademicYears(years)
        if (years.length > 0) {
          const latestYear = years.sort((a: any, b: any) => b.year - a.year)[0]
          setSelectedAcademicYear(latestYear.id)
        }
      } catch (err) {
        console.error('Error loading academic years:', err)
      }
    }
    fetchAcademicYears()
  }, [authInstitution?.id])

  // Cargar configuración de períodos cuando cambia el año académico
  useEffect(() => {
    const fetchGradingPeriods = async () => {
      if (!selectedAcademicYear) return
      setLoadingGradingPeriods(true)
      try {
        const [configRes, termsRes] = await Promise.all([
          gradingPeriodConfigApi.getByAcademicYear(selectedAcademicYear),
          academicTermsApi.getAll(selectedAcademicYear),
        ])
        const data = configRes.data || []
        setGradingPeriods(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          order: p.order,
          isOpen: p.config?.isOpen || false,
          openDate: p.config?.openDate ? new Date(p.config.openDate).toISOString().split('T')[0] : null,
          closeDate: p.config?.closeDate ? new Date(p.config.closeDate).toISOString().split('T')[0] : null,
          allowLateEntry: p.config?.allowLateEntry || false,
          lateEntryDays: p.config?.lateEntryDays || 0,
        })))

        // Cargar estado del ciclo de vida de cada término
        const terms = termsRes.data || []
        const statuses: Record<string, 'OPEN' | 'CLOSED' | 'FINALIZED'> = {}
        terms.forEach((t: any) => {
          statuses[t.id] = t.status || 'OPEN'
        })
        setTermStatuses(statuses)
      } catch (err) {
        console.error('Error loading grading periods:', err)
      } finally {
        setLoadingGradingPeriods(false)
      }
    }
    fetchGradingPeriods()
  }, [selectedAcademicYear])

  // Validar notas antes de cerrar
  const handleValidateGrades = async (termId: string) => {
    setValidatingTerm(termId)
    setTermActionError('')
    setValidationResult(null)
    try {
      const res = await reportsApi.validateTermGrades(termId)
      setValidationResult(res.data)
      setShowCloseConfirm(termId)
    } catch (err: any) {
      setTermActionError(err.response?.data?.message || 'Error al validar notas del período')
    } finally {
      setValidatingTerm(null)
    }
  }

  // Cerrar período (OPEN → CLOSED)
  const handleCloseTerm = async (termId: string) => {
    setActionLoading(termId)
    setTermActionError('')
    setTermActionSuccess('')
    try {
      await reportsApi.closeTerm(termId)
      setTermStatuses(prev => ({ ...prev, [termId]: 'CLOSED' }))
      setTermActionSuccess('Período cerrado exitosamente. Ahora puede finalizar para generar el snapshot de boletines.')
      setShowCloseConfirm(null)
      setValidationResult(null)
    } catch (err: any) {
      const data = err.response?.data
      if (data?.validation) {
        setValidationResult(data.validation)
        setTermActionError(data.message || 'Faltan notas por registrar')
      } else {
        setTermActionError(data?.message || 'Error al cerrar el período')
      }
    } finally {
      setActionLoading(null)
    }
  }

  // Finalizar período (CLOSED → FINALIZED)
  const handleFinalizeTerm = async (termId: string) => {
    setActionLoading(termId)
    setTermActionError('')
    setTermActionSuccess('')
    try {
      await reportsApi.finalizeTerm(termId)
      setTermStatuses(prev => ({ ...prev, [termId]: 'FINALIZED' }))
      setTermActionSuccess('Período finalizado exitosamente. Se generó snapshot legal de boletines.')
      setShowFinalizeConfirm(null)
    } catch (err: any) {
      setTermActionError(err.response?.data?.message || 'Error al finalizar el período')
    } finally {
      setActionLoading(null)
    }
  }

  // Reabrir período (FINALIZED → OPEN)
  const handleReopenTerm = async (termId: string) => {
    if (!reopenReason.trim()) {
      setTermActionError('Debe ingresar una razón para reabrir el período')
      return
    }
    setActionLoading(termId)
    setTermActionError('')
    setTermActionSuccess('')
    try {
      await reportsApi.reopenTerm(termId, reopenReason)
      setTermStatuses(prev => ({ ...prev, [termId]: 'OPEN' }))
      setTermActionSuccess('Período reabierto exitosamente.')
      setShowReopenConfirm(null)
      setReopenReason('')
    } catch (err: any) {
      setTermActionError(err.response?.data?.message || 'Error al reabrir el período')
    } finally {
      setActionLoading(null)
    }
  }

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Guardar configuración de un período
  const saveGradingPeriodConfig = async (periodId: string, config: Partial<GradingPeriodConfig>) => {
    setSavingPeriod(periodId)
    setSaveMessage(null)
    // Snapshot para rollback
    const previousPeriods = [...gradingPeriods]
    try {
      await gradingPeriodConfigApi.updateConfig(periodId, {
        isOpen: config.isOpen ?? false,
        openDate: config.openDate || null,
        closeDate: config.closeDate || null,
        allowLateEntry: config.allowLateEntry ?? false,
        lateEntryDays: config.lateEntryDays ?? 0,
      })
      setSaveMessage({ type: 'success', text: 'Configuración guardada correctamente' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving grading period config:', err)
      // Rollback UI state
      setGradingPeriods(previousPeriods)
      const msg = err.response?.data?.message || 'Error al guardar la configuración. Intente de nuevo.'
      setSaveMessage({ type: 'error', text: msg })
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSavingPeriod(null)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/academic/config/scale" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Ventanas de Calificación</h1>
              <p className="text-sm text-slate-500">Configura cuándo los docentes pueden ingresar notas por período</p>
            </div>
          </div>
        </div>
        <select
          value={selectedAcademicYear}
          onChange={(e) => setSelectedAcademicYear(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          {academicYears.map(year => (
            <option key={year.id} value={year.id}>Año {year.year}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-indigo-700">
              <strong>Importante:</strong> Los docentes solo podrán ingresar calificaciones durante las fechas configuradas para cada período. 
              Fuera de estas fechas, la planilla de notas aparecerá bloqueada.
            </p>
          </div>

          {saveMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
              saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {saveMessage.text}
            </div>
          )}

          {loadingGradingPeriods ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : academicYears.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="mb-2">No hay años académicos configurados</p>
              <p className="text-sm mb-4">Usa el wizard para crear un nuevo año lectivo con todos sus períodos.</p>
              <Link
                to="/academic/year/setup"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Crear Año Lectivo
              </Link>
            </div>
          ) : gradingPeriods.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="mb-2">No hay períodos académicos configurados para este año</p>
              <p className="text-sm">Configura los períodos en la página de Períodos Académicos y guárdalos para que aparezcan aquí.</p>
              <Link
                to="/academic/config/periods"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Ir a Períodos
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {gradingPeriods.map((period) => (
                <div key={period.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header del período */}
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    termStatuses[period.id] === 'FINALIZED' ? 'bg-purple-50' :
                    termStatuses[period.id] === 'CLOSED' ? 'bg-blue-50' :
                    period.isOpen ? 'bg-green-50' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {termStatuses[period.id] === 'FINALIZED' ? (
                        <ShieldCheck className="w-5 h-5 text-purple-600" />
                      ) : termStatuses[period.id] === 'CLOSED' ? (
                        <Lock className="w-5 h-5 text-blue-600" />
                      ) : period.isOpen ? (
                        <Unlock className="w-5 h-5 text-green-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-slate-400" />
                      )}
                      <div>
                        <h3 className="font-medium text-slate-900">{period.name}</h3>
                        <p className="text-xs">
                          {termStatuses[period.id] === 'FINALIZED' ? (
                            <span className="text-purple-600 font-medium">Finalizado — Boletines congelados</span>
                          ) : termStatuses[period.id] === 'CLOSED' ? (
                            <span className="text-blue-600 font-medium">Cerrado — Listo para finalizar</span>
                          ) : period.isOpen ? (
                            <span className="text-green-600">Abierto para calificaciones</span>
                          ) : (
                            <span className="text-slate-500">Cerrado para calificaciones</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Botón de acción según estado */}
                      {termStatuses[period.id] === 'FINALIZED' ? (
                        <button
                          onClick={() => { setShowReopenConfirm(period.id); setTermActionError(''); setReopenReason(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reabrir
                        </button>
                      ) : termStatuses[period.id] === 'CLOSED' ? (
                        <button
                          onClick={() => { setShowFinalizeConfirm(period.id); setTermActionError(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 transition-colors"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Finalizar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleValidateGrades(period.id)}
                          disabled={validatingTerm === period.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          {validatingTerm === period.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          Cerrar Período
                        </button>
                      )}
                      {/* Toggle de ventana de calificación (solo si no está finalizado) */}
                      {termStatuses[period.id] !== 'FINALIZED' && (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={period.isOpen}
                            onChange={(e) => {
                              const newIsOpen = e.target.checked
                              const updatedPeriod = { ...period, isOpen: newIsOpen }
                              setGradingPeriods(prev => prev.map(p => p.id === period.id ? updatedPeriod : p))
                              saveGradingPeriodConfig(period.id, updatedPeriod)
                            }}
                            disabled={savingPeriod === period.id}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Indicador visual del ciclo de vida */}
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        termStatuses[period.id] === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                      }`}>ABIERTO</span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        termStatuses[period.id] === 'CLOSED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                      }`}>CERRADO</span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        termStatuses[period.id] === 'FINALIZED' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'
                      }`}>FINALIZADO</span>
                    </div>
                  </div>
                  
                  <div className="px-4 py-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Apertura</label>
                        <input
                          type="date"
                          value={period.openDate || ''}
                          onChange={(e) => {
                            const newPeriod = { ...period, openDate: e.target.value || null }
                            setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                          }}
                          onBlur={() => saveGradingPeriodConfig(period.id, period)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Cierre</label>
                        <input
                          type="date"
                          value={period.closeDate || ''}
                          onChange={(e) => {
                            const newPeriod = { ...period, closeDate: e.target.value || null }
                            setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                          }}
                          onBlur={() => saveGradingPeriodConfig(period.id, period)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Permitir Entrada Tardía</label>
                        <select
                          value={period.allowLateEntry ? 'yes' : 'no'}
                          onChange={(e) => {
                            const newPeriod = { ...period, allowLateEntry: e.target.value === 'yes' }
                            setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                            saveGradingPeriodConfig(period.id, newPeriod)
                          }}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                      </div>
                      {period.allowLateEntry && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Días Adicionales</label>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={period.lateEntryDays}
                            onChange={(e) => {
                              const newPeriod = { ...period, lateEntryDays: parseInt(e.target.value) || 0 }
                              setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                            }}
                            onBlur={() => saveGradingPeriodConfig(period.id, period)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                    {savingPeriod === period.id && (
                      <p className="text-xs text-indigo-600 mt-2">Guardando...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mensajes de éxito/error */}
        {termActionSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center justify-between">
            <span>{termActionSuccess}</span>
            <button onClick={() => setTermActionSuccess('')} className="text-green-500 hover:text-green-700 ml-2">&times;</button>
          </div>
        )}
        {termActionError && !showFinalizeConfirm && !showReopenConfirm && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>{termActionError}</span>
            <button onClick={() => setTermActionError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
          </div>
        )}
      </div>

      {/* Modal: CERRAR PERÍODO (con validación de notas) */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Cerrar Período</h3>
            </div>

            {/* Resultado de validación */}
            {validationResult && (
              <div className="mb-4">
                {validationResult.isComplete ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Todas las notas están completas</span>
                    </div>
                    <p className="text-sm text-green-700">
                      {validationResult.totalFound} de {validationResult.totalExpected} notas registradas (100%)
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-800">
                        Faltan {validationResult.totalMissing} notas ({validationResult.completionPercent}% completado)
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="w-full bg-red-200 rounded-full h-2 mb-3">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${validationResult.completionPercent}%` }}
                      />
                    </div>
                    {/* Lista de faltantes */}
                    {validationResult.missing && validationResult.missing.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-700 mb-1">Notas faltantes:</p>
                        <div className="max-h-40 overflow-y-auto border border-red-200 rounded bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-red-50 sticky top-0">
                              <tr>
                                <th className="px-2 py-1 text-left text-red-700">Grupo</th>
                                <th className="px-2 py-1 text-left text-red-700">Estudiante</th>
                                <th className="px-2 py-1 text-left text-red-700">Asignatura</th>
                              </tr>
                            </thead>
                            <tbody>
                              {validationResult.missing.map((m: any, i: number) => (
                                <tr key={i} className="border-t border-red-100">
                                  <td className="px-2 py-1 text-slate-600">{m.group}</td>
                                  <td className="px-2 py-1 text-slate-700">{m.student}</td>
                                  <td className="px-2 py-1 text-slate-600">{m.subject}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {validationResult.hasMore && (
                          <p className="text-xs text-red-500 mt-1">... y más registros faltantes</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      No se puede cerrar el período hasta que todas las notas estén registradas.
                    </p>
                  </div>
                )}
              </div>
            )}

            {termActionError && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{termActionError}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCloseConfirm(null); setValidationResult(null); setTermActionError(''); }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              {validationResult?.isComplete && (
                <button
                  onClick={() => handleCloseTerm(showCloseConfirm)}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cerrando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Confirmar Cierre
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: FINALIZAR PERÍODO (generar snapshot) */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Finalizar Período</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Esta acción:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Genera un <strong>snapshot legal</strong> de todos los boletines del período</li>
                    <li><strong>Bloquea</strong> la modificación de notas parciales y finales</li>
                    <li>Los boletines se leerán desde el snapshot congelado</li>
                    <li>Solo un administrador puede reabrir el período después</li>
                  </ul>
                </div>
              </div>
            </div>
            {termActionError && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{termActionError}</div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFinalizeConfirm(null)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleFinalizeTerm(showFinalizeConfirm)}
                disabled={actionLoading !== null}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Confirmar Finalización
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: REABRIR PERÍODO */}
      {showReopenConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Reabrir Período Finalizado</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Esta acción permitirá modificar notas nuevamente. Se registrará quién reabrió el período y la razón.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Razón de reapertura <span className="text-red-500">*</span></label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Ej: Corrección de notas del docente de Matemáticas..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                rows={3}
              />
            </div>
            {termActionError && (
              <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{termActionError}</div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowReopenConfirm(null); setReopenReason(''); }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReopenTerm(showReopenConfirm)}
                disabled={actionLoading !== null || !reopenReason.trim()}
                className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reabriendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Confirmar Reapertura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
