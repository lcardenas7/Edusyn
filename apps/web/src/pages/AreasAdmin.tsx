import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Settings, Star, Lock, Save, AlertTriangle, Loader2 } from 'lucide-react'
import { useInstitution, AreaType, AreaCalculationMethod, AreaApprovalCriteria, AreaRecoveryType, AcademicLevel } from '../contexts/InstitutionContext'
import { useAuth } from '../contexts/AuthContext'
import { areasApi, academicGradesApi } from '../lib/api'

interface Subject {
  id: string
  name: string
  weeklyHours: number
  weightPercentage: number  // Porcentaje (0-100) para ponderado
  isDominant: boolean       // Si es la asignatura dominante
  order: number
  academicLevel?: string | null  // PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA
  gradeId?: string | null
  grade?: { id: string; name: string } | null
}

interface Area {
  id: string
  name: string
  isMandatory: boolean      // Si es obligatoria para promoción
  order: number
  subjects: Subject[]
  academicLevel?: string | null  // PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA
  gradeId?: string | null
  grade?: { id: string; name: string } | null
}

// Configuración de asignaturas por nivel (para el modal integrado)
interface LevelSubjectConfig {
  id?: string  // ID temporal para nuevas, real para existentes
  name: string
  weeklyHours: number
  weightPercentage: number
  isDominant: boolean
  isNew?: boolean  // Para distinguir nuevas de existentes
  toDelete?: boolean  // Marcar para eliminar
}

interface LevelConfig {
  levelCode: string
  levelName: string
  subjects: LevelSubjectConfig[]
}

interface GradeException {
  gradeId: string
  gradeName: string
  subjects: LevelSubjectConfig[]
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
    weeklyHours: s.weeklyHours,
    weightPercentage: Math.round(s.weight * 100), // Backend usa 0-1, frontend usa 0-100
    isDominant: s.isDominant,
    order: s.order,
    academicLevel: s.academicLevel,
    gradeId: s.gradeId,
    grade: s.grade,
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
      'PREESCOLAR': 'PRESCHOOL',
      'PRIMARIA': 'PRIMARY',
      'SECUNDARIA': 'SECONDARY',
      'MEDIA': 'HIGH_SCHOOL',
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

  // Configuración de asignaturas por nivel (para el modal integrado)
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([])
  const [gradeExceptions, setGradeExceptions] = useState<GradeException[]>([])
  const [activeConfigTab, setActiveConfigTab] = useState<'levels' | 'exceptions'>('levels')
  const [selectedConfigLevel, setSelectedConfigLevel] = useState<string>('')

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    weeklyHours: 0,
    weightPercentage: 0,
    isDominant: false,
    academicLevel: '' as string,
    gradeId: '' as string,
  })

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
      
      // Cargar configuraciones por nivel desde las asignaturas existentes
      const levelConfigsMap = new Map<string, LevelSubjectConfig[]>()
      const gradeExceptionsMap = new Map<string, { gradeName: string; subjects: LevelSubjectConfig[] }>()
      
      area.subjects.forEach(subject => {
        const subjectConfig: LevelSubjectConfig = {
          id: subject.id,
          name: subject.name,
          weeklyHours: subject.weeklyHours,
          weightPercentage: subject.weightPercentage,
          isDominant: subject.isDominant,
        }
        
        if (subject.gradeId && subject.grade) {
          // Es una excepción por grado
          const existing = gradeExceptionsMap.get(subject.gradeId)
          if (existing) {
            existing.subjects.push(subjectConfig)
          } else {
            gradeExceptionsMap.set(subject.gradeId, {
              gradeName: subject.grade.name,
              subjects: [subjectConfig]
            })
          }
        } else if (subject.academicLevel) {
          // Es configuración por nivel
          const existing = levelConfigsMap.get(subject.academicLevel)
          if (existing) {
            existing.push(subjectConfig)
          } else {
            levelConfigsMap.set(subject.academicLevel, [subjectConfig])
          }
        } else {
          // Es global - agregar a un nivel especial "GLOBAL"
          const existing = levelConfigsMap.get('GLOBAL')
          if (existing) {
            existing.push(subjectConfig)
          } else {
            levelConfigsMap.set('GLOBAL', [subjectConfig])
          }
        }
      })
      
      // Convertir maps a arrays
      const configs: LevelConfig[] = []
      levelConfigsMap.forEach((subjects, levelCode) => {
        const levelName = levelCode === 'GLOBAL' 
          ? 'Configuración Global (todos los niveles)'
          : academicLevels.find(l => l.code === levelCode)?.name || levelCode
        configs.push({ levelCode, levelName, subjects })
      })
      setLevelConfigs(configs)
      
      const exceptions: GradeException[] = []
      gradeExceptionsMap.forEach((data, gradeId) => {
        exceptions.push({ gradeId, gradeName: data.gradeName, subjects: data.subjects })
      })
      setGradeExceptions(exceptions)
      
    } else {
      setEditingArea(null)
      setAreaForm({ name: '', isMandatory: true })
      setLevelConfigs([])
      setGradeExceptions([])
    }
    setActiveConfigTab('levels')
    setSelectedConfigLevel('')
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
        academicLevel: subject.academicLevel || '',
        gradeId: subject.gradeId || '',
      })
    } else {
      setSubjectForm({ 
        name: '', 
        weeklyHours: 0, 
        weightPercentage: Math.min(remainingWeight, 100),
        academicLevel: selectedLevel === 'TODOS' ? '' : selectedLevel,
        gradeId: '',
        isDominant: false,
      })
    }
    setShowSubjectModal(true)
  }

  const saveArea = async () => {
    if (!areaForm.name.trim() || !institution?.id) return
    setSaving(true)

    try {
      let areaId = editingArea?.id
      
      if (editingArea) {
        // Actualizar área existente
        await areasApi.update(editingArea.id, {
          name: areaForm.name,
          isMandatory: areaForm.isMandatory,
        })
      } else {
        // Crear nueva área
        const response = await areasApi.create({
          institutionId: institution.id,
          name: areaForm.name,
          isMandatory: areaForm.isMandatory,
          order: areas.length + 1,
        })
        areaId = response.data.id
      }

      if (areaId) {
        // Obtener IDs de asignaturas existentes para saber cuáles eliminar
        const existingSubjectIds = new Set(
          editingArea?.subjects.map(s => s.id) || []
        )
        const processedIds = new Set<string>()

        // Guardar configuraciones por nivel
        for (const levelConfig of levelConfigs) {
          for (const subject of levelConfig.subjects) {
            if (subject.toDelete) continue
            
            const academicLevel = levelConfig.levelCode === 'GLOBAL' ? undefined : levelConfig.levelCode
            
            if (subject.id && !subject.isNew) {
              // Actualizar asignatura existente
              await areasApi.updateSubject(subject.id, {
                name: subject.name,
                weeklyHours: subject.weeklyHours,
                weight: subject.weightPercentage / 100,
                isDominant: subject.isDominant,
                academicLevel,
                gradeId: undefined,
              })
              processedIds.add(subject.id)
            } else {
              // Crear nueva asignatura
              await areasApi.addSubject(areaId, {
                name: subject.name,
                weeklyHours: subject.weeklyHours,
                weight: subject.weightPercentage / 100,
                isDominant: subject.isDominant,
                academicLevel,
              })
            }
          }
        }

        // Guardar excepciones por grado
        for (const exception of gradeExceptions) {
          for (const subject of exception.subjects) {
            if (subject.toDelete) continue
            
            if (subject.id && !subject.isNew) {
              // Actualizar asignatura existente
              await areasApi.updateSubject(subject.id, {
                name: subject.name,
                weeklyHours: subject.weeklyHours,
                weight: subject.weightPercentage / 100,
                isDominant: subject.isDominant,
                gradeId: exception.gradeId,
              })
              processedIds.add(subject.id)
            } else {
              // Crear nueva asignatura con excepción de grado
              await areasApi.addSubject(areaId, {
                name: subject.name,
                weeklyHours: subject.weeklyHours,
                weight: subject.weightPercentage / 100,
                isDominant: subject.isDominant,
                gradeId: exception.gradeId,
              })
            }
          }
        }

        // Eliminar asignaturas que ya no están en la configuración
        for (const existingId of existingSubjectIds) {
          if (!processedIds.has(existingId)) {
            await areasApi.deleteSubject(existingId)
          }
        }
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

  const saveSubject = async () => {
    if (!subjectForm.name.trim()) return
    setSaving(true)

    try {
      const area = areas.find(a => a.id === editingSubject.areaId)
      if (!area) return

      if (editingSubject.subject) {
        await areasApi.updateSubject(editingSubject.subject.id, {
          name: subjectForm.name,
          weeklyHours: subjectForm.weeklyHours,
          weight: subjectForm.weightPercentage / 100, // Frontend usa 0-100, backend usa 0-1
          isDominant: subjectForm.isDominant,
          academicLevel: subjectForm.academicLevel || undefined,
          gradeId: subjectForm.gradeId || undefined,
        })
      } else {
        await areasApi.addSubject(editingSubject.areaId, {
          name: subjectForm.name,
          weeklyHours: subjectForm.weeklyHours,
          weight: subjectForm.weightPercentage / 100,
          isDominant: subjectForm.isDominant,
          order: area.subjects.length + 1,
          academicLevel: subjectForm.academicLevel || undefined,
          gradeId: subjectForm.gradeId || undefined,
        })
      }
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
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{area.subjects.length} asignatura{area.subjects.length !== 1 ? 's' : ''}</span>
                      {!area.academicLevel && !area.gradeId && <span className="text-slate-400">• Global</span>}
                      {area.academicLevel && !area.gradeId && <span className="text-slate-400">• Todo el nivel</span>}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-slate-800">{subject.name}</span>
                              {subject.isDominant && (
                                <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Dominante</span>
                              )}
                              {subject.academicLevel && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                  {academicLevels.find(l => l.code === subject.academicLevel)?.name || subject.academicLevel}
                                </span>
                              )}
                              {subject.gradeId && subject.grade && (
                                <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                                  Solo {subject.grade.name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {subject.weeklyHours}h/semana
                              {(areaConfig.calculationMethod === 'WEIGHTED' || areaConfig.calculationMethod === 'DOMINANT') && (
                                <span className="ml-2">• {subject.weightPercentage}%</span>
                              )}
                              {!subject.academicLevel && <span className="ml-2 text-slate-400">• Global</span>}
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
        </div>
      </div>

      {/* Modal Área - Configuración Integrada */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingArea ? `Configurar Área: ${areaForm.name}` : 'Nueva Área'}
              </h3>
              <button onClick={() => setShowAreaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Información básica del área */}
              <div className="grid grid-cols-2 gap-4">
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
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={areaForm.isMandatory}
                      onChange={(e) => setAreaForm({ ...areaForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Área obligatoria para promoción</span>
                  </label>
                </div>
              </div>

              {/* Tabs de configuración */}
              <div className="border-b border-slate-200">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveConfigTab('levels')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeConfigTab === 'levels'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📚 Configuración por Niveles
                  </button>
                  <button
                    onClick={() => setActiveConfigTab('exceptions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeConfigTab === 'exceptions'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    🎯 Excepciones por Grado ({gradeExceptions.length})
                  </button>
                </div>
              </div>

              {/* Tab: Configuración por Niveles */}
              {activeConfigTab === 'levels' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Configure las asignaturas de esta área para cada nivel académico. Si no configura un nivel específico, 
                    se usará la configuración global.
                  </p>

                  {/* Selector para agregar configuración de nivel */}
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedConfigLevel}
                      onChange={(e) => setSelectedConfigLevel(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Seleccionar nivel para configurar...</option>
                      <option value="GLOBAL" disabled={levelConfigs.some(c => c.levelCode === 'GLOBAL')}>
                        🌐 Global (todos los niveles)
                      </option>
                      {academicLevels.filter(l => l.code !== 'TODOS').map(level => (
                        <option 
                          key={level.code} 
                          value={level.code}
                          disabled={levelConfigs.some(c => c.levelCode === level.code)}
                        >
                          📚 {level.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedConfigLevel) {
                          const levelName = selectedConfigLevel === 'GLOBAL'
                            ? 'Configuración Global (todos los niveles)'
                            : academicLevels.find(l => l.code === selectedConfigLevel)?.name || selectedConfigLevel
                          setLevelConfigs([...levelConfigs, {
                            levelCode: selectedConfigLevel,
                            levelName,
                            subjects: []
                          }])
                          setSelectedConfigLevel('')
                        }
                      }}
                      disabled={!selectedConfigLevel}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Lista de configuraciones por nivel */}
                  {levelConfigs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                      <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p>No hay configuraciones de nivel. Agregue una configuración global o por nivel específico.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {levelConfigs.map((config, configIndex) => (
                        <div key={config.levelCode} className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-100 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{config.levelCode === 'GLOBAL' ? '🌐' : '📚'}</span>
                              <span className="font-medium text-slate-800">{config.levelName}</span>
                              <span className="text-xs text-slate-500">
                                ({config.subjects.filter(s => !s.toDelete).length} asignaturas)
                              </span>
                            </div>
                            <button
                              onClick={() => setLevelConfigs(levelConfigs.filter((_, i) => i !== configIndex))}
                              className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                              title="Eliminar configuración"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="p-4 space-y-2">
                            {/* Lista de asignaturas del nivel */}
                            {config.subjects.filter(s => !s.toDelete).map((subject, subjectIndex) => (
                              <div key={subject.id || subjectIndex} className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200">
                                <input
                                  type="text"
                                  value={subject.name}
                                  onChange={(e) => {
                                    const newConfigs = [...levelConfigs]
                                    newConfigs[configIndex].subjects[subjectIndex].name = e.target.value
                                    setLevelConfigs(newConfigs)
                                  }}
                                  placeholder="Nombre asignatura"
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                />
                                <input
                                  type="number"
                                  value={subject.weeklyHours}
                                  onChange={(e) => {
                                    const newConfigs = [...levelConfigs]
                                    newConfigs[configIndex].subjects[subjectIndex].weeklyHours = parseInt(e.target.value) || 0
                                    setLevelConfigs(newConfigs)
                                  }}
                                  placeholder="Horas"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                                  min="0"
                                />
                                <span className="text-xs text-slate-500">h/sem</span>
                                <input
                                  type="number"
                                  value={subject.weightPercentage}
                                  onChange={(e) => {
                                    const newConfigs = [...levelConfigs]
                                    newConfigs[configIndex].subjects[subjectIndex].weightPercentage = parseInt(e.target.value) || 0
                                    setLevelConfigs(newConfigs)
                                  }}
                                  placeholder="%"
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                                  min="0"
                                  max="100"
                                />
                                <span className="text-xs text-slate-500">%</span>
                                <label className="flex items-center gap-1 text-xs text-amber-600">
                                  <input
                                    type="checkbox"
                                    checked={subject.isDominant}
                                    onChange={(e) => {
                                      const newConfigs = [...levelConfigs]
                                      // Desmarcar otras dominantes del mismo nivel
                                      newConfigs[configIndex].subjects.forEach((s, i) => {
                                        if (i !== subjectIndex) s.isDominant = false
                                      })
                                      newConfigs[configIndex].subjects[subjectIndex].isDominant = e.target.checked
                                      setLevelConfigs(newConfigs)
                                    }}
                                    className="w-3 h-3"
                                  />
                                  <Star className="w-3 h-3" />
                                </label>
                                <button
                                  onClick={() => {
                                    const newConfigs = [...levelConfigs]
                                    if (subject.id && !subject.isNew) {
                                      newConfigs[configIndex].subjects[subjectIndex].toDelete = true
                                    } else {
                                      newConfigs[configIndex].subjects.splice(subjectIndex, 1)
                                    }
                                    setLevelConfigs(newConfigs)
                                  }}
                                  className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            
                            {/* Botón agregar asignatura */}
                            <button
                              onClick={() => {
                                const newConfigs = [...levelConfigs]
                                newConfigs[configIndex].subjects.push({
                                  id: `new-${Date.now()}`,
                                  name: '',
                                  weeklyHours: 0,
                                  weightPercentage: 0,
                                  isDominant: false,
                                  isNew: true,
                                })
                                setLevelConfigs(newConfigs)
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded w-full"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar asignatura
                            </button>

                            {/* Suma de porcentajes */}
                            {config.subjects.filter(s => !s.toDelete).length > 0 && (
                              <div className={`text-xs text-right ${
                                config.subjects.filter(s => !s.toDelete).reduce((sum, s) => sum + s.weightPercentage, 0) === 100
                                  ? 'text-green-600'
                                  : 'text-amber-600'
                              }`}>
                                Total: {config.subjects.filter(s => !s.toDelete).reduce((sum, s) => sum + s.weightPercentage, 0)}%
                                {config.subjects.filter(s => !s.toDelete).reduce((sum, s) => sum + s.weightPercentage, 0) !== 100 && ' (debe ser 100%)'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Excepciones por Grado */}
              {activeConfigTab === 'exceptions' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Configure excepciones para grados específicos. Estas configuraciones tienen prioridad sobre la configuración del nivel.
                  </p>

                  {/* Selector para agregar excepción */}
                  <div className="flex items-center gap-3">
                    <select
                      value=""
                      onChange={(e) => {
                        const gradeId = e.target.value
                        if (gradeId && !gradeExceptions.some(ex => ex.gradeId === gradeId)) {
                          const grade = grades.find(g => g.id === gradeId)
                          if (grade) {
                            setGradeExceptions([...gradeExceptions, {
                              gradeId,
                              gradeName: grade.name,
                              subjects: []
                            }])
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="">Seleccionar grado para excepción...</option>
                      {grades.map(grade => (
                        <option 
                          key={grade.id} 
                          value={grade.id}
                          disabled={gradeExceptions.some(ex => ex.gradeId === grade.id)}
                        >
                          🎓 {grade.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lista de excepciones */}
                  {gradeExceptions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-purple-50 rounded-lg">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-purple-300" />
                      <p>No hay excepciones configuradas. Las excepciones permiten configurar asignaturas diferentes para grados específicos.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {gradeExceptions.map((exception, exIndex) => (
                        <div key={exception.gradeId} className="border border-purple-200 rounded-lg overflow-hidden">
                          <div className="bg-purple-100 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎓</span>
                              <span className="font-medium text-purple-800">Excepción: {exception.gradeName}</span>
                              <span className="text-xs text-purple-600">
                                ({exception.subjects.filter(s => !s.toDelete).length} asignaturas)
                              </span>
                            </div>
                            <button
                              onClick={() => setGradeExceptions(gradeExceptions.filter((_, i) => i !== exIndex))}
                              className="p-1 hover:bg-red-100 rounded text-purple-400 hover:text-red-600"
                              title="Eliminar excepción"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="p-4 space-y-2">
                            {exception.subjects.filter(s => !s.toDelete).map((subject, subjectIndex) => (
                              <div key={subject.id || subjectIndex} className="flex items-center gap-3 bg-white p-3 rounded border border-purple-200">
                                <input
                                  type="text"
                                  value={subject.name}
                                  onChange={(e) => {
                                    const newExceptions = [...gradeExceptions]
                                    newExceptions[exIndex].subjects[subjectIndex].name = e.target.value
                                    setGradeExceptions(newExceptions)
                                  }}
                                  placeholder="Nombre asignatura"
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                />
                                <input
                                  type="number"
                                  value={subject.weeklyHours}
                                  onChange={(e) => {
                                    const newExceptions = [...gradeExceptions]
                                    newExceptions[exIndex].subjects[subjectIndex].weeklyHours = parseInt(e.target.value) || 0
                                    setGradeExceptions(newExceptions)
                                  }}
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                                  min="0"
                                />
                                <span className="text-xs text-slate-500">h/sem</span>
                                <input
                                  type="number"
                                  value={subject.weightPercentage}
                                  onChange={(e) => {
                                    const newExceptions = [...gradeExceptions]
                                    newExceptions[exIndex].subjects[subjectIndex].weightPercentage = parseInt(e.target.value) || 0
                                    setGradeExceptions(newExceptions)
                                  }}
                                  className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                                  min="0"
                                  max="100"
                                />
                                <span className="text-xs text-slate-500">%</span>
                                <button
                                  onClick={() => {
                                    const newExceptions = [...gradeExceptions]
                                    if (subject.id && !subject.isNew) {
                                      newExceptions[exIndex].subjects[subjectIndex].toDelete = true
                                    } else {
                                      newExceptions[exIndex].subjects.splice(subjectIndex, 1)
                                    }
                                    setGradeExceptions(newExceptions)
                                  }}
                                  className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            
                            <button
                              onClick={() => {
                                const newExceptions = [...gradeExceptions]
                                newExceptions[exIndex].subjects.push({
                                  id: `new-${Date.now()}`,
                                  name: '',
                                  weeklyHours: 0,
                                  weightPercentage: 0,
                                  isDominant: false,
                                  isNew: true,
                                })
                                setGradeExceptions(newExceptions)
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded w-full"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar asignatura
                            </button>

                            {exception.subjects.filter(s => !s.toDelete).length > 0 && (
                              <div className={`text-xs text-right ${
                                exception.subjects.filter(s => !s.toDelete).reduce((sum, s) => sum + s.weightPercentage, 0) === 100
                                  ? 'text-green-600'
                                  : 'text-amber-600'
                              }`}>
                                Total: {exception.subjects.filter(s => !s.toDelete).reduce((sum, s) => sum + s.weightPercentage, 0)}%
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

              {/* Configuración por nivel/grado */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h4 className="text-sm font-medium text-blue-800">📚 Alcance de la asignatura</h4>
                <p className="text-xs text-blue-600 mb-2">
                  Define en qué niveles o grados específicos aplica esta asignatura
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nivel académico</label>
                  <select
                    value={subjectForm.academicLevel}
                    onChange={(e) => setSubjectForm({ ...subjectForm, academicLevel: e.target.value, gradeId: '' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">🌐 Todos los niveles (global)</option>
                    {academicLevels.filter(l => l.code !== 'TODOS').map(level => (
                      <option key={level.code} value={level.code}>📚 {level.name}</option>
                    ))}
                  </select>
                </div>

                {subjectForm.academicLevel && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grado específico (opcional)</label>
                    <select
                      value={subjectForm.gradeId}
                      onChange={(e) => setSubjectForm({ ...subjectForm, gradeId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">Todos los grados del nivel</option>
                      {grades
                        .filter(g => {
                          const stageMap: Record<string, string> = {
                            'PREESCOLAR': 'PRESCHOOL',
                            'PRIMARIA': 'PRIMARY',
                            'SECUNDARIA': 'SECONDARY',
                            'MEDIA': 'HIGH_SCHOOL',
                          }
                          return g.stage === (stageMap[subjectForm.academicLevel] || subjectForm.academicLevel)
                        })
                        .map(grade => (
                          <option key={grade.id} value={grade.id}>🎓 {grade.name}</option>
                        ))
                      }
                    </select>
                  </div>
                )}

                <p className="text-xs text-blue-600 italic">
                  {!subjectForm.academicLevel 
                    ? '✓ Esta asignatura aplica a todos los niveles y grados'
                    : subjectForm.gradeId 
                      ? `✓ Esta asignatura aplica SOLO a ${grades.find(g => g.id === subjectForm.gradeId)?.name || 'este grado'}`
                      : `✓ Esta asignatura aplica a todo ${academicLevels.find(l => l.code === subjectForm.academicLevel)?.name || subjectForm.academicLevel}`
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
