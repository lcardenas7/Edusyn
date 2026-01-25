import { useState, useCallback, useEffect, useMemo } from 'react'
import { BookOpen, ChevronDown, Save, Plus, Trash2, X, Settings, AlertTriangle, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useInstitution } from '../contexts/InstitutionContext'
import { teacherAssignmentsApi, studentsApi, gradingPeriodConfigApi, periodFinalGradesApi, partialGradesApi } from '../lib/api'

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

interface Activity {
  id: string
  name: string
  type: string
}

interface AttitudinalConfig {
  personal: number
  social: number
  autoevaluacion: number
  coevaluacion: number
}

export default function Grades() {
  const { user } = useAuth()
  const { gradingConfig, setGradingConfig, periods, selectedPeriod, setSelectedPeriod } = useInstitution()
  
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
  const [addToComponent, setAddToComponent] = useState<'COGNITIVO' | 'PROCEDIMENTAL' | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed')
  const [deleteConfirm, setDeleteConfirm] = useState<{ component: 'COGNITIVO' | 'PROCEDIMENTAL'; activityId: string; activityName: string } | null>(null)
  
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

  // Obtener pesos de componentes desde la nueva estructura de procesos
  const getProcessWeight = (code: string) => {
    const process = gradingConfig.evaluationProcesses.find(p => p.code === code)
    return process?.weightPercentage || 0
  }

  const componentWeights = {
    COGNITIVO: getProcessWeight('COGNITIVO'),
    PROCEDIMENTAL: getProcessWeight('PROCEDIMENTAL'),
    ACTITUDINAL: getProcessWeight('ACTITUDINAL'),
  }

  const setComponentWeights = (weights: { COGNITIVO: number; PROCEDIMENTAL: number; ACTITUDINAL: number }) => {
    const updated = gradingConfig.evaluationProcesses.map(p => {
      if (p.code === 'COGNITIVO') return { ...p, weightPercentage: weights.COGNITIVO }
      if (p.code === 'PROCEDIMENTAL') return { ...p, weightPercentage: weights.PROCEDIMENTAL }
      if (p.code === 'ACTITUDINAL') return { ...p, weightPercentage: weights.ACTITUDINAL }
      return p
    })
    setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
  }
  
  // Obtener configuración actitudinal desde subprocesos del proceso ACTITUDINAL
  const actitudinalProcess = gradingConfig.evaluationProcesses.find(p => p.code === 'ACTITUDINAL')
  const attitudinalConfig: AttitudinalConfig = {
    personal: actitudinalProcess?.subprocesses.find(s => s.name.toLowerCase().includes('personal'))?.weightPercentage || 0,
    social: actitudinalProcess?.subprocesses.find(s => s.name.toLowerCase().includes('social'))?.weightPercentage || 0,
    autoevaluacion: actitudinalProcess?.subprocesses.find(s => s.name.toLowerCase().includes('autoevaluación'))?.weightPercentage || 0,
    coevaluacion: actitudinalProcess?.subprocesses.find(s => s.name.toLowerCase().includes('coevaluación'))?.weightPercentage || 0,
  }

  const setAttitudinalConfig = (config: AttitudinalConfig) => {
    if (!actitudinalProcess) return
    const updatedSubs = actitudinalProcess.subprocesses.map(s => {
      const name = s.name.toLowerCase()
      if (name.includes('personal')) return { ...s, weightPercentage: config.personal }
      if (name.includes('social')) return { ...s, weightPercentage: config.social }
      if (name.includes('autoevaluación')) return { ...s, weightPercentage: config.autoevaluacion }
      if (name.includes('coevaluación')) return { ...s, weightPercentage: config.coevaluacion }
      return s
    })
    const updated = gradingConfig.evaluationProcesses.map(p =>
      p.code === 'ACTITUDINAL' ? { ...p, subprocesses: updatedSubs } : p
    )
    setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
  }

  // Cargar asignaciones del docente
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: any = {}
        // Si es docente, filtrar por su ID
        if (isTeacher && user?.id) {
          params.teacherId = user.id
        }
        const response = await teacherAssignmentsApi.getAll(params)
        const data = response.data || []
        setAssignments(data)
        // Inicializar filtros con la primera asignación
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

  // Cargar estado de períodos cuando cambia el año académico
  useEffect(() => {
    const fetchPeriodsStatus = async () => {
      if (!selectedAssignment?.academicYear?.id) return
      try {
        const response = await gradingPeriodConfigApi.getStatus(selectedAssignment.academicYear.id)
        setPeriodsStatus(response.data || [])
      } catch (err) {
        console.error('Error loading periods status:', err)
        // Si falla, asumir que todos los períodos están abiertos (comportamiento por defecto)
        setPeriodsStatus([])
      }
    }
    fetchPeriodsStatus()
  }, [selectedAssignment?.academicYear?.id])

  // Verificar si el período seleccionado está abierto y obtener el academicTermId
  useEffect(() => {
    if (periodsStatus.length === 0) {
      // Si no hay configuración, permitir calificaciones (comportamiento por defecto)
      setCurrentPeriodOpen(true)
      setPeriodClosedMessage('')
      setAcademicTermId(null)
      return
    }
    
    // El selectedPeriod del contexto es '1', '2', etc. Necesitamos buscar por order
    const periodOrder = parseInt(selectedPeriod)
    const currentPeriodStatus = periodsStatus.find(p => p.order === periodOrder)
    
    if (currentPeriodStatus) {
      // Guardar el academicTermId real para usar al guardar
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

  // Estudiantes del grupo seleccionado
  const [students, setStudents] = useState<Array<{ id: string; name: string; enrollmentId: string }>>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Cargar estudiantes cuando cambia la asignación
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedAssignment?.group?.id || !selectedAssignment?.academicYear?.id) {
        setStudents([])
        return
      }
      setLoadingStudents(true)
      try {
        const response = await studentsApi.getAll({
          groupId: selectedAssignment.group.id,
          academicYearId: selectedAssignment.academicYear.id,
        })
        const data = response.data || []
        // El backend devuelve StudentEnrollment cuando se filtra por groupId
        // Cada item tiene: { id (enrollmentId), student: { id, firstName, lastName }, ... }
        const mappedStudents = data.map((item: any) => {
          // Si viene como enrollment (tiene student anidado)
          if (item.student) {
            return {
              id: item.student.id,
              name: `${item.student.firstName} ${item.student.lastName}`,
              enrollmentId: item.id,
            }
          }
          // Si viene como student directo (tiene enrollments)
          const enrollment = item.enrollments?.find((e: any) => 
            e.groupId === selectedAssignment.group.id && 
            e.academicYearId === selectedAssignment.academicYear.id
          )
          return {
            id: item.id,
            name: `${item.firstName} ${item.lastName}`,
            enrollmentId: enrollment?.id || item.id,
          }
        })
        setStudents(mappedStudents)
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [selectedAssignment?.group?.id, selectedAssignment?.academicYear?.id])

  // Obtener configuración de procesos
  const cognitivoProcess = gradingConfig.evaluationProcesses.find(p => p.code === 'COGNITIVO')
  const procedimentalProcess = gradingConfig.evaluationProcesses.find(p => p.code === 'PROCEDIMENTAL')
  
  // Número de notas desde la configuración
  const cognitivoCount = cognitivoProcess?.subprocesses?.[0]?.numberOfGrades || 3
  const procedimentalCount = procedimentalProcess?.subprocesses?.[0]?.numberOfGrades || 3
  
  // Permitir agregar notas
  const allowAddCognitivo = cognitivoProcess?.allowTeacherAddGrades ?? true
  const allowAddProcedimental = procedimentalProcess?.allowTeacherAddGrades ?? true

  // Debug: mostrar en consola la configuración actual
  useEffect(() => {
    console.log('📊 Configuración de calificaciones:', {
      cognitivoCount,
      procedimentalCount,
      allowAddCognitivo,
      allowAddProcedimental,
      periodsCount: periods.length,
      periods: periods.map(p => p.name),
    })
  }, [cognitivoCount, procedimentalCount, allowAddCognitivo, allowAddProcedimental, periods])

  // Generar actividades dinámicamente
  const generateActivities = useCallback((prefix: string, count: number, defaultTypes: string[]): Activity[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${prefix}${i + 1}`,
      name: `Nota ${i + 1}`,
      type: defaultTypes[i % defaultTypes.length] || 'Actividad',
    }))
  }, [])

  const [cognitivoActivities, setCognitivoActivities] = useState<Activity[]>([])
  const [procedimentalActivities, setProcedimentalActivities] = useState<Activity[]>([])

  // Actualizar actividades cuando cambia la configuración
  useEffect(() => {
    setCognitivoActivities(generateActivities('cog', cognitivoCount, ['Examen escrito', 'Taller', 'Quiz', 'Proyecto', 'Evaluación']))
  }, [cognitivoCount, generateActivities])

  useEffect(() => {
    setProcedimentalActivities(generateActivities('proc', procedimentalCount, ['Actividad práctica', 'Proyecto', 'Trabajo en clase', 'Taller', 'Exposición']))
  }, [procedimentalCount, generateActivities])

  const [grades, setGrades] = useState<Record<string, Record<string, number>>>({})

  // Función para crear objeto de notas vacío basado en la configuración
  const createEmptyGrades = (): Record<string, number> => {
    const gradeObj: Record<string, number> = {
      personal: 0, social: 0, autoevaluacion: 0, coevaluacion: 0,
    }
    for (let i = 1; i <= cognitivoCount; i++) {
      gradeObj[`cog${i}`] = 0
    }
    for (let i = 1; i <= procedimentalCount; i++) {
      gradeObj[`proc${i}`] = 0
    }
    return gradeObj
  }

  // Cargar notas parciales guardadas del backend cuando cambia la asignatura
  useEffect(() => {
    const loadSavedGrades = async () => {
      if (!selectedAssignment?.id || !academicTermId || students.length === 0) {
        // Inicializar con ceros
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
        
        // Inicializar todas las notas en 0
        const initGrades: Record<string, Record<string, number>> = {}
        students.forEach(student => {
          initGrades[student.id] = createEmptyGrades()
        })
        
        // Mapear las notas guardadas a los estudiantes
        savedGrades.forEach((grade: any) => {
          const student = students.find(s => s.enrollmentId === grade.studentEnrollmentId)
          if (student && initGrades[student.id]) {
            // Construir el ID de la actividad (ej: cog1, proc2, personal)
            let activityKey = ''
            if (grade.componentType === 'COGNITIVO') {
              activityKey = `cog${grade.activityIndex}`
            } else if (grade.componentType === 'PROCEDIMENTAL') {
              activityKey = `proc${grade.activityIndex}`
            } else if (grade.componentType === 'ACTITUDINAL') {
              // Mapear índices actitudinales
              const attKeys = ['personal', 'social', 'autoevaluacion', 'coevaluacion']
              activityKey = attKeys[grade.activityIndex - 1] || ''
            }
            
            if (activityKey && initGrades[student.id]) {
              initGrades[student.id][activityKey] = Number(grade.score)
            }
          }
        })
        
        setGrades(initGrades)
      } catch (err) {
        console.error('Error loading saved grades:', err)
        // Inicializar con ceros en caso de error
        const initGrades: Record<string, Record<string, number>> = {}
        students.forEach(student => {
          initGrades[student.id] = {
            cog1: 0, cog2: 0, cog3: 0,
            proc1: 0, proc2: 0, proc3: 0,
            personal: 0, social: 0, autoevaluacion: 0, coevaluacion: 0,
          }
        })
        setGrades(initGrades)
      }
    }
    
    loadSavedGrades()
  }, [selectedAssignment?.id, academicTermId, students])

  const [newActivity, setNewActivity] = useState({ name: '', type: activityTypes[0] })

  const addActivity = (component: 'COGNITIVO' | 'PROCEDIMENTAL') => {
    const activities = component === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities
    const setActivities = component === 'COGNITIVO' ? setCognitivoActivities : setProcedimentalActivities
    const prefix = component === 'COGNITIVO' ? 'cog' : 'proc'
    
    const newId = `${prefix}${activities.length + 1}`
    const newAct: Activity = {
      id: newId,
      name: newActivity.name || `Nota ${activities.length + 1}`,
      type: newActivity.type,
    }
    
    setActivities([...activities, newAct])
    setGrades(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(studentId => {
        updated[studentId] = { ...updated[studentId], [newId]: 0 }
      })
      return updated
    })
    
    setNewActivity({ name: '', type: activityTypes[0] })
    setShowAddActivity(false)
    setAddToComponent(null)
  }

  const removeActivity = (component: 'COGNITIVO' | 'PROCEDIMENTAL', activityId: string) => {
    const activities = component === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities
    if (activities.length <= 1) return
    
    const setActivities = component === 'COGNITIVO' ? setCognitivoActivities : setProcedimentalActivities
    setActivities(activities.filter(a => a.id !== activityId))
    
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
    // Limitar el valor entre 1 y 5
    let clampedValue = value
    if (value > 5) clampedValue = 5
    else if (value < 1 && value !== 0) clampedValue = 1
    else if (value < 0) clampedValue = 0
    
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [activityId]: clampedValue }
    }))
  }

  const calculateAvg = (studentId: string, activityIds: string[]) => {
    const studentGrades = grades[studentId] || {}
    const values = activityIds.map(id => studentGrades[id]).filter(v => v > 0)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }

  const calculateFinalGrade = (studentId: string) => {
    const cogAvg = calculateAvg(studentId, cognitivoActivities.map(a => a.id))
    const procAvg = calculateAvg(studentId, procedimentalActivities.map(a => a.id))
    
    const attAvg = (
      (grades[studentId]?.personal || 0) * (attitudinalConfig.personal / 20) +
      (grades[studentId]?.social || 0) * (attitudinalConfig.social / 20) +
      (grades[studentId]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
      (grades[studentId]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
    )
    
    return (
      cogAvg * (componentWeights.COGNITIVO / 100) +
      procAvg * (componentWeights.PROCEDIMENTAL / 100) +
      attAvg * (componentWeights.ACTITUDINAL / 100)
    )
  }

  // Obtener todas las columnas de actividades en orden
  const allActivityColumns = [
    ...cognitivoActivities.map(a => a.id),
    ...procedimentalActivities.map(a => a.id),
    'personal', 'social', 'autoevaluacion', 'coevaluacion'
  ]

  // Función para guardar las calificaciones parciales en el backend
  const saveGrades = async () => {
    if (!selectedAssignment?.id || !academicTermId) {
      setSaveMessage({ type: 'error', text: 'No se puede guardar: falta información del período o asignatura' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      // Preparar las notas parciales para cada estudiante y actividad
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
        
        // Guardar notas cognitivas (incluir score=0 para eliminar notas borradas)
        cognitivoActivities.forEach((activity, idx) => {
          const score = studentGrades[activity.id] || 0
          partialGradesToSave.push({
            studentEnrollmentId: student.enrollmentId,
            teacherAssignmentId: selectedAssignment.id,
            academicTermId: academicTermId!,
            componentType: 'COGNITIVO',
            activityIndex: idx + 1,
            activityName: activity.name,
            activityType: activity.type,
            score,
          })
        })
        
        // Guardar notas procedimentales (incluir score=0 para eliminar notas borradas)
        procedimentalActivities.forEach((activity, idx) => {
          const score = studentGrades[activity.id] || 0
          partialGradesToSave.push({
            studentEnrollmentId: student.enrollmentId,
            teacherAssignmentId: selectedAssignment.id,
            academicTermId: academicTermId!,
            componentType: 'PROCEDIMENTAL',
            activityIndex: idx + 1,
            activityName: activity.name,
            activityType: activity.type,
            score,
          })
        })
        
        // Guardar notas actitudinales (incluir score=0 para eliminar notas borradas)
        const attitudinalKeys = [
          { key: 'personal', name: 'Personal' },
          { key: 'social', name: 'Social' },
          { key: 'autoevaluacion', name: 'Autoevaluación' },
          { key: 'coevaluacion', name: 'Coevaluación' },
        ]
        attitudinalKeys.forEach((att, idx) => {
          const score = studentGrades[att.key] || 0
          partialGradesToSave.push({
            studentEnrollmentId: student.enrollmentId,
            teacherAssignmentId: selectedAssignment.id,
            academicTermId: academicTermId!,
            componentType: 'ACTITUDINAL',
            activityIndex: idx + 1,
            activityName: att.name,
            score,
          })
        })
      })

      // Ya no validamos si hay notas > 0 porque ahora enviamos todas
      // (incluyendo score=0 para eliminar notas borradas)

      // Guardar notas parciales
      await partialGradesApi.bulkUpsert(partialGradesToSave)
      
      // También guardar las notas finales del período para los estudiantes que tienen notas
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

  // Navegación con teclado entre inputs de notas
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
          // Enter mueve hacia abajo (siguiente estudiante)
          if (studentIndex < students.length - 1) {
            targetStudentId = students[studentIndex + 1].id
            targetActivityId = activityId
          } else if (activityIndex < allActivityColumns.length - 1) {
            // Si es el último estudiante, ir a la siguiente actividad del primer estudiante
            targetStudentId = students[0].id
            targetActivityId = allActivityColumns[activityIndex + 1]
          }
        }
        break
      case 'Tab':
        e.preventDefault()
        if (!e.shiftKey) {
          // Tab mueve hacia la derecha (siguiente columna)
          if (activityIndex < allActivityColumns.length - 1) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex + 1]
          } else if (studentIndex < students.length - 1) {
            // Si es la última columna, ir a la primera columna del siguiente estudiante
            targetStudentId = students[studentIndex + 1].id
            targetActivityId = allActivityColumns[0]
          }
        } else {
          // Shift+Tab mueve hacia la izquierda (columna anterior)
          if (activityIndex > 0) {
            targetStudentId = studentId
            targetActivityId = allActivityColumns[activityIndex - 1]
          } else if (studentIndex > 0) {
            // Si es la primera columna, ir a la última columna del estudiante anterior
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
  }, [allActivityColumns])

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

      {/* Mensaje de guardado */}
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
              // Si el grupo actual no está disponible para la nueva asignatura, seleccionar el primero disponible
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
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
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
              <option key={group.id} value={group.id}>
                {group.gradeName} {group.name}
              </option>
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
        </div>

        <div className="ml-auto flex gap-2">
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Cognitivo ({componentWeights.COGNITIVO}%)
          </span>
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
            Procedimental ({componentWeights.PROCEDIMENTAL}%)
          </span>
          <span className="px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Actitudinal ({componentWeights.ACTITUDINAL}%)
          </span>
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

        {/* Banner de período cerrado */}
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
                  <th 
                    colSpan={cognitivoActivities.length + (allowAddCognitivo ? 1 : 0) + 1}
                    className="text-center px-2 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border-r border-slate-200"
                  >
                    COGNITIVO - {componentWeights.COGNITIVO}%
                  </th>
                  <th 
                    colSpan={procedimentalActivities.length + (allowAddProcedimental ? 1 : 0) + 1}
                    className="text-center px-2 py-2 text-xs font-semibold text-green-700 bg-green-50 border-r border-slate-200"
                  >
                    PROCEDIMENTAL - {componentWeights.PROCEDIMENTAL}%
                  </th>
                  <th 
                    colSpan={5}
                    className="text-center px-2 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border-r border-slate-200"
                  >
                    ACTITUDINAL - {componentWeights.ACTITUDINAL}%
                  </th>
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-600 uppercase bg-slate-200 min-w-[60px]">
                    Final
                  </th>
                  <th rowSpan={2} className="text-center px-3 py-2 text-xs font-medium text-slate-500 uppercase min-w-[50px]">
                    Niv
                  </th>
                </tr>
                <tr className="bg-slate-50 text-[11px]">
                  {cognitivoActivities.map((activity) => (
                    <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 truncate max-w-[45px]" title={`${activity.name} (${activity.type})`}>
                          {activity.name}
                        </span>
                        {cognitivoActivities.length > 1 && (
                          <button 
                            onClick={() => setDeleteConfirm({ component: 'COGNITIVO', activityId: activity.id, activityName: activity.name })}
                            className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {allowAddCognitivo && (
                    <th className="text-center px-1 py-1 min-w-[30px] border-b border-slate-200">
                      <button 
                        onClick={() => { setAddToComponent('COGNITIVO'); setShowAddActivity(true); }}
                        className="p-1 rounded hover:bg-blue-100 text-blue-600"
                        title="Agregar actividad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-blue-100 text-blue-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
                  
                  {procedimentalActivities.map((activity) => (
                    <th key={activity.id} className="text-center px-1 py-1 min-w-[50px] border-b border-slate-200">
                      <div className="flex flex-col items-center">
                        <span className="text-slate-600 truncate max-w-[45px]" title={`${activity.name} (${activity.type})`}>
                          {activity.name}
                        </span>
                        {procedimentalActivities.length > 1 && (
                          <button 
                            onClick={() => setDeleteConfirm({ component: 'PROCEDIMENTAL', activityId: activity.id, activityName: activity.name })}
                            className="p-0.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 mt-0.5"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {allowAddProcedimental && (
                    <th className="text-center px-1 py-1 min-w-[30px] border-b border-slate-200">
                      <button 
                        onClick={() => { setAddToComponent('PROCEDIMENTAL'); setShowAddActivity(true); }}
                        className="p-1 rounded hover:bg-green-100 text-green-600"
                        title="Agregar actividad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-green-100 text-green-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
                  
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Personal</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.personal}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Social</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.social}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Autoev.</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.autoevaluacion}%</div>
                  </th>
                  <th className="text-center px-1 py-1 min-w-[45px] bg-amber-50 border-b border-slate-200">
                    <span className="text-amber-700">Coev.</span>
                    <div className="text-[9px] text-amber-500">{attitudinalConfig.coevaluacion}%</div>
                  </th>
                  <th className="text-center px-1 py-1 text-[10px] font-medium uppercase bg-amber-100 text-amber-700 min-w-[40px] border-b border-slate-200">
                    Prom
                  </th>
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
                  const cogAvg = calculateAvg(student.id, cognitivoActivities.map(a => a.id))
                  const procAvg = calculateAvg(student.id, procedimentalActivities.map(a => a.id))
                  const attAvg = (
                    (grades[student.id]?.personal || 0) * (attitudinalConfig.personal / 20) +
                    (grades[student.id]?.social || 0) * (attitudinalConfig.social / 20) +
                    (grades[student.id]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
                    (grades[student.id]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
                  )
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-900 border-r border-slate-100 sticky left-0 bg-white z-10">
                        {student.name}
                      </td>
                      
                      {cognitivoActivities.map((activity) => (
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
                            className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200'}`}
                          />
                        </td>
                      ))}
                      {allowAddCognitivo && <td className="px-1 py-1"></td>}
                      <td className="px-1 py-1 text-center font-semibold text-blue-700 bg-blue-50/50">
                        {cogAvg > 0 ? cogAvg.toFixed(1) : '-'}
                      </td>
                      
                      {procedimentalActivities.map((activity) => (
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
                            className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200'}`}
                          />
                        </td>
                      ))}
                      {allowAddProcedimental && <td className="px-1 py-1"></td>}
                      <td className="px-1 py-1 text-center font-semibold text-green-700 bg-green-50/50">
                        {procAvg > 0 ? procAvg.toFixed(1) : '-'}
                      </td>
                      
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-personal`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.personal || ''}
                          onChange={(e) => updateGrade(student.id, 'personal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'personal')}
                          onFocus={(e) => e.target.select()}
                          disabled={!currentPeriodOpen}
                          className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-amber-200'}`}
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-social`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.social || ''}
                          onChange={(e) => updateGrade(student.id, 'social', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'social')}
                          onFocus={(e) => e.target.select()}
                          disabled={!currentPeriodOpen}
                          className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-amber-200'}`}
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-autoevaluacion`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.autoevaluacion || ''}
                          onChange={(e) => updateGrade(student.id, 'autoevaluacion', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'autoevaluacion')}
                          onFocus={(e) => e.target.select()}
                          disabled={!currentPeriodOpen}
                          className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-amber-200'}`}
                        />
                      </td>
                      <td className="px-1 py-1 text-center bg-amber-50/30">
                        <input
                          id={`grade-${student.id}-coevaluacion`}
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={grades[student.id]?.coevaluacion || ''}
                          onChange={(e) => updateGrade(student.id, 'coevaluacion', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyNavigation(e, student.id, 'coevaluacion')}
                          onFocus={(e) => e.target.select()}
                          disabled={!currentPeriodOpen}
                          className={`w-11 px-1 py-1 text-center text-xs border rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none ${!currentPeriodOpen ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-amber-200'}`}
                        />
                      </td>
                      <td className="px-1 py-1 text-center font-semibold text-amber-700 bg-amber-50/50">
                        {attAvg > 0 ? attAvg.toFixed(1) : '-'}
                      </td>
                      
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-blue-600 uppercase bg-blue-50">Cognitivo ({componentWeights.COGNITIVO}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-green-600 uppercase bg-green-50">Procedimental ({componentWeights.PROCEDIMENTAL}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-amber-600 uppercase bg-amber-50">Actitudinal ({componentWeights.ACTITUDINAL}%)</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-600 uppercase bg-slate-100">Promedio Final</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Desempeño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        Cargando estudiantes...
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No hay estudiantes matriculados en este grupo
                    </td>
                  </tr>
                ) : students.map((student) => {
                  const cogAvg = calculateAvg(student.id, cognitivoActivities.map(a => a.id))
                  const procAvg = calculateAvg(student.id, procedimentalActivities.map(a => a.id))
                  const attAvg = (
                    (grades[student.id]?.personal || 0) * (attitudinalConfig.personal / 20) +
                    (grades[student.id]?.social || 0) * (attitudinalConfig.social / 20) +
                    (grades[student.id]?.autoevaluacion || 0) * (attitudinalConfig.autoevaluacion / 20) +
                    (grades[student.id]?.coevaluacion || 0) * (attitudinalConfig.coevaluacion / 20)
                  )
                  const finalGrade = calculateFinalGrade(student.id)
                  const performance = getPerformanceLevel(finalGrade)
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{student.name}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-blue-700">{cogAvg > 0 ? cogAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(cogAvg).color}`}>
                          {getPerformanceLevel(cogAvg).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-green-700">{procAvg > 0 ? procAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(procAvg).color}`}>
                          {getPerformanceLevel(procAvg).label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg font-semibold text-amber-700">{attAvg > 0 ? attAvg.toFixed(1) : '-'}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${getPerformanceLevel(attAvg).color}`}>
                          {getPerformanceLevel(attAvg).label}
                        </span>
                      </td>
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
        )}
      </div>

      {/* Modal Nueva Actividad */}
      {showAddActivity && addToComponent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Nueva Actividad - {addToComponent === 'COGNITIVO' ? 'Cognitivo' : 'Procedimental'}
              </h3>
              <button onClick={() => { setShowAddActivity(false); setAddToComponent(null); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (opcional)</label>
                <input 
                  type="text" 
                  placeholder={`Nota ${(addToComponent === 'COGNITIVO' ? cognitivoActivities : procedimentalActivities).length + 1}`}
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
                onClick={() => { setShowAddActivity(false); setAddToComponent(null); }} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => addActivity(addToComponent)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración (Solo Admin) */}
      {showConfig && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Configuración de Componentes</h3>
              <button onClick={() => setShowConfig(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-slate-800 mb-3">Pesos de Componentes</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-blue-700 font-medium">Cognitivo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.COGNITIVO}
                        onChange={(e) => setComponentWeights({ ...componentWeights, COGNITIVO: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-green-700 font-medium">Procedimental</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.PROCEDIMENTAL}
                        onChange={(e) => setComponentWeights({ ...componentWeights, PROCEDIMENTAL: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 text-amber-700 font-medium">Actitudinal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={componentWeights.ACTITUDINAL}
                        onChange={(e) => setComponentWeights({ ...componentWeights, ACTITUDINAL: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                  Total: <span className={`font-semibold ${componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL}%
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-800 mb-3">Distribución Actitudinal (debe sumar {componentWeights.ACTITUDINAL}%)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Personal</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.personal}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, personal: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Social</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.social}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, social: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Autoevaluación</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.autoevaluacion}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, autoevaluacion: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 text-sm text-slate-600">Coevaluación</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={attitudinalConfig.coevaluacion}
                      onChange={(e) => setAttitudinalConfig({ ...attitudinalConfig, coevaluacion: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                  Total Actitudinal: <span className={`font-semibold ${
                    attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion === componentWeights.ACTITUDINAL 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfig(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button 
                onClick={() => setShowConfig(false)}
                disabled={
                  componentWeights.COGNITIVO + componentWeights.PROCEDIMENTAL + componentWeights.ACTITUDINAL !== 100 ||
                  attitudinalConfig.personal + attitudinalConfig.social + attitudinalConfig.autoevaluacion + attitudinalConfig.coevaluacion !== componentWeights.ACTITUDINAL
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
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
              Estás a punto de eliminar <strong>"{deleteConfirm.activityName}"</strong> del componente {deleteConfirm.component === 'COGNITIVO' ? 'Cognitivo' : 'Procedimental'}. 
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
                  removeActivity(deleteConfirm.component, deleteConfirm.activityId)
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
