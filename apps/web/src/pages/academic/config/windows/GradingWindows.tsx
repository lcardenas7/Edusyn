import { useState, useEffect } from 'react'
import { 
  Calendar,
  Lock,
  Unlock,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  AlertTriangle
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

  // Estado de finalización de períodos
  const [termStatuses, setTermStatuses] = useState<Record<string, 'OPEN' | 'FINALIZED'>>({})
  const [finalizingTerm, setFinalizingTerm] = useState<string | null>(null)
  const [reopeningTerm, setReopeningTerm] = useState<string | null>(null)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState<string | null>(null)
  const [showReopenConfirm, setShowReopenConfirm] = useState<string | null>(null)
  const [reopenReason, setReopenReason] = useState('')
  const [termActionError, setTermActionError] = useState('')
  const [termActionSuccess, setTermActionSuccess] = useState('')

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

        // Cargar estado de finalización de cada término
        const terms = termsRes.data || []
        const statuses: Record<string, 'OPEN' | 'FINALIZED'> = {}
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

  // Finalizar período
  const handleFinalizeTerm = async (termId: string) => {
    setFinalizingTerm(termId)
    setTermActionError('')
    setTermActionSuccess('')
    try {
      await reportsApi.finalizeTerm(termId)
      setTermStatuses(prev => ({ ...prev, [termId]: 'FINALIZED' }))
      setTermActionSuccess('Período finalizado exitosamente. Se generó snapshot de boletines.')
      setShowFinalizeConfirm(null)
    } catch (err: any) {
      setTermActionError(err.response?.data?.message || 'Error al finalizar el período')
    } finally {
      setFinalizingTerm(null)
    }
  }

  // Reabrir período finalizado
  const handleReopenTerm = async (termId: string) => {
    if (!reopenReason.trim()) {
      setTermActionError('Debe ingresar una razón para reabrir el período')
      return
    }
    setReopeningTerm(termId)
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
      setReopeningTerm(null)
    }
  }

  // Guardar configuración de un período
  const saveGradingPeriodConfig = async (periodId: string, config: Partial<GradingPeriodConfig>) => {
    setSavingPeriod(periodId)
    try {
      await gradingPeriodConfigApi.updateConfig(periodId, {
        isOpen: config.isOpen ?? false,
        openDate: config.openDate || null,
        closeDate: config.closeDate || null,
        allowLateEntry: config.allowLateEntry ?? false,
        lateEntryDays: config.lateEntryDays ?? 0,
      })
    } catch (err) {
      console.error('Error saving grading period config:', err)
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
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    termStatuses[period.id] === 'FINALIZED' ? 'bg-purple-50' : period.isOpen ? 'bg-green-50' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {termStatuses[period.id] === 'FINALIZED' ? (
                        <ShieldCheck className="w-5 h-5 text-purple-600" />
                      ) : period.isOpen ? (
                        <Unlock className="w-5 h-5 text-green-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-slate-400" />
                      )}
                      <div>
                        <h3 className="font-medium text-slate-900">{period.name}</h3>
                        <p className="text-xs text-slate-500">
                          {termStatuses[period.id] === 'FINALIZED' ? (
                            <span className="text-purple-600 font-medium">✅ Finalizado — Boletines congelados</span>
                          ) : period.isOpen ? (
                            <span className="text-green-600">Abierto para calificaciones</span>
                          ) : (
                            <span className="text-slate-500">Cerrado para calificaciones</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {termStatuses[period.id] === 'FINALIZED' ? (
                        <button
                          onClick={() => { setShowReopenConfirm(period.id); setTermActionError(''); setReopenReason(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reabrir
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowFinalizeConfirm(period.id); setTermActionError(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 transition-colors"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Finalizar
                        </button>
                      )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={period.isOpen}
                        onChange={(e) => saveGradingPeriodConfig(period.id, { ...period, isOpen: e.target.checked })}
                        disabled={savingPeriod === period.id}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
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

      {/* Modal de confirmación para FINALIZAR */}
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
                disabled={finalizingTerm !== null}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {finalizingTerm ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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

      {/* Modal de confirmación para REABRIR */}
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
                disabled={reopeningTerm !== null || !reopenReason.trim()}
                className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {reopeningTerm ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
