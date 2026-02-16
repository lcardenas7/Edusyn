import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'
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
} from 'lucide-react'
import {
  academicYearsApi,
  academicTermsApi,
  teacherAssignmentsApi,
  academicStudentsApi,
  pedagogicalSupportApi,
} from '../lib/api'

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  ACTIVE: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Activo' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completado' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', icon: XCircle, label: 'Cancelado' },
}

export default function PedagogicalSupport() {
  const { user, institution: authInstitution } = useAuth()
  const { academicLevels } = useAcademic()
  const institutionId = authInstitution?.id

  // Filters
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Data
  const [plans, setPlans] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [form, setForm] = useState({
    studentEnrollmentId: '',
    supportStrategy: '',
    familyCommitment: '',
    followUpDate: '',
    observations: '',
  })

  // Expanded rows
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)

  const isAdmin = user?.roles?.some((r: any) =>
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL'].includes(r.role?.name || r.name)
  )
  const isCoordinator = user?.roles?.some((r: any) =>
    ['COORDINADOR'].includes(r.role?.name || r.name)
  )
  const isAdminOrCoordinator = isAdmin || isCoordinator

  // ── Check if selected group is DIMENSIONS ──
  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId), [groups, selectedGroupId])
  const isDimensions = selectedGroup?.academicStructure === 'DIMENSIONS' || selectedGroup?.gradeStage === 'PREESCOLAR'

  // ── Load academic years ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await academicYearsApi.getAll()
        setAcademicYears(res.data || [])
        const current = res.data?.find((y: any) => y.isCurrent)
        if (current) setSelectedYearId(current.id)
      } catch (err) {
        console.error('Error loading academic years:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Load terms when year changes ──
  useEffect(() => {
    if (!selectedYearId) return
    const load = async () => {
      try {
        const res = await academicTermsApi.getAll(selectedYearId)
        setTerms(res.data || [])
        if (res.data?.length > 0) setSelectedTermId(res.data[0].id)
      } catch (err) {
        console.error('Error loading terms:', err)
        setTerms([])
      }
    }
    load()
  }, [selectedYearId])

  // ── Load groups (only DIMENSIONS) ──
  useEffect(() => {
    if (!selectedYearId) return
    const load = async () => {
      try {
        // teacherAssignmentsApi ya resuelve institutionId en backend para admin/coordinador
        const res = await teacherAssignmentsApi.getAll({ academicYearId: selectedYearId })
        const assignments = res.data || []
        console.log('[PedagogicalSupport] assignments loaded:', assignments.length)
        const uniqueGroups = new Map<string, any>()
        assignments.forEach((a: any) => {
          if (a.group && !uniqueGroups.has(a.group.id)) {
            uniqueGroups.set(a.group.id, {
              id: a.group.id,
              name: a.group.name,
              gradeName: a.group.grade?.name,
              gradeStage: a.group.grade?.stage,
              academicStructure: a.group.grade?.academicStructure,
            })
          }
        })
        console.log('[PedagogicalSupport] all groups:', Array.from(uniqueGroups.values()).map(g => ({ name: g.name, structure: g.academicStructure, stage: g.gradeStage })))
        // Filter only DIMENSIONS groups
        const dimensionsGroups = Array.from(uniqueGroups.values()).filter(
          g => g.academicStructure === 'DIMENSIONS' || g.gradeStage === 'PREESCOLAR'
        )
        console.log('[PedagogicalSupport] DIMENSIONS groups:', dimensionsGroups.length)
        setGroups(dimensionsGroups)
        if (dimensionsGroups.length > 0) {
          setSelectedGroupId(dimensionsGroups[0].id)
        } else {
          setSelectedGroupId('')
        }
      } catch (err) {
        console.error('Error loading groups:', err)
        setGroups([])
      }
    }
    load()
  }, [selectedYearId])

  // ── Load plans when filters change ──
  useEffect(() => {
    if (!selectedGroupId || !selectedTermId) {
      setPlans([])
      return
    }
    const load = async () => {
      setLoadingPlans(true)
      try {
        const res = await pedagogicalSupportApi.getByGroup(
          selectedGroupId,
          selectedTermId,
          statusFilter || undefined,
        )
        setPlans(res.data || [])
      } catch (err) {
        console.error('Error loading plans:', err)
        setPlans([])
      } finally {
        setLoadingPlans(false)
      }
    }
    load()
  }, [selectedGroupId, selectedTermId, statusFilter])

  // ── Load students for the selected group ──
  useEffect(() => {
    if (!selectedGroupId || !selectedYearId) {
      setStudents([])
      return
    }
    const load = async () => {
      try {
        const res = await academicStudentsApi.getByGroup({
          groupId: selectedGroupId,
          academicYearId: selectedYearId,
          institutionId,
        })
        setStudents(res.data || [])
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    load()
  }, [selectedGroupId, selectedYearId, institutionId])

  // ── Handlers ──
  const openCreateModal = () => {
    setEditingPlan(null)
    setForm({
      studentEnrollmentId: '',
      supportStrategy: '',
      familyCommitment: '',
      followUpDate: '',
      observations: '',
    })
    setShowModal(true)
  }

  const openEditModal = (plan: any) => {
    setEditingPlan(plan)
    setForm({
      studentEnrollmentId: plan.studentEnrollmentId,
      supportStrategy: plan.supportStrategy || '',
      familyCommitment: plan.familyCommitment || '',
      followUpDate: plan.followUpDate ? plan.followUpDate.split('T')[0] : '',
      observations: plan.observations || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.studentEnrollmentId || !form.supportStrategy) {
      setMessage({ type: 'error', text: 'Estudiante y estrategia de apoyo son obligatorios' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      if (editingPlan) {
        await pedagogicalSupportApi.update(editingPlan.id, {
          supportStrategy: form.supportStrategy,
          familyCommitment: form.familyCommitment || undefined,
          followUpDate: form.followUpDate || undefined,
          observations: form.observations || undefined,
        })
        setMessage({ type: 'success', text: 'Plan actualizado correctamente' })
      } else {
        await pedagogicalSupportApi.create({
          studentEnrollmentId: form.studentEnrollmentId,
          academicTermId: selectedTermId,
          supportStrategy: form.supportStrategy,
          familyCommitment: form.familyCommitment || undefined,
          followUpDate: form.followUpDate || undefined,
          observations: form.observations || undefined,
        })
        setMessage({ type: 'success', text: 'Plan de acompañamiento creado correctamente' })
      }
      setShowModal(false)
      // Reload plans
      const res = await pedagogicalSupportApi.getByGroup(
        selectedGroupId,
        selectedTermId,
        statusFilter || undefined,
      )
      setPlans(res.data || [])
    } catch (err: any) {
      console.error('Error saving plan:', err)
      const msg = err.response?.data?.message || 'Error al guardar el plan'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  const handleStatusChange = async (planId: string, newStatus: 'COMPLETED' | 'CANCELLED') => {
    try {
      if (newStatus === 'COMPLETED') {
        await pedagogicalSupportApi.markCompleted(planId)
      } else {
        await pedagogicalSupportApi.update(planId, { status: newStatus })
      }
      // Reload
      const res = await pedagogicalSupportApi.getByGroup(
        selectedGroupId,
        selectedTermId,
        statusFilter || undefined,
      )
      setPlans(res.data || [])
      setMessage({ type: 'success', text: `Plan marcado como ${STATUS_CONFIG[newStatus]?.label || newStatus}` })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Error updating status:', err)
      setMessage({ type: 'error', text: 'Error al actualizar el estado' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

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

  // Stats
  const stats = useMemo(() => {
    const active = plans.filter(p => p.status === 'ACTIVE').length
    const completed = plans.filter(p => p.status === 'COMPLETED').length
    const cancelled = plans.filter(p => p.status === 'CANCELLED').length
    return { active, completed, cancelled, total: plans.length }
  }, [plans])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // If no DIMENSIONS groups exist
  if (groups.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            No hay grupos con estructura DIMENSIONS
          </h2>
          <p className="text-amber-600">
            El acompañamiento pedagógico solo aplica para niveles con estructura académica de tipo
            <strong> Dimensiones</strong> (preescolar). No se encontraron grupos con esta configuración
            en el año académico seleccionado.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-purple-600" />
            Acompañamiento Pedagógico
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Planes de apoyo para estudiantes con desempeño bajo en dimensiones (preescolar)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={!selectedGroupId || !selectedTermId}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Plan
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seleccionar...</option>
              {academicYears.map((y: any) => (
                <option key={y.id} value={y.id}>
                  {y.name || y.year} {y.isCurrent ? '(Actual)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seleccionar...</option>
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Seleccionar...</option>
              {groups.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.gradeName ? `(${g.gradeName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="COMPLETED">Completados</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Planes</div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{stats.active}</div>
            <div className="text-xs text-amber-600">Activos</div>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-xs text-green-600">Completados</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-slate-500">{stats.cancelled}</div>
            <div className="text-xs text-slate-400">Cancelados</div>
          </div>
        </div>
      )}

      {/* Plans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loadingPlans ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium">No hay planes de acompañamiento</p>
            <p className="text-sm mt-1">
              {selectedGroupId && selectedTermId
                ? 'Crea un nuevo plan para comenzar el seguimiento pedagógico.'
                : 'Selecciona un grupo y período para ver los planes.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estudiante</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estrategia de Apoyo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Seguimiento</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan: any) => {
                  const student = plan.studentEnrollment?.student
                  const studentName = student
                    ? `${student.firstName} ${student.lastName}`
                    : 'Estudiante'
                  const isExpanded = expandedPlanId === plan.id

                  return (
                    <>
                      <tr
                        key={plan.id}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <div className="font-medium text-slate-900">{studentName}</div>
                              <div className="text-xs text-slate-400">
                                {plan.studentEnrollment?.group?.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs truncate text-slate-700">
                            {plan.supportStrategy}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {plan.followUpDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(plan.followUpDate).toLocaleDateString('es-CO')}
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin fecha</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(plan.status)}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {plan.status === 'ACTIVE' && (
                              <>
                                <button
                                  onClick={() => openEditModal(plan)}
                                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(plan.id, 'COMPLETED')}
                                  className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Marcar completado"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(plan.id, 'CANCELLED')}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Cancelar"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${plan.id}-detail`} className="bg-purple-50/30">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Estrategia de Apoyo</h4>
                                <p className="text-slate-600 whitespace-pre-wrap">{plan.supportStrategy}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Compromiso Familiar</h4>
                                <p className="text-slate-600 whitespace-pre-wrap">
                                  {plan.familyCommitment || 'No registrado'}
                                </p>
                              </div>
                              {plan.observations && (
                                <div className="md:col-span-2">
                                  <h4 className="font-medium text-slate-700 mb-1">Observaciones</h4>
                                  <p className="text-slate-600 whitespace-pre-wrap">{plan.observations}</p>
                                </div>
                              )}
                              {plan.achievement && (
                                <div>
                                  <h4 className="font-medium text-slate-700 mb-1">Dimensión</h4>
                                  <p className="text-slate-600">{plan.achievement.baseDescription}</p>
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-slate-700 mb-1">Creado</h4>
                                <p className="text-slate-600">
                                  {new Date(plan.createdAt).toLocaleDateString('es-CO', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingPlan ? 'Editar Plan de Acompañamiento' : 'Nuevo Plan de Acompañamiento'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Student selector (only for new plans) */}
              {!editingPlan && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estudiante <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.studentEnrollmentId}
                    onChange={(e) => setForm({ ...form, studentEnrollmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Seleccionar estudiante...</option>
                    {students.map((s: any) => (
                      <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>
                        {s.firstName || s.name} {s.lastName || ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Support Strategy */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estrategia de Apoyo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.supportStrategy}
                  onChange={(e) => setForm({ ...form, supportStrategy: e.target.value })}
                  rows={3}
                  placeholder="Describe la estrategia pedagógica a implementar..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Family Commitment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Compromiso Familiar
                </label>
                <textarea
                  value={form.familyCommitment}
                  onChange={(e) => setForm({ ...form, familyCommitment: e.target.value })}
                  rows={2}
                  placeholder="Compromisos acordados con la familia..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fecha de Seguimiento
                </label>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Observations */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={form.observations}
                  onChange={(e) => setForm({ ...form, observations: e.target.value })}
                  rows={2}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingPlan ? 'Actualizar' : 'Crear Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
