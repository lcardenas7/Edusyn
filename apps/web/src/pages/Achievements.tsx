import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'
import {
  FileText,
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  Check,
  X,
  Target,
  Heart,
  Filter,
  Users,
  CheckSquare,
  Square,
  Eye,
  Library,
  Search,
  Copy,
} from 'lucide-react'
import {
  academicYearsApi,
  groupsApi,
  teacherAssignmentsApi,
  achievementConfigApi,
  achievementsApi,
  periodFinalGradesApi,
  academicStudentsApi,
  achievementBankApi,
} from '../lib/api'

type TabType = 'achievements' | 'config'
type PerformanceLevel = 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR'

interface AchievementConfig {
  achievementsPerPeriod: number
  usePromotionalAchievement: boolean
  useAttitudinalAchievement: boolean
  attitudinalMode: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT'
  useValueJudgments: boolean
  useObservations: boolean
  displayMode: 'SEPARATE' | 'COMBINED'
  displayFormat: 'LIST' | 'PARAGRAPH'
  judgmentPosition: 'END_OF_EACH' | 'END_OF_ALL' | 'NONE'
}

interface ValueJudgmentTemplate {
  id?: string
  level: PerformanceLevel
  template: string
  isActive: boolean
}

interface Achievement {
  id: string
  orderNumber: number
  baseDescription: string
  isPromotional: boolean
  studentAchievements?: StudentAchievement[]
}

interface StudentAchievement {
  id: string
  studentEnrollmentId: string
  performanceLevel: PerformanceLevel
  suggestedText?: string
  approvedText?: string
  isTextApproved: boolean
  suggestedJudgment?: string
  approvedJudgment?: string
  isJudgmentApproved: boolean
  observation?: string
  studentEnrollment?: {
    student: {
      firstName: string
      lastName: string
    }
  }
}


const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  SUPERIOR: 'Superior',
  ALTO: 'Alto',
  BASICO: 'Básico',
  BAJO: 'Bajo',
}

const LEVEL_COLORS: Record<PerformanceLevel, string> = {
  SUPERIOR: 'bg-green-100 text-green-700 border-green-200',
  ALTO: 'bg-blue-100 text-blue-700 border-blue-200',
  BASICO: 'bg-amber-100 text-amber-700 border-amber-200',
  BAJO: 'bg-red-100 text-red-700 border-red-200',
}

const DEFAULT_TEMPLATES: ValueJudgmentTemplate[] = [
  { level: 'BAJO', template: 'Se recomienda reforzar los procesos de aprendizaje con acompañamiento constante.', isActive: true },
  { level: 'BASICO', template: 'Debe continuar fortaleciendo sus habilidades para consolidar los aprendizajes.', isActive: true },
  { level: 'ALTO', template: 'Demuestra un buen dominio de las competencias y mantiene un desempeño consistente.', isActive: true },
  { level: 'SUPERIOR', template: 'Demuestra compromiso, autonomía y excelencia en su proceso de aprendizaje.', isActive: true },
]

export default function Achievements() {
  const { user, institution: authInstitution } = useAuth()
  const { periods, selectedPeriod, setSelectedPeriod } = useAcademic()
  
  // Usar el institution del AuthContext que tiene el id real de la BD
  const institutionId = authInstitution?.id
  const [activeTab, setActiveTab] = useState<TabType>('achievements')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Selectors
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')

  // Config
  const [config, setConfig] = useState<AchievementConfig>({
    achievementsPerPeriod: 1,
    usePromotionalAchievement: true,
    useAttitudinalAchievement: false,
    attitudinalMode: 'GENERAL_PER_PERIOD',
    useValueJudgments: true,
    useObservations: false,
    displayMode: 'SEPARATE',
    displayFormat: 'LIST',
    judgmentPosition: 'END_OF_EACH',
  })
  const [templates, setTemplates] = useState<ValueJudgmentTemplate[]>(DEFAULT_TEMPLATES)

  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [editingAchievement, setEditingAchievement] = useState<string | null>(null)
  const [newAchievementText, setNewAchievementText] = useState('')
  const [attitudinalText, setAttitudinalText] = useState('')

  // Students
  const [students, setStudents] = useState<any[]>([])
  const [studentGrades, setStudentGrades] = useState<Record<string, number>>({})
  const [selectedAchievementId, setSelectedAchievementId] = useState<string | null>(null)
  const [studentAchievements, setStudentAchievements] = useState<StudentAchievement[]>([])

  // New: filter, selection, observation templates
  const [filterLevel, setFilterLevel] = useState<PerformanceLevel | 'ALL'>('ALL')
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  // Banco de logros
  const [showBank, setShowBank] = useState(false)
  const [bankItems, setBankItems] = useState<any[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [bankFilter, setBankFilter] = useState<string>('')

  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])

  const isAdmin = userRoles.some((r: string) => 
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r)
  )
  const isTeacher = userRoles.includes('DOCENTE')

  const selectedAssignment = teacherAssignments.find(a => a.id === selectedAssignmentId)

  // Cargar banco de logros
  const loadBank = async () => {
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
  }

  // Guardar logro actual al banco
  const saveToBank = async (description: string) => {
    if (!description.trim()) return
    try {
      await achievementBankApi.create({
        description: description.trim(),
        subjectId: selectedAssignment?.subject?.id,
        achievementType: 'ACADEMIC',
        isShared: true,
      })
      setMessage({ type: 'success', text: 'Logro guardado en el banco' })
      setTimeout(() => setMessage(null), 2000)
      if (showBank) loadBank()
    } catch (err) {
      console.error('Error saving to bank:', err)
    }
  }

  // 1. Cargar años académicos cuando institutionId esté disponible
  useEffect(() => {
    const loadAcademicYears = async () => {
      if (!institutionId) return
      try {
        console.log('[Achievements] 1. Loading academic years for institutionId:', institutionId)
        const response = await academicYearsApi.getAll(institutionId)
        const yearsData = response.data || []
        console.log('[Achievements] Academic years loaded:', yearsData.length)
        setAcademicYears(yearsData)
        
        // Seleccionar año actual o el primero
        const current = yearsData.find((y: any) => y.isCurrent) || yearsData[0]
        if (current) {
          setSelectedYearId(current.id)
        }
      } catch (err) {
        console.error('Error loading academic years:', err)
      }
    }
    loadAcademicYears()
  }, [institutionId])

  // 2. Cuando cambia el año, cargar los períodos de ese año
  useEffect(() => {
    if (!selectedYearId || academicYears.length === 0) {
      setTerms([])
      setSelectedTermId('')
      return
    }
    const selectedYear = academicYears.find((y: any) => y.id === selectedYearId)
    const termsData = selectedYear?.terms || []
    console.log('[Achievements] 2. Terms for year:', termsData.length)
    setTerms(termsData)
    
    // Seleccionar período actual basado en fecha, o el primero
    if (termsData.length > 0) {
      const today = new Date()
      const currentTerm = termsData.find((t: any) => {
        const start = new Date(t.startDate)
        const end = new Date(t.endDate)
        return today >= start && today <= end
      })
      setSelectedTermId((currentTerm || termsData[0]).id)
    } else {
      setSelectedTermId('')
    }
  }, [selectedYearId, academicYears])

  // 3. Cargar asignaturas del docente cuando cambia el año
  useEffect(() => {
    const loadTeacherAssignments = async () => {
      if (!selectedYearId || !institutionId) {
        setTeacherAssignments([])
        setSelectedAssignmentId('')
        return
      }
      try {
        const params: any = { academicYearId: selectedYearId }
        if (isTeacher && user?.id) {
          params.teacherId = user.id
        }
        console.log('[Achievements] 3. Loading assignments with params:', params)
        const response = await teacherAssignmentsApi.getAll(params)
        const assignmentsData = response.data || []
        console.log('[Achievements] Assignments loaded:', assignmentsData.length)
        setTeacherAssignments(assignmentsData)
        
        // Seleccionar primera asignatura
        if (assignmentsData.length > 0) {
          setSelectedAssignmentId(assignmentsData[0].id)
        } else {
          setSelectedAssignmentId('')
        }
      } catch (err) {
        console.error('Error loading teacher assignments:', err)
      }
    }
    loadTeacherAssignments()
  }, [selectedYearId, institutionId, isTeacher, user?.id])

  // 4. Cargar grupos basados en la asignatura seleccionada (o todos si es admin)
  useEffect(() => {
    const loadGroups = async () => {
      if (!institutionId) {
        setGroups([])
        setSelectedGroupId('')
        return
      }
      try {
        console.log('[Achievements] 4. Loading groups for institutionId:', institutionId)
        const response = await groupsApi.getAll({ institutionId })
        const groupsData = response.data || []
        console.log('[Achievements] Groups loaded:', groupsData.length)
        
        // Si hay asignatura seleccionada, filtrar grupos que tengan esa asignatura
        let filteredGroups = groupsData
        if (selectedAssignmentId) {
          const assignment = teacherAssignments.find(a => a.id === selectedAssignmentId)
          if (assignment?.groupId) {
            filteredGroups = groupsData.filter((g: any) => g.id === assignment.groupId)
          }
        }
        
        setGroups(filteredGroups)
        if (filteredGroups.length > 0) {
          setSelectedGroupId(filteredGroups[0].id)
        } else {
          setSelectedGroupId('')
        }
      } catch (err) {
        console.error('Error loading groups:', err)
      }
    }
    loadGroups()
  }, [institutionId, selectedAssignmentId, teacherAssignments])

  // Load config when institution changes
  useEffect(() => {
    const loadConfig = async () => {
      if (!institutionId) return
      try {
        const response = await achievementConfigApi.get(institutionId)
        if (response.data) {
          setConfig({
            achievementsPerPeriod: response.data.achievementsPerPeriod || 1,
            usePromotionalAchievement: response.data.usePromotionalAchievement ?? true,
            useAttitudinalAchievement: response.data.useAttitudinalAchievement ?? false,
            attitudinalMode: response.data.attitudinalMode || 'GENERAL_PER_PERIOD',
            useValueJudgments: response.data.useValueJudgments ?? true,
            useObservations: response.data.useObservations ?? false,
            displayMode: response.data.displayMode || 'SEPARATE',
            displayFormat: response.data.displayFormat || 'LIST',
            judgmentPosition: response.data.judgmentPosition || 'END_OF_EACH',
          })
        }
        
        const templatesResponse = await achievementConfigApi.getTemplates(institutionId)
        if (templatesResponse.data?.length > 0) {
          setTemplates(templatesResponse.data)
        }

      } catch (err) {
        console.error('Error loading config:', err)
      }
    }
    loadConfig()
  }, [institutionId])

  // Load achievements when assignment/term changes
  useEffect(() => {
    const loadAchievements = async () => {
      if (!selectedAssignmentId || !selectedTermId) return
      try {
        const response = await achievementsApi.getByAssignment(selectedAssignmentId, selectedTermId)
        setAchievements(response.data || [])
        
        // Load attitudinal if enabled
        if (config.useAttitudinalAchievement) {
          const attResponse = await achievementsApi.getAttitudinal(selectedAssignmentId, selectedTermId)
          if (attResponse.data?.length > 0) {
            setAttitudinalText(attResponse.data[0].description || '')
          }
        }
      } catch (err) {
        console.error('Error loading achievements:', err)
      }
    }
    loadAchievements()
  }, [selectedAssignmentId, selectedTermId, config.useAttitudinalAchievement])

  // Load students when assignment changes
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedAssignment?.group?.id || !selectedYearId) return
      try {
        // Usar academicStudentsApi para mantener separación de dominios
        const response = await academicStudentsApi.getByGroup({
          groupId: selectedAssignment.group.id,
          academicYearId: selectedYearId,
        })
        // El endpoint académico ya retorna el formato correcto: { id, name, enrollmentId }
        setStudents(response.data || [])

        // Load grades for students
        if (selectedTermId && selectedAssignment?.subject?.id) {
          try {
            const gradesResponse = await periodFinalGradesApi.getByGroup(
              selectedAssignment.group.id,
              selectedTermId
            )
            const gradesMap: Record<string, number> = {}
            gradesResponse.data?.forEach((g: any) => {
              if (g.subjectId === selectedAssignment.subject.id) {
                gradesMap[g.studentEnrollmentId] = Number(g.finalScore)
              }
            })
            setStudentGrades(gradesMap)
          } catch (err) {
            console.error('Error loading grades:', err)
          }
        }
      } catch (err) {
        console.error('Error loading students:', err)
      }
    }
    loadStudents()
  }, [selectedAssignment?.group?.id, selectedYearId, selectedTermId, selectedAssignment?.subject?.id])

  // Load student achievements when achievement is selected
  useEffect(() => {
    const loadStudentAchievements = async () => {
      if (!selectedAchievementId) {
        setStudentAchievements([])
        return
      }
      try {
        const response = await achievementsApi.getStudentAchievements(selectedAchievementId)
        setStudentAchievements(response.data || [])
      } catch (err) {
        console.error('Error loading student achievements:', err)
      }
    }
    loadStudentAchievements()
  }, [selectedAchievementId])

  // Save config
  const handleSaveConfig = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await achievementConfigApi.upsert({
        institutionId,
        ...config,
      })
      await achievementConfigApi.bulkUpsertTemplates({
        institutionId,
        templates: templates.map(t => ({
          level: t.level,
          template: t.template,
          isActive: t.isActive,
        })),
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

  // Create default templates
  const handleCreateDefaultTemplates = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await achievementConfigApi.createDefaultTemplates(institutionId)
      const response = await achievementConfigApi.getTemplates(institutionId)
      setTemplates(response.data || DEFAULT_TEMPLATES)
      setMessage({ type: 'success', text: 'Plantillas por defecto creadas' })
    } catch (err) {
      console.error('Error creating default templates:', err)
      setMessage({ type: 'error', text: 'Error al crear plantillas' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }


  // Create achievement
  const handleCreateAchievement = async () => {
    if (!selectedAssignmentId || !selectedTermId || !newAchievementText.trim()) return
    setSaving(true)
    try {
      const orderNumber = achievements.length + 1
      await achievementsApi.create({
        teacherAssignmentId: selectedAssignmentId,
        academicTermId: selectedTermId,
        orderNumber,
        baseDescription: newAchievementText.trim(),
      })
      setNewAchievementText('')
      // Reload achievements
      const response = await achievementsApi.getByAssignment(selectedAssignmentId, selectedTermId)
      setAchievements(response.data || [])
      setMessage({ type: 'success', text: 'Logro creado correctamente' })
    } catch (err) {
      console.error('Error creating achievement:', err)
      setMessage({ type: 'error', text: 'Error al crear el logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Update achievement
  const handleUpdateAchievement = async (id: string, baseDescription: string) => {
    setSaving(true)
    try {
      await achievementsApi.update(id, { baseDescription })
      setAchievements(prev => prev.map(a => 
        a.id === id ? { ...a, baseDescription } : a
      ))
      setEditingAchievement(null)
      setMessage({ type: 'success', text: 'Logro actualizado' })
    } catch (err) {
      console.error('Error updating achievement:', err)
      setMessage({ type: 'error', text: 'Error al actualizar el logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Delete achievement
  const handleDeleteAchievement = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este logro?')) return
    setSaving(true)
    try {
      await achievementsApi.delete(id)
      setAchievements(prev => prev.filter(a => a.id !== id))
      if (selectedAchievementId === id) {
        setSelectedAchievementId(null)
      }
      setMessage({ type: 'success', text: 'Logro eliminado' })
    } catch (err) {
      console.error('Error deleting achievement:', err)
      setMessage({ type: 'error', text: 'Error al eliminar el logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Helper: get performance level from grade using institution scales
  const getPerformanceLevelFromGrade = (grade: number): PerformanceLevel => {
    // Simple mapping based on common Colombian scale
    if (grade >= 4.6) return 'SUPERIOR'
    if (grade >= 4.0) return 'ALTO'
    if (grade >= 3.0) return 'BASICO'
    return 'BAJO'
  }

  // Filtered students based on performance level
  const filteredStudents = useMemo(() => {
    if (filterLevel === 'ALL') return students
    return students.filter(s => {
      const grade = studentGrades[s.enrollmentId] || 0
      return getPerformanceLevelFromGrade(grade) === filterLevel
    })
  }, [students, studentGrades, filterLevel])

  // Toggle student selection
  const toggleStudentSelection = (enrollmentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev)
      if (next.has(enrollmentId)) next.delete(enrollmentId)
      else next.add(enrollmentId)
      return next
    })
  }

  // Select/deselect all filtered students
  const toggleSelectAll = () => {
    const filteredIds = filteredStudents.map(s => s.enrollmentId)
    const allSelected = filteredIds.every(id => selectedStudentIds.has(id))
    if (allSelected) {
      setSelectedStudentIds(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedStudentIds(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  // BUTTON 1: Assign achievement to all students
  const handleBulkAssignAll = async () => {
    if (!selectedAchievementId || !institutionId) return
    setSaving(true)
    try {
      const enrollmentIds = students.map(s => s.enrollmentId)
      await achievementsApi.bulkAssign({
        achievementId: selectedAchievementId,
        studentEnrollmentIds: enrollmentIds,
        institutionId,
      })
      const response = await achievementsApi.getStudentAchievements(selectedAchievementId)
      setStudentAchievements(response.data || [])
      setMessage({ type: 'success', text: 'Logro asignado a todos los estudiantes' })
    } catch (err) {
      console.error('Error bulk assigning:', err)
      setMessage({ type: 'error', text: 'Error al asignar logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }


  // BUTTON 3: Assign achievement to selected students only
  const handleBulkAssignSelected = async () => {
    if (!selectedAchievementId || !institutionId || selectedStudentIds.size === 0) return
    setSaving(true)
    try {
      await achievementsApi.bulkAssign({
        achievementId: selectedAchievementId,
        studentEnrollmentIds: Array.from(selectedStudentIds),
        institutionId,
      })
      const response = await achievementsApi.getStudentAchievements(selectedAchievementId)
      setStudentAchievements(response.data || [])
      setSelectedStudentIds(new Set())
      setMessage({ type: 'success', text: `Logro asignado a ${selectedStudentIds.size} estudiantes` })
    } catch (err) {
      console.error('Error assigning to selected:', err)
      setMessage({ type: 'error', text: 'Error al asignar logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Update individual observation
  const handleUpdateObservation = async (saId: string, observation: string) => {
    try {
      await achievementsApi.updateObservation(saId, observation)
      setStudentAchievements(prev => prev.map(sa =>
        sa.id === saId ? { ...sa, observation } : sa
      ))
    } catch (err) {
      console.error('Error updating observation:', err)
      setMessage({ type: 'error', text: 'Error al guardar observación' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Approve student achievement
  const handleApproveStudentAchievement = async (sa: StudentAchievement, approvedText: string, approvedJudgment?: string) => {
    setSaving(true)
    try {
      await achievementsApi.approveStudentAchievement(sa.id, {
        approvedText,
        approvedJudgment,
      })
      setStudentAchievements(prev => prev.map(s => 
        s.id === sa.id ? { ...s, approvedText, approvedJudgment, isTextApproved: true, isJudgmentApproved: !!approvedJudgment } : s
      ))
      setMessage({ type: 'success', text: 'Logro aprobado' })
    } catch (err) {
      console.error('Error approving achievement:', err)
      setMessage({ type: 'error', text: 'Error al aprobar el logro' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Save attitudinal achievement
  const handleSaveAttitudinal = async () => {
    if (!selectedAssignmentId || !selectedTermId || !attitudinalText.trim()) return
    setSaving(true)
    try {
      await achievementsApi.upsertAttitudinal({
        teacherAssignmentId: selectedAssignmentId,
        academicTermId: selectedTermId,
        description: attitudinalText.trim(),
      })
      setMessage({ type: 'success', text: 'Logro actitudinal guardado' })
    } catch (err) {
      console.error('Error saving attitudinal:', err)
      setMessage({ type: 'error', text: 'Error al guardar logro actitudinal' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const tabs = [
    { id: 'achievements' as TabType, label: 'Logros Académicos', icon: Target },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Logros y Juicios Valorativos</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestión de logros académicos y juicios por desempeño</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
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

      {activeTab === 'achievements' ? (
        <div className="space-y-6">
          {/* Selectors - Orden: Año (fijo) → Período → Asignatura → Grupo */}
          <div className="flex gap-4 flex-wrap items-center">
            {/* 1. Año Académico (fijo, solo informativo) */}
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 font-medium">
              {academicYears.find(y => y.id === selectedYearId)?.year || 'Cargando...'}
            </div>

            {/* 2. Período */}
            <div className="relative">
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={!selectedYearId}
              >
                <option value="">Seleccionar período</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* 3. Asignatura */}
            <div className="relative">
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={!selectedYearId}
              >
                <option value="">Seleccionar asignatura</option>
                {teacherAssignments.map((ta) => (
                  <option key={ta.id} value={ta.id}>
                    {ta.subject?.name} - {ta.group?.grade?.name} {ta.group?.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* 4. Grupo (opcional, se auto-selecciona con la asignatura) */}
            {isAdmin && (
              <div className="relative">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={!selectedAssignmentId}
                >
                  <option value="">Seleccionar grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.grade?.name} {group.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {selectedAssignmentId && selectedTermId ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Achievements List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-900">Logros del Período</h3>
                  </div>
                  <span className="text-sm text-slate-500">
                    {achievements.length} / {config.achievementsPerPeriod} requeridos
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedAchievementId === achievement.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setSelectedAchievementId(achievement.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-500">
                              Logro {achievement.orderNumber}
                            </span>
                          </div>
                          {editingAchievement === achievement.id ? (
                            <div className="space-y-2">
                              <textarea
                                defaultValue={achievement.baseDescription}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                rows={3}
                                id={`edit-${achievement.id}`}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const textarea = document.getElementById(`edit-${achievement.id}`) as HTMLTextAreaElement
                                    handleUpdateAchievement(achievement.id, textarea.value)
                                  }}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingAchievement(null)
                                  }}
                                  className="px-3 py-1 border border-slate-300 rounded text-sm"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-700">{achievement.baseDescription}</p>
                          )}
                        </div>
                        {editingAchievement !== achievement.id && (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingAchievement(achievement.id)
                              }}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <Edit3 className="w-4 h-4 text-slate-400" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAchievement(achievement.id)
                              }}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {achievements.length < config.achievementsPerPeriod && (
                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg space-y-3">
                      <textarea
                        value={newAchievementText}
                        onChange={(e) => setNewAchievementText(e.target.value)}
                        placeholder="Escriba el texto del logro académico..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={3}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleCreateAchievement}
                          disabled={!newAchievementText.trim() || saving}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Agregar Logro
                        </button>
                        <button
                          onClick={() => { setShowBank(!showBank); if (!showBank) loadBank() }}
                          className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${showBank ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-300 hover:bg-slate-50 text-slate-600'}`}
                        >
                          <Library className="w-4 h-4" />
                          Banco de Logros
                        </button>
                        {newAchievementText.trim() && (
                          <button
                            onClick={() => saveToBank(newAchievementText)}
                            className="flex items-center gap-2 px-3 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm"
                            title="Guardar este texto en el banco para reutilizar"
                          >
                            <Save className="w-3 h-3" />
                            Guardar al banco
                          </button>
                        )}
                      </div>

                      {/* Panel Banco de Logros */}
                      {showBank && (
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Library className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm font-semibold text-slate-800">Banco de Logros</span>
                            <span className="text-xs text-slate-400">Seleccione para usar como texto base</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[180px]">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Buscar..."
                                value={bankSearch}
                                onChange={(e) => setBankSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadBank()}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <select
                              value={bankFilter}
                              onChange={(e) => { setBankFilter(e.target.value); setTimeout(loadBank, 0) }}
                              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5"
                            >
                              <option value="">Todos</option>
                              <option value="ACADEMIC">Académico</option>
                              <option value="ATTITUDINAL">Actitudinal</option>
                            </select>
                            <button onClick={loadBank} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                              Buscar
                            </button>
                          </div>

                          {bankLoading ? (
                            <div className="text-center py-4 text-slate-400 text-xs">Cargando...</div>
                          ) : bankItems.length === 0 ? (
                            <div className="text-center py-4">
                              <Library className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                              <p className="text-xs text-slate-500">No hay logros en el banco</p>
                              <p className="text-[10px] text-slate-400">Escribe un logro y presiona "Guardar al banco" para agregarlo</p>
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1.5">
                              {bankItems.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 bg-white hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer group transition-colors"
                                  onClick={() => {
                                    setNewAchievementText(item.description)
                                    achievementBankApi.markUsed(item.id).catch(() => {})
                                    setMessage({ type: 'success', text: 'Texto del logro insertado' })
                                    setTimeout(() => setMessage(null), 2000)
                                  }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {item.subject && (
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{item.subject.name}</span>
                                      )}
                                      {item.performanceLevel && (
                                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                                          item.performanceLevel === 'SUPERIOR' ? 'bg-green-50 text-green-600' :
                                          item.performanceLevel === 'ALTO' ? 'bg-blue-50 text-blue-600' :
                                          item.performanceLevel === 'BASICO' ? 'bg-amber-50 text-amber-600' :
                                          'bg-red-50 text-red-600'
                                        }`}>{item.performanceLevel}</span>
                                      )}
                                      {item.category && (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">{item.category}</span>
                                      )}
                                    </div>
                                  </div>
                                  <Copy className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 mt-0.5" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attitudinal Achievement */}
                  {config.useAttitudinalAchievement && config.attitudinalMode === 'GENERAL_PER_PERIOD' && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">Logro Actitudinal</span>
                      </div>
                      <textarea
                        value={attitudinalText}
                        onChange={(e) => setAttitudinalText(e.target.value)}
                        placeholder="Escriba el logro actitudinal del período..."
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm mb-2"
                        rows={2}
                      />
                      <button
                        onClick={handleSaveAttitudinal}
                        disabled={!attitudinalText.trim() || saving}
                        className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
                      >
                        Guardar Actitudinal
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Achievements */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-slate-900">Estudiantes</h3>
                    </div>
                  </div>

                  {selectedAchievementId && (
                    <div className="space-y-3">
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleBulkAssignAll}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Users className="w-4 h-4" />
                          Asignar a todos
                        </button>
                        <button
                          onClick={handleBulkAssignSelected}
                          disabled={saving || selectedStudentIds.size === 0}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckSquare className="w-4 h-4" />
                          Asignar a seleccionados ({selectedStudentIds.size})
                        </button>
                      </div>

                      {/* Filter + Select All */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-slate-400" />
                          <select
                            value={filterLevel}
                            onChange={(e) => {
                              setFilterLevel(e.target.value as PerformanceLevel | 'ALL')
                              setSelectedStudentIds(new Set())
                            }}
                            className="px-2 py-1 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="ALL">Todas las escalas</option>
                            <option value="SUPERIOR">Superior</option>
                            <option value="ALTO">Alto</option>
                            <option value="BASICO">Básico</option>
                            <option value="BAJO">Bajo</option>
                          </select>
                        </div>
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1.5 px-2 py-1 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded"
                        >
                          {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.enrollmentId))
                            ? <CheckSquare className="w-4 h-4 text-blue-600" />
                            : <Square className="w-4 h-4" />
                          }
                          Seleccionar todos ({filteredStudents.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {!selectedAchievementId ? (
                    <div className="text-center py-8 text-slate-500">
                      <Target className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p>Seleccione un logro para ver los estudiantes</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {filteredStudents.map((student) => {
                        const sa = studentAchievements.find(
                          s => s.studentEnrollmentId === student.enrollmentId
                        )
                        const grade = studentGrades[student.enrollmentId] || 0
                        const level = getPerformanceLevelFromGrade(grade)
                        const isSelected = selectedStudentIds.has(student.enrollmentId)
                        
                        return (
                          <StudentAchievementCard
                            key={student.id}
                            student={student}
                            grade={grade}
                            level={level}
                            studentAchievement={sa}
                            config={config}
                            isSelected={isSelected}
                            onToggleSelect={() => toggleStudentSelection(student.enrollmentId)}
                            onApprove={handleApproveStudentAchievement}
                            onUpdateObservation={handleUpdateObservation}
                            saving={saving}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Seleccione un grupo, asignatura y período para gestionar los logros</p>
            </div>
          )}
        </div>
      ) : (
        /* Configuration Tab */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Configuración de Logros</h3>

          <div className="space-y-6">
            {/* Basic Config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número de logros por período
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.achievementsPerPeriod}
                  onChange={(e) => setConfig({ ...config, achievementsPerPeriod: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.usePromotionalAchievement}
                    onChange={(e) => setConfig({ ...config, usePromotionalAchievement: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Usar logro promocional (fin de año)</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.useValueJudgments}
                    onChange={(e) => setConfig({ ...config, useValueJudgments: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Habilitar juicios valorativos por desempeño</span>
                </label>
              </div>
            </div>

            {/* Attitudinal Config */}
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-medium text-slate-800 mb-4">Logro Actitudinal</h4>
              
              <label className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={config.useAttitudinalAchievement}
                  onChange={(e) => setConfig({ ...config, useAttitudinalAchievement: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Habilitar logro actitudinal</span>
              </label>

              {config.useAttitudinalAchievement && (
                <div className="ml-7">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Modo del logro actitudinal</label>
                  <select
                    value={config.attitudinalMode}
                    onChange={(e) => setConfig({ ...config, attitudinalMode: e.target.value as any })}
                    className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="GENERAL_PER_PERIOD">Un logro actitudinal general por período</option>
                    <option value="PER_ACADEMIC_ACHIEVEMENT">Un logro actitudinal por cada logro académico</option>
                  </select>
                </div>
              )}
            </div>

            {/* Display Configuration for Report Card */}
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-medium text-slate-800 mb-4">Visualización en Boletín</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Modo de visualización
                  </label>
                  <select
                    value={config.displayMode}
                    onChange={(e) => setConfig({ ...config, displayMode: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="SEPARATE">Académico y Actitudinal separados</option>
                    <option value="COMBINED">Todo en un solo texto combinado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Formato de visualización
                  </label>
                  <select
                    value={config.displayFormat}
                    onChange={(e) => setConfig({ ...config, displayFormat: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="LIST">Lista numerada</option>
                    <option value="PARAGRAPH">Párrafo continuo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Posición del juicio valorativo
                  </label>
                  <select
                    value={config.judgmentPosition}
                    onChange={(e) => setConfig({ ...config, judgmentPosition: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="END_OF_EACH">Al final de cada logro</option>
                    <option value="END_OF_ALL">Al final de todos los logros</option>
                    <option value="NONE">No mostrar</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Value Judgment Templates */}
            {config.useValueJudgments && (
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-800">Plantillas de Juicios Valorativos</h4>
                  <button
                    onClick={handleCreateDefaultTemplates}
                    disabled={saving}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Restaurar por defecto
                  </button>
                </div>

                <div className="space-y-4">
                  {(['BAJO', 'BASICO', 'ALTO', 'SUPERIOR'] as PerformanceLevel[]).map((level) => {
                    const template = templates.find(t => t.level === level) || { level, template: '', isActive: true }
                    return (
                      <div key={level} className="flex items-start gap-4">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${LEVEL_COLORS[level]} min-w-[80px] text-center`}>
                          {LEVEL_LABELS[level]}
                        </span>
                        <textarea
                          value={template.template}
                          onChange={(e) => {
                            setTemplates(prev => {
                              const exists = prev.find(t => t.level === level)
                              if (exists) {
                                return prev.map(t => t.level === level ? { ...t, template: e.target.value } : t)
                              }
                              return [...prev, { level, template: e.target.value, isActive: true }]
                            })
                          }}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          rows={2}
                          placeholder={`Juicio valorativo para desempeño ${LEVEL_LABELS[level]}...`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-800">Observaciones por Estudiante</h4>
                  <p className="text-sm text-slate-500 mt-1">Permite al docente escribir una observación adicional por cada estudiante en el boletín</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.useObservations}
                    onChange={(e) => setConfig({ ...config, useObservations: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-slate-200 pt-6">
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
    </div>
  )
}

// Student Achievement Card Component
function StudentAchievementCard({
  student,
  grade,
  level,
  studentAchievement,
  config,
  isSelected,
  onToggleSelect,
  onApprove,
  onUpdateObservation,
  saving,
}: {
  student: { id: string; name: string; enrollmentId: string }
  grade: number
  level: PerformanceLevel
  studentAchievement?: StudentAchievement
  config: AchievementConfig
  isSelected: boolean
  onToggleSelect: () => void
  onApprove: (sa: StudentAchievement, text: string, judgment?: string) => void
  onUpdateObservation: (saId: string, observation: string) => void
  saving: boolean
}) {
  const [editedText, setEditedText] = useState(studentAchievement?.approvedText || studentAchievement?.suggestedText || '')
  const [editedJudgment, setEditedJudgment] = useState(studentAchievement?.approvedJudgment || studentAchievement?.suggestedJudgment || '')
  const [localObservation, setLocalObservation] = useState(studentAchievement?.observation || '')
  const [isEditing, setIsEditing] = useState(false)
  const [observationTimer, setObservationTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setEditedText(studentAchievement?.approvedText || studentAchievement?.suggestedText || '')
    setEditedJudgment(studentAchievement?.approvedJudgment || studentAchievement?.suggestedJudgment || '')
    setLocalObservation(studentAchievement?.observation || '')
  }, [studentAchievement])

  const handleObservationChange = (value: string) => {
    setLocalObservation(value)
    if (observationTimer) clearTimeout(observationTimer)
    if (studentAchievement) {
      const timer = setTimeout(() => {
        onUpdateObservation(studentAchievement.id, value)
      }, 800)
      setObservationTimer(timer)
    }
  }

  const hasAchievement = !!studentAchievement

  return (
    <div className={`p-3 border rounded-lg transition-colors ${isSelected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-2">
        {/* Checkbox */}
        <button onClick={onToggleSelect} className="flex-shrink-0">
          {isSelected
            ? <CheckSquare className="w-5 h-5 text-blue-600" />
            : <Square className="w-5 h-5 text-slate-300" />
          }
        </button>

        {/* Student info */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-800 text-sm truncate block">{student.name}</span>
        </div>

        {/* Grade + Level */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-slate-500">{grade > 0 ? grade.toFixed(1) : '-'}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[level]}`}>
            {LEVEL_LABELS[level]}
          </span>
          {hasAchievement && (
            <CheckCircle className="w-4 h-4 text-green-500" aria-label="Logro asignado" />
          )}
        </div>
      </div>

      {hasAchievement && (
        <div className="ml-8 space-y-2">
          {/* Approved text / editing */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                rows={2}
              />
              {config.useValueJudgments && (
                <textarea
                  value={editedJudgment}
                  onChange={(e) => setEditedJudgment(e.target.value)}
                  className="w-full px-2 py-1 border border-amber-300 rounded text-sm"
                  rows={2}
                  placeholder="Juicio valorativo..."
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onApprove(studentAchievement!, editedText, editedJudgment)
                    setIsEditing(false)
                  }}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs"
                >
                  <Check className="w-3 h-3" />
                  Aprobar
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-1 border border-slate-300 rounded text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {(studentAchievement!.approvedText || studentAchievement!.suggestedText) && (
                <p className="text-sm text-slate-600">
                  {studentAchievement!.approvedText || studentAchievement!.suggestedText}
                </p>
              )}
              {config.useValueJudgments && (studentAchievement!.approvedJudgment || studentAchievement!.suggestedJudgment) && (
                <p className="text-sm text-amber-700 italic">
                  {studentAchievement!.approvedJudgment || studentAchievement!.suggestedJudgment}
                </p>
              )}
              <div className="flex items-center gap-2">
                {studentAchievement!.isTextApproved ? (
                  <>
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      Aprobado
                    </span>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                    >
                      <Edit3 className="w-3 h-3" />
                      Re-editar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                  >
                    <Edit3 className="w-3 h-3" />
                    Editar y Aprobar
                  </button>
                )}
              </div>
            </>
          )}

          {/* Observation field - solo si está habilitado en config */}
          {config.useObservations && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Observación (boletín)</label>
              <textarea
                value={localObservation}
                onChange={(e) => handleObservationChange(e.target.value)}
                placeholder="Escriba la observación del estudiante..."
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {!hasAchievement && (
        <p className="ml-8 text-sm text-slate-400 italic">Sin logro asignado</p>
      )}
    </div>
  )
}
