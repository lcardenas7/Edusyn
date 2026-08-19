import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { BookOpen, ChevronDown, Save, Plus, Trash2, X, AlertTriangle, Lock, Download, Upload, Library, Search, Copy, FileText, Heart } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic, type AcademicLevel, type QualitativeLevel } from '../contexts/AcademicContext'
import { teacherAssignmentsApi, academicStudentsApi, gradingPeriodConfigApi, partialGradesApi, achievementsApi, achievementConfigApi, achievementBankApi, finalComponentsApi, finalComponentGradesApi, periodFinalGradesApi } from '../lib/api'
import { toast, TOAST } from '../lib/toast'
import { useSaveStatus } from '../hooks/useSaveStatus'
import SaveStatusPill from '../components/SaveStatusPill'
import { buildQualitativeMaps, toPerformanceLevel, toQualitativeCode } from '../utils/qualitativePerformanceMapper'
import { DiagnosisBadge } from '../components/StudentBadges'
import QualitativeGradesPanel from '../components/grades/QualitativeGradesPanel'
import ConvivenciaPanel, { type ConvivenciaItem } from '../components/grades/ConvivenciaPanel'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string; area?: { name: string }; subjectType?: string }
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
  // Convivencia: asignatura especial (texto libre, sin nota) — se detecta por el
  // subjectType, no por la estructura del grado. Debe evaluarse ANTES que
  // isQualitative porque vive en grados DIMENSIONS (Transición).
  const isConvivencia = selectedAssignment?.subject?.subjectType === 'CONVIVENCIA'
  const isQualitative = academicStructure === 'DIMENSIONS' && !isConvivencia
  const isNumeric = !isQualitative && !isConvivencia
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
    closedBy?: 'toggle' | 'date' | null;
    openDate?: string;
    closeDate?: string;
  }>>([])
  const [currentPeriodOpen, setCurrentPeriodOpen] = useState(true)
  const [periodClosedMessage, setPeriodClosedMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { status: saveStatus, withSave } = useSaveStatus()
  const [academicTermId, setAcademicTermId] = useState<string | null>(null)

  // Fuentes de nota unificadas (períodos + componentes finales)
  const [selectedSourceType, setSelectedSourceType] = useState<'period' | 'final_component'>('period')
  const [finalComponents, setFinalComponents] = useState<Array<{ id: string; name: string; weightPercentage: number; order: number; isOpen: boolean }>>([])
  const [selectedFinalComponentId, setSelectedFinalComponentId] = useState<string | null>(null)
  const [fcGrades, setFcGrades] = useState<Record<string, number>>({}) // studentId → grade
  const [savingFc, setSavingFc] = useState(false)
  
  // Estado para aprendizajes
  const [achievements, setAchievements] = useState<Array<{
    id: string;
    code: string;
    orderNumber: number;
    baseDescription: string;
    achievementType: string;
    levelDescriptors?: Array<{ levelCode: string; text: string }>;
    studentAchievements?: Array<{
      id: string;
      studentEnrollmentId: string;
      performanceLevel: string;
      suggestedText?: string;
      approvedText?: string;
      isTextApproved: boolean;
      observation?: string;
    }>;
  }>>([])
  const [achievementConfig, setAchievementConfig] = useState<{
    achievementsPerPeriod: number;
    useValueJudgments: boolean;
    descriptorMode: 'FREE' | 'DESCRIPTOR_PER_LEVEL';
    learningCatalogMode: 'TEACHER_MANAGED' | 'ADMIN_FIXED';
    valuationScope: 'PURPOSE' | 'EVIDENCE';
  } | null>(null)
  const descriptorMode = achievementConfig?.descriptorMode ?? 'FREE'
  const catalogLocked = achievementConfig?.learningCatalogMode === 'ADMIN_FIXED'
  // Modo de valoración por imprescindible (solo cualitativo). El docente valora cada evidencia.
  const isEvidenceMode = isQualitative && achievementConfig?.valuationScope === 'EVIDENCE'

  // Valoraciones por imprescindible (clave = evidenceId → studentId → {levelCode, observation}).
  const [evidenceGrades, setEvidenceGrades] = useState<Record<string, Record<string, { levelCode: string; observation: string }>>>({})
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)

  // Imprescindibles (evidencias) aplanados como "indicadores" para reutilizar el panel cualitativo.
  const evidenceIndicators = useMemo(() => {
    if (!isEvidenceMode) return [] as any[]
    const out: any[] = []
    ;(achievements as any[]).forEach((ach: any, pi: number) => {
      ;(ach.evidences || []).forEach((ev: any, ei: number) => {
        out.push({
          id: ev.id,
          code: `${ach.code || pi + 1}.${ei + 1}`,
          orderNumber: (ach.orderNumber || pi + 1) * 100 + (ev.orderNumber || ei + 1),
          baseDescription: ev.text,
        })
      })
    })
    return out
  }, [isEvidenceMode, achievements])

  const [qualitativeGradesByAchievement, setQualitativeGradesByAchievement] = useState<Record<string, Record<string, { levelCode: string; observation: string }>>>({})
  const [selectedQualitativeAchievementId, setSelectedQualitativeAchievementId] = useState<string | null>(null)

  // Convivencia: desempeños libres y valoración individual por estudiante.
  const [convivenciaByStudent, setConvivenciaByStudent] = useState<Record<string, ConvivenciaItem[]>>({})

  // Banco de aprendizajes
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
        } else if (currentPeriodStatus.status === 'closed' && currentPeriodStatus.closedBy === 'date') {
          setPeriodClosedMessage(`La ventana está habilitada, pero su fecha de cierre fue el ${new Date(currentPeriodStatus.closeDate || '').toLocaleDateString('es-CO')}. Un administrador debe ajustar la fecha en «Ventanas de Calificación».`)
        } else if (currentPeriodStatus.status === 'closed') {
          setPeriodClosedMessage('Este período está deshabilitado para calificaciones. Un administrador puede habilitarlo en «Ventanas de Calificación».')
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
        // Con la asignación, el backend recorta las fuentes que este grado /
        // asignatura no presenta, en vez de mostrarlas y rechazarlas al guardar.
        const res = await finalComponentsApi.getByAcademicYear(selectedAssignment.academicYear.id, selectedAssignment.id)
        setFinalComponents(res.data || [])
      } catch (err) {
        console.error('Error loading final components:', err)
        setFinalComponents([])
      }
    }
    fetchFinalComponents()
  }, [selectedAssignment?.academicYear?.id, selectedAssignment?.id])

  // Si la fuente final seleccionada deja de aplicar a la asignación actual
  // (otro grado, o el coordinador cambió el alcance), se vuelve a períodos en
  // vez de quedar apuntando a una columna que ya no existe.
  useEffect(() => {
    if (selectedSourceType !== 'final_component' || !selectedFinalComponentId) return
    if (finalComponents.some(fc => fc.id === selectedFinalComponentId)) return
    setSelectedSourceType('period')
    setSelectedFinalComponentId(null)
  }, [finalComponents, selectedSourceType, selectedFinalComponentId])

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
  
  const [grades, setGrades] = useState<Record<string, Record<string, number | null>>>({})
  // Concurrencia: snapshot de lo cargado del servidor (última vez que se leyó/guardó).
  // Al guardar, solo se envían las celdas que difieren de este snapshot — así dos personas
  // editando celdas distintas de la misma planilla no se pisan (guardado por diferencias).
  const [gradesBaseline, setGradesBaseline] = useState<Record<string, Record<string, number | null>>>({})
  // Nombres de actividad tal como estaban en el snapshot (para incluir renombres en el diff).
  const [baselineActivityNames, setBaselineActivityNames] = useState<Record<string, string>>({})
  // Concurrencia: updatedAt de cada celda tal como está en el servidor (null = la celda no
  // existe en el servidor). Se envía al guardar para detectar si alguien más la cambió.
  const [gradesServerUpdatedAt, setGradesServerUpdatedAt] = useState<Record<string, Record<string, string | null>>>({})
  // C-1 (UX): notas finales fijadas manualmente por coordinación (enrollmentId → nota).
  // Sirven para avisar al docente que su cambio de parcial NO moverá ese final.
  const [finalOverrides, setFinalOverrides] = useState<Record<string, number>>({})

  // Crear objeto de notas vacío
  // C-2: celda sin nota = null (distinto de un 0 real). No se inicializa en 0.
  const createEmptyGrades = useCallback((): Record<string, number | null> => {
    const gradeObj: Record<string, number | null> = {}
    allActivities.forEach(activity => {
      gradeObj[activity.id] = null
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
        const initGrades: Record<string, Record<string, number | null>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        setGrades(initGrades)
        setGradesBaseline(JSON.parse(JSON.stringify(initGrades)))
        setBaselineActivityNames({})
        setGradesServerUpdatedAt({})
        return
      }
      
      try {
        const response = await partialGradesApi.getByAssignment(selectedAssignment.id, academicTermId)
        const savedGrades = response.data || []
        
        const initGrades: Record<string, Record<string, number | null>> = {}
        const initUpdatedAt: Record<string, Record<string, string | null>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
          initUpdatedAt[student.id] = {}
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
                initUpdatedAt[student.id][activity.id] = grade.updatedAt || null
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
        setBaselineActivityNames(savedNames)
        setGrades(initGrades)
        setGradesBaseline(JSON.parse(JSON.stringify(initGrades)))
        setGradesServerUpdatedAt(initUpdatedAt)
      } catch (err) {
        console.error('Error loading saved grades:', err)
        const initGrades: Record<string, Record<string, number | null>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        setGrades(initGrades)
        setGradesBaseline(JSON.parse(JSON.stringify(initGrades)))
        setGradesServerUpdatedAt({})
      }
    }

    loadSavedGrades()
  }, [selectedAssignment?.id, academicTermId, students, createEmptyGrades, processConfigs])

  // C-1 (UX): cargar las notas finales fijadas manualmente para el grupo+período+asignatura.
  useEffect(() => {
    const groupId = selectedAssignment?.group?.id
    const subjectId = selectedAssignment?.subject?.id
    if (!groupId || !subjectId || !academicTermId) { setFinalOverrides({}); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await periodFinalGradesApi.getByGroup(groupId, academicTermId)
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const g of (res.data || [])) {
          if (g.subjectId === subjectId && g.isManualOverride) {
            map[g.studentEnrollmentId] = Number(g.finalScore)
          }
        }
        setFinalOverrides(map)
      } catch { if (!cancelled) setFinalOverrides({}) }
    })()
    return () => { cancelled = true }
  }, [selectedAssignment?.group?.id, selectedAssignment?.subject?.id, academicTermId])

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

  const updateGrade = (studentId: string, activityId: string, value: number | null) => {
    // C-2: null = celda vacía (sin nota). Un 0 real se conserva; solo se recorta el rango.
    let clampedValue: number | null = value
    if (value !== null) {
      if (Number.isNaN(value)) clampedValue = null
      else if (value > maxGrade) clampedValue = maxGrade
      else if (value < minGrade && value !== 0) clampedValue = minGrade
      else if (value < 0) clampedValue = 0
    }

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
      const subValues = subActivities.map(a => studentGrades[a.id]).filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v))
      
      if (subValues.length > 0) {
        const subAvg = subValues.reduce((a, b) => a + b, 0) / subValues.length
        weightedSum += subAvg * sub.weightPercentage
        totalWeight += sub.weightPercentage
      }
    })
    
    // Incluir actividades adicionales (sin subproceso)
    const additionalActs = allProcessActivities.filter(a => a.subprocessIndex === -1)
    if (additionalActs.length > 0) {
      const addValues = additionalActs.map(a => studentGrades[a.id]).filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v))
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

  const buildQualitativeAchievementText = useCallback((baseDescription: string, levelCode: string) => {
    const level = qualitativeLevels.find(ql => ql.code === levelCode)
    if (!level) return baseDescription
    return `${level.name}: ${baseDescription}`
  }, [qualitativeLevels])

  // Cargar aprendizajes y, en modo cualitativo, precargar los niveles por indicador
  useEffect(() => {
    const loadAchievements = async () => {
      if (!selectedAssignment?.id || !academicTermId) return

      const shouldLoadAchievements = isQualitative || viewMode === 'achievements'
      if (!shouldLoadAchievements) return

      try {
        const requests: Promise<any>[] = [achievementsApi.getByAssignment(selectedAssignment.id, academicTermId)]
        // La config (incluye descriptorMode) se necesita tanto en modo aprendizajes como cualitativo.
        if ((viewMode === 'achievements' || isQualitative) && institutionId) {
          requests.push(achievementConfigApi.get(institutionId))
        }

        const [achievementsRes, configRes] = await Promise.all(requests)
        const achievementsList = achievementsRes.data || []
        setAchievements(achievementsList)

        if (configRes?.data) {
          setAchievementConfig({
            achievementsPerPeriod: configRes.data.achievementsPerPeriod || 1,
            useValueJudgments: configRes.data.useValueJudgments ?? true,
            descriptorMode: configRes.data.descriptorMode ?? 'FREE',
            learningCatalogMode: configRes.data.learningCatalogMode ?? 'TEACHER_MANAGED',
            valuationScope: configRes.data.valuationScope ?? 'PURPOSE',
          })
        }

        if (isQualitative) {
          // Las valoraciones guardadas vienen por studentEnrollmentId, pero la
          // grilla se indexa por student.id: traducir para restaurar la selección.
          const studentIdByEnrollment = new Map<string, string>(
            students.map((s: any) => [s.enrollmentId, s.id])
          )
          const nextGrades: Record<string, Record<string, { levelCode: string; observation: string }>> = {}
          achievementsList.forEach((achievement: any) => {
            nextGrades[achievement.id] = {}
            ;(achievement.studentAchievements || []).forEach((sa: any) => {
              const studentId = studentIdByEnrollment.get(sa.studentEnrollmentId)
              if (!studentId) return
              nextGrades[achievement.id][studentId] = {
                levelCode: toQualitativeCode(sa.performanceLevel, toQual),
                // La observación es solo la nota libre del docente: el descriptor
                // (approvedText/suggestedText) NO se mezcla de vuelta aquí.
                observation: sa.observation || '',
              }
            })
          })
          setQualitativeGradesByAchievement(nextGrades)
          setSelectedQualitativeAchievementId(prev => {
            if (prev && achievementsList.some((achievement: any) => achievement.id === prev)) return prev
            return achievementsList[0]?.id || null
          })
        }
      } catch (err) {
        console.error('Error loading achievements:', err)
      }
    }
    loadAchievements()
  }, [viewMode, selectedAssignment?.id, academicTermId, institutionId, isQualitative, students, toQual])

  // Cargar registros de convivencia guardados (asignatura CONVIVENCIA).
  useEffect(() => {
    const loadConvivencia = async () => {
      if (!isConvivencia || !selectedAssignment?.id || !academicTermId) {
        setConvivenciaByStudent({})
        return
      }
      try {
        const res = await achievementsApi.getConvivencia(selectedAssignment.id, academicTermId)
        // Las entradas vienen por studentEnrollmentId; la grilla se indexa por student.id.
        const studentIdByEnrollment = new Map<string, string>(
          students.map((s) => [s.enrollmentId, s.id])
        )
        const next: Record<string, ConvivenciaItem[]> = {}
        ;(res.data || []).forEach((entry: any) => {
          const studentId = studentIdByEnrollment.get(entry.studentEnrollmentId)
          if (!studentId) return
          const storedItems = Array.isArray(entry.items) ? entry.items : []
          next[studentId] = storedItems.length
            ? storedItems.map((item: any) => ({ text: String(item?.text || ''), levelCode: toQual[String(item?.level || '')] || String(item?.level || '') }))
            : String(entry.text || '').split('\n').map(text => ({ text: text.trim(), levelCode: '' })).filter(item => item.text)
        })
        setConvivenciaByStudent(next)
      } catch (err) {
        console.error('Error loading convivencia:', err)
      }
    }
    loadConvivencia()
  }, [isConvivencia, selectedAssignment?.id, academicTermId, students])

  // Cargar valoraciones por imprescindible (modo EVIDENCE).
  useEffect(() => {
    const load = async () => {
      if (!isEvidenceMode || !selectedAssignment?.id || !academicTermId) {
        setEvidenceGrades({})
        return
      }
      try {
        const res = await achievementsApi.getEvidenceValuations(selectedAssignment.id, academicTermId)
        const studentIdByEnrollment = new Map<string, string>(students.map((s) => [s.enrollmentId, s.id]))
        const next: Record<string, Record<string, { levelCode: string; observation: string }>> = {}
        ;(res.data || []).forEach((v: any) => {
          const studentId = studentIdByEnrollment.get(v.studentEnrollmentId)
          if (!studentId) return
          if (!next[v.achievementEvidenceId]) next[v.achievementEvidenceId] = {}
          next[v.achievementEvidenceId][studentId] = {
            levelCode: toQualitativeCode(v.performanceLevel, toQual),
            observation: v.observation || '',
          }
        })
        setEvidenceGrades(next)
        setSelectedEvidenceId((prev) =>
          prev && evidenceIndicators.some((e) => e.id === prev) ? prev : (evidenceIndicators[0]?.id || null),
        )
      } catch (err) {
        console.error('Error loading evidence valuations:', err)
      }
    }
    load()
  }, [isEvidenceMode, selectedAssignment?.id, academicTermId, students, toQual, evidenceIndicators])

  // Todas las columnas para navegación
  const allActivityColumns = useMemo(() => {
    const cols: string[] = []
    processConfigs.forEach(process => {
      process.activities.forEach(a => cols.push(a.id))
      ;(additionalActivities[process.code] || []).forEach(a => cols.push(a.id))
    })
    return cols
  }, [processConfigs, additionalActivities])

  // ── Semáforo de completitud de notas ──────────────────────────────────────
  const completeness = useMemo(() => {
    if (students.length === 0 || allActivityColumns.length === 0) return null
    const withAnyGrade = students.filter(s => {
      const sg = grades[s.id] || {}
      return allActivityColumns.some(actId => (sg[actId] || 0) > 0)
    })
    const pct = Math.round((withAnyGrade.length / students.length) * 100)
    return { count: withAnyGrade.length, total: students.length, pct }
  }, [students, grades, allActivityColumns])

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
          toast.warning('No se pudo detectar el formato de la planilla. Use la plantilla descargada.')
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
            // C-2: un 0 en el Excel es una nota real (0.0), no "vacío". Solo se omite la celda vacía (NaN).
            if (!isNaN(val)) {
              let clamped = val
              if (clamped > maxGrade) clamped = maxGrade
              if (clamped < minGrade && clamped !== 0) clamped = minGrade
              else if (clamped < 0) clamped = 0
              updatedGrades[student.id][actId] = Math.round(clamped * 10) / 10
              imported++
            }
          })
        }

        setGrades(updatedGrades)
        toast.success(`${imported} notas importadas desde Excel`, 'Revisa los valores y presiona Guardar.')
      } catch (err) {
        console.error('Error importing Excel:', err)
        toast.error('Error al leer el archivo Excel')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Guardar evaluación cualitativa
  // GUARD: Solo ejecutar en modo DIMENSIONS. Nunca en modo numérico.
  const saveQualitativeGrades = async () => {
    if (!isQualitative) return
    if (!selectedAssignment?.id || !academicTermId) {
      toast.warning('No se puede guardar: falta información del período o dimensión')
      return
    }

    setSaving(true)

    try {
      if (achievements.length === 0) {
        toast.warning('Primero crea un indicador aquí mismo: escribe su nombre en "Agregar indicador" y presiona el botón. Luego asigna el nivel a cada estudiante.')
        return
      }

      let saved = 0
      let skipped = 0
      for (const achievement of achievements) {
        const achievementGrades = qualitativeGradesByAchievement[achievement.id] || {}

        for (const student of students) {
          const qg = achievementGrades[student.id]
          if (!qg || !qg.levelCode) continue

          const performanceLevel = toPerformanceLevel(qg.levelCode, toPerf)
          if (!performanceLevel) {
            skipped++
            continue
          }

          // Con descriptor por nivel: el texto del boletín es el descriptor redactado
          // para esa escala. Si falta, se cae al texto mecánico "{Nivel}: {base}".
          const descriptor = descriptorMode === 'DESCRIPTOR_PER_LEVEL'
            ? (achievement.levelDescriptors || []).find((d: any) => d.levelCode === qg.levelCode)?.text?.trim()
            : undefined
          const achievementText = descriptor || buildQualitativeAchievementText(achievement.baseDescription, qg.levelCode)

          await achievementsApi.upsertStudentAchievement('upsert', {
            studentEnrollmentId: student.enrollmentId,
            achievementId: achievement.id,
            academicTermId,
            performanceLevel,
            suggestedText: achievementText,
            approvedText: achievementText,
            isTextApproved: true,
            observation: qg.observation?.trim() || undefined,
          })
          saved++
        }
      }

      const msg = skipped > 0
        ? `Evaluación guardada · ${saved} estudiantes · ${skipped} omitidos`
        : `Evaluación cualitativa guardada · ${saved} estudiantes`
      TOAST.grades.saved(selectedAssignment?.subject?.name, selectedAssignment?.group?.name)
      toast.info(msg)
    } catch (err: any) {
      console.error('Error saving qualitative grades:', err)
      TOAST.grades.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Guardar registros de convivencia (asignatura CONVIVENCIA): texto libre por estudiante.
  const saveConvivencia = async () => {
    if (!isConvivencia) return
    const subjectId = selectedAssignment?.subject?.id
    if (!selectedAssignment?.id || !academicTermId || !subjectId) {
      toast.warning('No se puede guardar: falta información del período o la asignatura')
      return
    }

    setSaving(true)
    try {
      let saved = 0
      for (const student of students) {
        const items = (convivenciaByStudent[student.id] || []).map(item => ({
          text: item.text.trim(),
          performanceLevel: toPerformanceLevel(item.levelCode, toPerf),
        })).filter(item => item.text)
        const text = items.map(item => item.text).join('\n')
        // Se persiste incluso el vacío para permitir borrar un registro previo.
        await achievementsApi.upsertConvivencia({
          studentEnrollmentId: student.enrollmentId,
          academicTermId,
          subjectId,
          text,
          items: items.map(item => ({ text: item.text, level: item.performanceLevel || null })),
        })
        if (text) saved++
      }
      TOAST.grades.saved(selectedAssignment?.subject?.name, selectedAssignment?.group?.name)
      toast.info(`Convivencia guardada · ${saved} con registro`)
    } catch (err: any) {
      console.error('Error saving convivencia:', err)
      TOAST.grades.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Guardar valoraciones por imprescindible (modo EVIDENCE).
  const saveEvidenceValuations = async () => {
    if (!isEvidenceMode) return
    if (!selectedAssignment?.id || !academicTermId) {
      toast.warning('No se puede guardar: falta información del período o dimensión')
      return
    }
    setSaving(true)
    try {
      let saved = 0
      for (const ind of evidenceIndicators) {
        const grades = evidenceGrades[ind.id] || {}
        for (const student of students) {
          const g = grades[student.id]
          if (!g || !g.levelCode) continue
          const performanceLevel = toPerformanceLevel(g.levelCode, toPerf)
          if (!performanceLevel) continue
          await achievementsApi.upsertEvidenceValuation({
            studentEnrollmentId: student.enrollmentId,
            achievementEvidenceId: ind.id,
            academicTermId,
            performanceLevel,
            observation: g.observation?.trim() || undefined,
          })
          saved++
        }
      }
      TOAST.grades.saved(selectedAssignment?.subject?.name, selectedAssignment?.group?.name)
      toast.info(`Valoración por imprescindible guardada · ${saved} registros`)
    } catch (err: any) {
      console.error('Error saving evidence valuations:', err)
      TOAST.grades.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateQualitativeAchievement = async (
    baseDescription: string,
    levelDescriptors?: Array<{ levelCode: string; text: string }>,
  ) => {
    if (!selectedAssignment?.id || !academicTermId) {
      toast.warning('No se puede crear el indicador: falta información del período o dimensión')
      return
    }

    try {
      const response = await achievementsApi.create({
        teacherAssignmentId: selectedAssignment.id,
        academicTermId,
        orderNumber: achievements.length + 1,
        baseDescription,
        isPromotional: false,
        ...(levelDescriptors && levelDescriptors.length > 0 ? { levelDescriptors } : {}),
      })

      const created = response.data
      if (!created) return

      setAchievements(prev => [...prev, created].sort((a, b) => a.orderNumber - b.orderNumber))
      setQualitativeGradesByAchievement(prev => ({
        ...prev,
        [created.id]: prev[created.id] || {},
      }))
      setSelectedQualitativeAchievementId(created.id)
      toast.success('Indicador creado. Ahora asigna el nivel a cada estudiante en la grilla.')
      // Llevar al docente directo a la grilla de valoración
      setTimeout(() => {
        document.getElementById('qualitative-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } catch (err: any) {
      console.error('Error creating qualitative achievement:', err)
      toast.error(err)
      throw err
    }
  }

  const handleUpdateQualitativeAchievement = async (
    achievementId: string,
    baseDescription: string,
    levelDescriptors?: Array<{ levelCode: string; text: string }>,
  ) => {
    try {
      const response = await achievementsApi.update(achievementId, {
        baseDescription,
        ...(levelDescriptors && levelDescriptors.length > 0 ? { levelDescriptors } : {}),
      })
      const updated = response.data
      setAchievements(prev => prev.map(a => (a.id === achievementId ? { ...a, ...(updated || {}), baseDescription, levelDescriptors: updated?.levelDescriptors ?? levelDescriptors ?? a.levelDescriptors } : a)))
      toast.success('Indicador actualizado')
    } catch (err: any) {
      console.error('Error updating qualitative achievement:', err)
      toast.error(err)
      throw err
    }
  }

  const handleDeleteQualitativeAchievement = async (achievementId: string) => {
    try {
      await achievementsApi.delete(achievementId)
      setAchievements(prev => prev.filter(a => a.id !== achievementId))
      setQualitativeGradesByAchievement(prev => {
        const next = { ...prev }
        delete next[achievementId]
        return next
      })
      if (selectedQualitativeAchievementId === achievementId) {
        setSelectedQualitativeAchievementId(null)
      }
      toast.success('Indicador eliminado')
    } catch (err: any) {
      console.error('Error deleting qualitative achievement:', err)
      toast.error(err)
    }
  }

  // Guardar notas
  const saveGrades = async () => {
    if (!selectedAssignment?.id || !academicTermId) {
      toast.warning('No se puede guardar: falta información del período o asignatura')
      return
    }

    setSaving(true)

    try {
      const partialGradesToSave: Array<{
        studentEnrollmentId: string;
        teacherAssignmentId: string;
        academicTermId: string;
        componentType: string;
        activityIndex: number;
        activityName: string;
        activityType?: string;
        score: number | null;
        expectedUpdatedAt?: string | null;
      }> = []

      students.forEach(student => {
        const studentGrades = grades[student.id] || {}

        processConfigs.forEach(process => {
          const allProcessActivities = [
            ...process.activities,
            ...(additionalActivities[process.code] || [])
          ]

          allProcessActivities.forEach((activity, idx) => {
            // C-2: null = sin nota (el backend borra la celda); un número (incl. 0) se guarda.
            const raw = studentGrades[activity.id]
            const score = (raw === null || raw === undefined || Number.isNaN(raw)) ? null : raw
            const activityName = customActivityNames[activity.id] || activity.name

            // Concurrencia (guardado por diferencias): solo se envía la celda si su nota
            // cambió respecto al snapshot cargado, o si cambió el nombre de una actividad
            // que ya tiene nota (el nombre solo se persiste si hay una fila que lo cargue).
            // Así, dos personas editando celdas distintas de la misma planilla no se pisan.
            const baseScoreRaw = gradesBaseline[student.id]?.[activity.id]
            const baseScore = (baseScoreRaw === null || baseScoreRaw === undefined || Number.isNaN(baseScoreRaw)) ? null : baseScoreRaw
            const baseName = baselineActivityNames[activity.id] || activity.name
            const scoreChanged = score !== baseScore
            const nameChanged = score !== null && activityName !== baseName
            if (!scoreChanged && !nameChanged) return

            partialGradesToSave.push({
              studentEnrollmentId: student.enrollmentId,
              teacherAssignmentId: selectedAssignment.id,
              academicTermId: academicTermId!,
              componentType: process.code,
              activityIndex: idx + 1,
              activityName,
              activityType: activity.type,
              score,
              // Lo que el cliente vio la última vez para ESTA celda puntual — permite al
              // backend detectar si alguien más la cambió mientras tanto (misma celda).
              expectedUpdatedAt: gradesServerUpdatedAt[student.id]?.[activity.id] ?? null,
            })
          })
        })
      })

      if (partialGradesToSave.length === 0) {
        toast.info('No hay cambios por guardar')
        return
      }

      const saveResponse = await withSave(() => partialGradesApi.bulkUpsert(partialGradesToSave))
      // PeriodFinalGrade se recalcula automáticamente en el backend
      const conflicts: any[] = saveResponse?.data?.conflicts || []
      const results: any[] = saveResponse?.data?.results || []
      const conflictKey = (c: { studentEnrollmentId: string; componentType: string; activityIndex: number }) =>
        `${c.studentEnrollmentId}|${c.componentType}|${c.activityIndex}`
      const conflictSet = new Set(conflicts.map(conflictKey))

      // Resolver, por cada item enviado, a qué estudiante/actividad corresponde (una sola vez).
      const resolveCell = (g: { studentEnrollmentId: string; componentType: string; activityIndex: number }) => {
        const student = students.find(s => s.enrollmentId === g.studentEnrollmentId)
        const process = processConfigs.find(p => p.code === g.componentType)
        const allProcessActivities = process
          ? [...process.activities, ...(additionalActivities[process.code] || [])]
          : []
        const activity = allProcessActivities[g.activityIndex - 1]
        return student && activity ? { studentId: student.id, activityId: activity.id } : null
      }

      // Actualizar el snapshot base SOLO con lo que realmente se guardó (no lo que tuvo conflicto),
      // para que el próximo diff sea contra el estado ya persistido.
      setGradesBaseline(prev => {
        const next = JSON.parse(JSON.stringify(prev))
        partialGradesToSave.forEach(g => {
          if (conflictSet.has(conflictKey(g))) return // no se guardó: no tocar el baseline
          const cell = resolveCell(g)
          if (cell) {
            if (!next[cell.studentId]) next[cell.studentId] = {}
            next[cell.studentId][cell.activityId] = g.score
          }
        })
        return next
      })
      setBaselineActivityNames(prev => ({ ...prev, ...customActivityNames }))

      // updatedAt: para lo guardado, tomar el updatedAt real que devolvió el servidor
      // (evita otro falso-conflicto en el siguiente guardado). Para lo borrado, null.
      setGradesServerUpdatedAt(prev => {
        const next = JSON.parse(JSON.stringify(prev))
        results.forEach((r: any) => {
          const cell = resolveCell(r)
          if (!cell) return
          if (!next[cell.studentId]) next[cell.studentId] = {}
          next[cell.studentId][cell.activityId] = r.action === 'delete' ? null : (r.updatedAt || null)
        })
        return next
      })

      // Conflictos: alguien más cambió esa MISMA celda mientras editabas. No se sobrescribió
      // su valor — se refleja el valor actual del servidor para que decidas si reintentar.
      if (conflicts.length > 0) {
        setGrades(prev => {
          const next = JSON.parse(JSON.stringify(prev))
          conflicts.forEach((c: any) => {
            const cell = resolveCell(c)
            if (cell) {
              if (!next[cell.studentId]) next[cell.studentId] = {}
              next[cell.studentId][cell.activityId] = c.serverScore
            }
          })
          return next
        })
        setGradesBaseline(prev => {
          const next = JSON.parse(JSON.stringify(prev))
          conflicts.forEach((c: any) => {
            const cell = resolveCell(c)
            if (cell) {
              if (!next[cell.studentId]) next[cell.studentId] = {}
              next[cell.studentId][cell.activityId] = c.serverScore
            }
          })
          return next
        })
        setGradesServerUpdatedAt(prev => {
          const next = JSON.parse(JSON.stringify(prev))
          conflicts.forEach((c: any) => {
            const cell = resolveCell(c)
            if (cell) {
              if (!next[cell.studentId]) next[cell.studentId] = {}
              next[cell.studentId][cell.activityId] = c.serverUpdatedAt || null
            }
          })
          return next
        })
        toast.warning(`⚠️ ${conflicts.length} nota(s) NO se guardaron: alguien más las cambió mientras editabas. Se muestra el valor actual — revísalas y vuelve a guardar si aún quieres tu valor.`)
      }

      const notasConValor = results.filter((g: any) => g.action !== 'delete').length
      if (conflicts.length === 0 || results.length > 0) {
        TOAST.grades.saved(selectedAssignment?.subject?.name, selectedAssignment?.group?.name)
      }
      if (notasConValor > 0) toast.info(`${notasConValor} nota(s) guardada(s)`)
    } catch (err: any) {
      console.error('Error saving grades:', err)
      TOAST.grades.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Guardar notas de componente final (planilla simplificada)
  const saveFinalComponentGrades = async () => {
    if (!selectedAssignment?.id || !selectedFinalComponentId) {
      toast.warning('No se puede guardar: falta información del componente')
      return
    }

    setSavingFc(true)

    try {
      const gradesToSave = students.map(student => ({
        studentEnrollmentId: student.enrollmentId,
        teacherAssignmentId: selectedAssignment.id,
        finalComponentId: selectedFinalComponentId,
        grade: fcGrades[student.id] || 0,
      }))

      await withSave(() => finalComponentGradesApi.bulkUpsert(gradesToSave))

      const notasConValor = gradesToSave.filter(g => g.grade > 0).length
      TOAST.grades.saved(selectedAssignment?.subject?.name, selectedAssignment?.group?.name)
      if (notasConValor > 0) toast.info(`${notasConValor} notas del componente guardadas`)
    } catch (err: any) {
      console.error('Error saving final component grades:', err)
      TOAST.grades.error(err)
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
            {isConvivencia ? 'Registro de convivencia (texto libre)' : isQualitative ? 'Evaluación cualitativa por dimensiones' : 'Registro de notas por componente evaluativo'}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedAssignment && (
            <div className="relative">
              <button
                onClick={() => {
                  if (students.length === 0) {
                    toast.warning('No hay estudiantes cargados. Selecciona una asignatura y grupo primero.')
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
            onClick={isConvivencia ? saveConvivencia : isEvidenceMode ? saveEvidenceValuations : isQualitative ? saveQualitativeGrades : selectedSourceType === 'final_component' ? saveFinalComponentGrades : saveGrades}
            disabled={(selectedSourceType === 'period' ? saving : savingFc) || !currentPeriodOpen}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <Save className="w-4 h-4" />
            {(saving || savingFc) ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        {/* Semáforo de completitud */}
        {completeness && !isQualitative && !isConvivencia && (
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              completeness.pct >= 80 ? 'bg-green-500' :
              completeness.pct >= 30 ? 'bg-amber-400' : 'bg-red-500'
            }`} />
            <span className={`font-medium ${
              completeness.pct >= 80 ? 'text-green-700' :
              completeness.pct >= 30 ? 'text-amber-700' : 'text-red-600'
            }`}>
              {completeness.count}/{completeness.total} estudiantes con notas
            </span>
            <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completeness.pct >= 80 ? 'bg-green-500' :
                  completeness.pct >= 30 ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ width: `${completeness.pct}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs">{completeness.pct}%</span>
          </div>
        )}
        <SaveStatusPill status={saveStatus} />
      </div>

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

        {selectedSourceType === 'period' && !isQualitative && !isConvivencia && (
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
            Aprendizajes
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

        {!isQualitative && !isConvivencia && (
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

        {resolvedLevel?.gradingScaleType === 'QUALITATIVE_DESC' && !isQualitative && !isConvivencia && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-300 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800">
                El nivel "{resolvedLevel.name}" está configurado como evaluación cualitativa, pero este grado aún usa la planilla numérica.
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Para que esta planilla muestre la escala cualitativa ({resolvedLevel.qualitativeLevels?.map(l => l.name).join(', ')}), un administrador debe corregir la estructura del grado. En Configuración Inicial o desde el panel de administración, ejecute la opción "Corregir estructura de preescolar".
              </p>
            </div>
          </div>
        )}

        {isConvivencia ? (
          <ConvivenciaPanel
            students={students}
            loadingStudents={loadingStudents}
            currentPeriodOpen={currentPeriodOpen}
            subjectName={selectedAssignment.subject.name}
            valueByStudent={convivenciaByStudent}
            qualitativeLevels={qualitativeLevels}
            onChange={(studentId, items) => setConvivenciaByStudent(prev => ({ ...prev, [studentId]: items }))}
          />
        ) : isEvidenceMode ? (
          <QualitativeGradesPanel
            students={students}
            loadingStudents={loadingStudents}
            currentPeriodOpen={currentPeriodOpen}
            achievements={evidenceIndicators}
            descriptorMode={'FREE'}
            catalogLocked={true}
            indicatorLabel="Imprescindible"
            selectedAchievementId={selectedEvidenceId}
            onSelectAchievement={setSelectedEvidenceId}
            qualitativeLevels={qualitativeLevels}
            gradesByAchievement={evidenceGrades}
            onUpdateGrade={(evidenceId, studentId, patch) => {
              setEvidenceGrades(prev => ({
                ...prev,
                [evidenceId]: {
                  ...(prev[evidenceId] || {}),
                  [studentId]: {
                    ...(prev[evidenceId]?.[studentId] || { levelCode: '', observation: '' }),
                    ...patch,
                  },
                },
              }))
            }}
            onCreateAchievement={async () => {}}
            onEditAchievement={async () => {}}
            onDeleteAchievement={async () => {}}
          />
        ) : isQualitative ? (
          <QualitativeGradesPanel
            students={students}
            loadingStudents={loadingStudents}
            currentPeriodOpen={currentPeriodOpen}
            achievements={achievements}
            descriptorMode={descriptorMode}
            catalogLocked={catalogLocked}
            selectedAchievementId={selectedQualitativeAchievementId}
            onSelectAchievement={setSelectedQualitativeAchievementId}
            qualitativeLevels={qualitativeLevels}
            gradesByAchievement={qualitativeGradesByAchievement}
            onUpdateGrade={(achievementId, studentId, patch) => {
              setQualitativeGradesByAchievement(prev => ({
                ...prev,
                [achievementId]: {
                  ...(prev[achievementId] || {}),
                  [studentId]: {
                    ...(prev[achievementId]?.[studentId] || { levelCode: '', observation: '' }),
                    ...patch,
                  },
                },
              }))
            }}
            onCreateAchievement={handleCreateQualitativeAchievement}
            onEditAchievement={handleUpdateQualitativeAchievement}
            onDeleteAchievement={handleDeleteQualitativeAchievement}
          />
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
                  const override = finalOverrides[student.enrollmentId]
                  const performance = getPerformanceLevel(override ?? finalGrade)

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
                                  value={grades[student.id]?.[activity.id] ?? ''}
                                  onChange={(e) => { const v = e.target.value.trim(); updateGrade(student.id, activity.id, v === '' ? null : parseFloat(v)) }}
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
                        {override !== undefined ? (
                          <span
                            className="inline-flex items-center gap-1 text-violet-700"
                            title={`Nota final fijada manualmente por coordinación (${override.toFixed(1)}). Tus cambios de parciales NO la modifican.`}
                          >
                            <Lock className="w-3 h-3" /> {override.toFixed(1)}
                          </span>
                        ) : (finalGrade > 0 ? finalGrade.toFixed(1) : '-')}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {(override ?? finalGrade) > 0 && (
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
          /* Vista de Aprendizajes - Asociación automática aprendizaje-desempeño */
          <div className="space-y-4">
          {/* Banco de Aprendizajes Panel */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setShowBank(!showBank)}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Library className="w-5 h-5 text-indigo-600" />
                <div className="text-left">
                  <span className="font-semibold text-slate-900">Banco de Aprendizajes</span>
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
                      placeholder="Buscar aprendizajes..."
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
                    <p className="text-sm text-slate-500">No hay aprendizajes en el banco</p>
                    <p className="text-xs text-slate-400 mt-1">Puedes agregar aprendizajes desde el módulo de Aprendizajes y Evidencias</p>
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
                            toast.success('Aprendizaje copiado al portapapeles')
                          }}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Copiar texto del aprendizaje"
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
              <h3 className="font-semibold text-slate-900">Asociación Aprendizajes - Desempeño</h3>
              <p className="text-sm text-slate-500 mt-1">
                Visualización de la asociación automática entre aprendizajes y nivel de desempeño según la nota final
              </p>
            </div>
            
            {achievements.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay aprendizajes creados para este período</p>
                <p className="text-sm text-slate-400 mt-1">
                  Vaya al módulo de Aprendizajes y Evidencias para crear los aprendizajes de esta asignatura
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
                            <span>Aprendizaje {ach.orderNumber}</span>
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
                    Faltan {achievementConfig.achievementsPerPeriod - achievements.length} aprendizaje(s) por crear. 
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
