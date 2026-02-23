import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ClipboardList, Search, Plus, Eye, X, Save, Bell,
  ThumbsUp, AlertTriangle, AlertOctagon, FileText, Phone,
  Handshake, Brain, Send, Users, BookOpen,
  Activity, Shield, Edit2,
  CheckCircle, XCircle, Trash2, BarChart3, Loader2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { observerApi, teacherAssignmentsApi, groupsApi, enrollmentsApi } from '../lib/api'
import api from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  POSITIVE:             { label: 'Reconocimiento positivo',  color: 'text-green-700',  bg: 'bg-green-100',  icon: ThumbsUp },
  PEDAGOGICAL:          { label: 'Dificultad pedagógica',    color: 'text-yellow-700', bg: 'bg-yellow-100', icon: BookOpen },
  BEHAVIORAL_MILD:      { label: 'Indisciplina menor',       color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle },
  ACTA_TYPE_I:          { label: 'Acta Tipo I (leve)',       color: 'text-red-600',    bg: 'bg-red-100',    icon: FileText },
  ACTA_TYPE_II:         { label: 'Acta Tipo II (grave)',     color: 'text-red-700',    bg: 'bg-red-200',    icon: AlertOctagon },
  ACTA_TYPE_III:        { label: 'Acta Tipo III (gravísima)',color: 'text-red-900',    bg: 'bg-red-300',    icon: Shield },
  PARENT_CITATION:      { label: 'Citación acudiente',       color: 'text-purple-700', bg: 'bg-purple-100', icon: Phone },
  COMMITMENT:           { label: 'Compromiso',               color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Handshake },
  COUNSELING_FOLLOWUP:  { label: 'Seguimiento orientación',  color: 'text-cyan-700',   bg: 'bg-cyan-100',   icon: Brain },
  REFERRAL:             { label: 'Remisión',                 color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Send },
  COMMITTEE_DECISION:   { label: 'Decisión comité',          color: 'text-slate-700',  bg: 'bg-slate-200',  icon: Users },
  PEDAGOGICAL_FOLLOWUP: { label: 'Seguimiento pedagógico',   color: 'text-teal-700',   bg: 'bg-teal-100',   icon: Activity },
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  ACADEMIC:   { label: 'Académico',    color: 'bg-blue-100 text-blue-700' },
  BEHAVIORAL: { label: 'Convivencial', color: 'bg-purple-100 text-purple-700' },
  ATTENDANCE: { label: 'Asistencia',   color: 'bg-amber-100 text-amber-700' },
  UNIFORM:    { label: 'Uniforme',     color: 'bg-pink-100 text-pink-700' },
  OTHER:      { label: 'Otro',         color: 'bg-slate-100 text-slate-700' },
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Abierto',        color: 'text-blue-700',  bg: 'bg-blue-100' },
  IN_PROGRESS: { label: 'En seguimiento', color: 'text-amber-700', bg: 'bg-amber-100' },
  CLOSED:      { label: 'Cerrado',        color: 'text-green-700', bg: 'bg-green-100' },
}

// Permisos por rol
const canDeleteObs = (roles: string[]) => roles.some(r => ['ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR'].includes(r))
const canViewAll = (roles: string[]) => roles.some(r => ['ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR'].includes(r))

// Helpers
const fullName = (s: any) => s ? [s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ') : ''
const authorName = (a: any) => a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : ''

// Diagnóstico visual del estudiante basado en observaciones
function getDiagnosticBadge(obs: any[]) {
  if (!obs || obs.length === 0) return null
  const open = obs.filter(o => o.status !== 'CLOSED')
  const actas = open.filter(o => o.type?.startsWith('ACTA_TYPE'))
  const negative = open.filter(o => ['BEHAVIORAL_MILD', 'ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III'].includes(o.type))
  const positive = obs.filter(o => o.type === 'POSITIVE')

  if (actas.length >= 2) return { label: 'Alerta alta', color: 'bg-red-100 text-red-700 border-red-300' }
  if (negative.length >= 3) return { label: 'Seguimiento', color: 'bg-amber-100 text-amber-700 border-amber-300' }
  if (negative.length === 0 && positive.length >= 2) return { label: 'Destacado', color: 'bg-green-100 text-green-700 border-green-300' }
  if (negative.length > 0) return { label: 'Observado', color: 'bg-orange-100 text-orange-700 border-orange-300' }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function Observer() {
  const { user, institution: authInstitution } = useAuth()
  const institutionId = authInstitution?.id

  const userRoles = useMemo(() => {
    if (!user?.roles) return [] as string[]
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean) as string[]
  }, [user?.roles])

  const isAdmin = canViewAll(userRoles)
  const isTeacher = userRoles.includes('DOCENTE')

  // ─── Estado ─────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('')
  const [observations, setObservations] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedObs, setSelectedObs] = useState<any>(null)
  const [editingObs, setEditingObs] = useState(false)
  const [editForm, setEditForm] = useState({ type: '', category: '', description: '', actionTaken: '', requiresFollowUp: false, followUpDate: '', followUpNotes: '' })
  const [activeTab, setActiveTab] = useState<'observations' | 'summary'>('observations')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [academicYearId, setAcademicYearId] = useState('')

  // Form para nueva observación
  const [formData, setFormData] = useState({
    studentEnrollmentId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'POSITIVE',
    category: 'ACADEMIC',
    description: '',
    actionTaken: '',
    requiresFollowUp: false,
    followUpDate: '',
  })
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  // ─── Cargar año académico activo ──────────────────────────────────────
  useEffect(() => {
    const fetchYear = async () => {
      if (!institutionId) return
      try {
        const res = await api.get(`/academic-years/institution/${institutionId}/current`)
        if (res.data?.id) setAcademicYearId(res.data.id)
      } catch { /* sin año activo */ }
    }
    fetchYear()
  }, [institutionId])

  // ─── Cargar grupos ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchGroups = async () => {
      if (!institutionId) return
      try {
        if (isTeacher && user?.id) {
          // Docente: extraer grupos de sus asignaciones
          const res = await teacherAssignmentsApi.getAll({ teacherId: user.id })
          const data = res.data || []
          const uniqueGroups = new Map<string, any>()
          data.forEach((a: any) => {
            if (a.group?.id && !uniqueGroups.has(a.group.id)) {
              uniqueGroups.set(a.group.id, {
                id: a.group.id,
                name: `${a.group.grade?.name || ''} ${a.group.name || ''}`.trim(),
              })
            }
          })
          setGroups(Array.from(uniqueGroups.values()))
        } else {
          // Admin/Coordinador: todos los grupos de la institución
          const res = await groupsApi.getAll({ institutionId })
          const data = res.data || []
          setGroups(data.map((g: any) => ({
            id: g.id,
            name: `${g.grade?.name || ''} ${g.name || ''}`.trim(),
          })))
        }
      } catch (err) {
        console.error('Error loading groups:', err)
      }
    }
    fetchGroups()
  }, [institutionId, user?.id, isTeacher])

  // ─── Cargar estudiantes del grupo ─────────────────────────────────────
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedGroupId || !academicYearId) {
        setStudents([])
        return
      }
      try {
        const res = await enrollmentsApi.getAll({ groupId: selectedGroupId, academicYearId, status: 'ACTIVE' })
        const data = res.data || []
        setStudents(data.map((e: any) => ({
          enrollmentId: e.id,
          studentId: e.student?.id || e.studentId,
          name: fullName(e.student),
          hasDiagnosis: e.student?.hasDiagnosis || false,
          diagnosisType: e.student?.diagnosisType || undefined,
        })).sort((a: any, b: any) => a.name.localeCompare(b.name)))
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    fetchStudents()
  }, [selectedGroupId, academicYearId])

  // ─── Cargar observaciones del grupo ───────────────────────────────────
  const loadObservations = useCallback(async () => {
    if (!selectedGroupId || !academicYearId) {
      setObservations([])
      return
    }
    setLoading(true)
    try {
      const filters: any = {}
      if (filterType) filters.type = filterType
      if (filterStatus) filters.status = filterStatus
      const res = await observerApi.getByGroup(selectedGroupId, academicYearId, filters)
      setObservations(res.data || [])
    } catch (err) {
      console.error('Error loading observations:', err)
      setObservations([])
    } finally {
      setLoading(false)
    }
  }, [selectedGroupId, academicYearId, filterType, filterStatus])

  useEffect(() => { loadObservations() }, [loadObservations])

  // ─── Cargar resumen del estudiante seleccionado ───────────────────────
  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedEnrollmentId) { setSummary(null); return }
      try {
        const res = await observerApi.getSummary(selectedEnrollmentId)
        setSummary(res.data)
      } catch { setSummary(null) }
    }
    fetchSummary()
  }, [selectedEnrollmentId])

  // ─── Filtrado local (búsqueda por nombre) ─────────────────────────────
  const filteredObservations = useMemo(() => {
    if (!searchTerm) return observations
    const term = searchTerm.toLowerCase()
    return observations.filter((obs: any) => {
      const sName = fullName(obs.studentEnrollment?.student).toLowerCase()
      const desc = (obs.description || '').toLowerCase()
      return sName.includes(term) || desc.includes(term)
    })
  }, [observations, searchTerm])

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: observations.length,
    positive: observations.filter((o: any) => o.type === 'POSITIVE').length,
    negative: observations.filter((o: any) => ['BEHAVIORAL_MILD', 'ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III'].includes(o.type)).length,
    commitments: observations.filter((o: any) => o.type === 'COMMITMENT').length,
    pending: observations.filter((o: any) => o.requiresFollowUp && o.status !== 'CLOSED').length,
  }), [observations])

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (selectedStudentIds.length === 0 || !formData.description) return
    setSaving(true)
    try {
      let created = 0
      let errors = 0
      for (const enrollmentId of selectedStudentIds) {
        try {
          await observerApi.create({
            studentEnrollmentId: enrollmentId,
            date: formData.date,
            type: formData.type,
            category: formData.category,
            description: formData.description,
            actionTaken: formData.actionTaken || undefined,
            requiresFollowUp: formData.requiresFollowUp,
            followUpDate: formData.followUpDate || undefined,
          })
          created++
        } catch {
          errors++
        }
      }
      if (errors > 0) {
        setToast({ msg: `${created} observación(es) registrada(s), ${errors} error(es)`, type: created > 0 ? 'success' : 'error' })
      } else {
        setToast({ msg: selectedStudentIds.length > 1 ? `Observación registrada para ${created} estudiantes` : 'Observación registrada correctamente', type: 'success' })
      }
      setShowCreateModal(false)
      setSelectedStudentIds([])
      setStudentSearchTerm('')
      setFormData({
        studentEnrollmentId: '',
        date: new Date().toISOString().split('T')[0],
        type: 'POSITIVE',
        category: 'ACADEMIC',
        description: '',
        actionTaken: '',
        requiresFollowUp: false,
        followUpDate: '',
      })
      loadObservations()
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message || 'Error al registrar', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta observación?')) return
    try {
      await observerApi.delete(id)
      setToast({ msg: 'Observación eliminada', type: 'success' })
      loadObservations()
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message || 'Error al eliminar', type: 'error' })
    }
  }

  const handleStartEdit = (obs: any) => {
    setEditForm({
      type: obs.type || 'POSITIVE',
      category: obs.category || 'ACADEMIC',
      description: obs.description || '',
      actionTaken: obs.actionTaken || '',
      requiresFollowUp: obs.requiresFollowUp || false,
      followUpDate: obs.followUpDate ? new Date(obs.followUpDate).toISOString().split('T')[0] : '',
      followUpNotes: obs.followUpNotes || '',
    })
    setEditingObs(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedObs?.id || !editForm.description) return
    setSaving(true)
    try {
      const updated = await observerApi.update(selectedObs.id, {
        type: editForm.type,
        category: editForm.category,
        description: editForm.description,
        actionTaken: editForm.actionTaken || undefined,
        requiresFollowUp: editForm.requiresFollowUp,
        followUpDate: editForm.followUpDate || undefined,
        followUpNotes: editForm.followUpNotes || undefined,
      })
      setSelectedObs(updated.data)
      setEditingObs(false)
      setToast({ msg: 'Observación actualizada correctamente', type: 'success' })
      loadObservations()
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message || 'Error al actualizar', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleMarkNotified = async (id: string) => {
    try {
      await observerApi.markParentNotified(id)
      setToast({ msg: 'Marcado como notificado', type: 'success' })
      loadObservations()
    } catch (err: any) {
      setToast({ msg: 'Error al notificar', type: 'error' })
    }
  }

  // ─── Nombre de estudiante desde observación ───────────────────────────
  const obsStudentName = (obs: any) => {
    if (obs.studentEnrollment?.student) return fullName(obs.studentEnrollment.student)
    const found = students.find(s => s.enrollmentId === obs.studentEnrollmentId)
    return found?.name || 'Estudiante'
  }

  const obsGroupName = (obs: any) => {
    const g = obs.studentEnrollment?.group
    if (g) return `${g.grade?.name || ''} ${g.name || ''}`.trim()
    return groups.find(gr => gr.id === selectedGroupId)?.name || ''
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Observador del Estudiante</h1>
            {/* Badge diagnóstico de rol */}
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
              isAdmin ? 'bg-purple-100 text-purple-700 border-purple-300' :
              'bg-slate-100 text-slate-700 border-slate-300'
            }`}>
              <Shield className="w-3 h-3 inline mr-1" />
              {isAdmin ? 'Administrador' : isTeacher ? 'Docente' : 'Usuario'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro y seguimiento de situaciones académicas y convivenciales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedGroupId && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva Observación
            </button>
          )}
        </div>
      </div>

      {/* Selección de grupo */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value)
                setSelectedEnrollmentId('')
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Seleccionar grupo...</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          {selectedGroupId && students.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">Estudiante (opcional, para filtrar)</label>
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Todos los estudiantes ({students.length})</option>
                {students.map(s => (
                  <option key={s.enrollmentId} value={s.enrollmentId}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[200px] relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Buscar</label>
            <Search className="w-4 h-4 absolute left-3 bottom-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(typeConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(statusConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedGroupId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <ThumbsUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.positive}</p>
                <p className="text-xs text-slate-500">Positivas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.negative}</p>
                <p className="text-xs text-slate-500">Negativas</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Handshake className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.commitments}</p>
                <p className="text-xs text-slate-500">Compromisos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.pending}</p>
                <p className="text-xs text-slate-500">Seguimientos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Observaciones | Resumen */}
      {selectedEnrollmentId && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('observations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'observations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Observaciones
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            Resumen
          </button>
        </div>
      )}

      {/* Summary panel */}
      {activeTab === 'summary' && selectedEnrollmentId && summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Resumen del estudiante
            {(() => {
              const badge = getDiagnosticBadge(observations.filter((o: any) => o.studentEnrollmentId === selectedEnrollmentId))
              return badge ? (
                <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                  {badge.label}
                </span>
              ) : null
            })()}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Total observaciones</p>
              <p className="text-xl font-bold text-slate-900">{summary.totalObservations ?? 0}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-green-600">Positivas</p>
              <p className="text-xl font-bold text-green-700">{summary.positive ?? 0}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-red-600">Negativas</p>
              <p className="text-xl font-bold text-red-700">{summary.negative ?? 0}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-amber-600">Compromisos abiertos</p>
              <p className="text-xl font-bold text-amber-700">{summary.openCommitments ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder si no hay grupo seleccionado */}
      {!selectedGroupId && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Seleccione un grupo</h3>
          <p className="text-sm text-slate-500">Elija un grupo para ver y registrar observaciones</p>
        </div>
      )}

      {/* Observations List */}
      {selectedGroupId && (activeTab === 'observations' || !selectedEnrollmentId) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Fecha</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Estudiante</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Tipo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Categoría</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 max-w-xs">Descripción</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Estado</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Notificado</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredObservations.map((obs: any) => {
                      const tc = typeConfig[obs.type] || typeConfig.POSITIVE
                      const cc = categoryConfig[obs.category] || categoryConfig.OTHER
                      const sc = statusConfig[obs.status] || statusConfig.OPEN
                      const TypeIcon = tc.icon
                      const studentObs = observations.filter((o: any) => o.studentEnrollmentId === obs.studentEnrollmentId)
                      const badge = getDiagnosticBadge(studentObs)
                      return (
                        <tr key={obs.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(obs.date).toLocaleDateString('es-CO')}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-900">{obsStudentName(obs)}</p>
                            {badge && (
                              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${badge.color}`}>
                                {badge.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tc.bg} ${tc.color}`}>
                              <TypeIcon className="w-3 h-3" />
                              {tc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${cc.color}`}>
                              {cc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                            {obs.description}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {obs.parentNotified ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <button
                                onClick={() => handleMarkNotified(obs.id)}
                                title="Marcar como notificado"
                                className="mx-auto"
                              >
                                <XCircle className="w-5 h-5 text-slate-300 hover:text-amber-500 transition-colors" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => { setSelectedObs(obs); setEditingObs(false); setShowDetailModal(true) }}
                                className="p-1.5 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700"
                                title="Ver detalle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedObs(obs); handleStartEdit(obs); setShowDetailModal(true) }}
                                className="p-1.5 hover:bg-amber-50 rounded text-amber-500 hover:text-amber-700"
                                title="Editar observación"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {canDeleteObs(userRoles) && (
                                <button
                                  onClick={() => handleDelete(obs.id)}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filteredObservations.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No se encontraron observaciones</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ Modal Nueva Observación ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Nueva Observación</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Selección de estudiantes implicados */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estudiante(s) implicado(s) *
                  {selectedStudentIds.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {selectedStudentIds.length} seleccionado{selectedStudentIds.length > 1 ? 's' : ''}
                    </span>
                  )}
                </label>
                <p className="text-xs text-slate-500 mb-2">Puede seleccionar varios estudiantes para registrar la misma observación a todos.</p>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  {/* Buscador y seleccionar todos */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar estudiante..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = students.filter(s => !studentSearchTerm || s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                        const allIds = filtered.map(s => s.enrollmentId)
                        const allSelected = allIds.every(id => selectedStudentIds.includes(id))
                        if (allSelected) {
                          setSelectedStudentIds(selectedStudentIds.filter(id => !allIds.includes(id)))
                        } else {
                          setSelectedStudentIds([...new Set([...selectedStudentIds, ...allIds])])
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                    >
                      {students.filter(s => !studentSearchTerm || s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())).every(s => selectedStudentIds.includes(s.enrollmentId))
                        ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  {/* Lista de estudiantes con checkboxes */}
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {students
                      .filter(s => !studentSearchTerm || s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                      .map((s, idx) => (
                        <label
                          key={s.enrollmentId}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${
                            selectedStudentIds.includes(s.enrollmentId) ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(s.enrollmentId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds([...selectedStudentIds, s.enrollmentId])
                              } else {
                                setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.enrollmentId))
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400 w-5 text-right">{idx + 1}.</span>
                          <span className="text-sm text-slate-800">{s.name}</span>
                        </label>
                      ))}
                    {students.filter(s => !studentSearchTerm || s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())).length === 0 && (
                      <p className="px-3 py-3 text-sm text-slate-400 text-center">No se encontraron estudiantes</p>
                    )}
                  </div>
                </div>
                {/* Chips de seleccionados */}
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedStudentIds.map(id => {
                      const s = students.find(st => st.enrollmentId === id)
                      return s ? (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {s.name}
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id))}
                            className="hover:text-blue-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <optgroup label="Observaciones generales">
                      {Object.entries(typeConfig).filter(([k]) => !k.startsWith('ACTA_TYPE')).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </optgroup>
                    {isAdmin && (
                      <optgroup label="Clase de Situación (Ley 1620)">
                        {Object.entries(typeConfig).filter(([k]) => k.startsWith('ACTA_TYPE')).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {Object.entries(categoryConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {isAdmin && formData.type.startsWith('ACTA_TYPE') && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700">
                    ⚠️ Situación {formData.type === 'ACTA_TYPE_I' ? 'Tipo I (leve)' : formData.type === 'ACTA_TYPE_II' ? 'Tipo II (grave)' : 'Tipo III (gravísima)'} — Ley 1620
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {formData.type === 'ACTA_TYPE_I' ? 'Conflictos manejados inadecuadamente que no generan daño al cuerpo o a la salud.' :
                     formData.type === 'ACTA_TYPE_II' ? 'Agresión escolar, acoso escolar o ciberacoso que no constituyen delito.' :
                     'Situaciones que constituyen presunto delito contra la libertad, integridad y formación sexual.'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Describa la situación observada..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acción Tomada</label>
                <textarea
                  value={formData.actionTaken}
                  onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="¿Qué acción se tomó? (opcional)"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresFollowUp}
                    onChange={(e) => setFormData({ ...formData, requiresFollowUp: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700">Requiere seguimiento</span>
                </label>
              </div>

              {formData.requiresFollowUp && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Seguimiento</label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedStudentIds.length === 0 || !formData.description || saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal Detalle / Editar ═══ */}
      {showDetailModal && selectedObs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingObs ? 'Editar Observación' : 'Detalle de Observación'}
              </h3>
              <button onClick={() => { setShowDetailModal(false); setEditingObs(false) }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                const obsType = editingObs ? editForm.type : selectedObs.type
                const obsCat = editingObs ? editForm.category : selectedObs.category
                const tc = typeConfig[obsType] || typeConfig.POSITIVE
                const cc = categoryConfig[obsCat] || categoryConfig.OTHER
                const sc = statusConfig[selectedObs.status] || statusConfig.OPEN
                const TypeIcon = tc.icon
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tc.bg}`}>
                        <TypeIcon className={`w-5 h-5 ${tc.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{obsStudentName(selectedObs)}</p>
                        <p className="text-sm text-slate-500">{obsGroupName(selectedObs)} • {new Date(selectedObs.date).toLocaleDateString('es-CO')}</p>
                      </div>
                    </div>

                    {editingObs ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                              {Object.entries(typeConfig).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            >
                              {Object.entries(categoryConfig).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Acción Tomada</label>
                          <textarea
                            value={editForm.actionTaken}
                            onChange={(e) => setEditForm({ ...editForm, actionTaken: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                        </div>

                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.requiresFollowUp}
                              onChange={(e) => setEditForm({ ...editForm, requiresFollowUp: e.target.checked })}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-slate-700">Requiere seguimiento</span>
                          </label>
                        </div>

                        {editForm.requiresFollowUp && (
                          <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Seguimiento</label>
                              <input
                                type="date"
                                value={editForm.followUpDate}
                                onChange={(e) => setEditForm({ ...editForm, followUpDate: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">Notas de Seguimiento</label>
                              <textarea
                                value={editForm.followUpNotes}
                                onChange={(e) => setEditForm({ ...editForm, followUpNotes: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                placeholder="Notas adicionales del seguimiento..."
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${tc.bg} ${tc.color}`}>
                            {tc.label}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${cc.color}`}>
                            {cc.label}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-1">Descripción</p>
                          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{selectedObs.description}</p>
                        </div>

                        {selectedObs.actionTaken && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 mb-1">Acción Tomada</p>
                            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedObs.actionTaken}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Acudiente Notificado</p>
                            <p className="font-medium">{selectedObs.parentNotified ? 'Sí' : 'No'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Requiere Seguimiento</p>
                            <p className="font-medium">{selectedObs.requiresFollowUp ? 'Sí' : 'No'}</p>
                          </div>
                        </div>

                        {selectedObs.followUpDate && (
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <p className="text-sm font-medium text-purple-700">Fecha de Seguimiento</p>
                            <p className="text-sm text-purple-600">{new Date(selectedObs.followUpDate).toLocaleDateString('es-CO')}</p>
                            {selectedObs.followUpNotes && (
                              <p className="text-sm text-purple-600 mt-1">{selectedObs.followUpNotes}</p>
                            )}
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                          <p>Registrado por: {authorName(selectedObs.author)}</p>
                          <p>Fecha de registro: {new Date(selectedObs.createdAt).toLocaleString('es-CO')}</p>
                        </div>
                      </>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              {editingObs ? (
                <>
                  <button
                    onClick={() => setEditingObs(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editForm.description || saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Cambios
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleStartEdit(selectedObs)}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => { setShowDetailModal(false); setEditingObs(false) }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
