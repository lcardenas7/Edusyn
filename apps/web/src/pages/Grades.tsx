import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { BookOpen, ChevronDown, Save, Plus, Trash2, X, AlertTriangle, Lock, Download, Upload, Library, Search, Copy, FileText, Heart } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic, type AcademicLevel, type QualitativeLevel } from '../contexts/AcademicContext'
import { teacherAssignmentsApi, academicStudentsApi, gradingPeriodConfigApi, partialGradesApi, achievementsApi, achievementConfigApi, achievementBankApi, finalComponentsApi, finalComponentGradesApi } from '../lib/api'
import { buildQualitativeMaps, toPerformanceLevel, toQualitativeCode } from '../utils/qualitativePerformanceMapper'
import { DiagnosisBadge } from '../components/StudentBadges'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string; area?: { name: string } }
  group: { id: string; name: string; grade?: { name: string; stage?: string; academicStructure?: string } }
  academicYear: { id: string; year: number }
}

const activityTypes = [
  'Examen escrito',
  'Examen oral',
  'Taller',
  'Quiz',
  'Proyecto',
  'Actividad práctica',
  'Trabajo en clase',
  'Participación',
]

// Dynamic performance level based on AcademicLevel config (no hardcodes)
function getPerformanceLevelDynamic(
  grade: number,
  level?: AcademicLevel | null,
): { label: string; color: string } {
  if (!level || !level.performanceLevels || level.performanceLevels.length === 0) {
    // Fallback for when no level config is available
    if (grade >= 4.5) return { label: 'Superior', color: 'text-green-600 bg-green-100' }
    if (grade >= 4.0) return { label: 'Alto', color: 'text-blue-600 bg-blue-100' }
    if (grade >= 3.0) return { label: 'Básico', color: 'text-amber-600 bg-amber-100' }
    return { label: 'Bajo', color: 'text-red-600 bg-red-100' }
  }
  const sorted = [...level.performanceLevels].sort((a, b) => b.minScore - a.minScore)
  for (const pl of sorted) {
    if (grade >= pl.minScore && grade <= pl.maxScore) {
      const colorMap: Record<string, string> = {
        '#22c55e': 'text-green-600 bg-green-100',
        '#3b82f6': 'text-blue-600 bg-blue-100',
        '#f59e0b': 'text-amber-600 bg-amber-100',
        '#ef4444': 'text-red-600 bg-red-100',
      }
      return { label: pl.name, color: colorMap[pl.color] || 'text-slate-600 bg-slate-100' }
    }
  }
  const lowest = sorted[sorted.length - 1]
  return { label: lowest?.name || 'Bajo', color: 'text-red-600 bg-red-100' }
}

// Colores para los procesos (se asignan cíclicamente)
const processColors = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', light: 'bg-blue-50/50', input: 'focus:ring-blue-500 focus:border-blue-500' },
  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', light: 'bg-green-50/50', input: 'focus:ring-green-500 focus:border-green-500' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', light: 'bg-amber-50/50', input: 'focus:ring-amber-500 focus:border-amber-500' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', light: 'bg-purple-50/50', input: 'focus:ring-purple-500 focus:border-purple-500' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', light: 'bg-pink-50/50', input: 'focus:ring-pink-500 focus:border-pink-500' },
]

interface Activity {
  id: string
  name: string
  type: string
  processCode: string
  subprocessIndex: number
  gradeIndex: number
}

interface ProcessConfig {
  id: string
  code: string
  name: string
  weight: number
  allowAdd: boolean
  colorIndex: number
  subprocesses: Array<{
    id: string
    name: string
    weightPercentage: number
    numberOfGrades: number
    order?: number
  }>
  activities: Activity[]
}

export default function Grades() {
  const { user, institution: authInstitution } = useAuth()
  const { gradingConfig, setGradingConfig, periods, selectedPeriod, setSelectedPeriod, academicLevels } = useAcademic()
  // institutionId viene de Auth (dato institucional)
  const institutionId = authInstitution?.id

  // ============================================
  // DETECCIÓN DE MODO: Cualitativo vs Numérico
  // Fuente de verdad: AcademicLevel del grupo seleccionado
  // ============================================
  
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  
  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') || userRoles.includes('SUPERADMIN') || userRoles.includes('COORDINADOR')
  const isTeacher = userRoles.includes('DOCENTE')
  
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  // selectedAssignment is now a useMemo (see below) — no useState needed
  
  // Obtener listas únicas de asignaturas y grupos
  const uniqueSubjects = useMemo(() => {
    const subjects = new Map<string, { id: string; name: string }>()
    assignments.forEach(a => {
      if (!subjects.has(a.subject.id)) {
        subjects.set(a.subject.id, { id: a.subject.id, name: a.subject.name })
      }
    })
    return Array.from(subjects.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments])

  const uniqueGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; gradeName: string }>()
    assignments.forEach(a => {
      if (!groups.has(a.group.id)) {
        groups.set(a.group.id, { 
          id: a.group.id, 
          name: a.group.name, 
          gradeName: a.group.grade?.name || '' 
        })
      }
    })
    return Array.from(groups.values()).sort((a, b) => 
      `${a.gradeName} ${a.name}`.localeCompare(`${b.gradeName} ${b.name}`)
    )
  }, [assignments])

  // Filtrar asignaturas disponibles según el grupo seleccionado (Grupo → Asignatura)
  const filteredSubjects = useMemo(() => {
    if (!selectedGroupId) return uniqueSubjects
    const subjectIds = new Set(
      assignments.filter(a => a.group.id === selectedGroupId).map(a => a.subject.id)
    )
    return uniqueSubjects.filter(s => subjectIds.has(s.id))
  }, [assignments, selectedGroupId, uniqueSubjects])

  // Resolver asignación seleccionada SINCRÓNICAMENTE (useMemo, no useEffect)
  // Esto evita flicker de layout: isQualitative se resuelve en el mismo render
  const selectedAssignment = useMemo<TeacherAssignment | null>(() => {
    if (selectedSubjectId && selectedGroupId) {
      return assignments.find(
        a => a.subject.id === selectedSubjectId && a.group.id === selectedGroupId
      ) || null
    }
    return null
  }, [selectedSubjectId, selectedGroupId, assignments])

  // ── Resolver AcademicLevel del grupo seleccionado ──────────────────
  const resolvedLevel: AcademicLevel | null = useMemo(() => {
    if (!selectedAssignment?.group?.grade) return null
    const gradeName = selectedAssignment.group.grade.name || ''
    const gradeStage = selectedAssignment.group.grade.stage || ''
    // Match by grade name in level.grades[] or by stage code
    return academicLevels.find(lvl =>
      lvl.grades.some(g => g.toLowerCase() === gradeName.toLowerCase()) ||
      lvl.code === gradeStage
    ) || null
  }, [selectedAssignment, academicLevels])

  // DETECCIÓN DE MODO ESTRUCTURAL: exclusivamente por academicStructure del grado
  // gradingScaleType solo se usa para escala/labels, NUNCA para decidir layout
  const academicStructure = selectedAssignment?.group?.grade?.academicStructure
  const isQualitative = academicStructure === 'DIMENSIONS'
  const isNumeric = !isQualitative
  // Escala cualitativa: se lee del resolvedLevel (para labels/dropdown)
  const qualitativeLevels: QualitativeLevel[] = resolvedLevel?.qualitativeLevels || []

  // Mapas dinámicos: qualitativeCode ↔ PerformanceLevel (basado en niveles configurados)
  const { toPerf, toQual } = useMemo(
    () => buildQualitativeMaps(qualitativeLevels),
    [qualitativeLevels]
  )

  // Dynamic scale from AcademicLevel (no hardcodes)
  const minGrade = resolvedLevel?.minGrade ?? 1.0
  const maxGrade = resolvedLevel?.maxGrade ?? 5.0
  const minPassingGrade = resolvedLevel?.minPassingGrade ?? 3.0

  // Dynamic label: "Dimensión" for qualitative, "Asignatura" for numeric
  const subjectLabel = isQualitative ? 'Dimensión' : 'Asignatura'

  // Wrapper for getPerformanceLevel using resolved level
  const getPerformanceLevel = useCallback((grade: number) => {
    return getPerformanceLevelDynamic(grade, resolvedLevel)
  }, [resolvedLevel])

  // ── Estado para evaluación cualitativa ─────────────────────────────
  // Map: studentId → { qualitativeLevelId, observation }
  const [qualitativeGrades, setQualitativeGrades] = useState<Record<string, { levelCode: string; observation: string }>>({})

  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [addToProcessCode, setAddToProcessCode] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'summary' | 'achievements'>('detailed')
  const [deleteConfirm, setDeleteConfirm] = useState<{ processCode: string; activityId: string; activityName: string } | null>(null)
  
  // Estado de períodos habilitados para calificaciones
  const [periodsStatus, setPeriodsStatus] = useState<Array<{
    id: string;
    name: string;
    order: number;
    status: 'open' | 'closed' | 'upcoming' | 'not_configured';
    canEnterGrades: boolean;
    openDate?: string;
    closeDate?: string;
  }>>([])
  const [currentPeriodOpen, setCurrentPeriodOpen] = useState(true)
  const [periodClosedMessage, setPeriodClosedMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [academicTermId, setAcademicTermId] = useState<string | null>(null)

  // Fuentes de nota unificadas (períodos + componentes finales)
  const [selectedSourceType, setSelectedSourceType] = useState<'period' | 'final_component'>('period')
  const [finalComponents, setFinalComponents] = useState<Array<{ id: string; name: string; weightPercentage: number; order: number; isOpen: boolean }>>([])
  const [selectedFinalComponentId, setSelectedFinalComponentId] = useState<string | null>(null)
  const [fcGrades, setFcGrades] = useState<Record<string, number>>({}) // studentId → grade
  const [savingFc, setSavingFc] = useState(false)
  
  // Estado para logros
  const [achievements, setAchievements] = useState<Array<{
    id: string;
    code: string;
    orderNumber: number;
    baseDescription: string;
    achievementType: string;
    studentAchievements?: Array<{
      id: string;
      studentEnrollmentId: string;
      performanceLevel: string;
      suggestedText?: string;
      approvedText?: string;
      isTextApproved: boolean;
    }>;
  }>>([])
  const [achievementConfig, setAchievementConfig] = useState<{
    achievementsPerPeriod: number;
    useValueJudgments: boolean;
  } | null>(null)

  // Banco de logros
  const [showBank, setShowBank] = useState(false)
  const [bankItems, setBankItems] = useState<any[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [bankFilter, setBankFilter] = useState<string>('')

  const loadBank = useCallback(async () => {
    setBankLoading(true)
    try {
      const params: any = {}
      if (selectedAssignment?.subject?.id) params.subjectId = selectedAssignment.subject.id
      if (bankSearch) params.query = bankSearch
      if (bankFilter) params.achievementType = bankFilter
      const res = await achievementBankApi.search(params)
      setBankItems(res.data?.items || [])
    } catch (err) {
      console.error('Error loading bank:', err)
    } finally {
      setBankLoading(false)
    }
  }, [selectedAssignment?.subject?.id, bankSearch, bankFilter])

  useEffect(() => {
    if (showBank) loadBank()
  }, [showBank, loadBank])

  // ============================================
  // CONFIGURACIÓN DINÁMICA DE PROCESOS
  // ============================================
  
  // Generar configuración de procesos dinámicamente desde gradingConfig
  const processConfigs: ProcessConfig[] = useMemo(() => {
    return gradingConfig.evaluationProcesses.map((process, idx) => {
      const code = process.code || process.name.toUpperCase().replace(/\s+/g, '_')
      const activities: Activity[] = []
      
      // Generar actividades para cada subproceso
      process.subprocesses.forEach((sub, subIdx) => {
        const numGrades = sub.numberOfGrades || 1
        for (let i = 0; i < numGrades; i++) {
          activities.push({
            id: `${code.toLowerCase()}_s${subIdx}_g${i}`,
            name: numGrades > 1 ? `${sub.name} ${i + 1}` : sub.name,
            type: sub.name,
            processCode: code,
            subprocessIndex: subIdx,
            gradeIndex: i,
          })
        }
      })
      
      return {
        id: process.id,
        code,
        name: process.name,
        weight: process.weightPercentage,
        allowAdd: process.allowTeacherAddGrades ?? true,
        colorIndex: idx % processColors.length,
        subprocesses: process.subprocesses,
        activities,
      }
    })
  }, [gradingConfig.evaluationProcesses])

  // Todas las actividades en orden (para navegación)
  const allActivities = useMemo(() => {
    return processConfigs.flatMap(p => p.activities)
  }, [processConfigs])

  // Debug
  useEffect(() => {
    console.log('📊 Configuración dinámica de procesos:', processConfigs)
  }, [processConfigs])

  // Cargar asignaciones del docente
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: any = {}
        if (isTeacher && user?.id) {
          params.teacherId = user.id
        }
        const response = await teacherAssignmentsApi.getAll(params)
        const data = response.data || []
        setAssignments(data)
        if (data.length > 0) {
          // Select group first, then subject (Group → Subject order)
          setSelectedGroupId(data[0].group.id)
          setSelectedSubjectId(data[0].subject.id)
        }
      } catch (err: any) {
        console.error('Error loading assignments:', err)
        setError('Error al cargar asignaciones')
      } finally {
        setLoading(false)
      }
    }
    fetchAssignments()
  }, [user?.id, isTeacher])

  // Cargar estado de períodos
  useEffect(() => {
    const fetchPeriodsStatus = async () => {
      if (!selectedAssignment?.academicYear?.id) return
      try {
        const response = await gradingPeriodConfigApi.getStatus(selectedAssignment.academicYear.id)
        setPeriodsStatus(response.data || [])
      } catch (err) {
        console.error('Error loading periods status:', err)
        setPeriodsStatus([])
      }
    }
    fetchPeriodsStatus()
  }, [selectedAssignment?.academicYear?.id])

  // Verificar si el período o componente final está abierto
  useEffect(() => {
    // Si es componente final, verificar isOpen del componente
    if (selectedSourceType === 'final_component' && selectedFinalComponentId) {
      const fc = finalComponents.find(c => c.id === selectedFinalComponentId)
      if (fc) {
        setCurrentPeriodOpen(fc.isOpen)
        setPeriodClosedMessage(fc.isOpen ? '' : `El ingreso de notas para "${fc.name}" está cerrado. Un administrador debe habilitarlo.`)
      }
      return
    }

    if (periodsStatus.length === 0) {
      setCurrentPeriodOpen(true)
      setPeriodClosedMessage('')
      setAcademicTermId(null)
      return
    }
    
    const periodOrder = parseInt(selectedPeriod)
    const currentPeriodStatus = periodsStatus.find(p => p.order === periodOrder)
    
    if (currentPeriodStatus) {
      setAcademicTermId(currentPeriodStatus.id)
      setCurrentPeriodOpen(currentPeriodStatus.canEnterGrades)
      if (!currentPeriodStatus.canEnterGrades) {
        if (currentPeriodStatus.status === 'upcoming') {
          setPeriodClosedMessage(`Este período abre el ${new Date(currentPeriodStatus.openDate || '').toLocaleDateString('es-CO')}`)
        } else if (currentPeriodStatus.status === 'closed') {
          setPeriodClosedMessage(`Este período cerró el ${new Date(currentPeriodStatus.closeDate || '').toLocaleDateString('es-CO')}`)
        } else {
          setPeriodClosedMessage('Este período no está habilitado para calificaciones')
        }
      } else {
        setPeriodClosedMessage('')
      }
    } else {
      setCurrentPeriodOpen(true)
      setPeriodClosedMessage('')
      setAcademicTermId(null)
    }
  }, [selectedPeriod, periodsStatus, selectedSourceType, selectedFinalComponentId, finalComponents])

  // Cargar componentes finales del año
  useEffect(() => {
    const fetchFinalComponents = async () => {
      if (!selectedAssignment?.academicYear?.id) {
        setFinalComponents([])
        return
      }
      try {
        const res = await finalComponentsApi.getByAcademicYear(selectedAssignment.academicYear.id)
        setFinalComponents(res.data || [])
      } catch (err) {
        console.error('Error loading final components:', err)
        setFinalComponents([])
      }
    }
    fetchFinalComponents()
  }, [selectedAssignment?.academicYear?.id])

  // Estudiantes
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrollmentId: string; hasDiagnosis?: boolean; diagnosisType?: string }>>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedAssignment?.group?.id || !selectedAssignment?.academicYear?.id) {
        setStudents([])
        return
      }
      setLoadingStudents(true)
      try {
        // Usar academicStudentsApi para mantener separación de dominios
        const response = await academicStudentsApi.getByGroup({
          groupId: selectedAssignment.group.id,
          academicYearId: selectedAssignment.academicYear.id,
        })
        // El endpoint académico ya retorna el formato correcto: { id, name, enrollmentId }
        setStudents(response.data || [])
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [selectedAssignment?.group?.id, selectedAssignment?.academicYear?.id])

  // Cargar notas de componente final cuando se selecciona uno
  useEffect(() => {
    const loadFcGrades = async () => {
      if (selectedSourceType !== 'final_component' || !selectedFinalComponentId || !selectedAssignment?.id || students.length === 0) {
        if (selectedSourceType === 'final_component') setFcGrades({})
        return
      }
      try {
        const res = await finalComponentGradesApi.getByComponent(selectedFinalComponentId, selectedAssignment.id)
        const gradeMap: Record<string, number> = {}
        ;(res.data || []).forEach((g: any) => {
          const student = students.find(s => s.enrollmentId === g.studentEnrollmentId)
          if (student) gradeMap[student.id] = Number(g.grade)
        })
        setFcGrades(gradeMap)
      } catch (err) {
        console.error('Error loading final component grades:', err)
        setFcGrades({})
      }
    }
    loadFcGrades()
  }, [selectedSourceType, selectedFinalComponentId, selectedAssignment?.id, students])

  // ============================================
  // ESTADO DE NOTAS
  // ============================================
  
  const [grades, setGrades] = useState<Record<string, Record<string, number>>>({})

  // Crear objeto de notas vacío
  const createEmptyGrades = useCallback((): Record<string, number> => {
    const gradeObj: Record<string, number> = {}
    allActivities.forEach(activity => {
      gradeObj[activity.id] = 0
    })
    return gradeObj
  }, [allActivities])

  // Cargar notas guardadas
  useEffect(() => {
    const loadSavedGrades = async () => {
      // Limpiar estado del grupo anterior antes de cargar el nuevo
      setCustomActivityNames({})
      setAdditionalActivities({})

      if (!selectedAssignment?.id || !academicTermId || students.length === 0) {
        const initGrades: Record<string, Record<string, number>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        setGrades(initGrades)
        return
      }
      
      try {
        const response = await partialGradesApi.getByAssignment(selectedAssignment.id, academicTermId)
        const savedGrades = response.data || []
        
        const initGrades: Record<string, Record<string, number>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        
        // Mapear notas guardadas y extraer nombres personalizados
        const savedNames: Record<string, string> = {}
        savedGrades.forEach((grade: any) => {
          const student = students.find(s => s.enrollmentId === grade.studentEnrollmentId)
          if (student && initGrades[student.id]) {
            const process = processConfigs.find(p => p.code === grade.componentType)
            if (process) {
              const activity = process.activities[grade.activityIndex - 1]
              if (activity) {
                initGrades[student.id][activity.id] = Number(grade.score)
                // Guardar nombre personalizado si difiere del generado
                if (grade.activityName && grade.activityName !== activity.name) {
                  savedNames[activity.id] = grade.activityName
                }
              }
            }
          }
        })
        
        // Reemplazar nombres personalizados (no mezclar con los del grupo anterior)
        setCustomActivityNames(savedNames)
        setGrades(initGrades)
      } catch (err) {
        console.error('Error loading saved grades:', err)
        const initGrades: Record<string, Record<string, number>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        setGrades(initGrades)
      }
    }
    
    loadSavedGrades()
  }, [selectedAssignment?.id, academicTermId, students, createEmptyGrades, processConfigs])

  const [newActivity, setNewActivity] = useState({ name: '', type: activityTypes[0] })

  // Nombres personalizados de actividades (el docente puede renombrar columnas)
  const [customActivityNames, setCustomActivityNames] = useState<Record<string, string>>({})
  const [editingActivityName, setEditingActivityName] = useState<string | null>(null)

  // Estado para actividades adicionales del docente
  const [additionalActivities, setAdditionalActivities] = useState<Record<string, Activity[]>>({})

  const addActivity = (processCode: string) => {
    const process = processConfigs.find(p => p.code === processCode)
    if (!process) return
    
    const existingAdditional = additionalActivities[processCode] || []
    const totalActivities = process.activities.length + existingAdditional.length
    
    const newId = `${processCode.toLowerCase()}_add_${totalActivities}`
    const newAct: Activity = {
      id: newId,
      name: newActivity.name || `Nota ${totalActivities + 1}`,
      type: newActivity.type,
      processCode,
      subprocessIndex: -1,
      gradeIndex: totalActivities,
    }
    
    setAdditionalActivities(prev => ({
      ...prev,
      [processCode]: [...(prev[processCode] || []), newAct]
    }))
    
    setGrades(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(studentId => {
        updated[studentId] = { ...updated[studentId], [newId]: 0 }
      })
      return updated
    })
    
    setNewActivity({ name: '', type: activityTypes[0] })
    setShowAddActivity(false)
    setAddToProcessCode(null)
  }

  const removeActivity = (processCode: string, activityId: string) => {
    setAdditionalActivities(prev => ({
      ...prev,
      [processCode]: (prev[processCode] || []).filter(a => a.id !== activityId)
    }))
    
    setGrades(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(studentId => {
        const { [activityId]: _, ...rest } = updated[studentId]
        updated[studentId] = rest
      })
      return updated
    })
  }

  const updateGrade = (studentId: string, activityId: string, value: number) => {
    let clampedValue = value
    if (value > maxGrade) clampedValue = maxGrade
    else if (value < minGrade && value !== 0) clampedValue = minGrade
    else if (value < 0) clampedValue = 0
    
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [activityId]: clampedValue }
    }))
  }

  // Calcular promedio de un proceso
  const calculateProcessAvg = (studentId: string, processCode: string) => {
    const process = processConfigs.find(p => p.code === processCode)
    if (!process) return 0
    
    const studentGrades = grades[studentId] || {}
    const allProcessActivities = [
      ...process.activities,
      ...(additionalActivities[processCode] || [])
    ]
    
    // Calcular promedio ponderado por subproceso
    let totalWeight = 0
    let weightedSum = 0
    
    process.subprocesses.forEach((sub, subIdx) => {
      const subActivities = allProcessActivities.filter(a => a.subprocessIndex === subIdx)
      const subValues = subActivities.map(a => studentGrades[a.id] || 0).filter(v => v > 0)
      
      if (subValues.length > 0) {
        const subAvg = subValues.reduce((a, b) => a + b, 0) / subValues.length
        weightedSum += subAvg * sub.weightPercentage
        totalWeight += sub.weightPercentage
      }
    })
    
    // Incluir actividades adicionales (sin subproceso)
    const additionalActs = allProcessActivities.filter(a => a.subprocessIndex === -1)
    if (additionalActs.length > 0) {
      const addValues = additionalActs.map(a => studentGrades[a.id] || 0).filter(v => v > 0)
      if (addValues.length > 0) {
        const addAvg = addValues.reduce((a, b) => a + b, 0) / addValues.length
        // Las actividades adicionales se promedian con el resto
        if (totalWeight > 0) {
          return (weightedSum / totalWeight + addAvg) / 2
        }
        return addAvg
      }
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  // Calcular nota final
  const calculateFinalGrade = (studentId: string) => {
    let total = 0
    processConfigs.forEach(process => {
      const avg = calculateProcessAvg(studentId, process.code)
      total += avg * (process.weight / 100)
    })
    return total
  }

  // ── Cargar evaluación cualitativa cuando cambia la asignación/período ──
  useEffect(() => {
    const loadQualitativeGrades = async () => {
      if (!isQualitative || !selectedAssignment?.id || !academicTermId || students.length === 0) return
      try {
        const res = await achievementsApi.getByAssignment(selectedAssignment.id, academicTermId)
        const achievementsList = res.data || []
        const qGrades: Record<string, { levelCode: string; observation: string }> = {}
        
        // For each student, find their StudentAchievement and extract level + observation
        // Uses dynamic mapper: PerformanceLevel → qualitative code (based on configured levels)
        students.forEach(student => {
          for (const ach of achievementsList) {
            const sa = ach.studentAchievements?.find(
              (sa: any) => sa.studentEnrollmentId === student.enrollmentId
            )
            if (sa) {
              const levelCode = toQualitativeCode(sa.performanceLevel, toQual)
              qGrades[student.id] = {
                levelCode,
                observation: sa.observation || sa.approvedText || sa.suggestedText || '',
              }
              break // Take first achievement per student
            }
          }
        })
        setQualitativeGrades(qGrades)
      } catch (err) {
        console.error('Error loading qualitative grades:', err)
      }
    }
    loadQualitativeGrades()
  }, [isQualitative, selectedAssignment?.id, academicTermId, students, toQual])

  // Cargar logros cuando se cambia a la pestaña de logros
  useEffect(() => {
    const loadAchievements = async () => {
      if (viewMode !== 'achievements' || !selectedAssignment?.id || !academicTermId || !institutionId) return
      try {
        const [achievementsRes, configRes] = await Promise.all([
          achievementsApi.getByAssignment(selectedAssignment.id, academicTermId),
          achievementConfigApi.get(institutionId!)
        ])
        setAchievements(achievementsRes.data || [])
        if (configRes.data) {
          setAchievementConfig({
            achievementsPerPeriod: configRes.data.achievementsPerPeriod || 1,
            useValueJudgments: configRes.data.useValueJudgments ?? true,
          })
        }
      } catch (err) {
        console.error('Error loading achievements:', err)
      }
    }
    loadAchievements()
  }, [viewMode, selectedAssignment?.id, academicTermId, institutionId])

  // Todas las columnas para navegación
  const allActivityColumns = useMemo(() => {
    const cols: string[] = []
    processConfigs.forEach(process => {
      process.activities.forEach(a => cols.push(a.id))
      ;(additionalActivities[process.code] || []).forEach(a => cols.push(a.id))
    })
    return cols
  }, [processConfigs, additionalActivities])

  // ============================================
  // DESCARGAR PLANILLA DE CALIFICACIONES
  // ============================================
  const downloadGradeSheet = (includeGrades: boolean) => {
    if (!selectedAssignment || students.length === 0) return

    const subjectName = selectedAssignment.subject.name
    const groupName = `${selectedAssignment.group.grade?.name || ''} ${selectedAssignment.group.name}`.trim()
    const periodName = periods.find(p => p.id === selectedPeriod)?.name || 'Período'

    // Construir encabezados
    const headers: string[] = ['#', 'ESTUDIANTE']
    const subHeaders: string[] = ['', '']
    processConfigs.forEach(process => {
      const allActs = [...process.activities, ...(additionalActivities[process.code] || [])]
      allActs.forEach(a => {
        headers.push(process.name.toUpperCase())
        subHeaders.push(customActivityNames[a.id] || a.name)
      })
      headers.push(process.name.toUpperCase())
      subHeaders.push('PROM')
    })
    headers.push('FINAL')
    subHeaders.push('')
    headers.push('NIV')
    subHeaders.push('')

    // Construir filas de datos
    const dataRows: any[][] = []
    students.forEach((student, idx) => {
      const row: any[] = [idx + 1, student.name]
      processConfigs.forEach(process => {
        const allActs = [...process.activities, ...(additionalActivities[process.code] || [])]
        allActs.forEach(a => {
          const val = grades[student.id]?.[a.id] || 0
          row.push(includeGrades && val > 0 ? val : '')
        })
        // Promedio del proceso
        if (includeGrades) {
          const avg = calculateProcessAvg(student.id, process.code)
          row.push(avg > 0 ? Math.round(avg * 10) / 10 : '')
        } else {
          row.push('')
        }
      })
      // Nota final
      if (includeGrades) {
        const final = calculateFinalGrade(student.id)
        row.push(final > 0 ? Math.round(final * 10) / 10 : '')
        if (final > 0) {
          const perf = getPerformanceLevel(final)
          row.push(perf.label)
        } else {
          row.push('')
        }
      } else {
        row.push('')
        row.push('')
      }
      dataRows.push(row)
    })

    // Crear workbook
    const wb = XLSX.utils.book_new()
    const wsData = [
      [`${subjectName} - ${groupName} - ${periodName}`],
      [],
      headers,
      subHeaders,
      ...dataRows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 4 },   // #
      { wch: 35 },  // Estudiante
      ...headers.slice(2).map(() => ({ wch: 10 })),
    ]

    // Merge título
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]

    XLSX.utils.book_append_sheet(wb, ws, 'Planilla')
    const fileName = `Planilla_${subjectName}_${groupName}_${periodName}${includeGrades ? '_con_notas' : '_vacia'}.xlsx`
      .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\.áéíóúÁÉÍÓÚñÑ]/g, '')
    XLSX.writeFile(wb, fileName)
  }

  // Importar notas desde Excel
  const importGradesFromExcel = (file: File) => {
    if (!selectedAssignment || students.length === 0) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        // Buscar la fila de sub-headers (row 3, index 3) — formato: [título, vacía, headers, subHeaders, ...datos]
        // La plantilla tiene: fila 0=título, fila 1=vacía, fila 2=headers proceso, fila 3=sub-headers, fila 4+=datos
        let subHeaderRowIdx = -1
        let dataStartIdx = -1
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i]
          if (row && row.length > 2 && (row[0] === '#' || row[0] === '')) {
            // Posible fila de sub-headers si la siguiente tiene datos numéricos
            if (i > 0 && rows[i - 1]?.some((cell: any) => typeof cell === 'string' && cell.includes('%'))) {
              subHeaderRowIdx = i
              dataStartIdx = i + 1
              break
            }
          }
        }

        // Fallback: buscar PROM en sub-headers
        if (subHeaderRowIdx === -1) {
          for (let i = 0; i < Math.min(rows.length, 10); i++) {
            if (rows[i]?.includes('PROM')) {
              subHeaderRowIdx = i
              dataStartIdx = i + 1
              break
            }
          }
        }

        if (subHeaderRowIdx === -1 || dataStartIdx === -1) {
          setSaveMessage({ type: 'error', text: 'No se pudo detectar el formato de la planilla. Use la plantilla descargada.' })
          setTimeout(() => setSaveMessage(null), 5000)
          return
        }

        // Construir mapa de columnas: colIndex → activityId
        // Columnas: [#, ESTUDIANTE, ...actividades por proceso con PROM intercalado..., FINAL, NIV]
        const colToActivityId: Record<number, string> = {}
        let colIdx = 2 // Empieza después de # y ESTUDIANTE
        processConfigs.forEach(process => {
          const allActs = [...process.activities, ...(additionalActivities[process.code] || [])]
          allActs.forEach(a => {
            colToActivityId[colIdx] = a.id
            colIdx++
          })
          colIdx++ // saltar PROM
        })

        // Leer datos
        const updatedGrades = { ...grades }
        let imported = 0
        for (let r = dataStartIdx; r < rows.length; r++) {
          const row = rows[r]
          if (!row || row.length < 3) continue

          const rowNum = row[0]
          const studentName = String(row[1] || '').trim()
          if (!studentName) continue

          // Buscar estudiante por número de fila o por nombre
          const studentIdx = typeof rowNum === 'number' ? rowNum - 1 : students.findIndex(s => s.name.toLowerCase().includes(studentName.toLowerCase().substring(0, 15)))
          const student = students[studentIdx]
          if (!student) continue

          if (!updatedGrades[student.id]) updatedGrades[student.id] = {}

          Object.entries(colToActivityId).forEach(([col, actId]) => {
            const val = parseFloat(row[parseInt(col)])
            if (!isNaN(val) && val > 0) {
              let clamped = val
              if (clamped > maxGrade) clamped = maxGrade
              if (clamped < minGrade) clamped = minGrade
              updatedGrades[student.id][actId] = Math.round(clamped * 10) / 10
              imported++
            }
          })
        }

        setGrades(updatedGrades)
        setSaveMessage({ type: 'success', text: `${imported} notas importadas desde Excel. Revise y presione Guardar.` })
        setTimeout(() => setSaveMessage(null), 5000)
      } catch (err) {
        console.error('Error importing Excel:', err)
        setSaveMessage({ type: 'error', text: 'Error al leer el archivo Excel' })
        setTimeout(() => setSaveMessage(null), 5000)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Guardar evaluación cualitativa
  // GUARD: Solo ejecutar en modo DIMENSIONS. Nunca en modo numérico.
  const saveQualitativeGrades = async () => {
    if (!isQualitative) return
    if (!selectedAssignment?.id || !academicTermId) {
      setSaveMessage({ type: 'error', text: 'No se puede guardar: falta información del período o dimensión' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      // 1. Get achievements for this assignment+term
      const res = await achievementsApi.getByAssignment(selectedAssignment.id, academicTermId)
      const achievementsList = res.data || []
      
      if (achievementsList.length === 0) {
        setSaveMessage({ type: 'error', text: 'No hay logros creados para esta dimensión en este período. Cree logros primero desde el módulo de Logros.' })
        setTimeout(() => setSaveMessage(null), 5000)
        return
      }

      // Use the first achievement as the target
      const achievement = achievementsList[0]

      let saved = 0
      let skipped = 0
      for (const student of students) {
        const qg = qualitativeGrades[student.id]
        if (!qg || !qg.levelCode) continue

        // Mapeo dinámico: código cualitativo → PerformanceLevel (basado en niveles configurados)
        const performanceLevel = toPerformanceLevel(qg.levelCode, toPerf)
        if (!performanceLevel) {
          skipped++
          continue
        }

        await achievementsApi.upsertStudentAchievement('upsert', {
          studentEnrollmentId: student.enrollmentId,
          achievementId: achievement.id,
          performanceLevel,
          suggestedText: qg.levelCode,
          approvedText: qg.levelCode,
          isTextApproved: true,
          observation: qg.observation || undefined,
        })
        saved++
      }

      const msg = skipped > 0
        ? `Evaluación guardada (${saved} estudiantes, ${skipped} omitidos por nivel no mapeado)`
        : `Evaluación cualitativa guardada (${saved} estudiantes)`
      setSaveMessage({ type: 'success', text: msg })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving qualitative grades:', err)
      setSaveMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar la evaluación cualitativa' })
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Guardar notas
  const saveGrades = async () => {
    if (!selectedAssignment?.id || !academicTermId) {
      setSaveMessage({ type: 'error', text: 'No se puede guardar: falta información del período o asignatura' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      const partialGradesToSave: Array<{
        studentEnrollmentId: string;
        teacherAssignmentId: string;
        academicTermId: string;
        componentType: string;
        activityIndex: number;
        activityName: string;
        activityType?: string;
        score: number;
      }> = []

      students.forEach(student => {
        const studentGrades = grades[student.id] || {}
        
        processConfigs.forEach(process => {
          const allProcessActivities = [
            ...process.activities,
            ...(additionalActivities[process.code] || [])
          ]
          
          allProcessActivities.forEach((activity, idx) => {
            const score = studentGrades[activity.id] || 0
            partialGradesToSave.push({
              studentEnrollmentId: student.enrollmentId,
              teacherAssignmentId: selectedAssignment.id,
              academicTermId: academicTermId!,
              componentType: process.code,
              activityIndex: idx + 1,
              activityName: customActivityNames[activity.id] || activity.name,
              activityType: activity.type,
              score,
            })
          })
        })
      })

      await partialGradesApi.bulkUpsert(partialGradesToSave)
      // PeriodFinalGrade se recalcula automáticamente en el backend
      
      const notasConValor = partialGradesToSave.filter(g => g.score > 0).length
      setSaveMessage({ type: 'success', text: `Calificaciones actualizadas correctamente (${notasConValor} notas guardadas)` })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving grades:', err)
      setSaveMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar las calificaciones' })
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Guardar notas de componente final (planilla simplificada)
  const saveFinalComponentGrades = async () => {
    if (!selectedAssignment?.id || !selectedFinalComponentId) {
      setSaveMessage({ type: 'error', text: 'No se puede guardar: falta información del componente' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSavingFc(true)
    setSaveMessage(null)

    try {
      const gradesToSave = students.map(student => ({
        studentEnrollmentId: student.enrollmentId,
        teacherAssignmentId: selectedAssignment.id,
        finalComponentId: selectedFinalComponentId,
        grade: fcGrades[student.id] || 0,
      }))

      await finalComponentGradesApi.bulkUpsert(gradesToSave)

      const notasConValor = gradesToSave.filter(g => g.grade > 0).length
      setSaveMessage({ type: 'success', text: `Notas del componente actualizadas (${notasConValor} notas guardadas)` })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving final component grades:', err)
      setSaveMessage({ type: 'error', text: err.response?.data?.message || 'Error al guardar' })
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setSavingFc(false)
    }
  }

  // Navegación con teclado
  const handleKeyNavigation = useCallback((e: React.KeyboardEvent<HTMLInputElement>, studentId: string, activityId: string) => {
    const studentIndex = students.findIndex(s => s.id === studentId)
    const activityIndex = allActivityColumns.indexOf(activityId)
    
    let targetStudentId: string | null = null
    let targetActivityId: string | null = null

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (studentIndex < students.length - 1) {
          targetStudentId = students[studentIndex + 1].id
          targetActivityId = activityId
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (studentIndex > 0) {
          targetStudentId = students[studentIndex - 1].id
          targetActivityId = activityId
        }
        break
      case 'ArrowRight':
        if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
          e.preventDefault()
          if (activityIndex < allActivityColumns.length - 1) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex + 1]
          }
        }
        break
      case 'ArrowLeft':
        if (e.currentTarget.selectionStart === 0) {
          e.preventDefault()
          if (activityIndex > 0) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex - 1]
          }
        }
        break
      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault()
          if (studentIndex < students.length - 1) {
            targetStudentId = students[studentIndex + 1].id
            targetActivityId = activityId
          } else if (activityIndex < allActivityColumns.length - 1) {
            targetStudentId = students[0].id
            targetActivityId = allActivityColumns[activityIndex + 1]
          }
        }
        break
      case 'Tab':
        e.preventDefault()
        if (!e.shiftKey) {
          if (activityIndex < allActivityColumns.length - 1) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex + 1]
          } else if (studentIndex < students.length - 1) {
            targetStudentId = students[studentIndex + 1].id
            targetActivityId = allActivityColumns[0]
          }
        } else {
          if (activityIndex > 0) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex - 1]
          } else if (studentIndex > 0) {
            targetStudentId = students[studentIndex - 1].id
            targetActivityId = allActivityColumns[allActivityColumns.length - 1]
          }
        }
        break
    }

    if (targetStudentId && targetActivityId) {
      const targetInput = document.getElementById(`grade-${targetStudentId}-${targetActivityId}`) as HTMLInputElement
      if (targetInput) {
        targetInput.focus()
        targetInput.select()
      }
    }
  }, [allActivityColumns, students])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calificaciones</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            {isQualitative ? 'Evaluación cualitativa por dimensiones' : 'Registro de notas por componente evaluativo'}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedAssignment && (
            <div className="relative">
              <button
                onClick={() => {
                  if (students.length === 0) {
                    setSaveMessage({ type: 'error', text: 'No hay estudiantes cargados aún. Selecciona una asignatura y grupo.' })
                    setTimeout(() => setSaveMessage(null), 3000)
                    return
                  }
                  setShowDownloadMenu(!showDownloadMenu)
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm sm:text-base"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Planilla</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
              </button>
              {showDownloadMenu && students.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[220px]">
                    <button
                      onClick={() => { downloadGradeSheet(false); setShowDownloadMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-t-lg transition-colors"
                    >
                      📄 Planilla vacía (para imprimir)
                    </button>
                    <button
                      onClick={() => { downloadGradeSheet(true); setShowDownloadMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-t border-slate-100 transition-colors"
                    >
                      📊 Planilla con notas actuales
                    </button>
                    <label className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-t border-slate-100 transition-colors cursor-pointer block">
                      📥 Importar notas desde Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) importGradesFromExcel(file)
                          e.target.value = ''
                          setShowDownloadMenu(false)
                        }}
                      />
                    </label>
                    <button
                      onClick={() => { window.print(); setShowDownloadMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 rounded-b-lg border-t border-slate-100 transition-colors"
                    >
                      🖨️ Imprimir / PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button 
            onClick={isQualitative ? saveQualitativeGrades : selectedSourceType === 'final_component' ? saveFinalComponentGrades : saveGrades}
            disabled={(selectedSourceType === 'period' ? saving : savingFc) || !currentPeriodOpen}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <Save className="w-4 h-4" />
            {(saving || savingFc) ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-4 p-4 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {saveMessage.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="mt-4 text-red-600">{error}</p>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="mt-4 text-slate-500">No tienes asignaturas asignadas</p>
            <p className="text-sm text-slate-400">Contacta al coordinador para asignar tu carga académica</p>
          </div>
        </div>
      ) : (
      <>
      <div className="flex gap-4 mb-6 flex-wrap">
        {/* 1️⃣ GRUPO (primero) */}
        <div className="relative w-full sm:w-auto">
          <select
            value={selectedGroupId}
            onChange={(e) => {
              setSelectedGroupId(e.target.value)
              // Auto-select first subject of this group
              const firstSubject = assignments.find(a => a.group.id === e.target.value)?.subject.id
              if (firstSubject) {
                setSelectedSubjectId(firstSubject)
              } else {
                setSelectedSubjectId('')
              }
            }}
            className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Seleccionar curso</option>
            {uniqueGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.gradeName} {group.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* 2️⃣ ASIGNATURA / DIMENSIÓN (segundo, filtrado por grupo) */}
        <div className="relative w-full sm:w-auto">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={!selectedGroupId}
            className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="">Seleccionar {subjectLabel.toLowerCase()}</option>
            {filteredSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative w-full sm:w-auto">
          <select
            value={selectedSourceType === 'final_component' ? `fc_${selectedFinalComponentId}` : selectedPeriod}
            onChange={(e) => {
              const val = e.target.value
              if (val.startsWith('fc_')) {
                setSelectedSourceType('final_component')
                setSelectedFinalComponentId(val.replace('fc_', ''))
                setViewMode('detailed')
              } else {
                setSelectedSourceType('period')
                setSelectedFinalComponentId(null)
                setSelectedPeriod(val)
              }
            }}
            className="w-full sm:w-auto appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>{period.name}</option>
            ))}
            {finalComponents.length > 0 && (
              <option disabled>──────────────</option>
            )}
            {finalComponents.map((fc) => (
              <option key={fc.id} value={`fc_${fc.id}`}>{fc.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {selectedSourceType === 'period' && !isQualitative && (
        <div className="flex flex-wrap bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'detailed' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Detallado
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Resumen
          </button>
          <button
            onClick={() => setViewMode('achievements')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'achievements' ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            Logros
          </button>
        </div>
        )}

        {isQualitative && resolvedLevel && (
          <div className="ml-auto flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border-amber-200 border">
              {resolvedLevel.gradingScaleType === 'QUALITATIVE_DESC' ? 'Cualitativo descriptivo' : 'Cualitativo (letras)'}
            </span>
          </div>
        )}

        {!isQualitative && (
        <div className="ml-auto flex gap-2 flex-wrap">
          {selectedSourceType === 'period' ? (
            processConfigs.map((process) => {
              const colors = processColors[process.colorIndex]
              return (
                <span key={process.code} className={`px-3 py-1 rounded-lg text-sm font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                  {process.name} ({process.weight}%)
                </span>
              )
            })
          ) : (
            <span className="px-3 py-1 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 border-purple-200 border">
              {finalComponents.find(fc => fc.id === selectedFinalComponentId)?.name} ({finalComponents.find(fc => fc.id === selectedFinalComponentId)?.weightPercentage}% anual)
            </span>
          )}
        </div>
        )}
      </div>

      {!selectedAssignment ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-slate-500">Selecciona un grupo y {subjectLabel.toLowerCase()} para ver la planilla</p>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900">{selectedAssignment.subject.name}</h2>
              <p className="text-sm text-slate-500">{selectedAssignment.group.grade?.name} {selectedAssignment.group.name} • {selectedSourceType === 'final_component' ? finalComponents.find(fc => fc.id === selectedFinalComponentId)?.name : (periods.find(p => p.id === selectedPeriod)?.name || 'Período')}</p>
            </div>
          </div>
        </div>

        {!currentPeriodOpen && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Período cerrado para calificaciones</p>
              <p className="text-sm text-amber-600">{periodClosedMessage}</p>
            </div>
          </div>
        )}

        {isQualitative ? (
          /* ═══════════════════════════════════════════════════════
             PLANILLA CUALITATIVA - Estudiante | Nivel | Observación
             ═══════════════════════════════════════════════════════ */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50">
                  <th className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase w-10">N°</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[250px]">Estudiante</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-amber-700 uppercase min-w-[160px]">Nivel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase min-w-[300px]">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student, idx) => {
                  const qg = qualitativeGrades[student.id] || { levelCode: '', observation: '' }
                  const selectedQl = qualitativeLevels.find(ql => ql.code === qg.levelCode)
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={qg.levelCode}
                          onChange={(e) => {
                            setQualitativeGrades(prev => ({
                              ...prev,
                              [student.id]: { ...prev[student.id] || { levelCode: '', observation: '' }, levelCode: e.target.value }
                            }))
                          }}
                          disabled={!currentPeriodOpen}
                          className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none ${
                            !currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
                          }`}
                          style={selectedQl ? { borderLeftColor: selectedQl.color, borderLeftWidth: '4px' } : {}}
                        >
                          <option value="">Seleccionar nivel</option>
                          {qualitativeLevels.map(ql => (
                            <option key={ql.id} value={ql.code}>
                              {ql.code} - {ql.name}
                            </option>
                          ))}
                        </select>
                        {selectedQl && (
                          <p className="text-[10px] mt-1 text-slate-500 leading-tight">{selectedQl.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={qg.observation}
                          onChange={(e) => {
                            setQualitativeGrades(prev => ({
                              ...prev,
                              [student.id]: { ...prev[student.id] || { levelCode: '', observation: '' }, observation: e.target.value }
                            }))
                          }}
                          disabled={!currentPeriodOpen}
                          placeholder="Observación del docente..."
                          rows={2}
                          className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none resize-none ${
                            !currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
                          }`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : selectedSourceType === 'final_component' ? (
          /* ═══════════════════════════════════════════════════════
             PLANILLA SIMPLIFICADA - Componente Final (1 nota por estudiante)
             ═══════════════════════════════════════════════════════ */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-50">
                  <th className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase w-10">N°</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[250px]">Estudiante</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-purple-700 uppercase min-w-[120px]">
                    {finalComponents.find(fc => fc.id === selectedFinalComponentId)?.name || 'Nota'}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[80px]">Desempeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student, idx) => {
                  const grade = fcGrades[student.id] || 0
                  const performance = getPerformanceLevel(grade)
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="0.1"
                          min={minGrade}
                          max={maxGrade}
                          value={grade || ''}
                          onChange={(e) => {
                            let val = parseFloat(e.target.value) || 0
                            if (val > maxGrade) val = maxGrade
                            else if (val < minGrade && val !== 0) val = minGrade
                            else if (val < 0) val = 0
                            setFcGrades(prev => ({ ...prev, [student.id]: val }))
                          }}
                          onFocus={(e) => e.target.select()}
                          disabled={!currentPeriodOpen}
                          className={`w-20 px-2 py-1.5 text-center text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-300'}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {grade > 0 && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${performance.color}`}>
                            {performance.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'detailed' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="text-center px-2 py-2 text-xs font-medium text-slate-500 uppercase border-r border-slate-200 w-10 bg-slate-100 z-10">
                    N°
                  </th>
                  <th rowSpan={2} className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase border-r border-slate-200 min-w-[140px] sticky left-0 bg-slate-100 z-10">
                    Estudiante
                  </th>
                  {processConfigs.map((process) => {
                    const colors = processColors[process.colorIndex]
                    const totalCols = process.activities.length + (additionalActivities[process.code]?.length || 0) + (process.allowAdd ? 1 : 0) + 1
                    return (
                      <th 
                        key={process.code}
                        colSpan={totalCols}
                        className={`text-center px-2 py-2 text-xs font-semibold ${colors.text} ${colors.bg} border-r border-slate-200`}
                      >
                        {process.name.toUpperCase()} - {process.weight}%
                      </th>
                    )
                  })}
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-600 uppercase bg-slate-200 min-w-[60px]">
                    Final
                  </th>
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-500 uppercase min-w-[50px]">
                    Niv
                  </th>
                </tr>
                <tr className="bg-slate-50 text-[11px]">
                  {processConfigs.map((process) => {
                    const colors = processColors[process.colorIndex]
                    const allProcessActivities = [
                      ...process.activities,
                      ...(additionalActivities[process.code] || [])
                    ]
                    return (
                      <React.Fragment key={process.code}>
                        {allProcessActivities.map((activity) => {
                          const displayName = customActivityNames[activity.id] || activity.name
                          return (
                          <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                            <div className="flex flex-col items-center">
                              {editingActivityName === activity.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  defaultValue={displayName}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim()
                                    if (val && val !== activity.name) {
                                      setCustomActivityNames(prev => ({ ...prev, [activity.id]: val }))
                                    } else if (val === activity.name) {
                                      setCustomActivityNames(prev => { const copy = { ...prev }; delete copy[activity.id]; return copy })
                                    }
                                    setEditingActivityName(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                    if (e.key === 'Escape') setEditingActivityName(null)
                                  }}
                                  className="w-16 px-0.5 py-0 text-[10px] text-center border border-blue-400 rounded outline-none"
                                />
                              ) : (
                                <span
                                  className="text-slate-600 truncate max-w-[45px] cursor-pointer hover:text-blue-600 hover:underline"
                                  title={`${displayName} (click para renombrar)`}
                                  onClick={() => setEditingActivityName(activity.id)}
                                >
                                  {displayName.length > 6 ? displayName.substring(0, 6) + '.' : displayName}
                                </span>
                              )}
                              {activity.subprocessIndex === -1 && (
                                <button 
                                  onClick={() => setDeleteConfirm({ processCode: process.code, activityId: activity.id, activityName: displayName })}
                                  className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                                  title="Eliminar actividad"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </th>
                        )})}
                        {process.allowAdd && (
                          <th className="text-center px-1 py-1 min-w-[30px] border-b border-slate-200">
                            <button 
                              onClick={() => { setAddToProcessCode(process.code); setShowAddActivity(true); }}
                              className={`p-1 rounded hover:${colors.bg} ${colors.text}`}
                              title="Agregar actividad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </th>
                        )}
                        <th className={`text-center px-1 py-1 text-[10px] font-medium uppercase ${colors.bg} ${colors.text} min-w-[40px] border-b border-slate-200`}>
                          Prom
                        </th>
                      </React.Fragment>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={100} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={100} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student, idx) => {
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2 py-2 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 sticky left-0 bg-white z-10">
                        {student.name}<DiagnosisBadge student={student} />
                      </td>
                      
                      {processConfigs.map((process) => {
                        const colors = processColors[process.colorIndex]
                        const allProcessActivities = [
                          ...process.activities,
                          ...(additionalActivities[process.code] || [])
                        ]
                        const processAvg = calculateProcessAvg(student.id, process.code)
                        
                        return (
                          <React.Fragment key={process.code}>
                            {allProcessActivities.map((activity) => (
                              <td key={activity.id} className="px-1 py-1 text-center">
                                <input
                                  id={`grade-${student.id}-${activity.id}`}
                                  type="number"
                                  step="0.1"
                                  min={minGrade}
                                  max={maxGrade}
                                  value={grades[student.id]?.[activity.id] || ''}
                                  onChange={(e) => updateGrade(student.id, activity.id, parseFloat(e.target.value) || 0)}
                                  onKeyDown={(e) => handleKeyNavigation(e, student.id, activity.id)}
                                  onFocus={(e) => e.target.select()}
                                  disabled={!currentPeriodOpen}
                                  className={`w-11 px-1 py-1 text-center text-xs border rounded ${colors.input} outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200'}`}
                                />
                              </td>
                            ))}
                            {process.allowAdd && <td className="px-1 py-1"></td>}
                            <td className={`px-1 py-1 text-center font-semibold ${colors.text} ${colors.light}`}>
                              {processAvg > 0 ? processAvg.toFixed(1) : '-'}
                            </td>
                          </React.Fragment>
                        )
                      })}
                      
                      <td className="px-2 py-1 text-center font-bold text-slate-900 bg-slate-100">
                        {finalGrade > 0 ? finalGrade.toFixed(1) : '-'}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {finalGrade > 0 && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${performance.color}`}>
                            {performance.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase w-10">N°</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                  {processConfigs.map((process) => {
                    const colors = processColors[process.colorIndex]
                    return (
                      <th key={process.code} className={`text-center px-4 py-3 text-xs font-medium ${colors.text} uppercase ${colors.bg}`}>
                        {process.name} ({process.weight}%)
                      </th>
                    )
                  })}
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-600 uppercase bg-slate-100">Promedio Final</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Desempeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={processConfigs.length + 4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={processConfigs.length + 4} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student, idx) => {
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2 py-4 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></td>
                      {processConfigs.map((process) => {
                        const colors = processColors[process.colorIndex]
                        const avg = calculateProcessAvg(student.id, process.code)
                        return (
                          <td key={process.code} className="px-4 py-4 text-center">
                            <span className={`text-lg font-semibold ${colors.text}`}>{avg > 0 ? avg.toFixed(1) : '-'}</span>
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(avg).color}`}>
                              {getPerformanceLevel(avg).label}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-4 py-4 text-center bg-slate-50">
                        <span className="text-xl font-bold text-slate-900">{finalGrade > 0 ? finalGrade.toFixed(1) : '-'}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${performance.color}`}>
                          {performance.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'achievements' ? (
          /* Vista de Logros - Asociación automática logro-desempeño */
          <div className="space-y-4">
          {/* Banco de Logros Panel */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowBank(!showBank)}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Library className="w-5 h-5 text-indigo-600" />
                <div className="text-left">
                  <span className="font-semibold text-slate-900">Banco de Logros</span>
                  <span className="text-sm text-slate-500 ml-2">Plantillas reutilizables para copiar</span>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showBank ? 'rotate-180' : ''}`} />
            </button>
            
            {showBank && (
              <div className="border-t border-slate-200 p-4 space-y-3">
                {/* Búsqueda y filtros */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar logros..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadBank()}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={bankFilter}
                    onChange={(e) => setBankFilter(e.target.value)}
                    className="text-sm border border-slate-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="ACADEMIC">Académico</option>
                    <option value="ATTITUDINAL">Actitudinal</option>
                  </select>
                  <button
                    onClick={loadBank}
                    className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Buscar
                  </button>
                </div>

                {/* Resultados */}
                {bankLoading ? (
                  <div className="text-center py-6 text-slate-400 text-sm">Cargando...</div>
                ) : bankItems.length === 0 ? (
                  <div className="text-center py-6">
                    <Library className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No hay logros en el banco</p>
                    <p className="text-xs text-slate-400 mt-1">Puedes agregar logros desde el módulo de Logros y Juicios</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {bankItems.map((item: any) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {item.subject && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{item.subject.name}</span>
                            )}
                            {item.performanceLevel && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                item.performanceLevel === 'SUPERIOR' ? 'bg-green-50 text-green-600' :
                                item.performanceLevel === 'ALTO' ? 'bg-blue-50 text-blue-600' :
                                item.performanceLevel === 'BASICO' ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'
                              }`}>{item.performanceLevel}</span>
                            )}
                            {item.category && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item.category}</span>
                            )}
                            <span className="text-[10px] text-slate-400">Usado {item.usageCount}x</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.description)
                            achievementBankApi.markUsed(item.id).catch(() => {})
                            setSaveMessage({ type: 'success', text: 'Logro copiado al portapapeles' })
                            setTimeout(() => setSaveMessage(null), 2000)
                          }}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Copiar texto del logro"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Asociación Logros - Desempeño</h3>
              <p className="text-sm text-slate-500 mt-1">
                Visualización de la asociación automática entre logros y nivel de desempeño según la nota final
              </p>
            </div>
            
            {achievements.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay logros creados para este período</p>
                <p className="text-sm text-slate-400 mt-1">
                  Vaya al módulo de Logros y Juicios para crear los logros de esta asignatura
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase w-10">N°</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nota Final</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Desempeño</th>
                      {achievements.map((ach) => (
                        <th key={ach.id} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[200px]">
                          <div className="flex flex-col">
                            <span className="text-blue-600 font-mono text-[10px]">{ach.code}</span>
                            <span>Logro {ach.orderNumber}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students.map((student, idx) => {
                      const finalGrade = calculateFinalGrade(student.id)
                      const performance = getPerformanceLevel(finalGrade)
                      
                      return (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="px-2 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{student.name}<DiagnosisBadge student={student} /></td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-lg font-bold">{finalGrade > 0 ? finalGrade.toFixed(1) : '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${performance.color}`}>
                              {performance.label}
                            </span>
                          </td>
                          {achievements.map((ach) => {
                            const studentAch = ach.studentAchievements?.find(
                              sa => sa.studentEnrollmentId === student.enrollmentId
                            )
                            return (
                              <td key={ach.id} className="px-4 py-3">
                                {studentAch ? (
                                  <div className="space-y-1">
                                    <p className="text-xs text-slate-600 line-clamp-2">
                                      {studentAch.approvedText || studentAch.suggestedText || ach.baseDescription}
                                    </p>
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      studentAch.isTextApproved 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {studentAch.isTextApproved ? 'Aprobado' : 'Pendiente'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    Sin asociar - {performance.label}
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {achievementConfig && achievements.length < achievementConfig.achievementsPerPeriod && (
              <div className="px-6 py-4 bg-amber-50 border-t border-amber-200">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Faltan {achievementConfig.achievementsPerPeriod - achievements.length} logro(s) por crear. 
                    Requeridos: {achievementConfig.achievementsPerPeriod}
                  </span>
                </div>
              </div>
            )}
          </div>
          </div>
        ) : null}
      </div>
      )}

      {/* Modal Nueva Actividad */}
      {showAddActivity && addToProcessCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Nueva Actividad - {processConfigs.find(p => p.code === addToProcessCode)?.name}
              </h3>
              <button onClick={() => { setShowAddActivity(false); setAddToProcessCode(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (opcional)</label>
                <input 
                  type="text" 
                  placeholder="Nota nueva"
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de actividad</label>
                <select 
                  value={newActivity.type}
                  onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {activityTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => { setShowAddActivity(false); setAddToProcessCode(null); }} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => addActivity(addToProcessCode)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar Actividad */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              ¿Eliminar actividad?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estás a punto de eliminar <strong>"{deleteConfirm.activityName}"</strong>. 
              <span className="text-red-600 font-medium"> Las notas registradas en esta actividad se perderán.</span>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  removeActivity(deleteConfirm.processCode, deleteConfirm.activityId)
                  setDeleteConfirm(null)
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
