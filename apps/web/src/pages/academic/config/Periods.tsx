import { useState } from 'react'
import { 
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  GraduationCap,
  Eye,
  ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInstitution, Period } from '../../../contexts/InstitutionContext'
import { useAuth } from '../../../contexts/AuthContext'
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions'

export default function Periods() {
  const { 
    periods, setPeriods, 
    gradingConfig, setGradingConfig,
    savePeriodsToAPI, saveGradingConfigToAPI,
    isSaving 
  } = useInstitution()
  const { institution: authInstitution } = useAuth()
  const { can } = usePermissions()
  
  const canEditPeriods = can(PERMISSIONS.CONFIG_PERIODS_EDIT)
  const canEditGradingScale = can(PERMISSIONS.CONFIG_GRADING_EDIT_SCALE)
  
  // Estados locales para el modal y guardado
  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [periodForm, setPeriodForm] = useState({ name: '', weight: 25, startDate: '', endDate: '' })
  const [savingPeriods, setSavingPeriods] = useState(false)

  // Cálculos
  const totalPeriodWeight = periods.reduce((sum, p) => sum + p.weight, 0)
  const finalComponentsWeight = gradingConfig.useFinalComponents 
    ? gradingConfig.finalComponents.reduce((sum, c) => sum + c.weightPercentage, 0) 
    : 0
  const expectedPeriodWeight = 100 - finalComponentsWeight
  const totalWeight = totalPeriodWeight + finalComponentsWeight
  const isWeightValid = totalWeight === 100

  // Funciones para períodos
  const openPeriodModal = (period?: Period) => {
    if (period) {
      setEditingPeriod(period)
      setPeriodForm({ name: period.name, weight: period.weight, startDate: period.startDate, endDate: period.endDate })
    } else {
      setEditingPeriod(null)
      setPeriodForm({ name: '', weight: 25, startDate: '', endDate: '' })
    }
    setShowPeriodModal(true)
  }

  const savePeriod = () => {
    if (!periodForm.name.trim()) return
    
    if (editingPeriod) {
      setPeriods(periods.map(p => 
        p.id === editingPeriod.id 
          ? { ...p, ...periodForm }
          : p
      ))
    } else {
      const newPeriod: Period = {
        id: `period-${Date.now()}`,
        name: periodForm.name,
        weight: periodForm.weight,
        startDate: periodForm.startDate,
        endDate: periodForm.endDate
      }
      setPeriods([...periods, newPeriod])
    }
    setShowPeriodModal(false)
  }

  const deletePeriod = (id: string) => {
    if (periods.length <= 1) return
    setPeriods(periods.filter(p => p.id !== id))
  }

  const handleSavePeriodsAndSync = async () => {
    setSavingPeriods(true)
    try {
      const success = await savePeriodsToAPI()
      if (success) {
        alert('✅ Períodos guardados correctamente')
      } else {
        alert('❌ Error al guardar los períodos. Intente de nuevo.')
      }
    } catch (err) {
      console.error('Error saving periods:', err)
      alert('❌ Error al guardar los períodos. Intente de nuevo.')
    } finally {
      setSavingPeriods(false)
    }
  }

  const handleSaveGradingConfig = async () => {
    const success = await saveGradingConfigToAPI()
    if (success) {
      alert('✅ Sistema de calificación guardado correctamente')
    } else {
      alert('❌ Error al guardar. Intente de nuevo.')
    }
  }

  return (
    <div className="p-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/academic/config/scale" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Períodos Académicos</h1>
              <p className="text-sm text-slate-500">Configura los períodos del año escolar y su peso en la nota final</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!canEditPeriods && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              <Eye className="w-3 h-3" /> Solo lectura
            </span>
          )}
          {canEditPeriods && (
            <button
              onClick={() => openPeriodModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Período
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
          {/* Lista de Períodos */}
          <div className="space-y-3">
            {periods.map((period, index) => (
              <div key={period.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="font-bold text-purple-600">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{period.name}</h4>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {period.startDate} - {period.endDate}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold text-purple-600">{period.weight}%</span>
                  <p className="text-xs text-slate-500">Peso</p>
                </div>
                {canEditPeriods && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openPeriodModal(period)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletePeriod(period.id)}
                      disabled={periods.length <= 1}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botón Guardar Períodos */}
          {canEditPeriods && (
            <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
              <button
                onClick={handleSavePeriodsAndSync}
                disabled={savingPeriods || isSaving}
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium ${(savingPeriods || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save className="w-4 h-4" />
                {savingPeriods ? 'Guardando...' : 'Guardar Períodos'}
              </button>
            </div>
          )}

          {/* Componentes Finales Institucionales */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Componentes Finales Institucionales
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Evaluaciones globales que complementan la nota final del año (ej: Pruebas Semestrales)
                </p>
              </div>
              <label className={`flex items-center gap-2 ${!canEditPeriods ? 'cursor-not-allowed opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  checked={gradingConfig.useFinalComponents}
                  disabled={!canEditPeriods}
                  onChange={(e) => {
                    if (!canEditPeriods) return
                    const enabled = e.target.checked
                    if (enabled && gradingConfig.finalComponents.length === 0) {
                      setGradingConfig({
                        ...gradingConfig,
                        useFinalComponents: true,
                        finalComponents: [
                          { id: `fc-${Date.now()}`, name: 'Prueba Semestral I', weightPercentage: 10, order: 0 }
                        ]
                      })
                    } else {
                      setGradingConfig({ ...gradingConfig, useFinalComponents: enabled })
                    }
                  }}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <span className="text-sm text-slate-600">Habilitar</span>
              </label>
            </div>

            {gradingConfig.useFinalComponents && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-purple-700">Componentes configurados</span>
                  <button
                    onClick={() => {
                      const nextNum = gradingConfig.finalComponents.length + 1
                      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
                      const newComponent = {
                        id: `fc-${Date.now()}`,
                        name: `Prueba Semestral ${romanNumerals[nextNum - 1] || nextNum}`,
                        weightPercentage: 10,
                        order: gradingConfig.finalComponents.length
                      }
                      setGradingConfig({
                        ...gradingConfig,
                        finalComponents: [...gradingConfig.finalComponents, newComponent]
                      })
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    <Plus className="w-3 h-3" />
                    Agregar
                  </button>
                </div>

                <div className="space-y-2">
                  {gradingConfig.finalComponents.map((comp) => (
                    <div key={comp.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
                      <input
                        type="text"
                        value={comp.name}
                        onChange={(e) => {
                          const updated = gradingConfig.finalComponents.map(c =>
                            c.id === comp.id ? { ...c, name: e.target.value } : c
                          )
                          setGradingConfig({ ...gradingConfig, finalComponents: updated })
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={comp.weightPercentage}
                          onChange={(e) => {
                            const updated = gradingConfig.finalComponents.map(c =>
                              c.id === comp.id ? { ...c, weightPercentage: parseInt(e.target.value) || 0 } : c
                            )
                            setGradingConfig({ ...gradingConfig, finalComponents: updated })
                          }}
                          className="w-14 px-2 py-1 text-sm border border-slate-200 rounded text-center"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <button
                        onClick={() => {
                          if (gradingConfig.finalComponents.length > 1) {
                            const updated = gradingConfig.finalComponents.filter(c => c.id !== comp.id)
                            setGradingConfig({ ...gradingConfig, finalComponents: updated })
                          } else {
                            setGradingConfig({ ...gradingConfig, useFinalComponents: false, finalComponents: [] })
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-purple-700">
                  Total componentes: <strong>{finalComponentsWeight}%</strong>
                </div>
              </div>
            )}
          </div>

          {/* Resumen de distribución total */}
          <div className={`mt-4 p-3 rounded-lg text-sm ${isWeightValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                Períodos: <strong>{totalPeriodWeight}%</strong>
                {gradingConfig.useFinalComponents && (
                  <span className="ml-3">Componentes Finales: <strong>{finalComponentsWeight}%</strong></span>
                )}
              </div>
              <div>
                Total: <strong>{totalWeight}%</strong>
                {!isWeightValid && ' (debe sumar 100%)'}
              </div>
            </div>
            {gradingConfig.useFinalComponents && !isWeightValid && (
              <p className="mt-1 text-xs opacity-80">
                Los períodos deben sumar <strong>{expectedPeriodWeight}%</strong> para complementar los componentes finales
              </p>
            )}
          </div>

          {/* Botón Guardar Sistema de Calificación */}
          {canEditGradingScale && (
            <div className="flex justify-end pt-6 mt-6 border-t border-slate-200">
              <button
                onClick={handleSaveGradingConfig}
                disabled={isSaving}
                className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Guardar Sistema de Calificación'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPeriod ? 'Editar Período' : 'Nuevo Período'}
              </h3>
              <button onClick={() => setShowPeriodModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  placeholder="Ej: Primer Período"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peso (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={periodForm.weight}
                  onChange={(e) => setPeriodForm({ ...periodForm, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPeriodModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={savePeriod}
                disabled={!periodForm.name.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {editingPeriod ? 'Guardar Cambios' : 'Crear Período'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
