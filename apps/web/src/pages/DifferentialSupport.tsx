import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Heart,
  Plus,
  Save,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  FileText,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Shield,
  Activity,
  BarChart3,
  Search,
  Star,
  TrendingUp,
  Settings,
  Eye,
  Edit3,
  ClipboardList,
} from 'lucide-react'
import { apdApi, academicStudentsApi, academicYearsApi, academicTermsApi, teacherAssignmentsApi, academicGradesApi, groupsApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  ACTIVE: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Activo' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completado' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', icon: XCircle, label: 'Cancelado' },
}

const ADAPTATION_LEVELS: Record<string, { bg: string; text: string; label: string }> = {
  LOW: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Bajo' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medio' },
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'Alto' },
}

const COMPLETION_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pendiente' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Progreso' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
}

const SUPPORT_CATEGORIES = [
  'Ritmo de aprendizaje',
  'Barrera comunicativa',
  'Dificultad de atención',
  'Dificultad socioemocional',
  'Discapacidad cognitiva',
  'Discapacidad sensorial',
  'Discapacidad física',
  'Trastorno del espectro autista',
  'Talentos excepcionales',
  'Otra',
]

type Tab = 'profiles' | 'plans' | 'config'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function DifferentialSupport() {
  const { user, institution: authInstitution } = useAuth()
  const institutionId = authInstitution?.id

  // Config
  const [moduleEnabled, setModuleEnabled] = useState(false)
  const [allowTeacher, setAllowTeacher] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('profiles')

  // Profiles
  const [profiles, setProfiles] = useState<any[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profileSearch, setProfileSearch] = useState('')
  const [profileFilter, setProfileFilter] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [profileForm, setProfileForm] = useState({
    studentId: '',
    supportCategory: '',
    pedagogicalNotes: '',
    parentConsentAccepted: false,
    consentDate: '',
  })

  // Profile modal filters
  const [modalGrades, setModalGrades] = useState<any[]>([])
  const [modalGroups, setModalGroups] = useState<any[]>([])
  const [modalStudents, setModalStudents] = useState<any[]>([])
  const [modalSelectedGradeId, setModalSelectedGradeId] = useState('')
  const [modalSelectedGroupId, setModalSelectedGroupId] = useState('')
  const [modalStudentsLoading, setModalStudentsLoading] = useState(false)

  // Plans
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [planForm, setPlanForm] = useState({
    studentEnrollmentId: '',
    supportStrategy: '',
    familyCommitment: '',
    followUpDate: '',
    observations: '',
    objectives: '',
    adaptationStrategies: '',
    evaluationAdjustments: '',
  })

  // Activities
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [activityForm, setActivityForm] = useState({
    supportPlanId: '',
    topic: '',
    originalActivityDescription: '',
    teacherFinalActivity: '',
    adaptationLevel: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  })

  // Progress Log
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressForm, setProgressForm] = useState({
    supportPlanId: '',
    progressIndicator: 3,
    qualitativeObservation: '',
  })

  // General
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isAdmin = user?.roles?.some((r: any) =>
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r.role?.name || r.name)
  )
  const isCoordinator = user?.roles?.some((r: any) =>
    ['COORDINADOR'].includes(r.role?.name || r.name)
  )
  const isRector = user?.roles?.some((r: any) =>
    ['RECTOR'].includes(r.role?.name || r.name)
  )
  const canConfigure = isAdmin || isRector

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA INICIAL: CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apdApi.getConfig()
        setModuleEnabled(res.data?.enableDifferentialSupport || false)
        setAllowTeacher(res.data?.allowTeacherAccess ?? true)
      } catch (err: any) {
        if (err.response?.status === 403) {
          setModuleEnabled(false)
        }
      } finally {
        setConfigLoading(false)
      }
    }
    load()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFILES
  // ═══════════════════════════════════════════════════════════════════════════

  const loadProfiles = async () => {
    setProfilesLoading(true)
    try {
      const params: any = {}
      if (profileFilter) params.active = profileFilter
      if (profileSearch) params.search = profileSearch
      const res = await apdApi.getProfiles(params)
      setProfiles(res.data || [])
    } catch (err) {
      console.error('Error loading profiles:', err)
    } finally {
      setProfilesLoading(false)
    }
  }

  useEffect(() => {
    if (moduleEnabled && activeTab === 'profiles') {
      loadProfiles()
    }
  }, [moduleEnabled, activeTab, profileFilter])

  const handleSearchProfiles = () => {
    loadProfiles()
  }

  const openProfileDetail = async (profileId: string) => {
    try {
      const res = await apdApi.getProfile(profileId)
      setSelectedProfile(res.data)
    } catch (err) {
      showMsg('error', 'Error al cargar el perfil')
    }
  }

  // Load grades when profile modal opens
  useEffect(() => {
    if (!showProfileModal || editingProfile) return
    const loadGrades = async () => {
      try {
        const res = await academicGradesApi.getAll(institutionId)
        setModalGrades(res.data || [])
      } catch { setModalGrades([]) }
    }
    loadGrades()
  }, [showProfileModal, editingProfile, institutionId])

  // Load groups when grade selected in modal
  useEffect(() => {
    if (!modalSelectedGradeId) { setModalGroups([]); setModalSelectedGroupId(''); return }
    const loadGroups = async () => {
      try {
        const res = await groupsApi.getAll({ gradeId: modalSelectedGradeId, institutionId })
        setModalGroups(res.data || [])
        setModalSelectedGroupId('')
      } catch { setModalGroups([]) }
    }
    loadGroups()
  }, [modalSelectedGradeId, institutionId])

  // Load students when group selected in modal
  useEffect(() => {
    if (!modalSelectedGroupId || !selectedYearId) { setModalStudents([]); return }
    const loadStudents = async () => {
      setModalStudentsLoading(true)
      try {
        const res = await academicStudentsApi.getByGroup({
          groupId: modalSelectedGroupId,
          academicYearId: selectedYearId,
          institutionId,
        })
        setModalStudents(res.data || [])
      } catch { setModalStudents([]) }
      finally { setModalStudentsLoading(false) }
    }
    loadStudents()
  }, [modalSelectedGroupId, selectedYearId, institutionId])

  const openCreateProfile = () => {
    setEditingProfile(null)
    setProfileForm({
      studentId: '',
      supportCategory: '',
      pedagogicalNotes: '',
      parentConsentAccepted: false,
      consentDate: '',
    })
    setModalSelectedGradeId('')
    setModalSelectedGroupId('')
    setModalStudents([])
    setShowProfileModal(true)
  }

  const openEditProfile = (profile: any) => {
    setEditingProfile(profile)
    setProfileForm({
      studentId: profile.studentId,
      supportCategory: profile.supportCategory || '',
      pedagogicalNotes: profile.pedagogicalNotes || '',
      parentConsentAccepted: profile.parentConsentAccepted || false,
      consentDate: profile.consentDate ? profile.consentDate.split('T')[0] : '',
    })
    setShowProfileModal(true)
  }

  const handleSaveProfile = async () => {
    if (!profileForm.supportCategory) {
      showMsg('error', 'La categoría de acompañamiento es obligatoria')
      return
    }
    setSaving(true)
    try {
      if (editingProfile) {
        await apdApi.updateProfile(editingProfile.id, {
          supportCategory: profileForm.supportCategory,
          pedagogicalNotes: profileForm.pedagogicalNotes || undefined,
          parentConsentAccepted: profileForm.parentConsentAccepted,
          consentDate: profileForm.consentDate || undefined,
          active: profileForm.parentConsentAccepted,
        })
        showMsg('success', 'Perfil actualizado correctamente')
      } else {
        if (!profileForm.studentId) {
          showMsg('error', 'Seleccione un estudiante')
          setSaving(false)
          return
        }
        await apdApi.createProfile({
          studentId: profileForm.studentId,
          supportCategory: profileForm.supportCategory,
          pedagogicalNotes: profileForm.pedagogicalNotes || undefined,
          parentConsentAccepted: profileForm.parentConsentAccepted,
          consentDate: profileForm.consentDate || undefined,
        })
        showMsg('success', 'Perfil creado correctamente')
      }
      setShowProfileModal(false)
      loadProfiles()
      if (selectedProfile) {
        openProfileDetail(selectedProfile.id)
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleProfileActive = async (profile: any) => {
    if (!profile.parentConsentAccepted && !profile.active) {
      showMsg('error', 'No se puede activar sin consentimiento parental aceptado')
      return
    }
    try {
      await apdApi.updateProfile(profile.id, { active: !profile.active })
      showMsg('success', profile.active ? 'Perfil desactivado' : 'Perfil activado')
      loadProfiles()
      if (selectedProfile?.id === profile.id) {
        openProfileDetail(profile.id)
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al cambiar estado')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANES
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!moduleEnabled || activeTab !== 'plans') return
    const load = async () => {
      try {
        const res = await academicYearsApi.getAll()
        const years = res.data || []
        setAcademicYears(years)
        const current = years.find((y: any) => y.isCurrent)
          || years.find((y: any) => y.status === 'ACTIVE')
          || years.sort((a: any, b: any) => b.year - a.year)[0]
        if (current) setSelectedYearId(current.id)
      } catch (err) {
        console.error('Error loading years:', err)
      }
    }
    load()
  }, [moduleEnabled, activeTab])

  useEffect(() => {
    if (!selectedYearId) return
    const load = async () => {
      try {
        const res = await academicTermsApi.getAll(selectedYearId)
        setTerms(res.data || [])
        if (res.data?.length > 0) setSelectedTermId(res.data[0].id)
      } catch (err) {
        setTerms([])
      }
    }
    load()
  }, [selectedYearId])

  useEffect(() => {
    if (!selectedYearId) return
    const load = async () => {
      try {
        const res = await teacherAssignmentsApi.getAll({ academicYearId: selectedYearId })
        const assignments = res.data || []
        const uniqueGroups = new Map<string, any>()
        assignments.forEach((a: any) => {
          if (a.group && !uniqueGroups.has(a.group.id)) {
            uniqueGroups.set(a.group.id, {
              id: a.group.id,
              name: a.group.name,
              gradeName: a.group.grade?.name,
            })
          }
        })
        const allGroups = Array.from(uniqueGroups.values())
        setGroups(allGroups)
        if (allGroups.length > 0) setSelectedGroupId(allGroups[0].id)
        else setSelectedGroupId('')
      } catch (err) {
        setGroups([])
      }
    }
    load()
  }, [selectedYearId])

  useEffect(() => {
    if (!selectedGroupId || !selectedYearId) { setStudents([]); return }
    const load = async () => {
      try {
        const res = await academicStudentsApi.getByGroup({
          groupId: selectedGroupId,
          academicYearId: selectedYearId,
          institutionId,
        })
        setStudents(res.data || [])
      } catch (err) {
        setStudents([])
      }
    }
    load()
  }, [selectedGroupId, selectedYearId, institutionId])

  const loadPlans = async () => {
    if (!selectedGroupId || !selectedTermId) { setPlans([]); return }
    setPlansLoading(true)
    try {
      // Use the existing pedagogical support API to get plans by group
      const { pedagogicalSupportApi } = await import('../lib/api')
      const res = await pedagogicalSupportApi.getByGroup(selectedGroupId, selectedTermId)
      setPlans(res.data || [])
    } catch (err) {
      setPlans([])
    } finally {
      setPlansLoading(false)
    }
  }

  useEffect(() => {
    if (moduleEnabled && activeTab === 'plans') {
      loadPlans()
    }
  }, [selectedGroupId, selectedTermId, activeTab, moduleEnabled])

  const openCreatePlan = () => {
    setEditingPlan(null)
    setPlanForm({
      studentEnrollmentId: '',
      supportStrategy: '',
      familyCommitment: '',
      followUpDate: '',
      observations: '',
      objectives: '',
      adaptationStrategies: '',
      evaluationAdjustments: '',
    })
    setShowPlanModal(true)
  }

  const handleSavePlan = async () => {
    if (!planForm.studentEnrollmentId || !planForm.supportStrategy) {
      showMsg('error', 'Estudiante y estrategia de apoyo son obligatorios')
      return
    }
    setSaving(true)
    try {
      const objectives = planForm.objectives ? planForm.objectives.split('\n').filter(Boolean) : undefined
      const adaptationStrategies = planForm.adaptationStrategies ? planForm.adaptationStrategies.split('\n').filter(Boolean) : undefined
      const evaluationAdjustments = planForm.evaluationAdjustments ? planForm.evaluationAdjustments.split('\n').filter(Boolean) : undefined

      if (editingPlan) {
        await apdApi.updatePlan(editingPlan.id, {
          supportStrategy: planForm.supportStrategy,
          familyCommitment: planForm.familyCommitment || undefined,
          followUpDate: planForm.followUpDate || undefined,
          observations: planForm.observations || undefined,
          objectives,
          adaptationStrategies,
          evaluationAdjustments,
        })
        showMsg('success', 'Plan actualizado')
      } else {
        await apdApi.createPlan({
          studentEnrollmentId: planForm.studentEnrollmentId,
          academicTermId: selectedTermId,
          supportStrategy: planForm.supportStrategy,
          familyCommitment: planForm.familyCommitment || undefined,
          followUpDate: planForm.followUpDate || undefined,
          observations: planForm.observations || undefined,
          objectives,
          adaptationStrategies,
          evaluationAdjustments,
        })
        showMsg('success', 'Plan creado correctamente')
      }
      setShowPlanModal(false)
      loadPlans()
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al guardar el plan')
    } finally {
      setSaving(false)
    }
  }

  const handlePlanStatusChange = async (planId: string, newStatus: 'COMPLETED' | 'CANCELLED') => {
    try {
      await apdApi.updatePlan(planId, { status: newStatus })
      showMsg('success', `Plan marcado como ${STATUS_CONFIG[newStatus]?.label}`)
      loadPlans()
    } catch (err) {
      showMsg('error', 'Error al actualizar el estado')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  const openCreateActivity = (planId: string) => {
    setActivityForm({
      supportPlanId: planId,
      topic: '',
      originalActivityDescription: '',
      teacherFinalActivity: '',
      adaptationLevel: 'MEDIUM',
    })
    setShowActivityModal(true)
  }

  const handleSaveActivity = async () => {
    if (!activityForm.topic) {
      showMsg('error', 'El tema es obligatorio')
      return
    }
    setSaving(true)
    try {
      await apdApi.createActivity({
        supportPlanId: activityForm.supportPlanId,
        topic: activityForm.topic,
        originalActivityDescription: activityForm.originalActivityDescription || undefined,
        teacherFinalActivity: activityForm.teacherFinalActivity || undefined,
        adaptationLevel: activityForm.adaptationLevel,
      })
      showMsg('success', 'Actividad creada')
      setShowActivityModal(false)
      loadPlans()
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al crear actividad')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateActivityStatus = async (activityId: string, completionStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await apdApi.updateActivity(activityId, { completionStatus })
      showMsg('success', 'Actividad actualizada')
      loadPlans()
    } catch (err) {
      showMsg('error', 'Error al actualizar actividad')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGS DE PROGRESO
  // ═══════════════════════════════════════════════════════════════════════════

  const openCreateProgressLog = (planId: string) => {
    setProgressForm({
      supportPlanId: planId,
      progressIndicator: 3,
      qualitativeObservation: '',
    })
    setShowProgressModal(true)
  }

  const handleSaveProgressLog = async () => {
    setSaving(true)
    try {
      await apdApi.createProgressLog({
        supportPlanId: progressForm.supportPlanId,
        progressIndicator: progressForm.progressIndicator,
        qualitativeObservation: progressForm.qualitativeObservation || undefined,
      })
      showMsg('success', 'Registro de progreso creado')
      setShowProgressModal(false)
      loadPlans()
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al crear registro')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await apdApi.updateConfig({
        enableDifferentialSupport: moduleEnabled,
        allowTeacherAccess: allowTeacher,
      })
      showMsg('success', 'Configuración guardada')
    } catch (err: any) {
      showMsg('error', err.response?.data?.message || 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    )
  }

  const renderProgressBar = (percentage: number | null) => {
    const pct = percentage ? Number(percentage) : 0
    const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-slate-600 w-10 text-right">{pct.toFixed(0)}%</span>
      </div>
    )
  }

  const planStats = useMemo(() => {
    const active = plans.filter(p => p.status === 'ACTIVE').length
    const completed = plans.filter(p => p.status === 'COMPLETED').length
    return { active, completed, total: plans.length }
  }, [plans])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MODULE DISABLED (show config for admins)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!moduleEnabled && !canConfigure) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            Módulo no habilitado
          </h2>
          <p className="text-amber-600">
            El módulo de Acompañamiento Pedagógico Diferencial no está habilitado para esta institución.
            Contacte al rector o administrador para activarlo.
          </p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-purple-600" />
            Inclusión Educativa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompañamiento Pedagógico Diferencial — Perfiles, planes y seguimiento
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'profiles' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Perfiles
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          disabled={!moduleEnabled}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            activeTab === 'plans' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Planes y Actividades
        </button>
        {canConfigure && (
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'config' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuración
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PERFILES                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profiles' && moduleEnabled && (
        <div>
          {/* Profile detail view */}
          {selectedProfile ? (
            <div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4"
              >
                ← Volver a la lista
              </button>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedProfile.student?.lastName} {selectedProfile.student?.secondLastName || ''} {selectedProfile.student?.firstName} {selectedProfile.student?.secondName || ''}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedProfile.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {selectedProfile.active ? '● Activo' : '○ Inactivo'}
                      </span>
                      <span className="text-sm text-slate-500">
                        Categoría: <strong>{selectedProfile.supportCategory}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditProfile(selectedProfile)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleToggleProfileActive(selectedProfile)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${
                        selectedProfile.active
                          ? 'text-red-600 border border-red-200 hover:bg-red-50'
                          : 'text-green-600 border border-green-200 hover:bg-green-50'
                      }`}
                    >
                      {selectedProfile.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {/* Consent info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Consentimiento Parental</div>
                    <div className={`text-sm font-medium ${selectedProfile.parentConsentAccepted ? 'text-green-700' : 'text-red-600'}`}>
                      {selectedProfile.parentConsentAccepted ? '✓ Aceptado' : '✗ Pendiente'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Fecha de Consentimiento</div>
                    <div className="text-sm text-slate-700">
                      {selectedProfile.consentDate
                        ? new Date(selectedProfile.consentDate).toLocaleDateString('es-CO')
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Creado</div>
                    <div className="text-sm text-slate-700">
                      {new Date(selectedProfile.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                {selectedProfile.pedagogicalNotes && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-slate-500 mb-1">Notas Pedagógicas</div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap bg-purple-50/50 p-3 rounded-lg">
                      {selectedProfile.pedagogicalNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Plans linked to this profile */}
              {selectedProfile.supportPlans?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Planes de Acompañamiento</h3>
                  </div>
                  {selectedProfile.supportPlans.map((plan: any) => (
                    <div key={plan.id} className="p-5 border-b border-slate-100 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {renderStatusBadge(plan.status)}
                          <span className="text-sm text-slate-500">{plan.academicTerm?.name}</span>
                        </div>
                        {renderProgressBar(plan.progressPercentage)}
                      </div>
                      <p className="text-sm text-slate-700 mt-2">{plan.supportStrategy}</p>

                      {/* Activities */}
                      {plan.activities?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium text-slate-500">Actividades ({plan.activities.length})</div>
                          {plan.activities.map((act: any) => {
                            const cs = COMPLETION_STATUS[act.completionStatus] || COMPLETION_STATUS.PENDING
                            return (
                              <div key={act.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-slate-700">{act.topic}</span>
                                  <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cs.bg} ${cs.text}`}>
                                    {cs.label}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ADAPTATION_LEVELS[act.adaptationLevel]?.bg} ${ADAPTATION_LEVELS[act.adaptationLevel]?.text}`}>
                                  {ADAPTATION_LEVELS[act.adaptationLevel]?.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Progress Logs */}
                      {plan.progressLogs?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <div className="text-xs font-medium text-slate-500">Últimos registros de progreso</div>
                          {plan.progressLogs.slice(0, 3).map((log: any) => (
                            <div key={log.id} className="flex items-center gap-3 text-xs text-slate-600 bg-green-50/50 rounded px-3 py-1.5">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <Star key={i} className={`w-3 h-3 ${i <= log.progressIndicator ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                                ))}
                              </div>
                              <span className="flex-1 truncate">{log.qualitativeObservation || '—'}</span>
                              <span className="text-slate-400">{new Date(log.createdAt).toLocaleDateString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Profile list view */
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchProfiles()}
                      placeholder="Buscar estudiante..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>
                  <button onClick={handleSearchProfiles} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm">
                    Buscar
                  </button>
                </div>
                <select
                  value={profileFilter}
                  onChange={(e) => setProfileFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
                <button
                  onClick={openCreateProfile}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Perfil
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {profilesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium">No hay perfiles de acompañamiento</p>
                    <p className="text-sm mt-1">Cree un perfil para comenzar el seguimiento diferencial.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Estudiante</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Consentimiento</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Estado</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p: any) => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {p.student?.lastName} {p.student?.secondLastName || ''}, {p.student?.firstName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.supportCategory}</td>
                          <td className="px-4 py-3 text-center">
                            {p.parentConsentAccepted ? (
                              <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                                <Shield className="w-3.5 h-3.5" /> Aceptado
                              </span>
                            ) : (
                              <span className="text-red-500 text-xs font-medium">Pendiente</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              p.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openProfileDetail(p.id)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditProfile(p)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PLANES Y ACTIVIDADES                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'plans' && moduleEnabled && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año Académico</label>
                <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="">Seleccionar...</option>
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>{y.name || y.year} {y.isCurrent ? '(Actual)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="">Seleccionar...</option>
                  {terms.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="">Seleccionar...</option>
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name} {g.gradeName ? `(${g.gradeName})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={openCreatePlan}
                  disabled={!selectedGroupId || !selectedTermId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  <Plus className="w-4 h-4" /> Nuevo Plan
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          {plans.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{planStats.total}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{planStats.active}</div>
                <div className="text-xs text-amber-600">Activos</div>
              </div>
              <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{planStats.completed}</div>
                <div className="text-xs text-green-600">Completados</div>
              </div>
            </div>
          )}

          {/* Plans list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {plansLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : plans.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium">No hay planes de acompañamiento</p>
                <p className="text-sm mt-1">
                  {selectedGroupId && selectedTermId
                    ? 'Cree un nuevo plan para comenzar.'
                    : 'Seleccione grupo y período.'}
                </p>
              </div>
            ) : (
              <div>
                {plans.map((plan: any) => {
                  const student = plan.studentEnrollment?.student
                  const studentName = student ? `${student.lastName} ${student.firstName}` : 'Estudiante'
                  const isExpanded = expandedPlanId === plan.id

                  return (
                    <div key={plan.id} className="border-b border-slate-100 last:border-0">
                      {/* Plan row */}
                      <div
                        className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">{studentName}</div>
                          <div className="text-xs text-slate-500 truncate">{plan.supportStrategy}</div>
                        </div>
                        <div className="w-32 hidden sm:block">
                          {renderProgressBar(plan.progressPercentage)}
                        </div>
                        <div>{renderStatusBadge(plan.status)}</div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {plan.status === 'ACTIVE' && (
                            <>
                              <button onClick={() => openCreateActivity(plan.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Agregar actividad">
                                <Activity className="w-4 h-4" />
                              </button>
                              <button onClick={() => openCreateProgressLog(plan.id)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Registrar progreso">
                                <TrendingUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => handlePlanStatusChange(plan.id, 'COMPLETED')} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Completar">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-5 bg-purple-50/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <h4 className="font-medium text-slate-700 mb-1">Estrategia de Apoyo</h4>
                              <p className="text-slate-600 whitespace-pre-wrap">{plan.supportStrategy}</p>
                            </div>
                            {plan.familyCommitment && (
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Compromiso Familiar</h4>
                                <p className="text-slate-600 whitespace-pre-wrap">{plan.familyCommitment}</p>
                              </div>
                            )}
                            {plan.objectives && (
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Objetivos</h4>
                                <ul className="list-disc list-inside text-slate-600">
                                  {(Array.isArray(plan.objectives) ? plan.objectives : []).map((o: string, i: number) => (
                                    <li key={i}>{o}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {plan.adaptationStrategies && (
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Estrategias de Adaptación</h4>
                                <ul className="list-disc list-inside text-slate-600">
                                  {(Array.isArray(plan.adaptationStrategies) ? plan.adaptationStrategies : []).map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Activities */}
                          {plan.activities?.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Actividades ({plan.activities.length})
                              </h4>
                              <div className="space-y-2">
                                {plan.activities.map((act: any) => {
                                  const cs = COMPLETION_STATUS[act.completionStatus] || COMPLETION_STATUS.PENDING
                                  const al = ADAPTATION_LEVELS[act.adaptationLevel] || ADAPTATION_LEVELS.MEDIUM
                                  return (
                                    <div key={act.id} className="bg-white rounded-lg border border-slate-200 p-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-800 text-sm">{act.topic}</span>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${al.bg} ${al.text}`}>{al.label}</span>
                                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cs.bg} ${cs.text}`}>{cs.label}</span>
                                        </div>
                                      </div>
                                      {act.teacherFinalActivity && (
                                        <p className="text-xs text-slate-600 mt-1">{act.teacherFinalActivity}</p>
                                      )}
                                      {act.teacherFeedback && (
                                        <p className="text-xs text-slate-500 mt-1 italic">"{act.teacherFeedback}"</p>
                                      )}
                                      {plan.status === 'ACTIVE' && act.completionStatus !== 'COMPLETED' && (
                                        <div className="flex gap-1 mt-2">
                                          {act.completionStatus === 'PENDING' && (
                                            <button
                                              onClick={() => handleUpdateActivityStatus(act.id, 'IN_PROGRESS')}
                                              className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                            >
                                              Iniciar
                                            </button>
                                          )}
                                          <button
                                            onClick={() => handleUpdateActivityStatus(act.id, 'COMPLETED')}
                                            className="text-[10px] px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                                          >
                                            Completar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Progress Logs */}
                          {plan.progressLogs?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Registros de Progreso ({plan.progressLogs.length})
                              </h4>
                              <div className="space-y-1.5">
                                {plan.progressLogs.map((log: any) => (
                                  <div key={log.id} className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2 text-xs">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} className={`w-3.5 h-3.5 ${i <= log.progressIndicator ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                                      ))}
                                    </div>
                                    <span className="flex-1 text-slate-600">{log.qualitativeObservation || '—'}</span>
                                    <span className="text-slate-400">
                                      {log.createdBy?.firstName} {log.createdBy?.lastName} · {new Date(log.createdAt).toLocaleDateString('es-CO')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB: CONFIGURACIÓN                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && canConfigure && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-500" />
              Configuración del Módulo APD
            </h2>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">Habilitar módulo APD</div>
                  <div className="text-sm text-slate-500">Activa el Acompañamiento Pedagógico Diferencial para la institución</div>
                </div>
                <button
                  onClick={() => setModuleEnabled(!moduleEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    moduleEnabled ? 'bg-purple-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    moduleEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">Acceso para docentes</div>
                  <div className="text-sm text-slate-500">Permite a los docentes acceder al módulo APD</div>
                </div>
                <button
                  onClick={() => setAllowTeacher(!allowTeacher)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    allowTeacher ? 'bg-purple-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    allowTeacher ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR/EDITAR PERFIL                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingProfile ? 'Editar Perfil' : 'Nuevo Perfil de Acompañamiento'}
              </h2>
              <button onClick={() => setShowProfileModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!editingProfile && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
                      <select
                        value={modalSelectedGradeId}
                        onChange={(e) => { setModalSelectedGradeId(e.target.value); setProfileForm({ ...profileForm, studentId: '' }) }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                      >
                        <option value="">Seleccionar grado...</option>
                        {modalGrades.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                      <select
                        value={modalSelectedGroupId}
                        onChange={(e) => { setModalSelectedGroupId(e.target.value); setProfileForm({ ...profileForm, studentId: '' }) }}
                        disabled={!modalSelectedGradeId}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Seleccionar grupo...</option>
                        {modalGroups.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Estudiante <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={profileForm.studentId}
                      onChange={(e) => setProfileForm({ ...profileForm, studentId: e.target.value })}
                      disabled={!modalSelectedGroupId || modalStudentsLoading}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      <option value="">{modalStudentsLoading ? 'Cargando...' : 'Seleccionar estudiante...'}</option>
                      {modalStudents.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `${s.firstName} ${s.lastName}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Categoría de Acompañamiento <span className="text-red-500">*</span>
                </label>
                <select
                  value={profileForm.supportCategory}
                  onChange={(e) => setProfileForm({ ...profileForm, supportCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {SUPPORT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas Pedagógicas</label>
                <textarea
                  value={profileForm.pedagogicalNotes}
                  onChange={(e) => setProfileForm({ ...profileForm, pedagogicalNotes: e.target.value })}
                  rows={3}
                  placeholder="Descripción pedagógica del estudiante (NO incluir información clínica)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={profileForm.parentConsentAccepted}
                    onChange={(e) => setProfileForm({ ...profileForm, parentConsentAccepted: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label htmlFor="consent" className="text-sm font-medium text-amber-800">
                    Consentimiento parental aceptado
                  </label>
                </div>
                <p className="text-xs text-amber-600">
                  Decreto 1421 de 2017: Es obligatorio contar con el consentimiento de los padres o acudientes
                  para activar el perfil de acompañamiento diferencial.
                </p>
                {profileForm.parentConsentAccepted && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-amber-700 mb-1">Fecha de consentimiento</label>
                    <input
                      type="date"
                      value={profileForm.consentDate}
                      onChange={(e) => setProfileForm({ ...profileForm, consentDate: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
                {editingProfile ? 'Actualizar' : 'Crear Perfil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR/EDITAR PLAN                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingPlan ? 'Editar Plan' : 'Nuevo Plan de Acompañamiento'}
              </h2>
              <button onClick={() => setShowPlanModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!editingPlan && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estudiante <span className="text-red-500">*</span></label>
                  <select
                    value={planForm.studentEnrollmentId}
                    onChange={(e) => setPlanForm({ ...planForm, studentEnrollmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {students.map((s: any) => (
                      <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>
                        {s.name || `${s.firstName} ${s.lastName}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estrategia de Apoyo <span className="text-red-500">*</span></label>
                <textarea
                  value={planForm.supportStrategy}
                  onChange={(e) => setPlanForm({ ...planForm, supportStrategy: e.target.value })}
                  rows={3}
                  placeholder="Describe la estrategia pedagógica..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Objetivos (uno por línea)</label>
                <textarea
                  value={planForm.objectives}
                  onChange={(e) => setPlanForm({ ...planForm, objectives: e.target.value })}
                  rows={2}
                  placeholder="Objetivo 1&#10;Objetivo 2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estrategias de Adaptación (una por línea)</label>
                <textarea
                  value={planForm.adaptationStrategies}
                  onChange={(e) => setPlanForm({ ...planForm, adaptationStrategies: e.target.value })}
                  rows={2}
                  placeholder="Estrategia 1&#10;Estrategia 2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Compromiso Familiar</label>
                <textarea
                  value={planForm.familyCommitment}
                  onChange={(e) => setPlanForm({ ...planForm, familyCommitment: e.target.value })}
                  rows={2}
                  placeholder="Compromisos acordados con la familia..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Seguimiento</label>
                <input
                  type="date"
                  value={planForm.followUpDate}
                  onChange={(e) => setPlanForm({ ...planForm, followUpDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
                {editingPlan ? 'Actualizar' : 'Crear Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREAR ACTIVIDAD                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Nueva Actividad</h2>
              <button onClick={() => setShowActivityModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tema <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={activityForm.topic}
                  onChange={(e) => setActivityForm({ ...activityForm, topic: e.target.value })}
                  placeholder="Tema de la actividad..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción Original</label>
                <textarea
                  value={activityForm.originalActivityDescription}
                  onChange={(e) => setActivityForm({ ...activityForm, originalActivityDescription: e.target.value })}
                  rows={2}
                  placeholder="Actividad original del plan de estudios..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Actividad Adaptada</label>
                <textarea
                  value={activityForm.teacherFinalActivity}
                  onChange={(e) => setActivityForm({ ...activityForm, teacherFinalActivity: e.target.value })}
                  rows={2}
                  placeholder="Actividad adaptada para el estudiante..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel de Adaptación</label>
                <select
                  value={activityForm.adaptationLevel}
                  onChange={(e) => setActivityForm({ ...activityForm, adaptationLevel: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                >
                  <option value="LOW">Bajo — Ajustes mínimos</option>
                  <option value="MEDIUM">Medio — Adaptación parcial</option>
                  <option value="HIGH">Alto — Adaptación significativa</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowActivityModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={handleSaveActivity}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
                Crear Actividad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: REGISTRAR PROGRESO                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Registrar Progreso</h2>
              <button onClick={() => setShowProgressModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Indicador de Progreso</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button
                      key={i}
                      onClick={() => setProgressForm({ ...progressForm, progressIndicator: i })}
                      className="p-1"
                    >
                      <Star className={`w-8 h-8 transition-colors ${
                        i <= progressForm.progressIndicator ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-200'
                      }`} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-slate-500">{progressForm.progressIndicator}/5</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observación Cualitativa</label>
                <textarea
                  value={progressForm.qualitativeObservation}
                  onChange={(e) => setProgressForm({ ...progressForm, qualitativeObservation: e.target.value })}
                  rows={3}
                  placeholder="Describe el progreso observado..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowProgressModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={handleSaveProgressLog}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
