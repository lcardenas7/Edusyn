import { useState, useEffect } from 'react'
import { 
  Calendar,
  Lock,
  Unlock,
  RefreshCw,
  ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../../contexts/AuthContext'
import { recoveryPeriodConfigApi, academicYearsApi } from '../../../../lib/api'

interface RecoveryPeriodConfig {
  id: string
  name: string
  order: number
  isOpen: boolean
  openDate: string | null
  closeDate: string | null
  allowLateEntry: boolean
  lateEntryDays: number
}

export default function RecoveryWindows() {
  const { institution: authInstitution } = useAuth()
  
  const [recoveryPeriods, setRecoveryPeriods] = useState<RecoveryPeriodConfig[]>([])
  const [loadingRecoveryPeriods, setLoadingRecoveryPeriods] = useState(false)
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null)
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: number; status?: string }>>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')

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

  // Cargar configuración de períodos de recuperación
  useEffect(() => {
    const fetchRecoveryPeriods = async () => {
      if (!selectedAcademicYear) return
      setLoadingRecoveryPeriods(true)
      try {
        const response = await recoveryPeriodConfigApi.getByAcademicYear(selectedAcademicYear)
        const data = response.data || []
        setRecoveryPeriods(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          order: p.order,
          isOpen: p.recoveryConfig?.isOpen || false,
          openDate: p.recoveryConfig?.openDate ? new Date(p.recoveryConfig.openDate).toISOString().split('T')[0] : null,
          closeDate: p.recoveryConfig?.closeDate ? new Date(p.recoveryConfig.closeDate).toISOString().split('T')[0] : null,
          allowLateEntry: p.recoveryConfig?.allowLateEntry || false,
          lateEntryDays: p.recoveryConfig?.lateEntryDays || 0,
        })))
      } catch (err) {
        console.error('Error loading recovery periods:', err)
      } finally {
        setLoadingRecoveryPeriods(false)
      }
    }
    fetchRecoveryPeriods()
  }, [selectedAcademicYear])

  // Guardar configuración de un período de recuperación
  const saveRecoveryPeriodConfig = async (periodId: string, config: Partial<RecoveryPeriodConfig>) => {
    setSavingPeriod(periodId)
    try {
      await recoveryPeriodConfigApi.updateConfig(periodId, {
        isOpen: config.isOpen ?? false,
        openDate: config.openDate || null,
        closeDate: config.closeDate || null,
        allowLateEntry: config.allowLateEntry ?? false,
        lateEntryDays: config.lateEntryDays ?? 0,
      })
    } catch (err) {
      console.error('Error saving recovery period config:', err)
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
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Ventanas de Recuperación</h1>
              <p className="text-sm text-slate-500">Configura cuándo los docentes pueden ingresar notas de recuperación por período</p>
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-700">
              <strong>Importante:</strong> Los docentes solo podrán ingresar notas de recuperación durante las fechas configuradas para cada período. 
              Fuera de estas fechas, no podrán registrar actividades de recuperación.
            </p>
          </div>

          {loadingRecoveryPeriods ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
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
          ) : recoveryPeriods.length === 0 ? (
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
              {recoveryPeriods.map((period) => (
                <div key={period.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className={`px-4 py-3 flex items-center justify-between ${period.isOpen ? 'bg-green-50' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      {period.isOpen ? (
                        <Unlock className="w-5 h-5 text-green-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-slate-400" />
                      )}
                      <div>
                        <h3 className="font-medium text-slate-900">Recuperación {period.name}</h3>
                        <p className="text-xs text-slate-500">
                          {period.isOpen ? (
                            <span className="text-green-600">Abierto para recuperaciones</span>
                          ) : (
                            <span className="text-slate-500">Cerrado para recuperaciones</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={period.isOpen}
                        onChange={(e) => saveRecoveryPeriodConfig(period.id, { ...period, isOpen: e.target.checked })}
                        disabled={savingPeriod === period.id}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
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
                            setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                          }}
                          onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Cierre</label>
                        <input
                          type="date"
                          value={period.closeDate || ''}
                          onChange={(e) => {
                            const newPeriod = { ...period, closeDate: e.target.value || null }
                            setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                          }}
                          onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Permitir Entrada Tardía</label>
                        <select
                          value={period.allowLateEntry ? 'yes' : 'no'}
                          onChange={(e) => {
                            const newPeriod = { ...period, allowLateEntry: e.target.value === 'yes' }
                            setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                            saveRecoveryPeriodConfig(period.id, newPeriod)
                          }}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                              setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                            }}
                            onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                    {savingPeriod === period.id && (
                      <p className="text-xs text-amber-600 mt-2">Guardando...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
