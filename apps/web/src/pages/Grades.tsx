import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { BookOpen, ChevronDown, Save, Plus, Trash2, X, Settings, AlertTriangle, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'
import { teacherAssignmentsApi, academicStudentsApi, gradingPeriodConfigApi, periodFinalGradesApi, partialGradesApi, achievementsApi, achievementConfigApi } from '../lib/api'

interface TeacherAssignment {
  id: string
  subject: { id: string; name: string; area?: { name: string } }
  group: { id: string; name: string; grade?: { name: string } }
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

const getPerformanceLevel = (grade: number) => {
  if (grade >= 4.5) return { label: 'Superior', color: 'text-green-600 bg-green-100' }
  if (grade >= 4.0) return { label: 'Alto', color: 'text-blue-600 bg-blue-100' }
  if (grade >= 3.0) return { label: 'Básico', color: 'text-amber-600 bg-amber-100' }
  return { label: 'Bajo', color: 'text-red-600 bg-red-100' }
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
  const { gradingConfig, setGradingConfig, periods, selectedPeriod, setSelectedPeriod } = useAcademic()
  // institutionId viene de Auth (dato institucional)
  const institutionId = authInstitution?.id
  
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
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherAssignment | null>(null)
  
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

  // Filtrar grupos disponibles según la asignatura seleccionada
  const filteredGroups = useMemo(() => {
    if (!selectedSubjectId) return uniqueGroups
    const groupIds = new Set(
      assignments.filter(a => a.subject.id === selectedSubjectId).map(a => a.group.id)
    )
    return uniqueGroups.filter(g => groupIds.has(g.id))
  }, [assignments, selectedSubjectId, uniqueGroups])

  // Actualizar asignación seleccionada cuando cambian los filtros
  useEffect(() => {
    if (selectedSubjectId && selectedGroupId) {
      const assignment = assignments.find(
        a => a.subject.id === selectedSubjectId && a.group.id === selectedGroupId
      )
      setSelectedAssignment(assignment || null)
    } else {
      setSelectedAssignment(null)
    }
  }, [selectedSubjectId, selectedGroupId, assignments])

  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
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
          setSelectedSubjectId(data[0].subject.id)
          setSelectedGroupId(data[0].group.id)
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

  // Verificar si el período está abierto
  useEffect(() => {
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
  }, [selectedPeriod, periodsStatus])

  // Estudiantes
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrollmentId: string }>>([])
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
        
        // Mapear notas guardadas
        savedGrades.forEach((grade: any) => {
          const student = students.find(s => s.enrollmentId === grade.studentEnrollmentId)
          if (student && initGrades[student.id]) {
            // Buscar la actividad correspondiente
            const process = processConfigs.find(p => p.code === grade.componentType)
            if (process) {
              const activity = process.activities[grade.activityIndex - 1]
              if (activity) {
                initGrades[student.id][activity.id] = Number(grade.score)
              }
            }
          }
        })
        
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
    if (value > 5) clampedValue = 5
    else if (value < 1 && value !== 0) clampedValue = 1
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
              activityName: activity.name,
              activityType: activity.type,
              score,
            })
          })
        })
      })

      await partialGradesApi.bulkUpsert(partialGradesToSave)
      
      // Guardar notas finales
      const finalGradesToSave = students
        .filter(student => {
          const studentGrades = grades[student.id] || {}
          return Object.values(studentGrades).some(v => v > 0)
        })
        .map(student => {
          const finalScore = calculateFinalGrade(student.id)
          return {
            studentEnrollmentId: student.enrollmentId,
            academicTermId: academicTermId!,
            subjectId: selectedAssignment.subject.id,
            finalScore: Math.round(finalScore * 10) / 10,
          }
        })
      
      if (finalGradesToSave.length > 0) {
        await periodFinalGradesApi.bulkUpsert(finalGradesToSave)
      }
      
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
          <p className="text-sm sm:text-base text-slate-500 mt-1">Registro de notas por componente evaluativo</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button 
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm sm:text-base"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurar</span>
            </button>
          )}
          <button 
            onClick={saveGrades}
            disabled={saving || !currentPeriodOpen}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
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
        <div className="relative">
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value)
              const newGroupIds = new Set(
                assignments.filter(a => a.subject.id === e.target.value).map(a => a.group.id)
              )
              if (!newGroupIds.has(selectedGroupId)) {
                const firstGroup = assignments.find(a => a.subject.id === e.target.value)?.group.id
                if (firstGroup) setSelectedGroupId(firstGroup)
              }
            }}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Seleccionar asignatura</option>
            {uniqueSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">Seleccionar curso</option>
            {filteredGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.gradeName} {group.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>{period.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1">
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

        <div className="ml-auto flex gap-2 flex-wrap">
          {processConfigs.map((process) => {
            const colors = processColors[process.colorIndex]
            return (
              <span key={process.code} className={`px-3 py-1 rounded-lg text-sm font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                {process.name} ({process.weight}%)
              </span>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900">{selectedAssignment?.subject.name}</h2>
              <p className="text-sm text-slate-500">{selectedAssignment?.group.grade?.name} {selectedAssignment?.group.name} • {periods.find(p => p.id === selectedPeriod)?.name || 'Período'}</p>
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

        {viewMode === 'detailed' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
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
                        {allProcessActivities.map((activity) => (
                          <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                            <div className="flex flex-col items-center">
                              <span className="text-slate-600 truncate max-w-[45px]" title={activity.name}>
                                {activity.name.length > 6 ? activity.name.substring(0, 6) + '.' : activity.name}
                              </span>
                              {activity.subprocessIndex === -1 && (
                                <button 
                                  onClick={() => setDeleteConfirm({ processCode: process.code, activityId: activity.id, activityName: activity.name })}
                                  className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                                  title="Eliminar actividad"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
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
                ) : students.map((student) => {
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 sticky left-0 bg-white z-10">
                        {student.name}
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
                                  min="1"
                                  max="5"
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
                    <td colSpan={processConfigs.length + 3} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={processConfigs.length + 3} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student) => {
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
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
                    {students.map((student) => {
                      const finalGrade = calculateFinalGrade(student.id)
                      const performance = getPerformanceLevel(finalGrade)
                      
                      return (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{student.name}</td>
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
        ) : null}
      </div>

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
