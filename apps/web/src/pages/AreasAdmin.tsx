import { useState } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Settings, Star, Lock, Save } from 'lucide-react'
import { useInstitution, AreaCalculationType, AreaApprovalRule, AreaRecoveryRule } from '../contexts/InstitutionContext'
import { useAuth } from '../contexts/AuthContext'

interface Subject {
  id: string
  name: string
  weeklyHours: number
  weightPercentage: number  // Porcentaje (0-100) para ponderado
  isDominant: boolean       // Si es la asignatura dominante
  order: number
}

interface Area {
  id: string
  name: string
  isMandatory: boolean      // Si es obligatoria para promoción
  order: number
  subjects: Subject[]
}

const calculationTypeLabels: Record<AreaCalculationType, string> = {
  INFORMATIVE: 'Solo informativa',
  AVERAGE: 'Promedio simple',
  WEIGHTED: 'Promedio ponderado',
  DOMINANT: 'Asignatura dominante',
}

const approvalRuleLabels: Record<AreaApprovalRule, string> = {
  AREA_AVERAGE: 'Promedio área',
  ALL_SUBJECTS: 'Todas aprobadas',
  DOMINANT_SUBJECT: 'Dominante aprobada',
}

const recoveryRuleLabels: Record<AreaRecoveryRule, string> = {
  INDIVIDUAL_SUBJECT: 'Individual',
  FULL_AREA: 'Área completa',
  CONDITIONAL: 'Condicional',
}

const mockAreas: Area[] = [
  {
    id: '1',
    name: 'Matemáticas',
    isMandatory: true,
    order: 1,
    subjects: [
      { id: 's1', name: 'Matemáticas', weeklyHours: 5, weightPercentage: 70, isDominant: true, order: 1 },
      { id: 's1b', name: 'Estadística', weeklyHours: 2, weightPercentage: 30, isDominant: false, order: 2 },
    ],
  },
  {
    id: '2',
    name: 'Humanidades',
    isMandatory: true,
    order: 2,
    subjects: [
      { id: 's2', name: 'Lengua Castellana', weeklyHours: 4, weightPercentage: 50, isDominant: false, order: 1 },
      { id: 's3', name: 'Inglés', weeklyHours: 3, weightPercentage: 50, isDominant: false, order: 2 },
    ],
  },
  {
    id: '3',
    name: 'Ciencias Naturales',
    isMandatory: true,
    order: 3,
    subjects: [
      { id: 's4', name: 'Biología', weeklyHours: 3, weightPercentage: 50, isDominant: true, order: 1 },
      { id: 's5', name: 'Química', weeklyHours: 3, weightPercentage: 30, isDominant: false, order: 2 },
      { id: 's6', name: 'Física', weeklyHours: 2, weightPercentage: 20, isDominant: false, order: 3 },
    ],
  },
  {
    id: '4',
    name: 'Educación Artística',
    isMandatory: false,
    order: 4,
    subjects: [
      { id: 's7', name: 'Artes Plásticas', weeklyHours: 2, weightPercentage: 50, isDominant: false, order: 1 },
      { id: 's8', name: 'Música', weeklyHours: 2, weightPercentage: 50, isDominant: false, order: 2 },
    ],
  },
]

export default function AreasAdmin() {
  const { areaConfig, setAreaConfig, saveAreaConfigToAPI, isSaving } = useInstitution()
  const { user } = useAuth()
  
  // Solo admin y rector pueden editar la configuración global
  const canEditGlobalConfig = user?.roles?.some(r => {
    const roleName = (r.role?.name || '').toLowerCase()
    return roleName.includes('admin') || roleName.includes('rector')
  }) ?? true
  
  const [areas, setAreas] = useState<Area[]>(mockAreas)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(['1', '2', '3']))
  const [isConfigExpanded, setIsConfigExpanded] = useState(true)  // Estado para colapsar configuración global
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [editingSubject, setEditingSubject] = useState<{ areaId: string; subject: Subject | null }>({ areaId: '', subject: null })
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'area' | 'subject'; id: string; name: string } | null>(null)

  const [areaForm, setAreaForm] = useState({
    name: '',
    isMandatory: true,
  })

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    weeklyHours: 0,
    weightPercentage: 0,
    isDominant: false,
  })

  const toggleExpand = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }

  const openAreaModal = (area?: Area) => {
    if (area) {
      setEditingArea(area)
      setAreaForm({
        name: area.name,
        isMandatory: area.isMandatory,
      })
    } else {
      setEditingArea(null)
      setAreaForm({ name: '', isMandatory: true })
    }
    setShowAreaModal(true)
  }

  const openSubjectModal = (areaId: string, subject?: Subject) => {
    setEditingSubject({ areaId, subject: subject || null })
    const area = areas.find(a => a.id === areaId)
    const existingSubjects = area?.subjects || []
    const remainingWeight = 100 - existingSubjects.reduce((sum, s) => sum + (subject && s.id === subject.id ? 0 : s.weightPercentage), 0)
    
    if (subject) {
      setSubjectForm({ 
        name: subject.name, 
        weeklyHours: subject.weeklyHours, 
        weightPercentage: subject.weightPercentage,
        isDominant: subject.isDominant,
      })
    } else {
      setSubjectForm({ 
        name: '', 
        weeklyHours: 0, 
        weightPercentage: Math.min(remainingWeight, 100),
        isDominant: false,
      })
    }
    setShowSubjectModal(true)
  }

  const saveArea = () => {
    if (!areaForm.name.trim()) return

    if (editingArea) {
      setAreas(areas.map(a => 
        a.id === editingArea.id 
          ? { ...a, name: areaForm.name, isMandatory: areaForm.isMandatory }
          : a
      ))
    } else {
      const newArea: Area = {
        id: `area-${Date.now()}`,
        name: areaForm.name,
        isMandatory: areaForm.isMandatory,
        order: areas.length + 1,
        subjects: [],
      }
      setAreas([...areas, newArea])
    }
    setShowAreaModal(false)
  }

  const saveSubject = () => {
    if (!subjectForm.name.trim()) return

    setAreas(areas.map(area => {
      if (area.id !== editingSubject.areaId) return area

      // Si se marca como dominante, quitar dominante de las demás
      const updatedSubjects = editingSubject.subject
        ? area.subjects.map(s =>
            s.id === editingSubject.subject!.id
              ? { ...s, ...subjectForm }
              : subjectForm.isDominant ? { ...s, isDominant: false } : s
          )
        : area.subjects.map(s => subjectForm.isDominant ? { ...s, isDominant: false } : s)

      if (editingSubject.subject) {
        return { ...area, subjects: updatedSubjects }
      } else {
        const newSubject: Subject = {
          id: `subj-${Date.now()}`,
          name: subjectForm.name,
          weeklyHours: subjectForm.weeklyHours,
          weightPercentage: subjectForm.weightPercentage,
          isDominant: subjectForm.isDominant,
          order: area.subjects.length + 1,
        }
        return { ...area, subjects: [...updatedSubjects, newSubject] }
      }
    }))
    setShowSubjectModal(false)
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return

    if (deleteConfirm.type === 'area') {
      setAreas(areas.filter(a => a.id !== deleteConfirm.id))
    } else {
      setAreas(areas.map(area => ({
        ...area,
        subjects: area.subjects.filter(s => s.id !== deleteConfirm.id),
      })))
    }
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Áreas y Asignaturas</h1>
          <p className="text-slate-500 mt-1">Configuración de áreas académicas y sus asignaturas</p>
        </div>
        <button
          onClick={() => openAreaModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Área
        </button>
      </div>

      {/* Configuración Global de Áreas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div 
          className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50 cursor-pointer"
          onClick={() => setIsConfigExpanded(!isConfigExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-purple-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Configuración Global de Áreas</h2>
                <p className="text-sm text-slate-500">Estas reglas aplican a TODAS las áreas de la institución</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!canEditGlobalConfig && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  Solo Admin/Rector
                </div>
              )}
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isConfigExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {isConfigExpanded && <div className="p-6 space-y-6">
          {/* Tipo de Cálculo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Tipo de cálculo del área</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                disabled={!canEditGlobalConfig}
                onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, calculationType: 'INFORMATIVE' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                  areaConfig.calculationType === 'INFORMATIVE'
                    ? 'border-slate-500 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`text-sm font-medium ${areaConfig.calculationType === 'INFORMATIVE' ? 'text-slate-700' : 'text-slate-600'}`}>
                  Solo informativa
                </div>
                <div className="text-xs text-slate-500">No afecta promoción</div>
              </button>
              
              <button
                type="button"
                disabled={!canEditGlobalConfig}
                onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, calculationType: 'AVERAGE' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                  areaConfig.calculationType === 'AVERAGE'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`text-sm font-medium ${areaConfig.calculationType === 'AVERAGE' ? 'text-blue-700' : 'text-slate-600'}`}>
                  Promedio simple
                </div>
                <div className="text-xs text-slate-500">Todas pesan igual</div>
              </button>
              
              <button
                type="button"
                disabled={!canEditGlobalConfig}
                onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, calculationType: 'WEIGHTED' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                  areaConfig.calculationType === 'WEIGHTED'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`text-sm font-medium ${areaConfig.calculationType === 'WEIGHTED' ? 'text-purple-700' : 'text-slate-600'}`}>
                  Ponderado
                </div>
                <div className="text-xs text-slate-500">Cada asignatura tiene %</div>
              </button>
              
              <button
                type="button"
                disabled={!canEditGlobalConfig}
                onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, calculationType: 'DOMINANT' })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                  areaConfig.calculationType === 'DOMINANT'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`text-sm font-medium ${areaConfig.calculationType === 'DOMINANT' ? 'text-amber-700' : 'text-slate-600'}`}>
                  Dominante
                </div>
                <div className="text-xs text-slate-500">Aprueba si la principal aprueba</div>
              </button>
            </div>
          </div>

          {areaConfig.calculationType !== 'INFORMATIVE' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Regla de Aprobación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">¿Cuándo se aprueba el área?</label>
                <div className="space-y-2">
                  {[
                    { value: 'AREA_AVERAGE', label: 'Por promedio del área', desc: 'Promedio ≥ nota mínima' },
                    { value: 'ALL_SUBJECTS', label: 'Todas las asignaturas aprobadas', desc: 'Cada una ≥ nota mínima' },
                    { value: 'DOMINANT_SUBJECT', label: 'Asignatura dominante aprobada', desc: 'Solo importa la principal' },
                  ].map((option) => (
                    <label key={option.value} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                      areaConfig.approvalRule === option.value ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="globalApprovalRule"
                        disabled={!canEditGlobalConfig}
                        checked={areaConfig.approvalRule === option.value}
                        onChange={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, approvalRule: option.value as AreaApprovalRule })}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Regla de Recuperación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">¿Cómo se recupera el área?</label>
                <div className="space-y-2">
                  {[
                    { value: 'INDIVIDUAL_SUBJECT', label: 'Asignaturas individuales', desc: 'Solo las perdidas' },
                    { value: 'FULL_AREA', label: 'Área completa', desc: 'Toda el área' },
                    { value: 'CONDITIONAL', label: 'Condicional', desc: 'Según reglas específicas' },
                  ].map((option) => (
                    <label key={option.value} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                      areaConfig.recoveryRule === option.value ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="globalRecoveryRule"
                        disabled={!canEditGlobalConfig}
                        checked={areaConfig.recoveryRule === option.value}
                        onChange={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, recoveryRule: option.value as AreaRecoveryRule })}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {areaConfig.calculationType !== 'INFORMATIVE' && (
            <div className={`p-3 bg-slate-50 rounded-lg border border-slate-200 ${!canEditGlobalConfig ? 'opacity-60' : ''}`}>
              <label className={`flex items-center gap-3 ${canEditGlobalConfig ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  disabled={!canEditGlobalConfig}
                  checked={areaConfig.failIfAnySubjectFails}
                  onChange={(e) => canEditGlobalConfig && setAreaConfig({ ...areaConfig, failIfAnySubjectFails: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Pierde el área si cualquier asignatura está perdida</div>
                  <div className="text-xs text-slate-500">Aunque el promedio sea suficiente</div>
                </div>
              </label>
            </div>
          )}

          {/* Botón Guardar Configuración Global */}
          {canEditGlobalConfig && (
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={async () => {
                  const success = await saveAreaConfigToAPI()
                  if (success) {
                    alert('✅ Configuración global guardada correctamente')
                  } else {
                    alert('❌ Error al guardar la configuración. Intente de nuevo.')
                  }
                }}
                disabled={isSaving}
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          )}
        </div>}
      </div>

      {/* Lista de Áreas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Áreas Académicas</h2>
              <p className="text-sm text-slate-500">
                {calculationTypeLabels[areaConfig.calculationType]} • {approvalRuleLabels[areaConfig.approvalRule]} • Recup: {recoveryRuleLabels[areaConfig.recoveryRule]}
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {areas.map((area) => (
            <div key={area.id}>
              <div 
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                onClick={() => toggleExpand(area.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedAreas.has(area.id) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{area.name}</span>
                      {area.isMandatory && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Obligatoria
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{area.subjects.length} asignatura{area.subjects.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openAreaModal(area)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Configurar
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'area', id: area.id, name: area.name })}
                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                    title="Eliminar área"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedAreas.has(area.id) && (
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
                  <div className="ml-8 space-y-2">
                    {area.subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          {subject.isDominant ? (
                            <Star className="w-4 h-4 text-amber-500" />
                          ) : (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{subject.name}</span>
                              {subject.isDominant && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Dominante</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {subject.weeklyHours}h/semana
                              {(areaConfig.calculationType === 'WEIGHTED' || areaConfig.calculationType === 'DOMINANT') && (
                                <span className="ml-2">• {subject.weightPercentage}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openSubjectModal(area.id, subject)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'subject', id: subject.id, name: subject.name })}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => openSubjectModal(area.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar asignatura
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {areas.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No hay áreas configuradas</p>
              <button
                onClick={() => openAreaModal()}
                className="mt-3 text-blue-600 hover:underline"
              >
                Crear primera área
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Área */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingArea ? 'Editar Área' : 'Nueva Área'}
              </h3>
              <button onClick={() => setShowAreaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del área</label>
                <input
                  type="text"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  placeholder="Ej: Matemáticas, Ciencias Naturales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isMandatory"
                  checked={areaForm.isMandatory}
                  onChange={(e) => setAreaForm({ ...areaForm, isMandatory: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="isMandatory" className="text-sm text-slate-700">
                  Área obligatoria para promoción
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowAreaModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveArea}
                disabled={!areaForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingArea ? 'Guardar cambios' : 'Crear área'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignatura */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingSubject.subject ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </h3>
              <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la asignatura</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Ej: Álgebra, Biología..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas semanales</label>
                <input
                  type="number"
                  min="0"
                  value={subjectForm.weeklyHours}
                  onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Porcentaje del área (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={subjectForm.weightPercentage}
                  onChange={(e) => setSubjectForm({ ...subjectForm, weightPercentage: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Para promedio ponderado. La suma de todas las asignaturas debe ser 100%</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input
                  type="checkbox"
                  id="isDominant"
                  checked={subjectForm.isDominant}
                  onChange={(e) => setSubjectForm({ ...subjectForm, isDominant: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <div>
                  <label htmlFor="isDominant" className="text-sm font-medium text-amber-800 flex items-center gap-1">
                    <Star className="w-4 h-4" />
                    Asignatura dominante
                  </label>
                  <p className="text-xs text-amber-600">Si está aprobada, el área se considera aprobada (según configuración)</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSubjectModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveSubject}
                disabled={!subjectForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingSubject.subject ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              ¿Eliminar {deleteConfirm.type === 'area' ? 'área' : 'asignatura'}?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estás a punto de eliminar <strong>"{deleteConfirm.name}"</strong>.
              {deleteConfirm.type === 'area' && (
                <span className="text-red-600 font-medium"> Todas las asignaturas asociadas también se eliminarán.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
