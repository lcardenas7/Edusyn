import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Settings, Star, Lock, Save, AlertTriangle, Loader2 } from 'lucide-react'
import { useInstitution, AreaType, AreaCalculationMethod, AreaApprovalCriteria, AreaRecoveryType, AcademicLevel } from '../contexts/InstitutionContext'
import { useAuth } from '../contexts/AuthContext'
import { areasApi, academicGradesApi } from '../lib/api'

// Configuración de asignatura por nivel/grado
interface SubjectLevelConfig {
  id: string
  weeklyHours: number
  weight: number  // 0-1
  isDominant: boolean
  academicLevel?: string | null
  gradeId?: string | null
  grade?: { id: string; name: string } | null
}

// Asignatura (catálogo único)
interface Subject {
  id: string
  name: string
  order: number
  levelConfigs: SubjectLevelConfig[]  // Configuraciones por nivel
}

interface Area {
  id: string
  name: string
  isMandatory: boolean
  order: number
  subjects: Subject[]
  academicLevel?: string | null
  gradeId?: string | null
  grade?: { id: string; name: string } | null
}

interface Grade {
  id: string
  name: string
  stage: string
}

// Labels para los nuevos tipos
const areaTypeLabels: Record<AreaType, { label: string; desc: string; color: string }> = {
  EVALUABLE: { label: 'Evaluable', desc: 'Afecta promoción, se calcula nota', color: 'green' },
  INFORMATIVE: { label: 'Informativa', desc: 'No afecta promoción', color: 'blue' },
  FORMATIVE: { label: 'Formativa', desc: 'Solo observaciones cualitativas', color: 'purple' },
}

const calculationMethodLabels: Record<AreaCalculationMethod, { label: string; desc: string }> = {
  AVERAGE: { label: 'Promedio simple', desc: 'Todas las asignaturas pesan igual' },
  WEIGHTED: { label: 'Ponderado', desc: 'Cada asignatura tiene un % del área' },
  DOMINANT: { label: 'Asignatura dominante', desc: 'Solo cuenta la asignatura principal' },
}

const approvalCriteriaLabels: Record<AreaApprovalCriteria, { label: string; desc: string }> = {
  AREA_AVERAGE: { label: 'Por nota final del área', desc: 'Promedio del área ≥ nota mínima' },
  ALL_SUBJECTS: { label: 'Todas las asignaturas aprobadas', desc: 'Cada asignatura ≥ nota mínima' },
  DOMINANT_SUBJECT: { label: 'Asignatura dominante aprobada', desc: 'Solo importa la principal' },
}

const recoveryTypeLabels: Record<AreaRecoveryType, { label: string; desc: string }> = {
  BY_SUBJECT: { label: 'Por asignatura', desc: 'Recupera solo las asignaturas perdidas' },
  FULL_AREA: { label: 'Área completa', desc: 'Evalúa todo el contenido del área' },
  CONDITIONAL: { label: 'Condicional', desc: 'Según comité de evaluación' },
  NONE: { label: 'No aplica', desc: 'No permite recuperación' },
}

// Helper para obtener resumen de configuración
const getConfigSummary = (areaType: AreaType, calcMethod: AreaCalculationMethod, approvalCriteria: AreaApprovalCriteria, recoveryType: AreaRecoveryType) => {
  if (areaType === 'INFORMATIVE') return 'Informativa • No afecta promoción'
  if (areaType === 'FORMATIVE') return 'Formativa • Solo observaciones'
  return `${calculationMethodLabels[calcMethod].label} • ${approvalCriteriaLabels[approvalCriteria].label} • Recup: ${recoveryTypeLabels[recoveryType].label}`
}

// Interfaz para grados
interface Grade {
  id: string
  name: string
  stage: string
}

// Helper para mapear datos del backend al formato del frontend
const mapBackendAreaToFrontend = (backendArea: any): Area => ({
  id: backendArea.id,
  name: backendArea.name,
  isMandatory: backendArea.isMandatory,
  order: backendArea.order,
  academicLevel: backendArea.academicLevel,
  gradeId: backendArea.gradeId,
  grade: backendArea.grade,
  subjects: (backendArea.subjects || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    order: s.order,
    levelConfigs: (s.levelConfigs || []).map((lc: any) => ({
      id: lc.id,
      weeklyHours: lc.weeklyHours,
      weight: lc.weight,
      isDominant: lc.isDominant,
      academicLevel: lc.academicLevel,
      gradeId: lc.gradeId,
      grade: lc.grade,
    })),
  })),
})

export default function AreasAdmin() {
  const { areaConfig, setAreaConfig, saveAreaConfigToAPI, isSaving, institution: institutionConfig } = useInstitution()
  const { user, institution } = useAuth()
  
  // Obtener niveles académicos configurados en la institución
  const academicLevels = useMemo(() => {
    const levels = institutionConfig?.academicLevels || []
    return [
      { code: 'TODOS', name: 'Todos los niveles' },
      ...levels.map(l => ({ code: l.code, name: l.name }))
    ]
  }, [institutionConfig?.academicLevels])
  
  // Solo admin y rector pueden editar la configuración global
  const canEditGlobalConfig = user?.roles?.some(r => {
    const roleName = (r.role?.name || '').toLowerCase()
    return roleName.includes('admin') || roleName.includes('rector')
  }) ?? true
  
  const [areas, setAreas] = useState<Area[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [isConfigExpanded, setIsConfigExpanded] = useState(true)
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [editingSubject, setEditingSubject] = useState<{ areaId: string; subject: Subject | null }>({ areaId: '', subject: null })
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'area' | 'subject'; id: string; name: string } | null>(null)
  
  // Filtro por nivel académico
  const [selectedLevel, setSelectedLevel] = useState<string>('TODOS')
  
  // Grados filtrados por nivel seleccionado
  const filteredGrades = useMemo(() => {
    if (selectedLevel === 'TODOS') return grades
    // Mapear código de nivel a stage del backend
    const stageMap: Record<string, string> = {
      'PREESCOLAR': 'PREESCOLAR',
      'PRIMARIA': 'BASICA_PRIMARIA',
      'SECUNDARIA': 'BASICA_SECUNDARIA',
      'MEDIA': 'MEDIA',
    }
    const stage = stageMap[selectedLevel] || selectedLevel
    return grades.filter(g => g.stage === stage)
  }, [grades, selectedLevel])
  
  // Filtrar áreas según nivel seleccionado
  const filteredAreas = useMemo(() => {
    if (selectedLevel === 'TODOS') return areas
    return areas.filter(area => 
      !area.academicLevel || area.academicLevel === selectedLevel
    )
  }, [areas, selectedLevel])

  const [areaForm, setAreaForm] = useState({
    name: '',
    isMandatory: true,
  })

  // Formulario para agregar/editar configuración de asignatura por nivel
  const [subjectConfigForm, setSubjectConfigForm] = useState({
    subjectId: '',  // ID de asignatura existente o vacío para crear nueva
    subjectName: '',  // Nombre de la asignatura
    weeklyHours: 0,
    weightPercentage: 0,
    isDominant: false,
    academicLevel: '' as string,
    gradeId: '' as string,
  })
  
  // Estado para el modal de configuración de asignatura
  const [editingConfig, setEditingConfig] = useState<SubjectLevelConfig | null>(null)

  // Cargar áreas desde el backend
  const loadAreas = useCallback(async () => {
    if (!institution?.id) return
    setLoading(true)
    try {
      const response = await areasApi.getAll(institution.id)
      const mappedAreas = (response.data || []).map(mapBackendAreaToFrontend)
      setAreas(mappedAreas)
    } catch (error) {
      console.error('Error loading areas:', error)
    } finally {
      setLoading(false)
    }
  }, [institution?.id])

  // Cargar grados desde el backend
  const loadGrades = useCallback(async () => {
    if (!institution?.id) return
    try {
      const response = await academicGradesApi.getAll(institution.id)
      setGrades(response.data || [])
    } catch (error) {
      console.error('Error loading grades:', error)
    }
  }, [institution?.id])

  useEffect(() => {
    loadAreas()
    loadGrades()
  }, [loadAreas, loadGrades])

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

  // Abrir modal para agregar/editar configuración de asignatura por nivel
  const openSubjectModal = (areaId: string, subject?: Subject, config?: SubjectLevelConfig) => {
    setEditingSubject({ areaId, subject: subject || null })
    setEditingConfig(config || null)
    
    if (subject && config) {
      // Editando configuración existente
      setSubjectConfigForm({
        subjectId: subject.id,
        subjectName: subject.name,
        weeklyHours: config.weeklyHours,
        weightPercentage: Math.round(config.weight * 100),
        isDominant: config.isDominant,
        academicLevel: config.academicLevel || '',
        gradeId: config.gradeId || '',
      })
    } else if (subject) {
      // Agregando nueva configuración a asignatura existente
      setSubjectConfigForm({
        subjectId: subject.id,
        subjectName: subject.name,
        weeklyHours: 0,
        weightPercentage: 0,
        isDominant: false,
        academicLevel: selectedLevel === 'TODOS' ? '' : selectedLevel,
        gradeId: '',
      })
    } else {
      // Creando nueva asignatura con configuración
      setSubjectConfigForm({
        subjectId: '',
        subjectName: '',
        weeklyHours: 0,
        weightPercentage: 0,
        isDominant: false,
        academicLevel: selectedLevel === 'TODOS' ? '' : selectedLevel,
        gradeId: '',
      })
    }
    setShowSubjectModal(true)
  }

  const saveArea = async () => {
    if (!areaForm.name.trim() || !institution?.id) return
    setSaving(true)

    try {
      if (editingArea) {
        // Actualizar área existente
        await areasApi.update(editingArea.id, {
          name: areaForm.name,
        })
      } else {
        // Crear nueva área
        await areasApi.create({
          institutionId: institution.id,
          name: areaForm.name,
          order: areas.length + 1,
        })
      }

      await loadAreas()
      setShowAreaModal(false)
    } catch (error: any) {
      console.error('Error saving area:', error)
      alert(error.response?.data?.message || 'Error al guardar el área')
    } finally {
      setSaving(false)
    }
  }

  // Guardar asignatura con configuración (usa el método combinado del backend)
  const saveSubject = async () => {
    if (!subjectConfigForm.subjectName.trim()) return
    setSaving(true)

    try {
      // Crear asignatura en el catálogo
      await areasApi.addSubject(editingSubject.areaId, {
        name: subjectConfigForm.subjectName,
      })
      
      await loadAreas()
      setShowSubjectModal(false)
    } catch (error: any) {
      console.error('Error saving subject:', error)
      alert(error.response?.data?.message || 'Error al guardar la asignatura')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    setSaving(true)

    try {
      if (deleteConfirm.type === 'area') {
        await areasApi.delete(deleteConfirm.id)
      } else {
        await areasApi.deleteSubject(deleteConfirm.id)
      }
      await loadAreas()
      setDeleteConfirm(null)
    } catch (error: any) {
      console.error('Error deleting:', error)
      alert(error.response?.data?.message || 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Áreas y Asignaturas</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Configuración de áreas académicas y sus asignaturas</p>
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

        {isConfigExpanded && <div className="p-6 space-y-8">
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CAPA 1: TIPO DE ÁREA */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🧩</span>
              <div>
                <label className="block text-sm font-semibold text-slate-800">1. Tipo de Área</label>
                <p className="text-xs text-slate-500">Define el impacto académico</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['EVALUABLE', 'INFORMATIVE', 'FORMATIVE'] as AreaType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={!canEditGlobalConfig}
                  onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, areaType: type })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                    areaConfig.areaType === type
                      ? `border-${areaTypeLabels[type].color}-500 bg-${areaTypeLabels[type].color}-50`
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`text-sm font-medium ${areaConfig.areaType === type ? `text-${areaTypeLabels[type].color}-700` : 'text-slate-600'}`}>
                    {areaTypeLabels[type].label}
                  </div>
                  <div className="text-xs text-slate-500">{areaTypeLabels[type].desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CAPA 2: MÉTODO DE CÁLCULO (solo si EVALUABLE) */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {areaConfig.areaType === 'EVALUABLE' && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📐</span>
                <div>
                  <label className="block text-sm font-semibold text-slate-800">2. Cálculo del Área</label>
                  <p className="text-xs text-slate-500">Cómo se obtiene la nota final</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(['AVERAGE', 'WEIGHTED', 'DOMINANT'] as AreaCalculationMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={!canEditGlobalConfig}
                    onClick={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, calculationMethod: method })}
                    className={`p-3 rounded-lg border-2 text-left transition-all bg-white ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : ''} ${
                      areaConfig.calculationMethod === method
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className={`text-sm font-medium ${areaConfig.calculationMethod === method ? 'text-blue-700' : 'text-slate-600'}`}>
                      {calculationMethodLabels[method].label}
                    </div>
                    <div className="text-xs text-slate-500">{calculationMethodLabels[method].desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CAPA 3: CRITERIO DE APROBACIÓN (solo si EVALUABLE) */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {areaConfig.areaType === 'EVALUABLE' && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✅</span>
                <div>
                  <label className="block text-sm font-semibold text-slate-800">3. Aprobación del Área</label>
                  <p className="text-xs text-slate-500">Condición para aprobar</p>
                </div>
              </div>
              <div className="space-y-2">
                {(['AREA_AVERAGE', 'ALL_SUBJECTS', 'DOMINANT_SUBJECT'] as AreaApprovalCriteria[]).map((criteria) => (
                  <label key={criteria} className={`flex items-start gap-3 p-3 rounded-lg border transition-all bg-white ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                    areaConfig.approvalCriteria === criteria ? 'border-green-500 bg-green-100' : 'border-slate-200 hover:border-green-300'
                  }`}>
                    <input
                      type="radio"
                      name="approvalCriteria"
                      disabled={!canEditGlobalConfig}
                      checked={areaConfig.approvalCriteria === criteria}
                      onChange={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, approvalCriteria: criteria })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">{approvalCriteriaLabels[criteria].label}</div>
                      <div className="text-xs text-slate-500">{approvalCriteriaLabels[criteria].desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              
              {/* Opción adicional */}
              <div className={`mt-3 p-3 bg-white rounded-lg border border-slate-200 ${!canEditGlobalConfig ? 'opacity-60' : ''}`}>
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
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CAPA 4: TIPO DE RECUPERACIÓN */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">♻️</span>
              <div>
                <label className="block text-sm font-semibold text-slate-800">4. Recuperación</label>
                <p className="text-xs text-slate-500">Qué ocurre si se pierde</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(['BY_SUBJECT', 'FULL_AREA', 'CONDITIONAL', 'NONE'] as AreaRecoveryType[]).map((type) => (
                <label key={type} className={`flex items-start gap-3 p-3 rounded-lg border transition-all bg-white ${!canEditGlobalConfig ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                  areaConfig.recoveryType === type ? 'border-orange-500 bg-orange-100' : 'border-slate-200 hover:border-orange-300'
                }`}>
                  <input
                    type="radio"
                    name="recoveryType"
                    disabled={!canEditGlobalConfig}
                    checked={areaConfig.recoveryType === type}
                    onChange={() => canEditGlobalConfig && setAreaConfig({ ...areaConfig, recoveryType: type })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">{recoveryTypeLabels[type].label}</div>
                    <div className="text-xs text-slate-500">{recoveryTypeLabels[type].desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Validaciones y alertas */}
          {areaConfig.calculationMethod === 'DOMINANT' && areaConfig.areaType === 'EVALUABLE' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Asignatura dominante requerida</p>
                <p className="text-xs text-amber-600">Asegúrate de marcar una asignatura como "dominante" en cada área.</p>
              </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Áreas Académicas</h2>
                <p className="text-sm text-slate-500">
                  {getConfigSummary(areaConfig.areaType, areaConfig.calculationMethod, areaConfig.approvalCriteria, areaConfig.recoveryType)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Filtrar por nivel:</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {academicLevels.map(level => (
                  <option key={level.code} value={level.code}>{level.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-spin" />
              <p className="text-slate-500">Cargando áreas...</p>
            </div>
          ) : filteredAreas.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>{selectedLevel === 'TODOS' ? 'No hay áreas configuradas' : `No hay áreas para ${academicLevels.find(l => l.code === selectedLevel)?.name || selectedLevel}`}</p>
              <button
                onClick={() => openAreaModal()}
                className="mt-3 text-blue-600 hover:underline"
              >
                Crear primera área
              </button>
            </div>
          ) : filteredAreas.map((area) => (
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
                      {area.academicLevel && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                          {academicLevels.find(l => l.code === area.academicLevel)?.name || area.academicLevel}
                        </span>
                      )}
                      {area.gradeId && area.grade && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          Solo {area.grade.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
                      <span>{area.subjects.length} asignatura{area.subjects.length !== 1 ? 's' : ''} única{area.subjects.length !== 1 ? 's' : ''}</span>
                      {(() => {
                        // Contar configuraciones por nivel/grado
                        const allConfigs = area.subjects.flatMap(s => s.levelConfigs)
                        const levels = new Set(allConfigs.filter(c => c.academicLevel && !c.gradeId).map(c => c.academicLevel))
                        const grades = new Set(allConfigs.filter(c => c.gradeId).map(c => c.gradeId))
                        const hasGlobal = allConfigs.some(c => !c.academicLevel && !c.gradeId)
                        const configs: string[] = []
                        if (hasGlobal) configs.push('Global')
                        if (levels.size > 0) configs.push(`${levels.size} nivel${levels.size > 1 ? 'es' : ''}`)
                        if (grades.size > 0) configs.push(`${grades.size} excepción${grades.size > 1 ? 'es' : ''}`)
                        return configs.length > 0 ? (
                          <span className="text-slate-400">• {configs.join(', ')}</span>
                        ) : null
                      })()}
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
                  <div className="ml-8 space-y-3">
                    {/* Agrupar configuraciones por nivel/grado */}
                    {(() => {
                      // Agrupar todas las configuraciones de todas las asignaturas
                      type ConfigWithSubject = { subject: Subject; config: SubjectLevelConfig }
                      const globalConfigs: ConfigWithSubject[] = []
                      const levelGroups = new Map<string, ConfigWithSubject[]>()
                      const gradeGroups = new Map<string, { gradeName: string; configs: ConfigWithSubject[] }>()
                      
                      area.subjects.forEach(subject => {
                        subject.levelConfigs.forEach(config => {
                          const item = { subject, config }
                          if (config.gradeId && config.grade) {
                            const existing = gradeGroups.get(config.gradeId)
                            if (existing) {
                              existing.configs.push(item)
                            } else {
                              gradeGroups.set(config.gradeId, { gradeName: config.grade.name, configs: [item] })
                            }
                          } else if (config.academicLevel) {
                            const existing = levelGroups.get(config.academicLevel)
                            if (existing) {
                              existing.push(item)
                            } else {
                              levelGroups.set(config.academicLevel, [item])
                            }
                          } else {
                            globalConfigs.push(item)
                          }
                        })
                      })

                      const renderConfigItem = (item: ConfigWithSubject, borderColor: string) => (
                        <div key={item.config.id} className={`flex items-center justify-between bg-white px-3 py-2 rounded border ${borderColor}`}>
                          <div className="flex items-center gap-2">
                            {item.config.isDominant ? <Star className="w-4 h-4 text-amber-500" /> : <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                            <span className="font-medium text-slate-800">{item.subject.name}</span>
                            {item.config.isDominant && <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Dominante</span>}
                            <span className="text-xs text-slate-500">{item.config.weeklyHours}h • {Math.round(item.config.weight * 100)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openSubjectModal(area.id, item.subject, item.config)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm({ type: 'subject', id: item.subject.id, name: item.subject.name })} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )

                      return (
                        <>
                          {/* Configuraciones Globales */}
                          {globalConfigs.length > 0 && (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 flex items-center gap-2">
                                🌐 Global (todos los niveles)
                              </div>
                              <div className="p-2 space-y-1">
                                {globalConfigs.map(item => renderConfigItem(item, 'border-slate-200'))}
                              </div>
                            </div>
                          )}

                          {/* Configuraciones por Nivel */}
                          {Array.from(levelGroups.entries()).map(([levelCode, configs]) => (
                            <div key={levelCode} className="border border-blue-200 rounded-lg overflow-hidden">
                              <div className="bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 flex items-center gap-2">
                                📚 {academicLevels.find(l => l.code === levelCode)?.name || levelCode}
                              </div>
                              <div className="p-2 space-y-1">
                                {configs.map(item => renderConfigItem(item, 'border-blue-200'))}
                              </div>
                            </div>
                          ))}

                          {/* Excepciones por Grado */}
                          {Array.from(gradeGroups.entries()).map(([gradeId, { gradeName, configs }]) => (
                            <div key={gradeId} className="border border-purple-200 rounded-lg overflow-hidden">
                              <div className="bg-purple-100 px-3 py-2 text-sm font-medium text-purple-800 flex items-center gap-2">
                                🎓 Excepción: {gradeName}
                              </div>
                              <div className="p-2 space-y-1">
                                {configs.map(item => renderConfigItem(item, 'border-purple-200'))}
                              </div>
                            </div>
                          ))}

                          {/* Mensaje si no hay asignaturas */}
                          {area.subjects.length === 0 && (
                            <div className="text-center py-4 text-slate-500 text-sm">
                              No hay asignaturas configuradas. Agregue asignaturas para cada nivel académico.
                            </div>
                          )}
                        </>
                      )
                    })()}
                    
                    <button
                      onClick={() => openSubjectModal(area.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full border border-dashed border-blue-300"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar asignatura (configurar nivel/grado)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Área - Simple */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
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

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 <strong>Tip:</strong> Después de crear el área, use "Agregar asignatura" para configurar las asignaturas por nivel académico o grado específico.
                </p>
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
                disabled={!areaForm.name.trim() || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
              {/* Selector de asignatura existente o crear nueva */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignatura</label>
                {editingSubject.subject ? (
                  <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700">
                    {subjectConfigForm.subjectName}
                    <span className="text-xs text-slate-500 ml-2">(editando configuración)</span>
                  </div>
                ) : (
                  <>
                    {/* Mostrar asignaturas existentes del área */}
                    {(() => {
                      const area = areas.find(a => a.id === editingSubject.areaId)
                      const existingSubjects = area?.subjects || []
                      
                      if (existingSubjects.length > 0) {
                        return (
                          <div className="space-y-2">
                            <select
                              value={subjectConfigForm.subjectId}
                              onChange={(e) => {
                                const selected = existingSubjects.find(s => s.id === e.target.value)
                                if (selected) {
                                  setSubjectConfigForm({
                                    ...subjectConfigForm,
                                    subjectId: selected.id,
                                    subjectName: selected.name,
                                  })
                                } else {
                                  setSubjectConfigForm({
                                    ...subjectConfigForm,
                                    subjectId: '',
                                    subjectName: '',
                                  })
                                }
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                              <option value="">➕ Crear nueva asignatura...</option>
                              {existingSubjects.map(s => (
                                <option key={s.id} value={s.id}>📚 {s.name}</option>
                              ))}
                            </select>
                            
                            {!subjectConfigForm.subjectId && (
                              <input
                                type="text"
                                value={subjectConfigForm.subjectName}
                                onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, subjectName: e.target.value })}
                                placeholder="Nombre de la nueva asignatura..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            )}
                          </div>
                        )
                      }
                      
                      return (
                        <input
                          type="text"
                          value={subjectConfigForm.subjectName}
                          onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, subjectName: e.target.value })}
                          placeholder="Ej: Álgebra, Biología..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      )
                    })()}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas semanales</label>
                <input
                  type="number"
                  min="0"
                  value={subjectConfigForm.weeklyHours}
                  onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, weeklyHours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Porcentaje del área (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={subjectConfigForm.weightPercentage}
                  onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, weightPercentage: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Para promedio ponderado. La suma de todas las asignaturas debe ser 100%</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input
                  type="checkbox"
                  id="isDominant"
                  checked={subjectConfigForm.isDominant}
                  onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, isDominant: e.target.checked })}
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

              {/* Configuración por nivel/grado */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h4 className="text-sm font-medium text-blue-800">📚 Alcance de esta configuración</h4>
                <p className="text-xs text-blue-600 mb-2">
                  Define en qué nivel o grado específico aplica esta configuración
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nivel académico</label>
                  <select
                    value={subjectConfigForm.academicLevel}
                    onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, academicLevel: e.target.value, gradeId: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">🌐 Todos los niveles (global)</option>
                    {academicLevels.filter(l => l.code !== 'TODOS').map(level => (
                      <option key={level.code} value={level.code}>📚 {level.name}</option>
                    ))}
                  </select>
                </div>

                {subjectConfigForm.academicLevel && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grado específico (excepción)</label>
                    <select
                      value={subjectConfigForm.gradeId}
                      onChange={(e) => setSubjectConfigForm({ ...subjectConfigForm, gradeId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Todos los grados del nivel</option>
                      {grades
                        .filter(g => {
                          const stageMap: Record<string, string> = {
                            'PREESCOLAR': 'PREESCOLAR',
                            'PRIMARIA': 'BASICA_PRIMARIA',
                            'SECUNDARIA': 'BASICA_SECUNDARIA',
                            'MEDIA': 'MEDIA',
                          }
                          return g.stage === (stageMap[subjectConfigForm.academicLevel] || subjectConfigForm.academicLevel)
                        })
                        .map(grade => (
                          <option key={grade.id} value={grade.id}>🎓 {grade.name}</option>
                        ))
                      }
                    </select>
                  </div>
                )}

                <p className="text-xs text-blue-600 italic">
                  {!subjectConfigForm.academicLevel 
                    ? '✓ Esta configuración aplica a todos los niveles y grados'
                    : subjectConfigForm.gradeId 
                      ? `✓ Esta configuración aplica SOLO a ${grades.find(g => g.id === subjectConfigForm.gradeId)?.name || 'este grado'}`
                      : `✓ Esta configuración aplica a todo ${academicLevels.find(l => l.code === subjectConfigForm.academicLevel)?.name || subjectConfigForm.academicLevel}`
                  }
                </p>
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
                disabled={!subjectConfigForm.subjectName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingConfig ? 'Guardar' : 'Crear'}
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
