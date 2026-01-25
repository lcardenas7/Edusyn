import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useInstitution } from '../contexts/InstitutionContext'
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
  Sparkles,
  Check,
  X,
  Target,
  Heart,
} from 'lucide-react'
import {
  academicYearsApi,
  groupsApi,
  teacherAssignmentsApi,
  achievementConfigApi,
  achievementsApi,
  periodFinalGradesApi,
  studentsApi,
} from '../lib/api'

type TabType = 'achievements' | 'config'
type PerformanceLevel = 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR'

interface AchievementConfig {
  achievementsPerPeriod: number
  usePromotionalAchievement: boolean
  useAttitudinalAchievement: boolean
  attitudinalMode: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT'
  useValueJudgments: boolean
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
  const { user } = useAuth()
  const { institution, periods, selectedPeriod, setSelectedPeriod } = useInstitution()
  const [activeTab, setActiveTab] = useState<TabType>('achievements')
  const [loading, setLoading] = useState(true)
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

  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])

  const isAdmin = userRoles.some((r: string) => 
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r)
  )
  const isTeacher = userRoles.includes('DOCENTE')

  const selectedAssignment = teacherAssignments.find(a => a.id === selectedAssignmentId)

  // Load academic years
  useEffect(() => {
    const loadAcademicYears = async () => {
      try {
        const response = await academicYearsApi.getAll()
        setAcademicYears(response.data)
        const current = response.data.find((y: any) => y.isCurrent)
        if (current) {
          setSelectedYearId(current.id)
          setTerms(current.terms || [])
          if (current.terms?.length > 0) {
            setSelectedTermId(current.terms[0].id)
          }
        }
      } catch (err) {
        console.error('Error loading academic years:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAcademicYears()
  }, [])

  // Load groups when year changes
  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedYearId) return
      try {
        const response = await groupsApi.getAll()
        setGroups(response.data)
      } catch (err) {
        console.error('Error loading groups:', err)
      }
    }
    loadGroups()
  }, [selectedYearId])

  // Load config when institution changes
  useEffect(() => {
    const loadConfig = async () => {
      if (!institution?.id) return
      try {
        const response = await achievementConfigApi.get(institution.id)
        if (response.data) {
          setConfig({
            achievementsPerPeriod: response.data.achievementsPerPeriod || 1,
            usePromotionalAchievement: response.data.usePromotionalAchievement ?? true,
            useAttitudinalAchievement: response.data.useAttitudinalAchievement ?? false,
            attitudinalMode: response.data.attitudinalMode || 'GENERAL_PER_PERIOD',
            useValueJudgments: response.data.useValueJudgments ?? true,
          })
        }
        
        const templatesResponse = await achievementConfigApi.getTemplates(institution.id)
        if (templatesResponse.data?.length > 0) {
          setTemplates(templatesResponse.data)
        }
      } catch (err) {
        console.error('Error loading config:', err)
      }
    }
    loadConfig()
  }, [institution?.id])

  // Load teacher assignments when group changes
  useEffect(() => {
    const loadTeacherAssignments = async () => {
      if (!selectedGroupId || !selectedYearId) return
      try {
        const params: any = { groupId: selectedGroupId, academicYearId: selectedYearId }
        if (isTeacher && user?.id) {
          params.teacherId = user.id
        }
        const response = await teacherAssignmentsApi.getAll(params)
        setTeacherAssignments(response.data)
        if (response.data.length > 0) {
          setSelectedAssignmentId(response.data[0].id)
        }
      } catch (err) {
        console.error('Error loading teacher assignments:', err)
      }
    }
    loadTeacherAssignments()
  }, [selectedGroupId, selectedYearId, isTeacher, user?.id])

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
        const response = await studentsApi.getAll({
          groupId: selectedAssignment.group.id,
          academicYearId: selectedYearId,
        })
        const data = response.data || []
        const mappedStudents = data.map((item: any) => {
          if (item.student) {
            return {
              id: item.student.id,
              name: `${item.student.firstName} ${item.student.lastName}`,
              enrollmentId: item.id,
            }
          }
          return {
            id: item.id,
            name: `${item.firstName} ${item.lastName}`,
            enrollmentId: item.enrollments?.[0]?.id || item.id,
          }
        })
        setStudents(mappedStudents)

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
    if (!institution?.id) return
    setSaving(true)
    try {
      await achievementConfigApi.upsert({
        institutionId: institution.id,
        ...config,
      })
      await achievementConfigApi.bulkUpsertTemplates({
        institutionId: institution.id,
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
    if (!institution?.id) return
    setSaving(true)
    try {
      await achievementConfigApi.createDefaultTemplates(institution.id)
      const response = await achievementConfigApi.getTemplates(institution.id)
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

  // Generate suggestions for all students
  const handleGenerateSuggestions = async () => {
    if (!selectedAchievementId || !institution?.id) return
    setSaving(true)
    try {
      const studentGradesArray = students.map(s => ({
        studentEnrollmentId: s.enrollmentId,
        finalGrade: studentGrades[s.enrollmentId] || 0,
      }))
      
      await achievementsApi.generateSuggestions({
        achievementId: selectedAchievementId,
        institutionId: institution.id,
        studentGrades: studentGradesArray,
      })
      
      // Reload student achievements
      const response = await achievementsApi.getStudentAchievements(selectedAchievementId)
      setStudentAchievements(response.data || [])
      setMessage({ type: 'success', text: 'Sugerencias generadas correctamente' })
    } catch (err) {
      console.error('Error generating suggestions:', err)
      setMessage({ type: 'error', text: 'Error al generar sugerencias' })
    } finally {
      setSaving(false)
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
          {/* Selectors */}
          <div className="flex gap-4 flex-wrap">
            <div className="relative">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

            <div className="relative">
              <select
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Seleccionar asignatura</option>
                {teacherAssignments.map((ta) => (
                  <option key={ta.id} value={ta.id}>
                    {ta.subject?.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg">
                      <textarea
                        value={newAchievementText}
                        onChange={(e) => setNewAchievementText(e.target.value)}
                        placeholder="Escriba el texto del logro académico..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
                        rows={3}
                      />
                      <button
                        onClick={handleCreateAchievement}
                        disabled={!newAchievementText.trim() || saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Logro
                      </button>
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
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-slate-900">Logros por Estudiante</h3>
                  </div>
                  {selectedAchievementId && (
                    <button
                      onClick={handleGenerateSuggestions}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generar Sugerencias
                    </button>
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
                      {students.map((student) => {
                        const sa = studentAchievements.find(
                          s => s.studentEnrollmentId === student.enrollmentId
                        )
                        const grade = studentGrades[student.enrollmentId] || 0
                        
                        return (
                          <StudentAchievementCard
                            key={student.id}
                            student={student}
                            grade={grade}
                            studentAchievement={sa}
                            config={config}
                            onApprove={handleApproveStudentAchievement}
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
  studentAchievement,
  config,
  onApprove,
  saving,
}: {
  student: { id: string; name: string; enrollmentId: string }
  grade: number
  studentAchievement?: StudentAchievement
  config: AchievementConfig
  onApprove: (sa: StudentAchievement, text: string, judgment?: string) => void
  saving: boolean
}) {
  const [editedText, setEditedText] = useState(studentAchievement?.suggestedText || '')
  const [editedJudgment, setEditedJudgment] = useState(studentAchievement?.suggestedJudgment || '')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setEditedText(studentAchievement?.approvedText || studentAchievement?.suggestedText || '')
    setEditedJudgment(studentAchievement?.approvedJudgment || studentAchievement?.suggestedJudgment || '')
  }, [studentAchievement])

  const level = studentAchievement?.performanceLevel

  return (
    <div className="p-3 border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-slate-800">{student.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Nota: {grade > 0 ? grade.toFixed(1) : '-'}</span>
          {level && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[level]}`}>
              {LEVEL_LABELS[level]}
            </span>
          )}
        </div>
      </div>

      {studentAchievement ? (
        <div className="space-y-2">
          {isEditing ? (
            <>
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
                    onApprove(studentAchievement, editedText, editedJudgment)
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
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {studentAchievement.approvedText || studentAchievement.suggestedText || 'Sin texto generado'}
              </p>
              {config.useValueJudgments && (studentAchievement.approvedJudgment || studentAchievement.suggestedJudgment) && (
                <p className="text-sm text-amber-700 italic">
                  {studentAchievement.approvedJudgment || studentAchievement.suggestedJudgment}
                </p>
              )}
              <div className="flex items-center gap-2">
                {studentAchievement.isTextApproved ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Aprobado
                  </span>
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
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">Genere sugerencias para ver el logro</p>
      )}
    </div>
  )
}
