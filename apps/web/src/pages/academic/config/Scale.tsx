import { useState, useEffect } from 'react'
import { 
  Percent,
  BookOpen,
  Plus,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Eye,
  Save,
  ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInstitution } from '../../../contexts/InstitutionContext'
import { usePermissions, PERMISSIONS } from '../../../hooks/usePermissions'

interface EvaluationProcess {
  id: string
  name: string
  code: string
  weightPercentage: number
  order: number
  allowTeacherAddGrades: boolean
  subprocesses: Subprocess[]
}

interface Subprocess {
  id: string
  name: string
  weightPercentage: number
  numberOfGrades: number
  order: number
}

export default function Scale() {
  const { gradingConfig, setGradingConfig, saveGradingConfigToAPI, isSaving } = useInstitution()
  const { can } = usePermissions()
  const canEditGradingScale = can(PERMISSIONS.CONFIG_GRADING_EDIT_SCALE)
  
  const [expandedProcesses, setExpandedProcesses] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const totalProcessWeight = gradingConfig.evaluationProcesses.reduce(
    (sum, p) => sum + p.weightPercentage, 0
  )

  const handleSave = async () => {
    await saveGradingConfigToAPI()
    setHasChanges(false)
  }

  const updateConfig = (newConfig: typeof gradingConfig) => {
    setGradingConfig(newConfig)
    setHasChanges(true)
  }

  const addProcess = () => {
    const newProcess: EvaluationProcess = {
      id: `proc-${Date.now()}`,
      name: 'Nuevo Proceso',
      code: `PROCESO_${gradingConfig.evaluationProcesses.length + 1}`,
      weightPercentage: 0,
      order: gradingConfig.evaluationProcesses.length,
      allowTeacherAddGrades: true,
      subprocesses: [
        { id: `sub-${Date.now()}`, name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 }
      ]
    }
    updateConfig({
      ...gradingConfig,
      evaluationProcesses: [...gradingConfig.evaluationProcesses, newProcess]
    })
  }

  const removeProcess = (processId: string) => {
    updateConfig({
      ...gradingConfig,
      evaluationProcesses: gradingConfig.evaluationProcesses.filter(p => p.id !== processId)
    })
  }

  const updateProcess = (processId: string, updates: Partial<EvaluationProcess>) => {
    updateConfig({
      ...gradingConfig,
      evaluationProcesses: gradingConfig.evaluationProcesses.map(p =>
        p.id === processId ? { ...p, ...updates } : p
      )
    })
  }

  const addSubprocess = (processId: string) => {
    const process = gradingConfig.evaluationProcesses.find(p => p.id === processId)
    if (!process) return
    
    const newSubprocess: Subprocess = {
      id: `sub-${Date.now()}`,
      name: `Sub ${process.subprocesses.length + 1}`,
      weightPercentage: 0,
      numberOfGrades: 3,
      order: process.subprocesses.length
    }
    updateProcess(processId, {
      subprocesses: [...process.subprocesses, newSubprocess]
    })
  }

  const updateSubprocess = (processId: string, subprocessId: string, updates: Partial<Subprocess>) => {
    const process = gradingConfig.evaluationProcesses.find(p => p.id === processId)
    if (!process) return
    
    updateProcess(processId, {
      subprocesses: process.subprocesses.map(s =>
        s.id === subprocessId ? { ...s, ...updates } : s
      )
    })
  }

  const removeSubprocess = (processId: string, subprocessId: string) => {
    const process = gradingConfig.evaluationProcesses.find(p => p.id === processId)
    if (!process || process.subprocesses.length <= 1) return
    
    updateProcess(processId, {
      subprocesses: process.subprocesses.filter(s => s.id !== subprocessId)
    })
  }

  const toggleExpand = (processId: string) => {
    setExpandedProcesses(prev =>
      prev.includes(processId) 
        ? prev.filter(id => id !== processId) 
        : [...prev, processId]
    )
  }

  const processColors = ['blue', 'green', 'amber', 'purple', 'pink', 'cyan']

  return (
    <div className="p-6">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/academic-templates" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Percent className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Sistema de Calificación</h1>
              <p className="text-sm text-slate-500">Configura los componentes evaluativos y la escala de valoración</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!canEditGradingScale && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              <Eye className="w-3 h-3" /> Solo lectura
            </span>
          )}
          {canEditGradingScale && hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </div>

      {/* Procesos Evaluativos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Procesos Evaluativos
            </h3>
            {canEditGradingScale && (
              <button
                onClick={addProcess}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Agregar Proceso
              </button>
            )}
          </div>

          {/* Lista de Procesos */}
          <div className="space-y-4">
            {gradingConfig.evaluationProcesses.map((process, processIndex) => {
              const colorClass = processColors[processIndex % processColors.length]
              const isExpanded = expandedProcesses.includes(process.id)
              const subprocessTotal = process.subprocesses.reduce((sum, s) => sum + s.weightPercentage, 0)
              
              return (
                <div key={process.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Cabecera del Proceso */}
                  <div className={`p-4 bg-${colorClass}-50 border-b border-${colorClass}-200`}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => toggleExpand(process.id)} className="p-1">
                        {isExpanded ? (
                          <ChevronDown className={`w-5 h-5 text-${colorClass}-600`} />
                        ) : (
                          <ChevronRight className={`w-5 h-5 text-${colorClass}-600`} />
                        )}
                      </button>
                      
                      <input
                        type="text"
                        value={process.name}
                        disabled={!canEditGradingScale}
                        onChange={(e) => updateProcess(process.id, { name: e.target.value })}
                        className={`flex-1 font-medium text-${colorClass}-700 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-${colorClass}-300 rounded px-2 py-1 ${!canEditGradingScale ? 'cursor-not-allowed' : ''}`}
                      />
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={process.weightPercentage}
                          disabled={!canEditGradingScale}
                          onChange={(e) => updateProcess(process.id, { weightPercentage: parseInt(e.target.value) || 0 })}
                          className={`w-16 px-2 py-1 border border-slate-300 rounded text-center font-semibold ${!canEditGradingScale ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        />
                        <span className="text-slate-600 font-medium">%</span>
                      </div>

                      {canEditGradingScale && (
                        <button
                          onClick={() => removeProcess(process.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subprocesos (expandible) */}
                  {isExpanded && (
                    <div className="p-4 bg-white">
                      {/* Opción para permitir que docentes agreguen notas */}
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <label className={`flex items-center gap-2 text-sm ${!canEditGradingScale ? 'cursor-not-allowed opacity-60' : ''}`}>
                          <input
                            type="checkbox"
                            checked={process.allowTeacherAddGrades}
                            disabled={!canEditGradingScale}
                            onChange={(e) => updateProcess(process.id, { allowTeacherAddGrades: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-slate-700">Permitir que el docente agregue más casillas de notas</span>
                        </label>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-600">Subprocesos</span>
                        {canEditGradingScale && (
                          <button
                            onClick={() => addSubprocess(process.id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                          >
                            <Plus className="w-3 h-3" />
                            Agregar Subproceso
                          </button>
                        )}
                      </div>

                      {/* Lista de Subprocesos */}
                      <div className="space-y-2">
                        {process.subprocesses.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <input
                              type="text"
                              value={sub.name}
                              disabled={!canEditGradingScale}
                              onChange={(e) => updateSubprocess(process.id, sub.id, { name: e.target.value })}
                              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded bg-white"
                            />
                            
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={sub.weightPercentage}
                                disabled={!canEditGradingScale}
                                onChange={(e) => updateSubprocess(process.id, sub.id, { weightPercentage: parseInt(e.target.value) || 0 })}
                                className="w-14 px-2 py-1 text-sm border border-slate-200 rounded text-center"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                            
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={sub.numberOfGrades}
                                disabled={!canEditGradingScale}
                                onChange={(e) => updateSubprocess(process.id, sub.id, { numberOfGrades: parseInt(e.target.value) || 1 })}
                                className="w-12 px-1 py-0.5 text-sm border border-blue-300 rounded text-center bg-white"
                              />
                              <span className="text-xs text-blue-600">notas</span>
                            </div>
                            
                            {canEditGradingScale && (
                              <button
                                onClick={() => removeSubprocess(process.id, sub.id)}
                                disabled={process.subprocesses.length <= 1}
                                className={`p-1 rounded ${process.subprocesses.length > 1 ? 'hover:bg-red-100 text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Total de subprocesos */}
                      <div className={`mt-3 text-xs ${subprocessTotal === 100 ? 'text-green-600' : 'text-red-600'}`}>
                        Total subprocesos: <strong>{subprocessTotal}%</strong> {subprocessTotal !== 100 && '(debe sumar 100%)'}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Total de Procesos */}
          <div className={`mt-4 p-3 rounded-lg text-sm ${totalProcessWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            Total Procesos: <strong>{totalProcessWeight}%</strong> {totalProcessWeight !== 100 && '(debe sumar 100%)'}
          </div>
        </div>

        {/* Nota sobre escala de valoración */}
        <div className="p-4 mx-6 mb-6 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-blue-800">Escala de Valoración</div>
              <p className="text-sm text-blue-600 mt-1">
                La escala de valoración (Superior, Alto, Básico, Bajo) se configura dentro de cada <strong>Nivel Académico</strong>. 
                Esto permite tener escalas diferentes por nivel (ej: cualitativa para Preescolar, numérica para Primaria).
              </p>
              <Link 
                to="/academic/config/levels" 
                className="inline-flex items-center gap-1 mt-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
              >
                Ir a Niveles Académicos
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
