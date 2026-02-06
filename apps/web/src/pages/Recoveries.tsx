import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'
import {
  RefreshCw,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  Save,
  Calendar,
  BookOpen,
  ClipboardList
} from 'lucide-react'
import {
  academicYearsApi,
  academicTermsApi,
  recoveryConfigApi,
  periodRecoveryApi,
  finalRecoveryApi,
  academicActsApi,
  teacherAssignmentsApi,
  periodFinalGradesApi,
  recoveryPeriodConfigApi
} from '../lib/api'

type TabType = 'period' | 'final' | 'config' | 'acts'

interface RecoveryConfig {
  id?: string
  minPassingScore: number
  periodRecoveryEnabled: boolean
  periodMaxScore: number
  periodImpactType: string
  finalRecoveryEnabled: boolean
  finalMaxScore: number
  finalImpactType: string
  maxAreasRecoverable: number
  requiresAcademicCouncilAct: boolean
  requiresPromotionAct: boolean
}

const IMPACT_TYPES = [
  { value: 'ADJUST_TO_MINIMUM', label: 'Ajustar hasta nota mínima aprobatoria' },
  { value: 'AVERAGE_WITH_ORIGINAL', label: 'Promediar con nota original' },
  { value: 'REPLACE_IF_HIGHER', label: 'Reemplazar solo si es mayor' },
  { value: 'QUALITATIVE_ONLY', label: 'Solo registro cualitativo (no afecta nota)' },
]

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', icon: RefreshCw },
  COMPLETED: { bg: 'bg-slate-100', text: 'text-slate-700', icon: CheckCircle },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  NOT_APPROVED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', icon: XCircle },
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Proceso',
  COMPLETED: 'Completada',
  APPROVED: 'Aprobada',
  NOT_APPROVED: 'No Aprobada',
  CANCELLED: 'Cancelada',
}

export default function Recoveries() {
  const { user, institution: authInstitution } = useAuth()
  // institutionId viene de Auth (dato institucional), no de Academic
  const institutionId = authInstitution?.id
  const [activeTab, setActiveTab] = useState<TabType>('period')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [failingStudents, setFailingStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([])

  const [config, setConfig] = useState<RecoveryConfig>({
    minPassingScore: 3.0,
    periodRecoveryEnabled: true,
    periodMaxScore: 3.0,
    periodImpactType: 'ADJUST_TO_MINIMUM',
    finalRecoveryEnabled: true,
    finalMaxScore: 3.0,
    finalImpactType: 'ADJUST_TO_MINIMUM',
    maxAreasRecoverable: 2,
    requiresAcademicCouncilAct: true,
    requiresPromotionAct: true,
  })

  const [periodRecoveries, setPeriodRecoveries] = useState<any[]>([])
  const [finalRecoveries, setFinalRecoveries] = useState<any[]>([])
  const [acts, setActs] = useState<any[]>([])
  const [periodStats, setPeriodStats] = useState<Record<string, number>>({})
  const [finalStats, setFinalStats] = useState<Record<string, number>>({})
  const [recoveryPeriodOpen, setRecoveryPeriodOpen] = useState(false)
  const [recoveryPeriodMessage, setRecoveryPeriodMessage] = useState('')
  
  // Estado para el modal de crear plan de recuperación
  const [showRecoveryPlanModal, setShowRecoveryPlanModal] = useState(false)
  const [selectedStudentForRecovery, setSelectedStudentForRecovery] = useState<any>(null)
  const [recoveryPlanForm, setRecoveryPlanForm] = useState({
    activityDescription: '',
    observations: '',
    recoveryScore: '',
    recoveryDate: new Date().toISOString().split('T')[0],
  })

  const isAdmin = user?.roles?.some((r: any) => 
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r.role?.name || r.name)
  )
  
  const isCoordinator = user?.roles?.some((r: any) => 
    ['COORDINADOR'].includes(r.role?.name || r.name)
  )
  
  const isTeacher = user?.roles?.some((r: any) => 
    ['DOCENTE'].includes(r.role?.name || r.name)
  )
  
  const isAdminOrCoordinator = isAdmin || isCoordinator

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    if (selectedYearId) {
      // Cargar términos (períodos) del año seleccionado
      const loadTerms = async () => {
        try {
          const response = await academicTermsApi.getAll(selectedYearId)
          setTerms(response.data || [])
          // Seleccionar el primer término si hay alguno
          if (response.data?.length > 0) {
            setSelectedTermId(response.data[0].id)
          }
        } catch (err) {
          console.error('Error loading terms:', err)
          setTerms([])
        }
      }
      loadTerms()
      
      if (institutionId) {
        loadConfig()
        loadFinalRecoveries()
        loadActs()
      }
    }
  }, [selectedYearId, institutionId])

  useEffect(() => {
    if (selectedTermId) {
      loadPeriodRecoveries()
      checkRecoveryPeriodStatus()
    }
  }, [selectedTermId])

  // Verificar si el período de recuperación está abierto
  const checkRecoveryPeriodStatus = async () => {
    if (!selectedTermId || !selectedYearId) {
      setRecoveryPeriodOpen(false)
      return
    }
    
    try {
      const response = await recoveryPeriodConfigApi.getStatus(selectedYearId)
      const periodsStatus = response.data || []
      
      // Buscar el estado del período seleccionado
      const currentPeriod = periodsStatus.find((p: any) => p.id === selectedTermId)
      
      if (currentPeriod) {
        // El backend devuelve canEnterRecoveries, no canEnterGrades
        const canEnter = currentPeriod.canEnterRecoveries || currentPeriod.status === 'open'
        setRecoveryPeriodOpen(canEnter)
        if (!canEnter) {
          if (currentPeriod.status === 'upcoming') {
            setRecoveryPeriodMessage(`Recuperaciones abren el ${new Date(currentPeriod.openDate).toLocaleDateString('es-CO')}`)
          } else if (currentPeriod.status === 'closed') {
            setRecoveryPeriodMessage(`Recuperaciones cerraron el ${new Date(currentPeriod.closeDate).toLocaleDateString('es-CO')}`)
          } else if (currentPeriod.status === 'not_configured') {
            setRecoveryPeriodMessage('Período de recuperación no configurado')
          } else {
            setRecoveryPeriodMessage('Recuperaciones no habilitadas para este período')
          }
        } else {
          setRecoveryPeriodMessage('')
        }
      } else {
        // Si no hay configuración, permitir por defecto para admin/coordinador
        setRecoveryPeriodOpen(isAdminOrCoordinator || false)
        setRecoveryPeriodMessage(isAdminOrCoordinator ? '' : 'Período de recuperación no configurado')
      }
    } catch (err) {
      console.error('Error checking recovery period status:', err)
      // En caso de error, permitir para admin/coordinador
      setRecoveryPeriodOpen(isAdminOrCoordinator || false)
    }
  }

  // Cargar grupos y asignaturas según el rol del usuario
  useEffect(() => {
    const loadGroupsAndSubjects = async () => {
      if (!selectedYearId) return
      try {
        // Cargar asignaciones del docente o todas si es admin/coordinador
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: selectedYearId })
        const assignments = assignmentsRes.data || []
        setTeacherAssignments(assignments)
        
        // Extraer grupos únicos
        const uniqueGroups = new Map<string, any>()
        // Extraer asignaturas únicas
        const uniqueSubjects = new Map<string, any>()
        
        assignments.forEach((assignment: any) => {
          if (assignment.group && !uniqueGroups.has(assignment.group.id)) {
            uniqueGroups.set(assignment.group.id, {
              id: assignment.group.id,
              name: assignment.group.name,
              gradeName: assignment.group.grade?.name
            })
          }
          if (assignment.subject && !uniqueSubjects.has(assignment.subject.id)) {
            uniqueSubjects.set(assignment.subject.id, {
              id: assignment.subject.id,
              name: assignment.subject.name,
              areaName: assignment.subject.area?.name
            })
          }
        })
        
        const groupsList = Array.from(uniqueGroups.values())
        const subjectsList = Array.from(uniqueSubjects.values())
        
        // Para admin/coordinador, agregar opción "Todos"
        if (isAdminOrCoordinator) {
          setGroups([{ id: 'all', name: 'Todos los grupos', gradeName: '' }, ...groupsList])
          setSubjects([{ id: 'all', name: 'Todas las asignaturas', areaName: '' }, ...subjectsList])
          setSelectedGroupId('all')
          setSelectedSubjectId('all')
        } else {
          setGroups(groupsList)
          setSubjects(subjectsList)
          if (groupsList.length > 0) setSelectedGroupId(groupsList[0].id)
          if (subjectsList.length > 0) setSelectedSubjectId(subjectsList[0].id)
        }
      } catch (err) {
        console.error('Error loading groups and subjects:', err)
        setGroups([])
        setSubjects([])
      }
    }
    loadGroupsAndSubjects()
  }, [selectedYearId, isAdminOrCoordinator])

  // Cargar estudiantes que perdieron cuando cambian los filtros
  useEffect(() => {
    const loadFailingStudents = async () => {
      if (!selectedTermId) {
        setFailingStudents([])
        return
      }
      
      // Para docente, necesita seleccionar grupo y asignatura específicos
      if (isTeacher && (!selectedGroupId || selectedGroupId === 'all' || !selectedSubjectId || selectedSubjectId === 'all')) {
        setFailingStudents([])
        return
      }
      
      setLoadingStudents(true)
      try {
        // Determinar qué grupos consultar
        const groupsToQuery = selectedGroupId === 'all' 
          ? groups.filter(g => g.id !== 'all').map(g => g.id)
          : [selectedGroupId]
        
        // Obtener notas de todos los grupos seleccionados
        let allGrades: any[] = []
        for (const groupId of groupsToQuery) {
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId, selectedTermId)
            allGrades = [...allGrades, ...(gradesRes.data || [])]
          } catch (err) {
            console.error(`Error loading grades for group ${groupId}:`, err)
          }
        }
        
        // Filtrar por asignatura si se seleccionó una específica
        if (selectedSubjectId && selectedSubjectId !== 'all') {
          allGrades = allGrades.filter((g: any) => g.subjectId === selectedSubjectId)
        }
        
        // Para docente, filtrar solo las asignaturas que tiene asignadas
        if (isTeacher) {
          const teacherSubjectIds = teacherAssignments.map(a => a.subject?.id).filter(Boolean)
          allGrades = allGrades.filter((g: any) => teacherSubjectIds.includes(g.subjectId))
        }
        
        // Agrupar notas por estudiante
        const studentGradesMap = new Map<string, {
          studentId: string;
          enrollmentId: string;
          studentName: string;
          groupName: string;
          failingSubjects: Array<{ subjectId: string; subjectName: string; score: number }>;
        }>()
        
        allGrades.forEach((grade: any) => {
          const score = Number(grade.finalScore)
          // Solo considerar notas menores a 3.0 (nota mínima aprobatoria)
          if (score < 3.0) {
            const enrollmentId = grade.studentEnrollmentId
            const student = grade.studentEnrollment?.student
            const studentName = student ? `${student.firstName} ${student.lastName}` : 'Estudiante'
            const subjectName = grade.subject?.name || 'Asignatura'
            const subjectId = grade.subjectId
            const groupName = grade.studentEnrollment?.group?.name || ''
            
            if (!studentGradesMap.has(enrollmentId)) {
              studentGradesMap.set(enrollmentId, {
                studentId: student?.id || enrollmentId,
                enrollmentId,
                studentName,
                groupName,
                failingSubjects: []
              })
            }
            
            studentGradesMap.get(enrollmentId)!.failingSubjects.push({
              subjectId,
              subjectName,
              score
            })
          }
        })
        
        // Convertir a array
        const failingList = Array.from(studentGradesMap.values()).map(item => ({
          id: item.studentId,
          enrollmentId: item.enrollmentId,
          name: item.studentName,
          groupName: item.groupName,
          failingSubjects: item.failingSubjects,
          subjectsCount: item.failingSubjects.length,
          lowestScore: Math.min(...item.failingSubjects.map(s => s.score))
        }))
        
        setFailingStudents(failingList)
      } catch (err) {
        console.error('Error loading failing students:', err)
        setFailingStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }
    loadFailingStudents()
  }, [selectedGroupId, selectedTermId, selectedSubjectId, isTeacher, teacherAssignments, groups])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearsApi.getAll()
      setAcademicYears(response.data)
      const current = response.data.find((y: any) => y.isCurrent)
      if (current) {
        setSelectedYearId(current.id)
      }
    } catch (err) {
      console.error('Error loading academic years:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadConfig = async () => {
    if (!institutionId || !selectedYearId) return
    try {
      const response = await recoveryConfigApi.get(institutionId, selectedYearId)
      if (response.data) {
        setConfig({
          ...response.data,
          minPassingScore: Number(response.data.minPassingScore),
          periodMaxScore: Number(response.data.periodMaxScore),
          finalMaxScore: Number(response.data.finalMaxScore),
        })
      }
    } catch (err) {
      console.error('Error loading config:', err)
    }
  }

  const loadPeriodRecoveries = async () => {
    if (!selectedTermId) return
    try {
      const [recoveriesRes, statsRes] = await Promise.all([
        periodRecoveryApi.getByTerm(selectedTermId),
        periodRecoveryApi.getStats(selectedTermId),
      ])
      setPeriodRecoveries(recoveriesRes.data)
      setPeriodStats(statsRes.data)
    } catch (err) {
      console.error('Error loading period recoveries:', err)
    }
  }

  const loadFinalRecoveries = async () => {
    if (!selectedYearId) return
    try {
      const [recoveriesRes, statsRes] = await Promise.all([
        finalRecoveryApi.getByYear(selectedYearId),
        finalRecoveryApi.getStats(selectedYearId),
      ])
      setFinalRecoveries(recoveriesRes.data)
      setFinalStats(statsRes.data)
    } catch (err) {
      console.error('Error loading final recoveries:', err)
    }
  }

  const loadActs = async () => {
    if (!institutionId || !selectedYearId) return
    try {
      const response = await academicActsApi.getAll(institutionId, selectedYearId)
      setActs(response.data)
    } catch (err) {
      console.error('Error loading acts:', err)
    }
  }

  const handleSaveConfig = async () => {
    if (!institutionId || !selectedYearId) return
    setSaving(true)
    try {
      await recoveryConfigApi.upsert({
        institutionId: institutionId,
        academicYearId: selectedYearId,
        ...config,
      })
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
    } catch (err) {
      console.error('Error saving config:', err)
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const renderStatusBadge = (status: string) => {
    const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.PENDING
    const Icon = statusInfo.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
        <Icon className="w-3 h-3" />
        {STATUS_LABELS[status] || status}
      </span>
    )
  }

  const tabs = [
    { id: 'period' as TabType, label: 'Recuperación por Período', icon: Calendar },
    { id: 'final' as TabType, label: 'Recuperación Final', icon: BookOpen },
    { id: 'acts' as TabType, label: 'Actas', icon: FileText },
    ...(isAdmin ? [{ id: 'config' as TabType, label: 'Configuración', icon: Settings }] : []),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Recuperaciones Académicas</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestión de planes de recuperación y apoyo pedagógico</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}</option>
              ))}
            </select>
          </div>

          {activeTab === 'period' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  disabled={!selectedYearId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={!selectedYearId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.gradeName} {group.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignatura</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={!selectedYearId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <nav className="flex gap-2 sm:gap-4 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {activeTab === 'period' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-amber-50 rounded-xl p-3 sm:p-4 border border-amber-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-amber-700">
                    {(periodStats.PENDING || 0) + failingStudents.reduce((acc, s) => acc + s.failingSubjects.length, 0)}
                  </p>
                  <p className="text-xs sm:text-sm text-amber-600">Pendientes</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-blue-700">{periodStats.IN_PROGRESS || 0}</p>
                  <p className="text-xs sm:text-sm text-blue-600">En Proceso</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 sm:p-4 border border-green-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-green-700">{periodStats.COMPLETED || periodStats.APPROVED || 0}</p>
                  <p className="text-xs sm:text-sm text-green-600">Aprobadas</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 sm:p-4 border border-red-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-red-700">{periodStats.NOT_APPROVED || periodStats.FAILED || 0}</p>
                  <p className="text-xs sm:text-sm text-red-600">No Aprobadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Estudiantes que perdieron el período */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">Estudiantes con Bajo Rendimiento</h2>
              <span className="text-xs sm:text-sm text-slate-500">
                {failingStudents.length} estudiante(s) con nota inferior a 3.0
              </span>
            </div>
            {loadingStudents ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : !selectedTermId ? (
              <div className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
                <p className="text-slate-500">Selecciona un período para ver los estudiantes</p>
              </div>
            ) : isTeacher && (!selectedGroupId || !selectedSubjectId) ? (
              <div className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
                <p className="text-slate-500">Selecciona un grupo y una asignatura para ver los estudiantes</p>
              </div>
            ) : failingStudents.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                <p className="text-slate-500">No hay estudiantes con bajo rendimiento en este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                      {selectedGroupId === 'all' && (
                        <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Grupo</th>
                      )}
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Asignaturas Perdidas</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {failingStudents.map(student => (
                      <tr key={student.enrollmentId} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{student.name}</p>
                        </td>
                        {selectedGroupId === 'all' && (
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{student.groupName}</span>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {student.failingSubjects?.map((subj: any, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                {subj.subjectName}: {subj.score.toFixed(1)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                            {student.subjectsCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                            Pendiente
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              setSelectedStudentForRecovery(student)
                              setRecoveryPlanForm({
                                activityDescription: '',
                                observations: '',
                                recoveryScore: '',
                                recoveryDate: new Date().toISOString().split('T')[0],
                              })
                              setShowRecoveryPlanModal(true)
                            }}
                            disabled={!recoveryPeriodOpen && isTeacher}
                            className={`px-3 py-1.5 text-sm rounded-lg ${
                              !recoveryPeriodOpen && isTeacher
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                            title={!recoveryPeriodOpen && isTeacher ? recoveryPeriodMessage : ''}
                          >
                            Crear Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mensaje de período cerrado para docentes */}
          {isTeacher && !recoveryPeriodOpen && recoveryPeriodMessage && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              {recoveryPeriodMessage}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Recuperaciones del Período</h2>
            </div>
            {periodRecoveries.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay recuperaciones registradas para este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Asignatura</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nota Original</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nota Recuperación</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nota Final</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periodRecoveries.map((recovery) => (
                      <tr key={recovery.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {recovery.studentEnrollment?.student?.firstName} {recovery.studentEnrollment?.student?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {recovery.studentEnrollment?.group?.grade?.name} - {recovery.studentEnrollment?.group?.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{recovery.subject?.name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                            {Number(recovery.originalScore).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {recovery.recoveryScore ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                              {Number(recovery.recoveryScore).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {recovery.finalScore ? (
                            <span className={`px-2 py-1 rounded font-medium ${
                              Number(recovery.finalScore) >= 3.0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {Number(recovery.finalScore).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {renderStatusBadge(recovery.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'final' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-700">{finalStats.PENDING || 0}</p>
                  <p className="text-sm text-amber-600">Pendientes</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-700">{finalStats.IN_PROGRESS || 0}</p>
                  <p className="text-sm text-blue-600">En Proceso</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{finalStats.APPROVED || 0}</p>
                  <p className="text-sm text-green-600">Aprobadas</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{finalStats.NOT_APPROVED || 0}</p>
                  <p className="text-sm text-red-600">No Aprobadas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Planes de Apoyo Final</h2>
            </div>
            {finalRecoveries.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay planes de apoyo registrados para este año</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Área</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nota Original</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nota Final</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Docente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finalRecoveries.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {plan.studentEnrollment?.student?.firstName} {plan.studentEnrollment?.student?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {plan.studentEnrollment?.group?.grade?.name} - {plan.studentEnrollment?.group?.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{plan.area?.name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                            {Number(plan.originalAreaScore).toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {plan.finalAreaScore ? (
                            <span className={`px-2 py-1 rounded font-medium ${
                              Number(plan.finalAreaScore) >= 3.0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {Number(plan.finalAreaScore).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {renderStatusBadge(plan.status)}
                        </td>
                        <td className="px-6 py-4 text-slate-700 text-sm">
                          {plan.responsibleTeacher?.firstName} {plan.responsibleTeacher?.lastName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'acts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Actas Académicas</h2>
          </div>
          {acts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No hay actas registradas para este año</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {acts.map((act) => (
                <div key={act.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {act.actNumber}
                        </span>
                        <span className="text-sm text-slate-500">
                          {new Date(act.actDate).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                      <h3 className="font-medium text-slate-900 mt-1">{act.title}</h3>
                      {act.studentEnrollment && (
                        <p className="text-sm text-slate-500 mt-1">
                          Estudiante: {act.studentEnrollment.student?.firstName} {act.studentEnrollment.student?.lastName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {act.approvedById ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Aprobada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Configuración de Recuperaciones</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuración General
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nota Mínima Aprobatoria
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={config.minPassingScore}
                    onChange={(e) => setConfig({ ...config, minPassingScore: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recuperación por Período
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.periodRecoveryEnabled}
                    onChange={(e) => setConfig({ ...config, periodRecoveryEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Habilitar recuperación por período</span>
                </label>

                {config.periodRecoveryEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nota Máxima Alcanzable
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={config.periodMaxScore}
                        onChange={(e) => setConfig({ ...config, periodMaxScore: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Impacto en la Nota
                      </label>
                      <select
                        value={config.periodImpactType}
                        onChange={(e) => setConfig({ ...config, periodImpactType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {IMPACT_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Recuperación Final (Plan de Apoyo)
              </h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.finalRecoveryEnabled}
                    onChange={(e) => setConfig({ ...config, finalRecoveryEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Habilitar recuperación final</span>
                </label>

                {config.finalRecoveryEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-7">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nota Máxima Alcanzable
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        value={config.finalMaxScore}
                        onChange={(e) => setConfig({ ...config, finalMaxScore: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Tipo de Impacto en la Nota
                      </label>
                      <select
                        value={config.finalImpactType}
                        onChange={(e) => setConfig({ ...config, finalImpactType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {IMPACT_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Máximo de Áreas Recuperables
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={config.maxAreasRecoverable}
                        onChange={(e) => setConfig({ ...config, maxAreasRecoverable: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Actas Requeridas
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.requiresAcademicCouncilAct}
                    onChange={(e) => setConfig({ ...config, requiresAcademicCouncilAct: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Requiere Acta de Consejo Académico</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.requiresPromotionAct}
                    onChange={(e) => setConfig({ ...config, requiresPromotionAct: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Requiere Acta de Promoción</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear Plan de Recuperación */}
      {showRecoveryPlanModal && selectedStudentForRecovery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Plan de Recuperación</h2>
              <button 
                onClick={() => setShowRecoveryPlanModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Información del estudiante */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-medium text-slate-900 mb-2">{selectedStudentForRecovery.name}</h3>
                {selectedStudentForRecovery.groupName && (
                  <p className="text-sm text-slate-600 mb-2">Grupo: {selectedStudentForRecovery.groupName}</p>
                )}
                <div className="mt-2">
                  <p className="text-sm font-medium text-slate-700 mb-1">Asignaturas a recuperar:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedStudentForRecovery.failingSubjects?.map((subj: any, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                        {subj.subjectName}: {subj.score.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Formulario del plan */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Recuperación *
                  </label>
                  <input
                    type="date"
                    value={recoveryPlanForm.recoveryDate}
                    onChange={(e) => setRecoveryPlanForm({ ...recoveryPlanForm, recoveryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descripción de la Actividad de Recuperación *
                  </label>
                  <textarea
                    value={recoveryPlanForm.activityDescription}
                    onChange={(e) => setRecoveryPlanForm({ ...recoveryPlanForm, activityDescription: e.target.value })}
                    placeholder="Describa la actividad que el estudiante debe realizar para recuperar (ej: Taller escrito sobre los temas del período, sustentación oral, etc.)"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Observaciones
                  </label>
                  <textarea
                    value={recoveryPlanForm.observations}
                    onChange={(e) => setRecoveryPlanForm({ ...recoveryPlanForm, observations: e.target.value })}
                    placeholder="Observaciones adicionales sobre el proceso de recuperación del estudiante"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nota de Recuperación (opcional - se puede agregar después)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={recoveryPlanForm.recoveryScore}
                    onChange={(e) => setRecoveryPlanForm({ ...recoveryPlanForm, recoveryScore: e.target.value })}
                    placeholder="Ej: 3.0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Nota máxima alcanzable según configuración: {config.periodMaxScore}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRecoveryPlanModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!recoveryPlanForm.activityDescription) {
                    setMessage({ type: 'error', text: 'La descripción de la actividad es requerida' })
                    setTimeout(() => setMessage(null), 3000)
                    return
                  }
                  
                  setSaving(true)
                  try {
                    // Crear plan de recuperación para cada asignatura perdida
                    for (const subj of selectedStudentForRecovery.failingSubjects) {
                      await periodRecoveryApi.create({
                        studentEnrollmentId: selectedStudentForRecovery.enrollmentId,
                        academicTermId: selectedTermId,
                        subjectId: subj.subjectId,
                        originalScore: subj.score,
                        recoveryScore: recoveryPlanForm.recoveryScore ? parseFloat(recoveryPlanForm.recoveryScore) : undefined,
                        activityDescription: recoveryPlanForm.activityDescription,
                        observations: recoveryPlanForm.observations,
                        recoveryDate: recoveryPlanForm.recoveryDate,
                        status: recoveryPlanForm.recoveryScore ? 'COMPLETED' : 'PENDING',
                      })
                    }
                    
                    setMessage({ type: 'success', text: 'Plan de recuperación creado correctamente' })
                    setTimeout(() => setMessage(null), 3000)
                    setShowRecoveryPlanModal(false)
                    loadPeriodRecoveries()
                  } catch (err: any) {
                    console.error('Error creating recovery plan:', err)
                    setMessage({ type: 'error', text: err.response?.data?.message || 'Error al crear el plan de recuperación' })
                    setTimeout(() => setMessage(null), 5000)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving || !recoveryPlanForm.activityDescription}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Crear Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
