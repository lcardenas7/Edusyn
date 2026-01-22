import { useState, useEffect } from 'react'
import { 
  Building2, 
  BookOpen, 
  Calendar, 
  Settings, 
  ChevronRight,
  ChevronDown,
  Percent,
  GraduationCap,
  Clock,
  Save,
  Plus,
  Edit2,
  Trash2,
  X,
  UsersRound,
  Lock,
  Unlock,
  CalendarClock,
  RefreshCw,
  AlertTriangle,
  Eye
} from 'lucide-react'
import { useInstitution, Period, AcademicLevel, GradingScaleType } from '../contexts/InstitutionContext'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions, PERMISSIONS } from '../hooks/usePermissions'
import { gradingPeriodConfigApi, recoveryPeriodConfigApi, academicYearsApi, academicYearLifecycleApi } from '../lib/api'

type TabType = 'general' | 'academic-levels' | 'grading' | 'periods' | 'grades' | 'grading-windows' | 'recovery-windows'

interface GradingPeriodConfig {
  id: string
  name: string
  order: number
  isOpen: boolean
  openDate: string | null
  closeDate: string | null
  allowLateEntry: boolean
  lateEntryDays: number
}

interface Grade {
  id: string
  name: string
  level: string // Código del nivel académico (dinámico)
  order: number
  groups: Group[]
}

interface Group {
  id: string
  name: string
  shift: 'MAÑANA' | 'TARDE' | 'UNICA'
  capacity: number
  director?: string
}

const defaultGrades: Grade[] = [
  { id: 'g1', name: 'Transición', level: 'PREESCOLAR', order: 0, groups: [{ id: 'gr1', name: 'A', shift: 'MAÑANA', capacity: 30 }] },
  { id: 'g2', name: 'Primero', level: 'PRIMARIA', order: 1, groups: [{ id: 'gr2', name: 'A', shift: 'MAÑANA', capacity: 35 }, { id: 'gr3', name: 'B', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g3', name: 'Segundo', level: 'PRIMARIA', order: 2, groups: [{ id: 'gr4', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g4', name: 'Tercero', level: 'PRIMARIA', order: 3, groups: [{ id: 'gr5', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g5', name: 'Cuarto', level: 'PRIMARIA', order: 4, groups: [{ id: 'gr6', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g6', name: 'Quinto', level: 'PRIMARIA', order: 5, groups: [{ id: 'gr7', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g7', name: 'Sexto', level: 'SECUNDARIA', order: 6, groups: [{ id: 'gr8', name: 'A', shift: 'MAÑANA', capacity: 40 }, { id: 'gr9', name: 'B', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g8', name: 'Séptimo', level: 'SECUNDARIA', order: 7, groups: [{ id: 'gr10', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g9', name: 'Octavo', level: 'SECUNDARIA', order: 8, groups: [{ id: 'gr11', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g10', name: 'Noveno', level: 'SECUNDARIA', order: 9, groups: [{ id: 'gr12', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g11', name: 'Décimo', level: 'MEDIA', order: 10, groups: [{ id: 'gr13', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g12', name: 'Undécimo', level: 'MEDIA', order: 11, groups: [{ id: 'gr14', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
]

const defaultLevelLabels: Record<string, string> = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  MEDIA: 'Media',
}

const defaultLevelColors: Record<string, string> = {
  PREESCOLAR: 'bg-pink-100 text-pink-700 border-pink-200',
  PRIMARIA: 'bg-blue-100 text-blue-700 border-blue-200',
  SECUNDARIA: 'bg-green-100 text-green-700 border-green-200',
  MEDIA: 'bg-purple-100 text-purple-700 border-purple-200',
}

// Colores adicionales para niveles personalizados
const extraLevelColors = [
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-orange-100 text-orange-700 border-orange-200',
]

// Helper para obtener label de nivel (dinámico o default)
function getLevelLabel(levelCode: string, academicLevels: AcademicLevel[]): string {
  const level = academicLevels.find(l => l.code === levelCode)
  if (level) return level.name
  return defaultLevelLabels[levelCode] || levelCode
}

// Helper para obtener color de nivel (dinámico o default)
function getLevelColor(levelCode: string, academicLevels: AcademicLevel[]): string {
  if (defaultLevelColors[levelCode]) {
    return defaultLevelColors[levelCode]
  }
  // Asignar color basado en el índice del nivel
  const levelIndex = academicLevels.findIndex(l => l.code === levelCode)
  if (levelIndex >= 0) {
    return extraLevelColors[levelIndex % extraLevelColors.length]
  }
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function Institution() {
  const { 
    institution, setInstitution, 
    gradingConfig, setGradingConfig, 
    periods, setPeriods,
    saveGradingConfigToAPI, saveAcademicLevelsToAPI, savePeriodsToAPI,
    loadPeriodsFromActiveYear,
    isSaving 
  } = useInstitution()
  const { institution: authInstitution } = useAuth()
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISOS - Determinar qué puede hacer el usuario en cada sección
  // ═══════════════════════════════════════════════════════════════════════════
  const canEditInfo = can(PERMISSIONS.CONFIG_INFO_EDIT)
  const canEditGradingScale = can(PERMISSIONS.CONFIG_GRADING_EDIT_SCALE)
  const canEditGradingLevels = can(PERMISSIONS.CONFIG_GRADING_EDIT_LEVELS)
  const _canEditGradingWeights = can(PERMISSIONS.CONFIG_GRADING_EDIT_WEIGHTS)
  const canEditPeriods = can(PERMISSIONS.CONFIG_PERIODS_EDIT)
  const _canTogglePeriods = can(PERMISSIONS.CONFIG_PERIODS_TOGGLE)
  const _canEditGradeWindowsDates = can(PERMISSIONS.CONFIG_GRADE_WINDOWS_DATES)
  const _canEditGradeWindowsRules = can(PERMISSIONS.CONFIG_GRADE_WINDOWS_RULES)
  const _canEditRecoveryDates = can(PERMISSIONS.CONFIG_RECOVERY_DATES)
  const _canEditRecoveryRules = can(PERMISSIONS.CONFIG_RECOVERY_RULES)
  const canEditGrades = can(PERMISSIONS.CONFIG_GRADES_EDIT)

  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [periodForm, setPeriodForm] = useState({ name: '', weight: 25, startDate: '', endDate: '' })

  const [grades, setGrades] = useState<Grade[]>(() => {
    // Cargar grados desde localStorage con clave específica por institución
    const institutionId = authInstitution?.id || 'default'
    const saved = localStorage.getItem(`edusyn_grades_${institutionId}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    // Si no hay datos guardados, inicializar vacío (el usuario creará los grados)
    return []
  })
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [gradeForm, setGradeForm] = useState({ name: '', level: '', order: 0 })
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{ gradeId: string; group: Group | null }>(null!)
  const [groupForm, setGroupForm] = useState({ name: '', shift: 'MAÑANA' as Group['shift'], capacity: 35, director: '' })
  const [expandedGrades, setExpandedGrades] = useState<string[]>([])

  // Estado para configuración de ventanas de calificaciones
  const [gradingPeriods, setGradingPeriods] = useState<GradingPeriodConfig[]>([])
  const [loadingGradingPeriods, setLoadingGradingPeriods] = useState(false)
  const [savingPeriod, setSavingPeriod] = useState<string | null>(null)
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: number; status?: string }>>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [activeYearStatus, setActiveYearStatus] = useState<'DRAFT' | 'ACTIVE' | 'CLOSED' | null>(null)

  // Cargar años académicos
  useEffect(() => {
    const fetchAcademicYears = async () => {
      if (!authInstitution?.id) return
      try {
        const response = await academicYearsApi.getAll(authInstitution.id)
        const years = response.data || []
        setAcademicYears(years)
        if (years.length > 0) {
          // Seleccionar el año más reciente
          const latestYear = years.sort((a: any, b: any) => b.year - a.year)[0]
          setSelectedAcademicYear(latestYear.id)
        }
      } catch (err) {
        console.error('Error loading academic years:', err)
      }
    }
    fetchAcademicYears()
  }, [authInstitution?.id])

  // Cargar períodos y estado desde el año académico activo al iniciar
  useEffect(() => {
    const loadActiveYear = async () => {
      if (!authInstitution?.id) return
      try {
        const response = await academicYearLifecycleApi.getCurrent(authInstitution.id)
        if (response.data) {
          setActiveYearStatus(response.data.status as 'DRAFT' | 'ACTIVE' | 'CLOSED')
        }
        loadPeriodsFromActiveYear(authInstitution.id)
      } catch (error) {
        console.error('Error loading active year:', error)
      }
    }
    loadActiveYear()
  }, [authInstitution?.id, loadPeriodsFromActiveYear])

  // Cargar configuración de períodos cuando cambia el año académico
  useEffect(() => {
    const fetchGradingPeriods = async () => {
      if (!selectedAcademicYear) return
      setLoadingGradingPeriods(true)
      try {
        const response = await gradingPeriodConfigApi.getByAcademicYear(selectedAcademicYear)
        const data = response.data || []
        setGradingPeriods(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          order: p.order,
          isOpen: p.config?.isOpen || false,
          openDate: p.config?.openDate ? new Date(p.config.openDate).toISOString().split('T')[0] : null,
          closeDate: p.config?.closeDate ? new Date(p.config.closeDate).toISOString().split('T')[0] : null,
          allowLateEntry: p.config?.allowLateEntry || false,
          lateEntryDays: p.config?.lateEntryDays || 0,
        })))
      } catch (err) {
        console.error('Error loading grading periods:', err)
      } finally {
        setLoadingGradingPeriods(false)
      }
    }
    fetchGradingPeriods()
  }, [selectedAcademicYear])

  // Guardar configuración de un período
  const saveGradingPeriodConfig = async (periodId: string, config: Partial<GradingPeriodConfig>) => {
    setSavingPeriod(periodId)
    try {
      await gradingPeriodConfigApi.updateConfig(periodId, {
        isOpen: config.isOpen ?? false,
        openDate: config.openDate || null,
        closeDate: config.closeDate || null,
        allowLateEntry: config.allowLateEntry,
        lateEntryDays: config.lateEntryDays,
      })
      // Actualizar estado local
      setGradingPeriods(prev => prev.map(p => 
        p.id === periodId ? { ...p, ...config } : p
      ))
    } catch (err) {
      console.error('Error saving grading period config:', err)
    } finally {
      setSavingPeriod(null)
    }
  }

  // Estado para configuración de ventanas de recuperaciones
  const [recoveryPeriods, setRecoveryPeriods] = useState<GradingPeriodConfig[]>([])
  const [loadingRecoveryPeriods, setLoadingRecoveryPeriods] = useState(false)
  const [savingRecoveryPeriod, setSavingRecoveryPeriod] = useState<string | null>(null)

  // Cargar configuración de recuperaciones cuando cambia el año académico
  useEffect(() => {
    const fetchRecoveryPeriods = async () => {
      if (!selectedAcademicYear) return
      setLoadingRecoveryPeriods(true)
      try {
        const response = await recoveryPeriodConfigApi.getByAcademicYear(selectedAcademicYear)
        const data = response.data || []
        setRecoveryPeriods(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          order: p.order,
          isOpen: p.config?.isOpen || false,
          openDate: p.config?.openDate ? new Date(p.config.openDate).toISOString().split('T')[0] : null,
          closeDate: p.config?.closeDate ? new Date(p.config.closeDate).toISOString().split('T')[0] : null,
          allowLateEntry: p.config?.allowLateEntry || false,
          lateEntryDays: p.config?.lateEntryDays || 0,
        })))
      } catch (err) {
        console.error('Error loading recovery periods:', err)
      } finally {
        setLoadingRecoveryPeriods(false)
      }
    }
    fetchRecoveryPeriods()
  }, [selectedAcademicYear])

  // Guardar configuración de recuperación de un período
  const saveRecoveryPeriodConfig = async (periodId: string, config: Partial<GradingPeriodConfig>) => {
    setSavingRecoveryPeriod(periodId)
    try {
      await recoveryPeriodConfigApi.updateConfig(periodId, {
        isOpen: config.isOpen ?? false,
        openDate: config.openDate || null,
        closeDate: config.closeDate || null,
        allowLateEntry: config.allowLateEntry,
        lateEntryDays: config.lateEntryDays,
      })
      setRecoveryPeriods(prev => prev.map(p => 
        p.id === periodId ? { ...p, ...config } : p
      ))
    } catch (err) {
      console.error('Error saving recovery period config:', err)
    } finally {
      setSavingRecoveryPeriod(null)
    }
  }

  // Guardar períodos y recargar años académicos para ventanas de calificación
  const [savingPeriods, setSavingPeriods] = useState(false)
  const handleSavePeriodsAndSync = async () => {
    setSavingPeriods(true)
    try {
      const success = await savePeriodsToAPI()
      if (success) {
        // Recargar años académicos después de guardar períodos
        if (authInstitution?.id) {
          const response = await academicYearsApi.getAll(authInstitution.id)
          const years = response.data || []
          setAcademicYears(years)
          if (years.length > 0) {
            const latestYear = years.sort((a: any, b: any) => b.year - a.year)[0]
            setSelectedAcademicYear(latestYear.id)
          }
        }
        alert('✅ Períodos guardados correctamente. Las ventanas de calificación y recuperación ahora mostrarán estos períodos.')
      } else {
        alert('❌ Error al guardar los períodos. Intente de nuevo.')
      }
    } catch (err) {
      console.error('Error saving periods:', err)
      alert('❌ Error al guardar los períodos. Intente de nuevo.')
    } finally {
      setSavingPeriods(false)
    }
  }

  const tabs = [
    { id: 'general' as TabType, name: 'Información General', icon: Building2 },
    { id: 'academic-levels' as TabType, name: 'Niveles y Calendario', icon: GraduationCap },
    { id: 'grading' as TabType, name: 'Sistema de Calificación', icon: Percent },
    { id: 'periods' as TabType, name: 'Períodos Académicos', icon: Calendar },
    { id: 'grading-windows' as TabType, name: 'Ventanas de Calificación', icon: CalendarClock },
    { id: 'recovery-windows' as TabType, name: 'Ventanas de Recuperación', icon: RefreshCw },
    { id: 'grades' as TabType, name: 'Grados y Grupos', icon: UsersRound },
  ]

  const openPeriodModal = (period?: Period) => {
    if (period) {
      setEditingPeriod(period)
      setPeriodForm({ name: period.name, weight: period.weight, startDate: period.startDate, endDate: period.endDate })
    } else {
      setEditingPeriod(null)
      setPeriodForm({ name: `Período ${periods.length + 1}`, weight: 25, startDate: '', endDate: '' })
    }
    setShowPeriodModal(true)
  }

  const savePeriod = () => {
    if (!periodForm.name.trim()) return
    
    if (editingPeriod) {
      setPeriods(periods.map(p => p.id === editingPeriod.id ? { ...p, ...periodForm } : p))
    } else {
      setPeriods([...periods, { id: `period-${Date.now()}`, ...periodForm }])
    }
    setShowPeriodModal(false)
  }

  const deletePeriod = (id: string) => {
    if (periods.length <= 1) return
    setPeriods(periods.filter(p => p.id !== id))
  }

  const toggleGradeExpand = (gradeId: string) => {
    setExpandedGrades(prev => 
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    )
  }

  const openGradeModal = (grade?: Grade) => {
    if (grade) {
      setEditingGrade(grade)
      setGradeForm({ name: grade.name, level: grade.level, order: grade.order })
    } else {
      setEditingGrade(null)
      // Usar el primer nivel académico disponible como default
      const defaultLevel = institution.academicLevels[0]?.code || ''
      setGradeForm({ name: '', level: defaultLevel, order: grades.length })
    }
    setShowGradeModal(true)
  }

  const saveGrade = () => {
    if (!gradeForm.name.trim()) return
    if (editingGrade) {
      setGrades(grades.map(g => g.id === editingGrade.id ? { ...g, ...gradeForm } : g))
    } else {
      setGrades([...grades, { id: `grade-${Date.now()}`, ...gradeForm, groups: [] }])
    }
    setShowGradeModal(false)
  }

  const deleteGrade = (id: string) => {
    setGrades(grades.filter(g => g.id !== id))
  }

  const openGroupModal = (gradeId: string, group?: Group) => {
    if (group) {
      setEditingGroup({ gradeId, group })
      setGroupForm({ name: group.name, shift: group.shift, capacity: group.capacity, director: group.director || '' })
    } else {
      setEditingGroup({ gradeId, group: null })
      const grade = grades.find(g => g.id === gradeId)
      const nextLetter = String.fromCharCode(65 + (grade?.groups.length || 0))
      setGroupForm({ name: nextLetter, shift: 'MAÑANA', capacity: 35, director: '' })
    }
    setShowGroupModal(true)
  }

  const saveGroup = () => {
    if (!groupForm.name.trim() || !editingGroup) return
    const newGroup: Group = {
      id: editingGroup.group?.id || `group-${Date.now()}`,
      ...groupForm
    }
    setGrades(grades.map(g => {
      if (g.id !== editingGroup.gradeId) return g
      if (editingGroup.group) {
        return { ...g, groups: g.groups.map(gr => gr.id === editingGroup.group!.id ? newGroup : gr) }
      } else {
        return { ...g, groups: [...g.groups, newGroup] }
      }
    }))
    setShowGroupModal(false)
  }

  const deleteGroup = (gradeId: string, groupId: string) => {
    setGrades(grades.map(g => 
      g.id === gradeId ? { ...g, groups: g.groups.filter(gr => gr.id !== groupId) } : g
    ))
  }

  // gradesByLevel ya no se usa - ahora se filtra dinámicamente en el render

  // Persistir grados en localStorage cuando cambien (con clave específica por institución)
  useEffect(() => {
    const institutionId = authInstitution?.id || 'default'
    localStorage.setItem(`edusyn_grades_${institutionId}`, JSON.stringify(grades))
  }, [grades, authInstitution?.id])

  const totalProcessWeight = gradingConfig.evaluationProcesses.reduce((sum, p) => sum + p.weightPercentage, 0)
  const totalPeriodWeight = periods.reduce((sum, p) => sum + p.weight, 0)

  // Estado para mensajes y confirmaciones
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [pendingChanges, setPendingChanges] = useState(false)
  const [isLocalSaving, setIsLocalSaving] = useState(false)

  // Detectar cambios pendientes (usado para indicador visual)
  useEffect(() => {
    setPendingChanges(true)
  }, [institution, gradingConfig, periods])

  // Log para evitar warning de variable no usada
  if (pendingChanges) { /* cambios pendientes */ }

  // Función para guardar cambios
  const handleSaveChanges = async () => {
    setIsLocalSaving(true)
    try {
      // Los cambios ya se guardan automáticamente en localStorage por el contexto
      // Aquí podríamos agregar llamada al backend en el futuro
      
      // Simular guardado
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setSaveMessage({ type: 'success', text: '¡Configuración guardada exitosamente!' })
      setPendingChanges(false)
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSaveMessage(null), 3000)
    } catch {
      setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setIsLocalSaving(false)
    }
  }

  const confirmCriticalChange = () => {
    setShowWarningModal(false)
  }

  return (
    <div>
      {/* Modal de advertencia */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Advertencia</h3>
            </div>
            <p className="text-slate-600 mb-4">
              Ya existen notas registradas con la configuración actual. 
              Cambiar el número de notas o los procesos evaluativos puede afectar 
              las calificaciones existentes.
            </p>
            <p className="text-slate-600 mb-6 font-medium">
              ¿Deseas continuar con el cambio?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarningModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCriticalChange}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración Institucional</h1>
          <p className="text-slate-500 mt-1">Administra la configuración académica de tu institución</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              saveMessage.type === 'success' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {saveMessage.type === 'success' ? '✓' : '✗'} {saveMessage.text}
            </div>
          )}
          <button
            onClick={() => window.location.href = '/academic-year-wizard'}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Wizard Año Lectivo
          </button>
          <button 
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banner de Estado del Año - Restricciones de Edición */}
      {activeYearStatus && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
          activeYearStatus === 'DRAFT' ? 'bg-amber-50 border border-amber-200' :
          activeYearStatus === 'ACTIVE' ? 'bg-green-50 border border-green-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              activeYearStatus === 'DRAFT' ? 'bg-amber-500' :
              activeYearStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' :
              'bg-red-500'
            }`} />
            <div>
              <p className={`text-sm font-medium ${
                activeYearStatus === 'DRAFT' ? 'text-amber-800' :
                activeYearStatus === 'ACTIVE' ? 'text-green-800' :
                'text-red-800'
              }`}>
                Año en estado: <strong>{
                  activeYearStatus === 'DRAFT' ? 'Borrador' :
                  activeYearStatus === 'ACTIVE' ? 'Activo' :
                  'Cerrado'
                }</strong>
              </p>
              <p className={`text-xs ${
                activeYearStatus === 'DRAFT' ? 'text-amber-600' :
                activeYearStatus === 'ACTIVE' ? 'text-green-600' :
                'text-red-600'
              }`}>
                {activeYearStatus === 'DRAFT' && 'Toda la configuración es editable. Active el año cuando esté listo.'}
                {activeYearStatus === 'ACTIVE' && 'Algunos cambios están restringidos para proteger datos existentes.'}
                {activeYearStatus === 'CLOSED' && 'El año está cerrado. Solo lectura. Correcciones requieren Acta Académica.'}
              </p>
            </div>
          </div>
          {activeYearStatus === 'CLOSED' && (
            <Lock className="w-5 h-5 text-red-500" />
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar de tabs */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Configuración</span>
              </div>
            </div>
            <nav className="p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.name}
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${activeTab === tab.id ? 'rotate-90' : ''}`} />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Tab: Información General */}
            {activeTab === 'general' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Información General</h2>
                    <p className="text-sm text-slate-500">Datos básicos de la institución</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded ml-auto">
                    <Eye className="w-3 h-3" /> Solo lectura
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Institución</label>
                    <input
                      type="text"
                      value={institution.name}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
                    <input
                      type="text"
                      value={institution.nit}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, nit: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Código DANE</label>
                    <input
                      type="text"
                      value={institution.dane}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, dane: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rector(a)</label>
                    <input
                      type="text"
                      value={institution.rector}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, rector: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={institution.address}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={institution.city}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, city: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={institution.phone}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={institution.email}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico Actual</label>
                    <input
                      type="number"
                      value={institution.academicYear}
                      onChange={(e) => canEditInfo && setInstitution({ ...institution, academicYear: parseInt(e.target.value) || institution.academicYear })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly={!canEditInfo}
                      disabled={!canEditInfo}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Niveles Académicos y Calendario */}
            {activeTab === 'academic-levels' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Niveles Académicos y Calendario</h2>
                    <p className="text-sm text-slate-500">Configura el calendario y los niveles con su sistema de calificación</p>
                  </div>
                </div>

                {/* Calendario Académico */}
                <div className="mb-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-900">Calendario Académico</h3>
                    {!canEditGradingLevels && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        <Eye className="w-3 h-3" /> Solo lectura
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all flex-1 ${
                      institution.academicCalendar === 'A' ? 'border-blue-500 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                      <input
                        type="radio"
                        name="calendar"
                        checked={institution.academicCalendar === 'A'}
                        onChange={() => canEditGradingLevels && setInstitution({ ...institution, academicCalendar: 'A' })}
                        disabled={!canEditGradingLevels}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-slate-900">Calendario A</div>
                        <div className="text-sm text-slate-500">Febrero - Noviembre</div>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all flex-1 ${
                      institution.academicCalendar === 'B' ? 'border-blue-500 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
                    } ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
                      <input
                        type="radio"
                        name="calendar"
                        checked={institution.academicCalendar === 'B'}
                        onChange={() => canEditGradingLevels && setInstitution({ ...institution, academicCalendar: 'B' })}
                        disabled={!canEditGradingLevels}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-slate-900">Calendario B</div>
                        <div className="text-sm text-slate-500">Septiembre - Junio</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Niveles Académicos */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-slate-900">Niveles Académicos</h3>
                      {!canEditGradingLevels && (
                        <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          <Eye className="w-3 h-3" /> Solo lectura
                        </span>
                      )}
                    </div>
                    {canEditGradingLevels && (
                      <button
                        onClick={() => {
                          const defaultPerfLevels = [
                            { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
                            { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
                            { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
                            { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
                          ]
                          const newLevel: AcademicLevel = {
                            id: `lvl-${Date.now()}`,
                            name: 'Nuevo Nivel',
                            code: 'NUEVO',
                            order: institution.academicLevels.length,
                            gradingScaleType: 'NUMERIC_1_5',
                            minGrade: 1.0,
                            maxGrade: 5.0,
                            minPassingGrade: 3.0,
                            grades: [],
                            performanceLevels: defaultPerfLevels,
                          }
                          setInstitution({
                            ...institution,
                            academicLevels: [...institution.academicLevels, newLevel],
                          })
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Nivel
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {institution.academicLevels.map((level) => {
                      const isExpanded = expandedGrades.includes(`level-${level.id}`)
                      return (
                      <div key={level.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Cabecera colapsable */}
                        <div 
                          className={`p-4 cursor-pointer ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'bg-amber-50 hover:bg-amber-100' : 'bg-purple-50 hover:bg-purple-100'} transition-colors`}
                          onClick={() => {
                            const key = `level-${level.id}`
                            setExpandedGrades(prev => 
                              prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]
                            )
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <button className="p-1">
                              {isExpanded ? (
                                <ChevronDown className={`w-5 h-5 ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'text-amber-600' : 'text-purple-600'}`} />
                              ) : (
                                <ChevronRight className={`w-5 h-5 ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'text-amber-600' : 'text-purple-600'}`} />
                              )}
                            </button>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'bg-amber-200' : 'bg-purple-200'}`}>
                              <GraduationCap className={`w-5 h-5 ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'text-amber-700' : 'text-purple-700'}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">{level.name}</span>
                                <span className="px-2 py-0.5 text-xs bg-white/50 text-slate-600 rounded">{level.code}</span>
                                <span className={`px-2 py-0.5 text-xs rounded ${level.gradingScaleType.startsWith('QUALITATIVE') ? 'bg-amber-200 text-amber-700' : 'bg-purple-200 text-purple-700'}`}>
                                  {level.gradingScaleType.startsWith('QUALITATIVE') ? 'Cualitativo' : 'Numérico'}
                                </span>
                                {level.shift && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                    {level.shift === 'MORNING' ? '☀️ Mañana' : 
                                     level.shift === 'AFTERNOON' ? '🌤️ Tarde' : 
                                     level.shift === 'EVENING' ? '🌙 Noche' : 
                                     level.shift === 'SINGLE' ? '📚 J. Única' : 'Otra'}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-500 mt-0.5">
                                {level.grades.length > 0 ? level.grades.join(', ') : 'Sin grados asignados'}
                              </div>
                            </div>
                            {/* Muestra colores de la escala en la cabecera */}
                            <div className="flex gap-1">
                              {level.gradingScaleType.startsWith('QUALITATIVE') ? (
                                level.qualitativeLevels?.slice(0, 4).map((ql) => (
                                  <div key={ql.id} className="w-4 h-4 rounded" style={{ backgroundColor: ql.color }} title={ql.name} />
                                ))
                              ) : (
                                level.performanceLevels?.slice(0, 4).map((pl) => (
                                  <div key={pl.id} className="w-4 h-4 rounded" style={{ backgroundColor: pl.color }} title={pl.name} />
                                ))
                              )}
                            </div>
                            {canEditGradingLevels && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const updated = institution.academicLevels.filter(l => l.id !== level.id)
                                  setInstitution({ ...institution, academicLevels: updated })
                                }}
                                className="p-2 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Contenido expandible */}
                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-slate-100 space-y-4">
                            {/* Información básica */}
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Nombre del nivel</label>
                                <input
                                  type="text"
                                  value={level.name}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updated = institution.academicLevels.map(l =>
                                      l.id === level.id ? { ...l, name: e.target.value } : l
                                    )
                                    setInstitution({ ...institution, academicLevels: updated })
                                  }}
                                  disabled={!canEditGradingLevels}
                                  className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Código</label>
                                <input
                                  type="text"
                                  value={level.code}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updated = institution.academicLevels.map(l =>
                                      l.id === level.id ? { ...l, code: e.target.value.toUpperCase() } : l
                                    )
                                    setInstitution({ ...institution, academicLevels: updated })
                                  }}
                                  disabled={!canEditGradingLevels}
                                  className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Jornada</label>
                                <select
                                  value={level.shift || 'SINGLE'}
                                  disabled={!canEditGradingLevels}
                                  className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const updated = institution.academicLevels.map(l =>
                                      l.id === level.id ? { ...l, shift: e.target.value as any } : l
                                    )
                                    setInstitution({ ...institution, academicLevels: updated })
                                  }}
                                >
                                  <option value="MORNING">Mañana</option>
                                  <option value="AFTERNOON">Tarde</option>
                                  <option value="EVENING">Noche</option>
                                  <option value="SINGLE">Jornada Única</option>
                                  <option value="OTHER">Otra</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Tipo de calificación</label>
                                <select
                                  value={level.gradingScaleType}
                                  disabled={!canEditGradingLevels}
                                  className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded ${canEditGradingLevels ? 'bg-white' : 'bg-slate-100 cursor-not-allowed'}`}
                                  onChange={(e) => {
                                    if (!canEditGradingLevels) return
                                    const newType = e.target.value as GradingScaleType
                                    
                                    // Configuración según tipo de escala numérica
                                    const getNumericConfig = (type: GradingScaleType) => {
                                      switch (type) {
                                        case 'NUMERIC_1_5':
                                          return {
                                            minGrade: 1.0, maxGrade: 5.0, minPassingGrade: 3.0,
                                            performanceLevels: [
                                              { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
                                              { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
                                              { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
                                              { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
                                            ]
                                          }
                                        case 'NUMERIC_1_10':
                                          return {
                                            minGrade: 1, maxGrade: 10, minPassingGrade: 6,
                                            performanceLevels: [
                                              { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 9, maxScore: 10, order: 0, color: '#22c55e', isApproved: true },
                                              { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 8, maxScore: 8.9, order: 1, color: '#3b82f6', isApproved: true },
                                              { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 6, maxScore: 7.9, order: 2, color: '#f59e0b', isApproved: true },
                                              { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 1, maxScore: 5.9, order: 3, color: '#ef4444', isApproved: false },
                                            ]
                                          }
                                        case 'NUMERIC_0_100':
                                          return {
                                            minGrade: 0, maxGrade: 100, minPassingGrade: 60,
                                            performanceLevels: [
                                              { id: `perf-${Date.now()}-1`, name: 'Superior', code: 'SUPERIOR', minScore: 90, maxScore: 100, order: 0, color: '#22c55e', isApproved: true },
                                              { id: `perf-${Date.now()}-2`, name: 'Alto', code: 'ALTO', minScore: 80, maxScore: 89, order: 1, color: '#3b82f6', isApproved: true },
                                              { id: `perf-${Date.now()}-3`, name: 'Básico', code: 'BASICO', minScore: 60, maxScore: 79, order: 2, color: '#f59e0b', isApproved: true },
                                              { id: `perf-${Date.now()}-4`, name: 'Bajo', code: 'BAJO', minScore: 0, maxScore: 59, order: 3, color: '#ef4444', isApproved: false },
                                            ]
                                          }
                                        default:
                                          return { minGrade: 1.0, maxGrade: 5.0, minPassingGrade: 3.0, performanceLevels: [] }
                                      }
                                    }
                                    
                                    const updated = institution.academicLevels.map(l =>
                                      l.id === level.id ? {
                                        ...l,
                                        gradingScaleType: newType,
                                        ...(newType.startsWith('NUMERIC') ? {
                                          ...getNumericConfig(newType),
                                          qualitativeLevels: undefined,
                                        } : {
                                          qualitativeLevels: [
                                            { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros', color: '#22c55e', order: 0, isApproved: true },
                                            { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza los logros', color: '#3b82f6', order: 1, isApproved: true },
                                            { id: 'q3', code: 'B', name: 'Básico', description: 'Logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
                                            { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza', color: '#ef4444', order: 3, isApproved: false },
                                          ],
                                          minGrade: undefined,
                                          maxGrade: undefined,
                                          minPassingGrade: undefined,
                                          performanceLevels: undefined,
                                        }),
                                      } : l
                                    )
                                    setInstitution({ ...institution, academicLevels: updated })
                                  }}
                                >
                                  <option value="NUMERIC_1_5">Numérico 1.0 - 5.0</option>
                                  <option value="NUMERIC_1_10">Numérico 1 - 10</option>
                                  <option value="NUMERIC_0_100">Numérico 0 - 100</option>
                                  <option value="QUALITATIVE">Cualitativo (letras)</option>
                                  <option value="QUALITATIVE_DESC">Cualitativo descriptivo</option>
                                </select>
                              </div>
                            </div>

                            {/* Grados del nivel */}
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Grados (separados por coma)</label>
                              <input
                                type="text"
                                value={level.grades.join(', ')}
                                disabled={!canEditGradingLevels}
                                onChange={(e) => {
                                  if (!canEditGradingLevels) return
                                  const gradesArray = e.target.value.split(',').map(g => g.trim()).filter(g => g)
                                  const updated = institution.academicLevels.map(l =>
                                    l.id === level.id ? { ...l, grades: gradesArray } : l
                                  )
                                  setInstitution({ ...institution, academicLevels: updated })
                                }}
                                placeholder="Ej: Transición, 1°, 2°, 3°"
                                className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                              />
                            </div>

                            {/* Configuración según tipo de escala */}
                            {level.gradingScaleType.startsWith('NUMERIC') ? (
                              <>
                                {/* Escala numérica */}
                                <div className="grid grid-cols-3 gap-4 p-3 bg-purple-50 rounded-lg">
                                  <div>
                                    <label className="block text-xs text-purple-600 mb-1">Nota mínima</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={level.minGrade || 1}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updated = institution.academicLevels.map(l =>
                                          l.id === level.id ? { ...l, minGrade: parseFloat(e.target.value) || 1 } : l
                                        )
                                        setInstitution({ ...institution, academicLevels: updated })
                                      }}
                                      className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-purple-600 mb-1">Nota máxima</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={level.maxGrade || 5}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updated = institution.academicLevels.map(l =>
                                          l.id === level.id ? { ...l, maxGrade: parseFloat(e.target.value) || 5 } : l
                                        )
                                        setInstitution({ ...institution, academicLevels: updated })
                                      }}
                                      className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-purple-600 mb-1">Nota para aprobar</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={level.minPassingGrade || 3}
                                      disabled={!canEditGradingLevels}
                                      onChange={(e) => {
                                        if (!canEditGradingLevels) return
                                        const updated = institution.academicLevels.map(l =>
                                          l.id === level.id ? { ...l, minPassingGrade: parseFloat(e.target.value) || 3 } : l
                                        )
                                        setInstitution({ ...institution, academicLevels: updated })
                                      }}
                                      className={`w-full px-2 py-1.5 text-sm border border-purple-300 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                    />
                                  </div>
                                </div>

                                {/* Escala de valoración (Performance Levels) */}
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-xs text-green-700 font-medium">Escala de Valoración (Niveles de Desempeño)</div>
                                    {canEditGradingLevels && (
                                      <button
                                        onClick={() => {
                                          const newPerf = {
                                            id: `perf-${Date.now()}`,
                                            name: 'Nuevo Nivel',
                                            code: 'NUEVO',
                                            minScore: 0,
                                            maxScore: 0,
                                            order: level.performanceLevels?.length || 0,
                                            color: '#6b7280',
                                            isApproved: true,
                                          }
                                          const updated = institution.academicLevels.map(l =>
                                            l.id === level.id ? { ...l, performanceLevels: [...(l.performanceLevels || []), newPerf] } : l
                                          )
                                          setInstitution({ ...institution, academicLevels: updated })
                                        }}
                                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        + Agregar
                                      </button>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    {level.performanceLevels?.map((pl, plIndex) => (
                                      <div 
                                        key={pl.id} 
                                        className="flex items-center gap-2 p-2 bg-white rounded border"
                                        style={{ borderColor: pl.color, borderLeftWidth: '4px' }}
                                      >
                                        <input
                                          type="color"
                                          value={pl.color}
                                          disabled={!canEditGradingLevels}
                                          onChange={(e) => {
                                            if (!canEditGradingLevels) return
                                            const updatedPl = level.performanceLevels?.map((p, i) =>
                                              i === plIndex ? { ...p, color: e.target.value } : p
                                            )
                                            const updated = institution.academicLevels.map(l =>
                                              l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                            )
                                            setInstitution({ ...institution, academicLevels: updated })
                                          }}
                                          className={`w-8 h-8 rounded border-0 ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                        />
                                        <input
                                          type="text"
                                          value={pl.name}
                                          disabled={!canEditGradingLevels}
                                          onChange={(e) => {
                                            if (!canEditGradingLevels) return
                                            const updatedPl = level.performanceLevels?.map((p, i) =>
                                              i === plIndex ? { ...p, name: e.target.value } : p
                                            )
                                            const updated = institution.academicLevels.map(l =>
                                              l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                            )
                                            setInstitution({ ...institution, academicLevels: updated })
                                          }}
                                          placeholder="Nombre"
                                          className={`w-24 px-2 py-1 text-xs border border-slate-200 rounded font-medium ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                        />
                                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs">
                                          <input
                                            type="number"
                                            step="0.1"
                                            value={pl.minScore}
                                            disabled={!canEditGradingLevels}
                                            onChange={(e) => {
                                              if (!canEditGradingLevels) return
                                              const updatedPl = level.performanceLevels?.map((p, i) =>
                                                i === plIndex ? { ...p, minScore: parseFloat(e.target.value) || 0 } : p
                                              )
                                              const updated = institution.academicLevels.map(l =>
                                                l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                              )
                                              setInstitution({ ...institution, academicLevels: updated })
                                            }}
                                            className={`w-14 px-1 py-0.5 text-xs border border-slate-200 rounded text-center ${canEditGradingLevels ? 'bg-white' : 'bg-slate-50 cursor-not-allowed'}`}
                                          />
                                          <span className="text-slate-400">-</span>
                                          <input
                                            type="number"
                                            step="0.1"
                                            value={pl.maxScore}
                                            disabled={!canEditGradingLevels}
                                            onChange={(e) => {
                                              if (!canEditGradingLevels) return
                                              const updatedPl = level.performanceLevels?.map((p, i) =>
                                                i === plIndex ? { ...p, maxScore: parseFloat(e.target.value) || 0 } : p
                                              )
                                              const updated = institution.academicLevels.map(l =>
                                                l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                              )
                                              setInstitution({ ...institution, academicLevels: updated })
                                            }}
                                            className={`w-14 px-1 py-0.5 text-xs border border-slate-200 rounded text-center ${canEditGradingLevels ? 'bg-white' : 'bg-slate-50 cursor-not-allowed'}`}
                                          />
                                        </div>
                                        <label className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${pl.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} ${!canEditGradingLevels ? 'cursor-not-allowed opacity-60' : ''}`}>
                                          <input
                                            type="checkbox"
                                            checked={pl.isApproved}
                                            disabled={!canEditGradingLevels}
                                            onChange={(e) => {
                                              if (!canEditGradingLevels) return
                                              const updatedPl = level.performanceLevels?.map((p, i) =>
                                                i === plIndex ? { ...p, isApproved: e.target.checked } : p
                                              )
                                              const updated = institution.academicLevels.map(l =>
                                                l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                              )
                                              setInstitution({ ...institution, academicLevels: updated })
                                            }}
                                            className="w-3 h-3"
                                          />
                                          {pl.isApproved ? 'Aprueba' : 'No aprueba'}
                                        </label>
                                        {canEditGradingLevels && (
                                          <button
                                            onClick={() => {
                                              const updatedPl = level.performanceLevels?.filter((_, i) => i !== plIndex)
                                              const updated = institution.academicLevels.map(l =>
                                                l.id === level.id ? { ...l, performanceLevels: updatedPl } : l
                                              )
                                              setInstitution({ ...institution, academicLevels: updated })
                                            }}
                                            className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {(!level.performanceLevels || level.performanceLevels.length === 0) && (
                                      <div className="text-xs text-slate-400 text-center py-2">Sin niveles de desempeño configurados</div>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* Escala cualitativa */
                              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-xs text-amber-700 font-medium">Escala Cualitativa</div>
                                  {canEditGradingLevels && (
                                    <button
                                      onClick={() => {
                                        const newQl = {
                                          id: `ql-${Date.now()}`,
                                          code: 'N',
                                          name: 'Nuevo',
                                          description: '',
                                          color: '#6b7280',
                                          order: level.qualitativeLevels?.length || 0,
                                          isApproved: true,
                                        }
                                        const updated = institution.academicLevels.map(l =>
                                          l.id === level.id ? { ...l, qualitativeLevels: [...(l.qualitativeLevels || []), newQl] } : l
                                        )
                                        setInstitution({ ...institution, academicLevels: updated })
                                      }}
                                      className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                                    >
                                      + Agregar
                                    </button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {level.qualitativeLevels?.map((ql, qlIndex) => (
                                    <div key={ql.id} className="flex items-center gap-2 p-2 bg-white rounded border border-amber-200">
                                      <input
                                        type="color"
                                        value={ql.color}
                                        disabled={!canEditGradingLevels}
                                        onChange={(e) => {
                                          if (!canEditGradingLevels) return
                                          const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                            i === qlIndex ? { ...q, color: e.target.value } : q
                                          )
                                          const updated = institution.academicLevels.map(l =>
                                            l.id === level.id ? { ...l, qualitativeLevels: updatedQl } : l
                                          )
                                          setInstitution({ ...institution, academicLevels: updated })
                                        }}
                                        className={`w-8 h-8 rounded border-0 ${canEditGradingLevels ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                      />
                                      <input
                                        type="text"
                                        value={ql.code}
                                        disabled={!canEditGradingLevels}
                                        onChange={(e) => {
                                          if (!canEditGradingLevels) return
                                          const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                            i === qlIndex ? { ...q, code: e.target.value } : q
                                          )
                                          const updated = institution.academicLevels.map(l =>
                                            l.id === level.id ? { ...l, qualitativeLevels: updatedQl } : l
                                          )
                                          setInstitution({ ...institution, academicLevels: updated })
                                        }}
                                        className={`w-12 px-2 py-1 text-xs text-center border border-slate-200 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                        placeholder="Código"
                                      />
                                      <input
                                        type="text"
                                        value={ql.name}
                                        disabled={!canEditGradingLevels}
                                        onChange={(e) => {
                                          if (!canEditGradingLevels) return
                                          const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                            i === qlIndex ? { ...q, name: e.target.value } : q
                                          )
                                          const updated = institution.academicLevels.map(l =>
                                            l.id === level.id ? { ...l, qualitativeLevels: updatedQl } : l
                                          )
                                          setInstitution({ ...institution, academicLevels: updated })
                                        }}
                                        className={`flex-1 px-2 py-1 text-xs border border-slate-200 rounded ${!canEditGradingLevels ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                        placeholder="Nombre"
                                      />
                                      <label className={`flex items-center gap-1 text-xs whitespace-nowrap ${!canEditGradingLevels ? 'cursor-not-allowed opacity-60' : ''}`}>
                                        <input
                                          type="checkbox"
                                          checked={ql.isApproved}
                                          disabled={!canEditGradingLevels}
                                          onChange={(e) => {
                                            if (!canEditGradingLevels) return
                                            const updatedQl = level.qualitativeLevels?.map((q, i) =>
                                              i === qlIndex ? { ...q, isApproved: e.target.checked } : q
                                            )
                                            const updated = institution.academicLevels.map(l =>
                                              l.id === level.id ? { ...l, qualitativeLevels: updatedQl } : l
                                            )
                                            setInstitution({ ...institution, academicLevels: updated })
                                          }}
                                          className="w-3 h-3"
                                        />
                                        Aprueba
                                      </label>
                                      {canEditGradingLevels && (
                                        <button
                                          onClick={() => {
                                            const updatedQl = level.qualitativeLevels?.filter((_, i) => i !== qlIndex)
                                            const updated = institution.academicLevels.map(l =>
                                              l.id === level.id ? { ...l, qualitativeLevels: updatedQl } : l
                                            )
                                            setInstitution({ ...institution, academicLevels: updated })
                                          }}
                                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )})}
                    

                    {institution.academicLevels.length === 0 && (
                      <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                        <p className="mb-2">No hay niveles académicos configurados</p>
                        <button
                          onClick={() => {
                            const defaultLevels: AcademicLevel[] = [
                              {
                                id: 'lvl-preescolar',
                                name: 'Preescolar',
                                code: 'PREESCOLAR',
                                order: 0,
                                gradingScaleType: 'QUALITATIVE',
                                qualitativeLevels: [
                                  { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros', color: '#22c55e', order: 0, isApproved: true },
                                  { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza los logros', color: '#3b82f6', order: 1, isApproved: true },
                                  { id: 'q3', code: 'B', name: 'Básico', description: 'Logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
                                  { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza', color: '#ef4444', order: 3, isApproved: false },
                                ],
                                grades: ['Pre-Jardín', 'Jardín', 'Transición'],
                              },
                              {
                                id: 'lvl-primaria',
                                name: 'Básica Primaria',
                                code: 'PRIMARIA',
                                order: 1,
                                gradingScaleType: 'NUMERIC_1_5',
                                minGrade: 1.0,
                                maxGrade: 5.0,
                                minPassingGrade: 3.0,
                                grades: ['1°', '2°', '3°', '4°', '5°'],
                              },
                              {
                                id: 'lvl-secundaria',
                                name: 'Básica Secundaria',
                                code: 'SECUNDARIA',
                                order: 2,
                                gradingScaleType: 'NUMERIC_1_5',
                                minGrade: 1.0,
                                maxGrade: 5.0,
                                minPassingGrade: 3.0,
                                grades: ['6°', '7°', '8°', '9°'],
                              },
                              {
                                id: 'lvl-media',
                                name: 'Media',
                                code: 'MEDIA',
                                order: 3,
                                gradingScaleType: 'NUMERIC_1_5',
                                minGrade: 1.0,
                                maxGrade: 5.0,
                                minPassingGrade: 3.0,
                                grades: ['10°', '11°'],
                              },
                            ]
                            setInstitution({ ...institution, academicLevels: defaultLevels })
                          }}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Cargar niveles por defecto
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón Guardar Niveles Académicos */}
                {canEditGradingLevels && (
                  <div className="flex justify-end pt-6 mt-6 border-t border-slate-200">
                    <button
                      onClick={async () => {
                        const success = await saveAcademicLevelsToAPI()
                        if (success) {
                          alert('✅ Niveles académicos guardados correctamente')
                        } else {
                          alert('❌ Error al guardar. Intente de nuevo.')
                        }
                      }}
                      disabled={isSaving}
                      className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Guardando...' : 'Guardar Niveles Académicos'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Sistema de Calificación */}
            {activeTab === 'grading' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Percent className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Sistema de Calificación</h2>
                    <p className="text-sm text-slate-500">Configura los componentes evaluativos y la escala de valoración</p>
                  </div>
                  {!canEditGradingScale && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded ml-auto">
                      <Eye className="w-3 h-3" /> Solo lectura
                    </span>
                  )}
                </div>

                {/* Procesos Evaluativos Dinámicos */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Procesos Evaluativos
                    </h3>
                    {canEditGradingScale && (
                      <button
                        onClick={() => {
                          const newProcess = {
                            id: `proc-${Date.now()}`,
                            name: 'Nuevo Proceso',
                            code: `PROCESO_${gradingConfig.evaluationProcesses.length + 1}`,
                            weightPercentage: 0,
                            order: gradingConfig.evaluationProcesses.length,
                            allowTeacherAddGrades: true,
                            subprocesses: [
                              { id: `sub-${Date.now()}`, name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 }
                            ]
                          }
                          setGradingConfig({
                            ...gradingConfig,
                            evaluationProcesses: [...gradingConfig.evaluationProcesses, newProcess]
                          })
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Proceso
                      </button>
                    )}
                  </div>

                  {/* Lista de Procesos */}
                  <div className="space-y-4">
                    {gradingConfig.evaluationProcesses.map((process, processIndex) => {
                      const processColors = ['blue', 'green', 'amber', 'purple', 'pink', 'cyan'][processIndex % 6]
                      const isExpanded = expandedGrades.includes(`process-${process.id}`)
                      const subprocessTotal = process.subprocesses.reduce((sum, s) => sum + s.weightPercentage, 0)
                      
                      return (
                        <div key={process.id} className="border border-slate-200 rounded-lg overflow-hidden">
                          {/* Cabecera del Proceso */}
                          <div className={`p-4 bg-${processColors}-50 border-b border-${processColors}-200`}>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => {
                                  const key = `process-${process.id}`
                                  setExpandedGrades(prev => 
                                    prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]
                                  )
                                }}
                                className="p-1"
                              >
                                {isExpanded ? (
                                  <ChevronDown className={`w-5 h-5 text-${processColors}-600`} />
                                ) : (
                                  <ChevronRight className={`w-5 h-5 text-${processColors}-600`} />
                                )}
                              </button>
                              
                              <input
                                type="text"
                                value={process.name}
                                disabled={!canEditGradingScale}
                                onChange={(e) => {
                                  if (!canEditGradingScale) return
                                  const updated = gradingConfig.evaluationProcesses.map(p =>
                                    p.id === process.id ? { ...p, name: e.target.value } : p
                                  )
                                  setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                }}
                                className={`flex-1 font-medium text-${processColors}-700 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-${processColors}-300 rounded px-2 py-1 ${!canEditGradingScale ? 'cursor-not-allowed' : ''}`}
                              />
                              
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={process.weightPercentage}
                                  disabled={!canEditGradingScale}
                                  onChange={(e) => {
                                    if (!canEditGradingScale) return
                                    const updated = gradingConfig.evaluationProcesses.map(p =>
                                      p.id === process.id ? { ...p, weightPercentage: parseInt(e.target.value) || 0 } : p
                                    )
                                    setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                  }}
                                  className={`w-16 px-2 py-1 border border-slate-300 rounded text-center font-semibold ${!canEditGradingScale ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                                />
                                <span className="text-slate-600 font-medium">%</span>
                              </div>

                              {canEditGradingScale && (
                                <button
                                  onClick={() => {
                                    const updated = gradingConfig.evaluationProcesses.filter(p => p.id !== process.id)
                                    setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                  }}
                                  className="p-1.5 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Subprocesos (expandible) */}
                          {isExpanded && (
                            <div className="p-4 bg-white">
                              {/* Opción para permitir que docentes agreguen notas */}
                              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <label className={`flex items-center gap-2 text-sm ${!canEditGradingScale ? 'cursor-not-allowed opacity-60' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={process.allowTeacherAddGrades}
                                    disabled={!canEditGradingScale}
                                    onChange={(e) => {
                                      if (!canEditGradingScale) return
                                      const updated = gradingConfig.evaluationProcesses.map(p =>
                                        p.id === process.id ? { ...p, allowTeacherAddGrades: e.target.checked } : p
                                      )
                                      setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-slate-700">Permitir que el docente agregue más casillas de notas</span>
                                </label>
                              </div>

                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-slate-600">Subprocesos</span>
                                <button
                                  onClick={() => {
                                    const newSubprocess = {
                                      id: `sub-${Date.now()}`,
                                      name: `Sub ${process.subprocesses.length + 1}`,
                                      weightPercentage: 0,
                                      numberOfGrades: 3,
                                      order: process.subprocesses.length
                                    }
                                    const updated = gradingConfig.evaluationProcesses.map(p =>
                                      p.id === process.id ? { ...p, subprocesses: [...p.subprocesses, newSubprocess] } : p
                                    )
                                    setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                                >
                                  <Plus className="w-3 h-3" />
                                  Agregar Subproceso
                                </button>
                              </div>

                              {/* Lista de Subprocesos */}
                              <div className="space-y-2">
                                {process.subprocesses.map((sub) => (
                                  <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    {/* Nombre del subproceso */}
                                    <input
                                      type="text"
                                      value={sub.name}
                                      onChange={(e) => {
                                        const updatedSubs = process.subprocesses.map(s =>
                                          s.id === sub.id ? { ...s, name: e.target.value } : s
                                        )
                                        const updated = gradingConfig.evaluationProcesses.map(p =>
                                          p.id === process.id ? { ...p, subprocesses: updatedSubs } : p
                                        )
                                        setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                      }}
                                      className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded bg-white"
                                    />
                                    
                                    {/* Porcentaje */}
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={sub.weightPercentage}
                                        onChange={(e) => {
                                          const updatedSubs = process.subprocesses.map(s =>
                                            s.id === sub.id ? { ...s, weightPercentage: parseInt(e.target.value) || 0 } : s
                                          )
                                          const updated = gradingConfig.evaluationProcesses.map(p =>
                                            p.id === process.id ? { ...p, subprocesses: updatedSubs } : p
                                          )
                                          setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                        }}
                                        className="w-14 px-2 py-1 text-sm border border-slate-200 rounded text-center"
                                      />
                                      <span className="text-xs text-slate-500">%</span>
                                    </div>
                                    
                                    {/* Cantidad de notas */}
                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded">
                                      <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={sub.numberOfGrades}
                                        onChange={(e) => {
                                          const newValue = parseInt(e.target.value) || 1
                                          const updatedSubs = process.subprocesses.map(s =>
                                            s.id === sub.id ? { ...s, numberOfGrades: newValue } : s
                                          )
                                          const updated = gradingConfig.evaluationProcesses.map(p =>
                                            p.id === process.id ? { ...p, subprocesses: updatedSubs } : p
                                          )
                                          setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                        }}
                                        className="w-12 px-1 py-0.5 text-sm border border-blue-300 rounded text-center bg-white"
                                        title="Cantidad de notas"
                                      />
                                      <span className="text-xs text-blue-600">notas</span>
                                    </div>
                                    
                                    {/* Eliminar subproceso */}
                                    <button
                                      onClick={() => {
                                        if (process.subprocesses.length > 1) {
                                          const updatedSubs = process.subprocesses.filter(s => s.id !== sub.id)
                                          const updated = gradingConfig.evaluationProcesses.map(p =>
                                            p.id === process.id ? { ...p, subprocesses: updatedSubs } : p
                                          )
                                          setGradingConfig({ ...gradingConfig, evaluationProcesses: updated })
                                        }
                                      }}
                                      disabled={process.subprocesses.length <= 1}
                                      className={`p-1 rounded ${process.subprocesses.length > 1 ? 'hover:bg-red-100 text-slate-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {/* Total de subprocesos */}
                              <div className={`mt-3 text-xs ${subprocessTotal === 100 ? 'text-green-600' : 'text-red-600'}`}>
                                Total subprocesos: <strong>{subprocessTotal}%</strong> {subprocessTotal !== 100 && '(debe sumar 100%)'}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Total de Procesos */}
                  <div className={`mt-4 p-3 rounded-lg text-sm ${totalProcessWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    Total Procesos: <strong>{totalProcessWeight}%</strong> {totalProcessWeight !== 100 && '(debe sumar 100%)'}
                  </div>
                </div>

                {/* Nota sobre escala de valoración */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <GraduationCap className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-blue-800">Escala de Valoración</div>
                      <p className="text-sm text-blue-600 mt-1">
                        La escala de valoración (Superior, Alto, Básico, Bajo) ahora se configura dentro de cada <strong>Nivel Académico</strong> en la pestaña "Niveles y Calendario". 
                        Esto permite tener escalas diferentes por nivel (ej: cualitativa para Preescolar, numérica para Primaria).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Períodos Académicos */}
            {activeTab === 'periods' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Períodos Académicos</h2>
                      <p className="text-sm text-slate-500">Configura los períodos del año escolar y su peso en la nota final</p>
                    </div>
                    {!canEditPeriods && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        <Eye className="w-3 h-3" /> Solo lectura
                      </span>
                    )}
                  </div>
                  {canEditPeriods && (
                    <button
                      onClick={() => openPeriodModal()}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Período
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {periods.map((period, index) => (
                    <div key={period.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-purple-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{period.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {period.startDate} - {period.endDate}
                          </span>
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-purple-600">{period.weight}%</span>
                        <p className="text-xs text-slate-500">Peso</p>
                      </div>
                      {canEditPeriods && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openPeriodModal(period)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePeriod(period.id)}
                            disabled={periods.length <= 1}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Botón Guardar Períodos */}
                {canEditPeriods && (
                  <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
                    <button
                      onClick={handleSavePeriodsAndSync}
                      disabled={savingPeriods || isSaving}
                      className={`px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium ${(savingPeriods || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Save className="w-4 h-4" />
                      {savingPeriods ? 'Guardando...' : 'Guardar Períodos'}
                    </button>
                  </div>
                )}

                {/* Componentes Finales Institucionales */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Componentes Finales Institucionales
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Evaluaciones globales que complementan la nota final del año (ej: Pruebas Semestrales)
                      </p>
                    </div>
                    <label className={`flex items-center gap-2 ${!canEditPeriods ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        checked={gradingConfig.useFinalComponents}
                        disabled={!canEditPeriods}
                        onChange={(e) => {
                          if (!canEditPeriods) return
                          const enabled = e.target.checked
                          if (enabled && gradingConfig.finalComponents.length === 0) {
                            setGradingConfig({
                              ...gradingConfig,
                              useFinalComponents: true,
                              finalComponents: [
                                { id: `fc-${Date.now()}`, name: 'Prueba Semestral I', weightPercentage: 10, order: 0 }
                              ]
                            })
                          } else {
                            setGradingConfig({ ...gradingConfig, useFinalComponents: enabled })
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm text-slate-600">Habilitar</span>
                    </label>
                  </div>

                  {gradingConfig.useFinalComponents && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-purple-700">Componentes configurados</span>
                        <button
                          onClick={() => {
                            const nextNum = gradingConfig.finalComponents.length + 1
                            const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
                            const newComponent = {
                              id: `fc-${Date.now()}`,
                              name: `Prueba Semestral ${romanNumerals[nextNum - 1] || nextNum}`,
                              weightPercentage: 10,
                              order: gradingConfig.finalComponents.length
                            }
                            setGradingConfig({
                              ...gradingConfig,
                              finalComponents: [...gradingConfig.finalComponents, newComponent]
                            })
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          <Plus className="w-3 h-3" />
                          Agregar
                        </button>
                      </div>

                      <div className="space-y-2">
                        {gradingConfig.finalComponents.map((comp) => (
                          <div key={comp.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
                            <input
                              type="text"
                              value={comp.name}
                              onChange={(e) => {
                                const updated = gradingConfig.finalComponents.map(c =>
                                  c.id === comp.id ? { ...c, name: e.target.value } : c
                                )
                                setGradingConfig({ ...gradingConfig, finalComponents: updated })
                              }}
                              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={comp.weightPercentage}
                                onChange={(e) => {
                                  const updated = gradingConfig.finalComponents.map(c =>
                                    c.id === comp.id ? { ...c, weightPercentage: parseInt(e.target.value) || 0 } : c
                                  )
                                  setGradingConfig({ ...gradingConfig, finalComponents: updated })
                                }}
                                className="w-14 px-2 py-1 text-sm border border-slate-200 rounded text-center"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                            <button
                              onClick={() => {
                                if (gradingConfig.finalComponents.length > 1) {
                                  const updated = gradingConfig.finalComponents.filter(c => c.id !== comp.id)
                                  setGradingConfig({ ...gradingConfig, finalComponents: updated })
                                } else {
                                  setGradingConfig({ ...gradingConfig, useFinalComponents: false, finalComponents: [] })
                                }
                              }}
                              className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 text-xs text-purple-700">
                        Total componentes: <strong>{gradingConfig.finalComponents.reduce((sum, c) => sum + c.weightPercentage, 0)}%</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumen de distribución total */}
                {(() => {
                  const finalComponentsWeight = gradingConfig.useFinalComponents 
                    ? gradingConfig.finalComponents.reduce((sum, c) => sum + c.weightPercentage, 0) 
                    : 0
                  const expectedPeriodWeight = 100 - finalComponentsWeight
                  const totalWeight = totalPeriodWeight + finalComponentsWeight
                  const isValid = totalWeight === 100
                  
                  return (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          Períodos: <strong>{totalPeriodWeight}%</strong>
                          {gradingConfig.useFinalComponents && (
                            <span className="ml-3">Componentes Finales: <strong>{finalComponentsWeight}%</strong></span>
                          )}
                        </div>
                        <div>
                          Total: <strong>{totalWeight}%</strong>
                          {!isValid && ' (debe sumar 100%)'}
                        </div>
                      </div>
                      {gradingConfig.useFinalComponents && !isValid && (
                        <p className="mt-1 text-xs opacity-80">
                          Los períodos deben sumar <strong>{expectedPeriodWeight}%</strong> para complementar los componentes finales
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Botón Guardar Sistema de Calificación */}
                {canEditGradingScale && (
                  <div className="flex justify-end pt-6 mt-6 border-t border-slate-200">
                    <button
                      onClick={async () => {
                        const success = await saveGradingConfigToAPI()
                        if (success) {
                          alert('✅ Sistema de calificación guardado correctamente')
                        } else {
                          alert('❌ Error al guardar. Intente de nuevo.')
                        }
                      }}
                      disabled={isSaving}
                      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Guardando...' : 'Guardar Sistema de Calificación'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Grados y Grupos */}
            {activeTab === 'grades' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Grados y Grupos</h2>
                      <p className="text-sm text-slate-500">Configura los grados académicos y sus grupos</p>
                    </div>
                    {!canEditGrades && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        <Eye className="w-3 h-3" /> Solo lectura
                      </span>
                    )}
                  </div>
                  {canEditGrades && (
                    <button
                      onClick={() => openGradeModal()}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Grado
                    </button>
                  )}
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.length}</p>
                    <p className="text-xs text-slate-500">Grados</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.length, 0)}</p>
                    <p className="text-xs text-slate-500">Grupos</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.reduce((s, gr) => s + gr.capacity, 0), 0)}</p>
                    <p className="text-xs text-slate-500">Capacidad Total</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{institution.academicLevels.length}</p>
                    <p className="text-xs text-slate-500">Niveles</p>
                  </div>
                </div>

                {/* Lista por nivel - usa niveles académicos dinámicos */}
                <div className="space-y-6">
                  {institution.academicLevels.map((level) => {
                    const levelGrades = grades.filter(g => g.level === level.code)
                    const colorClass = getLevelColor(level.code, institution.academicLevels)
                    return (
                    <div key={level.id} className={`border rounded-lg overflow-hidden ${colorClass.split(' ')[2] || 'border-slate-200'}`}>
                      <div className={`px-4 py-3 ${colorClass} flex items-center justify-between`}>
                        <h3 className="font-semibold">{level.name}</h3>
                        <span className="text-sm">{levelGrades.length} grado(s)</span>
                      </div>
                      <div className="bg-white divide-y divide-slate-100">
                        {levelGrades.length === 0 ? (
                          <p className="px-4 py-6 text-center text-slate-400 text-sm">No hay grados en este nivel</p>
                        ) : (
                          levelGrades.sort((a, b) => a.order - b.order).map((grade) => (
                            <div key={grade.id}>
                              <div 
                                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                                onClick={() => toggleGradeExpand(grade.id)}
                              >
                                <button className="p-1">
                                  {expandedGrades.includes(grade.id) ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                <div className="flex-1">
                                  <span className="font-medium text-slate-900">{grade.name}</span>
                                  <span className="ml-2 text-sm text-slate-500">({grade.groups.length} grupo{grade.groups.length !== 1 ? 's' : ''})</span>
                                </div>
                                {canEditGrades && (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => openGroupModal(grade.id)}
                                      className="p-1.5 hover:bg-teal-100 rounded text-teal-600"
                                      title="Agregar grupo"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => openGradeModal(grade)}
                                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteGrade(grade.id)}
                                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {expandedGrades.includes(grade.id) && grade.groups.length > 0 && (
                                <div className="bg-slate-50 px-4 py-2 ml-8 border-l-2 border-slate-200">
                                  <div className="grid grid-cols-1 gap-2">
                                    {grade.groups.map((group) => (
                                      <div key={group.id} className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                        <UsersRound className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium text-slate-700">{grade.name} {group.name}</span>
                                        <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500">{group.shift}</span>
                                        <span className="text-xs text-slate-500">Cap: {group.capacity}</span>
                                        {group.director && <span className="text-xs text-slate-500">Dir: {group.director}</span>}
                                        {canEditGrades && (
                                          <div className="ml-auto flex items-center gap-1">
                                            <button
                                              onClick={() => openGroupModal(grade.id, group)}
                                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => deleteGroup(grade.id, group.id)}
                                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                            >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* Tab: Ventanas de Calificación */}
            {activeTab === 'grading-windows' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <CalendarClock className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Ventanas de Calificación</h2>
                      <p className="text-sm text-slate-500">Configura cuándo los docentes pueden ingresar notas por período</p>
                    </div>
                  </div>
                  <select
                    value={selectedAcademicYear}
                    onChange={(e) => setSelectedAcademicYear(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {academicYears.map(year => (
                      <option key={year.id} value={year.id}>Año {year.year}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-indigo-700">
                    <strong>Importante:</strong> Los docentes solo podrán ingresar calificaciones durante las fechas configuradas para cada período. 
                    Fuera de estas fechas, la planilla de notas aparecerá bloqueada.
                  </p>
                </div>

                {loadingGradingPeriods ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : academicYears.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="mb-2">No hay años académicos configurados</p>
                    <p className="text-sm mb-4">Usa el wizard para crear un nuevo año lectivo con todos sus períodos.</p>
                    <button
                      onClick={() => window.location.href = '/academic-year-wizard'}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Crear Año Lectivo
                    </button>
                  </div>
                ) : gradingPeriods.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="mb-2">No hay períodos académicos configurados para este año</p>
                    <p className="text-sm">Configura los períodos en la pestaña "Períodos Académicos" y guárdalos para que aparezcan aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gradingPeriods.map((period) => (
                      <div key={period.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className={`px-4 py-3 flex items-center justify-between ${period.isOpen ? 'bg-green-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-3">
                            {period.isOpen ? (
                              <Unlock className="w-5 h-5 text-green-600" />
                            ) : (
                              <Lock className="w-5 h-5 text-slate-400" />
                            )}
                            <div>
                              <h3 className="font-medium text-slate-900">{period.name}</h3>
                              <p className="text-xs text-slate-500">
                                {period.isOpen ? (
                                  <span className="text-green-600">Abierto para calificaciones</span>
                                ) : (
                                  <span className="text-slate-500">Cerrado para calificaciones</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={period.isOpen}
                              onChange={(e) => saveGradingPeriodConfig(period.id, { ...period, isOpen: e.target.checked })}
                              disabled={savingPeriod === period.id}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                          </label>
                        </div>
                        
                        <div className="px-4 py-4 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Apertura</label>
                              <input
                                type="date"
                                value={period.openDate || ''}
                                onChange={(e) => {
                                  const newPeriod = { ...period, openDate: e.target.value || null }
                                  setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                }}
                                onBlur={() => saveGradingPeriodConfig(period.id, period)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Cierre</label>
                              <input
                                type="date"
                                value={period.closeDate || ''}
                                onChange={(e) => {
                                  const newPeriod = { ...period, closeDate: e.target.value || null }
                                  setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                }}
                                onBlur={() => saveGradingPeriodConfig(period.id, period)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Permitir Entrada Tardía</label>
                              <select
                                value={period.allowLateEntry ? 'yes' : 'no'}
                                onChange={(e) => {
                                  const newPeriod = { ...period, allowLateEntry: e.target.value === 'yes' }
                                  setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                  saveGradingPeriodConfig(period.id, newPeriod)
                                }}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="no">No</option>
                                <option value="yes">Sí</option>
                              </select>
                            </div>
                            {period.allowLateEntry && (
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Días Adicionales</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={period.lateEntryDays}
                                  onChange={(e) => {
                                    const newPeriod = { ...period, lateEntryDays: parseInt(e.target.value) || 0 }
                                    setGradingPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                  }}
                                  onBlur={() => saveGradingPeriodConfig(period.id, period)}
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                              </div>
                            )}
                          </div>
                          {savingPeriod === period.id && (
                            <p className="text-xs text-indigo-600 mt-2">Guardando...</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Ventanas de Recuperación */}
            {activeTab === 'recovery-windows' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Ventanas de Recuperación</h2>
                      <p className="text-sm text-slate-500">Configura cuándo los docentes pueden ingresar notas de recuperación por período</p>
                    </div>
                  </div>
                  <select
                    value={selectedAcademicYear}
                    onChange={(e) => setSelectedAcademicYear(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {academicYears.map(year => (
                      <option key={year.id} value={year.id}>Año {year.year}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-amber-700">
                    <strong>Importante:</strong> Los docentes solo podrán ingresar notas de recuperación durante las fechas configuradas para cada período. 
                    Fuera de estas fechas, no podrán registrar actividades de recuperación.
                  </p>
                </div>

                {loadingRecoveryPeriods ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                  </div>
                ) : academicYears.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="mb-2">No hay años académicos configurados</p>
                    <p className="text-sm mb-4">Usa el wizard para crear un nuevo año lectivo con todos sus períodos.</p>
                    <button
                      onClick={() => window.location.href = '/academic-year-wizard'}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Crear Año Lectivo
                    </button>
                  </div>
                ) : recoveryPeriods.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="mb-2">No hay períodos académicos configurados para este año</p>
                    <p className="text-sm">Configura los períodos en la pestaña "Períodos Académicos" y guárdalos para que aparezcan aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recoveryPeriods.map((period) => (
                      <div key={period.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className={`px-4 py-3 flex items-center justify-between ${period.isOpen ? 'bg-green-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-3">
                            {period.isOpen ? (
                              <Unlock className="w-5 h-5 text-green-600" />
                            ) : (
                              <Lock className="w-5 h-5 text-slate-400" />
                            )}
                            <div>
                              <h3 className="font-medium text-slate-900">Recuperación {period.name}</h3>
                              <p className="text-xs text-slate-500">
                                {period.isOpen ? (
                                  <span className="text-green-600">Abierto para recuperaciones</span>
                                ) : (
                                  <span className="text-slate-500">Cerrado para recuperaciones</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={period.isOpen}
                              onChange={(e) => saveRecoveryPeriodConfig(period.id, { ...period, isOpen: e.target.checked })}
                              disabled={savingRecoveryPeriod === period.id}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                          </label>
                        </div>
                        
                        <div className="px-4 py-4 bg-white">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Apertura</label>
                              <input
                                type="date"
                                value={period.openDate || ''}
                                onChange={(e) => {
                                  const newPeriod = { ...period, openDate: e.target.value || null }
                                  setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                }}
                                onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de Cierre</label>
                              <input
                                type="date"
                                value={period.closeDate || ''}
                                onChange={(e) => {
                                  const newPeriod = { ...period, closeDate: e.target.value || null }
                                  setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                }}
                                onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Permitir Entrada Tardía</label>
                              <select
                                value={period.allowLateEntry ? 'yes' : 'no'}
                                onChange={(e) => {
                                  const newPeriod = { ...period, allowLateEntry: e.target.value === 'yes' }
                                  setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                  saveRecoveryPeriodConfig(period.id, newPeriod)
                                }}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="no">No</option>
                                <option value="yes">Sí</option>
                              </select>
                            </div>
                            {period.allowLateEntry && (
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Días Adicionales</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="30"
                                  value={period.lateEntryDays}
                                  onChange={(e) => {
                                    const newPeriod = { ...period, lateEntryDays: parseInt(e.target.value) || 0 }
                                    setRecoveryPeriods(prev => prev.map(p => p.id === period.id ? newPeriod : p))
                                  }}
                                  onBlur={() => saveRecoveryPeriodConfig(period.id, period)}
                                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                              </div>
                            )}
                          </div>
                          {savingRecoveryPeriod === period.id && (
                            <p className="text-xs text-amber-600 mt-2">Guardando...</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal Período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPeriod ? 'Editar Período' : 'Nuevo Período'}
              </h3>
              <button onClick={() => setShowPeriodModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del período</label>
                <input
                  type="text"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peso en la nota final (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={periodForm.weight}
                  onChange={(e) => setPeriodForm({ ...periodForm, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPeriodModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={savePeriod}
                disabled={!periodForm.name.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {editingPeriod ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grado */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGrade ? 'Editar Grado' : 'Nuevo Grado'}
              </h3>
              <button onClick={() => setShowGradeModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grado</label>
                <input
                  type="text"
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  placeholder="Ej: Sexto, Séptimo, Octavo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel educativo</label>
                <select
                  value={gradeForm.level}
                  onChange={(e) => setGradeForm({ ...gradeForm, level: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  {institution.academicLevels.map((level) => (
                    <option key={level.id} value={level.code}>{level.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={gradeForm.order}
                  onChange={(e) => setGradeForm({ ...gradeForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Define el orden de aparición del grado</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGradeModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGrade}
                disabled={!gradeForm.name.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGrade ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grupo */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGroup?.group ? 'Editar Grupo' : 'Nuevo Grupo'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grupo</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ej: A, B, C..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jornada</label>
                <select
                  value={groupForm.shift}
                  onChange={(e) => setGroupForm({ ...groupForm, shift: e.target.value as Group['shift'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="MAÑANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="UNICA">Única</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={groupForm.capacity}
                  onChange={(e) => setGroupForm({ ...groupForm, capacity: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Director de grupo (opcional)</label>
                <input
                  type="text"
                  value={groupForm.director}
                  onChange={(e) => setGroupForm({ ...groupForm, director: e.target.value })}
                  placeholder="Nombre del docente director"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupForm.name.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGroup?.group ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
