import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList,
  Search,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
  X,
  Save,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Handshake,
  Download,
  Printer,
  Settings,
  Shield,
  CheckSquare,
  Clock,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { teacherAssignmentsApi } from '../lib/api'

// Tipos de rol del sistema
type UserRole = 'TEACHER' | 'COORDINATOR' | 'RECTOR' | 'ADMIN'

// Estado del caso/observación
type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED'

type ObservationType = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'COMMITMENT'
type ObservationCategory = 'ACADEMIC' | 'BEHAVIORAL' | 'ATTENDANCE' | 'UNIFORM' | 'OTHER'

interface Observation {
  id: string
  studentId: string
  studentName: string
  group: string
  date: string
  type: ObservationType
  category: ObservationCategory
  description: string
  actionTaken?: string
  parentNotified: boolean
  parentNotifiedAt?: string
  requiresFollowUp: boolean
  followUpDate?: string
  followUpNotes?: string
  author: string
  authorId: string
  createdAt: string
  // Campos para seguimiento (Coordinador)
  status: CaseStatus
  closedAt?: string
  closedBy?: string
  closureNotes?: string
}

// Configuración de permisos por rol
const rolePermissions: Record<UserRole, {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canViewAll: boolean
  canDoFollowUp: boolean
  canCloseCases: boolean
  canConfigure: boolean
  label: string
}> = {
  TEACHER: {
    canCreate: true,
    canEdit: true, // Solo sus propias observaciones
    canDelete: false,
    canViewAll: false, // Solo sus grupos
    canDoFollowUp: false,
    canCloseCases: false,
    canConfigure: false,
    label: 'Docente'
  },
  COORDINATOR: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewAll: true,
    canDoFollowUp: true,
    canCloseCases: true,
    canConfigure: false,
    label: 'Coordinador'
  },
  RECTOR: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewAll: true,
    canDoFollowUp: true,
    canCloseCases: true,
    canConfigure: true,
    label: 'Rector'
  },
  ADMIN: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewAll: true,
    canDoFollowUp: true,
    canCloseCases: true,
    canConfigure: true,
    label: 'Administrador'
  }
}

const statusConfig: Record<CaseStatus, { label: string; color: string; bgColor: string }> = {
  OPEN: { label: 'Abierto', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  IN_PROGRESS: { label: 'En Seguimiento', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  CLOSED: { label: 'Cerrado', color: 'text-green-700', bgColor: 'bg-green-100' },
}

const typeConfig: Record<ObservationType, { label: string; color: string; bgColor: string; icon: any }> = {
  POSITIVE: { label: 'Positiva', color: 'text-green-700', bgColor: 'bg-green-100', icon: ThumbsUp },
  NEGATIVE: { label: 'Negativa', color: 'text-red-700', bgColor: 'bg-red-100', icon: ThumbsDown },
  NEUTRAL: { label: 'Informativa', color: 'text-slate-700', bgColor: 'bg-slate-100', icon: Minus },
  COMMITMENT: { label: 'Compromiso', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Handshake },
}

const categoryConfig: Record<ObservationCategory, { label: string; color: string }> = {
  ACADEMIC: { label: 'Académico', color: 'bg-blue-100 text-blue-700' },
  BEHAVIORAL: { label: 'Comportamental', color: 'bg-purple-100 text-purple-700' },
  ATTENDANCE: { label: 'Asistencia', color: 'bg-amber-100 text-amber-700' },
  UNIFORM: { label: 'Uniforme', color: 'bg-pink-100 text-pink-700' },
  OTHER: { label: 'Otro', color: 'bg-slate-100 text-slate-700' },
}



// Estudiantes por grupo (para filtrar según rol)
const mockStudents = [
  { id: 's1', name: 'ACOSTA GUTIERREZ ALEXANDER DAVID', group: '9°A' },
  { id: 's2', name: 'ALVAREZ LARIOS DANYER JESIT', group: '9°A' },
  { id: 's3', name: 'AMARIS CASTRO KAROLAY', group: '9°A' },
  { id: 's4', name: 'ARRIETA CARVAJALINO JHON BREINER', group: '9°A' },
  { id: 's5', name: 'BARRIOS PADILLA LEINNER DAVID', group: '9°A' },
  { id: 's6', name: 'BROCHERO VELÁSQUEZ SHARICK PAOLA', group: '9°A' },
  { id: 's7', name: 'CAÑAS BALMACEDA DAIMY MICHELLE', group: '9°A' },
  { id: 's8', name: 'GONZALEZ MARTINEZ PEDRO LUIS', group: '10°A' },
  { id: 's9', name: 'HERNANDEZ LOPEZ MARIA JOSE', group: '10°A' },
  { id: 's10', name: 'JIMENEZ CASTRO ANDRES FELIPE', group: '9°B' },
]

const allGroups = ['9°A', '9°B', '10°A', '10°B', '11°A']

export default function Observer() {
  const { user } = useAuth()
  
  // Determinar rol del usuario
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  
  const isTeacher = userRoles.includes('DOCENTE')
  const isCoordinator = userRoles.includes('COORDINADOR')
  const isAdmin = userRoles.includes('ADMIN_INSTITUTIONAL') || userRoles.includes('SUPERADMIN')
  
  // Mapear rol del sistema
  const currentUserRole: UserRole = isAdmin ? 'ADMIN' : isCoordinator ? 'COORDINATOR' : 'TEACHER'
  const permissions = rolePermissions[currentUserRole]
  
  // Estado para grupos asignados del docente
  const [assignedGroups, setAssignedGroups] = useState<string[]>([])
  const [, setLoadingAssignments] = useState(true)
  
  // Cargar asignaciones del docente
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!isTeacher || !user?.id) {
        setLoadingAssignments(false)
        return
      }
      
      try {
        const response = await teacherAssignmentsApi.getAll({ teacherId: user.id })
        const data = response.data || []
        // Extraer grupos únicos de las asignaciones
        const groups = [...new Set(data.map((a: any) => 
          `${a.group?.grade?.name || ''} ${a.group?.name || ''}`.trim()
        ))].filter(Boolean)
        setAssignedGroups(groups as string[])
      } catch (err) {
        console.error('Error loading assignments:', err)
      } finally {
        setLoadingAssignments(false)
      }
    }
    fetchAssignments()
  }, [user?.id, isTeacher])

  const [observations, setObservations] = useState<Observation[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<ObservationType | 'ALL'>('ALL')
  const [filterCategory, setFilterCategory] = useState<ObservationCategory | 'ALL'>('ALL')
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'ALL'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Usuario actual para observaciones
  const currentUser = {
    id: user?.id || 'u1',
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Usuario',
    role: currentUserRole,
    assignedGroups: assignedGroups
  }

  // Estudiantes visibles según rol
  const visibleStudents = permissions.canViewAll 
    ? mockStudents 
    : mockStudents.filter(s => currentUser.assignedGroups.some(g => s.group.includes(g.split(' ')[0]) || g.includes(s.group)))

  // Grupos visibles según rol
  const visibleGroups = permissions.canViewAll 
    ? allGroups 
    : assignedGroups.length > 0 ? assignedGroups : allGroups

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'NEUTRAL' as ObservationType,
    category: 'ACADEMIC' as ObservationCategory,
    description: '',
    actionTaken: '',
    parentNotified: false,
    requiresFollowUp: false,
    followUpDate: '',
    followUpNotes: '',
  })

  // Filtro de grupo en el modal de nueva observación
  const [modalGroupFilter, setModalGroupFilter] = useState('ALL')

  // Estudiantes filtrados por grupo en el modal
  const filteredStudentsInModal = modalGroupFilter === 'ALL' 
    ? visibleStudents 
    : visibleStudents.filter(s => s.group === modalGroupFilter)

  // Obtener historial de observaciones del estudiante seleccionado
  const getStudentHistory = (studentId: string) => {
    return observations.filter(obs => obs.studentId === studentId)
  }

  // Estadísticas del estudiante seleccionado
  const selectedStudentHistory = formData.studentId ? getStudentHistory(formData.studentId) : []
  const studentStats = {
    total: selectedStudentHistory.length,
    positive: selectedStudentHistory.filter(o => o.type === 'POSITIVE').length,
    negative: selectedStudentHistory.filter(o => o.type === 'NEGATIVE').length,
    commitments: selectedStudentHistory.filter(o => o.type === 'COMMITMENT').length,
    openCases: selectedStudentHistory.filter(o => o.status !== 'CLOSED').length,
  }

  // Filtrar observaciones según permisos y filtros
  const filteredObservations = observations.filter(obs => {
    // Filtro por rol: Docente solo ve sus propias observaciones
    if (!permissions.canViewAll && obs.authorId !== currentUser.id) {
      return false
    }
    
    const matchesSearch = obs.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          obs.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'ALL' || obs.type === filterType
    const matchesCategory = filterCategory === 'ALL' || obs.category === filterCategory
    const matchesGroup = filterGroup === 'ALL' || obs.group === filterGroup
    const matchesStatus = filterStatus === 'ALL' || obs.status === filterStatus
    return matchesSearch && matchesType && matchesCategory && matchesGroup && matchesStatus
  })

  // Verificar si el usuario puede editar una observación específica
  const canEditObservation = (obs: Observation) => {
    if (!permissions.canEdit) return false
    // Docente solo puede editar sus propias observaciones
    if (currentUser.role === 'TEACHER' && obs.authorId !== currentUser.id) return false
    return true
  }

  // Verificar si el usuario puede eliminar una observación
  const canDeleteObservation = (_obs: Observation) => {
    if (!permissions.canDelete) return false
    return true
  }

  const handleOpenNew = () => {
    setFormData({
      studentId: '',
      date: new Date().toISOString().split('T')[0],
      type: 'NEUTRAL',
      category: 'ACADEMIC',
      description: '',
      actionTaken: '',
      parentNotified: false,
      requiresFollowUp: false,
      followUpDate: '',
      followUpNotes: '',
    })
    setModalGroupFilter('ALL')
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (obs: Observation) => {
    setFormData({
      studentId: obs.studentId,
      date: obs.date,
      type: obs.type,
      category: obs.category,
      description: obs.description,
      actionTaken: obs.actionTaken || '',
      parentNotified: obs.parentNotified,
      requiresFollowUp: obs.requiresFollowUp,
      followUpDate: obs.followUpDate || '',
      followUpNotes: obs.followUpNotes || '',
    })
    setSelectedObservation(obs)
    setIsEditing(true)
    setShowModal(true)
  }

  const handleSave = () => {
    const student = mockStudents.find(s => s.id === formData.studentId)
    if (!student) return

    if (isEditing && selectedObservation) {
      setObservations(observations.map(obs => 
        obs.id === selectedObservation.id 
          ? {
              ...obs,
              ...formData,
              studentName: student.name,
              group: student.group,
            }
          : obs
      ))
    } else {
      const newObs: Observation = {
        id: Date.now().toString(),
        studentId: formData.studentId,
        studentName: student.name,
        group: student.group,
        date: formData.date,
        type: formData.type,
        category: formData.category,
        description: formData.description,
        actionTaken: formData.actionTaken || undefined,
        parentNotified: formData.parentNotified,
        parentNotifiedAt: formData.parentNotified ? new Date().toISOString() : undefined,
        requiresFollowUp: formData.requiresFollowUp,
        followUpDate: formData.followUpDate || undefined,
        followUpNotes: formData.followUpNotes || undefined,
        author: currentUser.name,
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      }
      setObservations([newObs, ...observations])
    }
    setShowModal(false)
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Está seguro de eliminar esta observación?')) {
      setObservations(observations.filter(obs => obs.id !== id))
    }
  }

  const handleViewDetail = (obs: Observation) => {
    setSelectedObservation(obs)
    setShowDetailModal(true)
  }

  // Funciones de Coordinador: Seguimiento
  const [followUpData, setFollowUpData] = useState({ notes: '', nextDate: '' })
  
  const handleOpenFollowUp = (obs: Observation) => {
    setSelectedObservation(obs)
    setFollowUpData({ notes: obs.followUpNotes || '', nextDate: obs.followUpDate || '' })
    setShowFollowUpModal(true)
  }

  const handleSaveFollowUp = () => {
    if (!selectedObservation) return
    setObservations(observations.map(obs => 
      obs.id === selectedObservation.id 
        ? {
            ...obs,
            status: 'IN_PROGRESS',
            followUpNotes: followUpData.notes,
            followUpDate: followUpData.nextDate,
            requiresFollowUp: true,
          }
        : obs
    ))
    setShowFollowUpModal(false)
  }

  // Funciones de Coordinador: Cerrar caso
  const [closureNotes, setClosureNotes] = useState('')

  const handleOpenClose = (obs: Observation) => {
    setSelectedObservation(obs)
    setClosureNotes('')
    setShowCloseModal(true)
  }

  const handleCloseCase = () => {
    if (!selectedObservation) return
    setObservations(observations.map(obs => 
      obs.id === selectedObservation.id 
        ? {
            ...obs,
            status: 'CLOSED',
            closedAt: new Date().toISOString(),
            closedBy: currentUser.name,
            closureNotes: closureNotes,
          }
        : obs
    ))
    setShowCloseModal(false)
  }

  const stats = {
    total: observations.length,
    positive: observations.filter(o => o.type === 'POSITIVE').length,
    negative: observations.filter(o => o.type === 'NEGATIVE').length,
    commitments: observations.filter(o => o.type === 'COMMITMENT').length,
    pendingFollowUp: observations.filter(o => o.requiresFollowUp && !o.followUpNotes).length,
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Observador del Estudiante</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              currentUser.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
              currentUser.role === 'COORDINATOR' ? 'bg-green-100 text-green-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              <Shield className="w-3 h-3 inline mr-1" />
              {permissions.label}
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            {permissions.canViewAll 
              ? 'Acceso completo a todos los registros' 
              : `Grupos asignados: ${currentUser.assignedGroups.join(', ')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          {permissions.canConfigure && (
            <button 
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </button>
          )}
          {permissions.canCreate && (
            <button 
              onClick={handleOpenNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Nueva Observación
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
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
              <ThumbsDown className="w-5 h-5 text-red-600" />
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
              <p className="text-2xl font-bold text-purple-600">{stats.pendingFollowUp}</p>
              <p className="text-xs text-slate-500">Seguimientos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por estudiante o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="POSITIVE">Positivas</option>
              <option value="NEGATIVE">Negativas</option>
              <option value="NEUTRAL">Informativas</option>
              <option value="COMMITMENT">Compromisos</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="ALL">Todas las categorías</option>
              <option value="ACADEMIC">Académico</option>
              <option value="BEHAVIORAL">Comportamental</option>
              <option value="ATTENDANCE">Asistencia</option>
              <option value="UNIFORM">Uniforme</option>
              <option value="OTHER">Otro</option>
            </select>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="ALL">Todos los grupos</option>
              {visibleGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {permissions.canDoFollowUp && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="ALL">Todos los estados</option>
                <option value="OPEN">Abiertos</option>
                <option value="IN_PROGRESS">En Seguimiento</option>
                <option value="CLOSED">Cerrados</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Observations List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Fecha</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Estudiante</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Grupo</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Categoría</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600 max-w-xs">Descripción</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Notificado</th>
                {permissions.canDoFollowUp && (
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Estado</th>
                )}
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredObservations.map((obs) => {
                const TypeIcon = typeConfig[obs.type].icon
                return (
                  <tr key={obs.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(obs.date).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{obs.studentName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{obs.group}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeConfig[obs.type].bgColor} ${typeConfig[obs.type].color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig[obs.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${categoryConfig[obs.category].color}`}>
                        {categoryConfig[obs.category].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {obs.description}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {obs.parentNotified ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    {permissions.canDoFollowUp && (
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig[obs.status].bgColor} ${statusConfig[obs.status].color}`}>
                          {statusConfig[obs.status].label}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleViewDetail(obs)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEditObservation(obs) && (
                          <button 
                            onClick={() => handleEdit(obs)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.canDoFollowUp && obs.status !== 'CLOSED' && (
                          <button 
                            onClick={() => handleOpenFollowUp(obs)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-purple-600"
                            title="Seguimiento"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.canCloseCases && obs.status !== 'CLOSED' && (
                          <button 
                            onClick={() => handleOpenClose(obs)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-green-600"
                            title="Cerrar caso"
                          >
                            <CheckSquare className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteObservation(obs) && (
                          <button 
                            onClick={() => handleDelete(obs.id)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600"
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
      </div>

      {/* Modal Nueva/Editar Observación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {isEditing ? 'Editar Observación' : 'Nueva Observación'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Filtro por grupo y selección de estudiante */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filtrar por Grupo</label>
                  <select
                    value={modalGroupFilter}
                    onChange={(e) => {
                      setModalGroupFilter(e.target.value)
                      setFormData({ ...formData, studentId: '' }) // Reset estudiante al cambiar grupo
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  >
                    <option value="ALL">Todos los grupos</option>
                    {visibleGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estudiante *</label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Seleccionar estudiante ({filteredStudentsInModal.length})</option>
                    {filteredStudentsInModal.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Historial del estudiante seleccionado */}
              {formData.studentId && selectedStudentHistory.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-amber-800">
                      ⚠️ Este estudiante tiene {studentStats.total} observación(es) registrada(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {studentStats.positive > 0 && (
                      <span className="flex items-center gap-1 text-green-700">
                        <ThumbsUp className="w-3 h-3" /> {studentStats.positive} positiva(s)
                      </span>
                    )}
                    {studentStats.negative > 0 && (
                      <span className="flex items-center gap-1 text-red-700">
                        <ThumbsDown className="w-3 h-3" /> {studentStats.negative} negativa(s)
                      </span>
                    )}
                    {studentStats.commitments > 0 && (
                      <span className="flex items-center gap-1 text-amber-700">
                        <Handshake className="w-3 h-3" /> {studentStats.commitments} compromiso(s)
                      </span>
                    )}
                    {studentStats.openCases > 0 && (
                      <span className="flex items-center gap-1 text-blue-700">
                        <Clock className="w-3 h-3" /> {studentStats.openCases} caso(s) abierto(s)
                      </span>
                    )}
                  </div>
                  {/* Últimas observaciones */}
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <p className="text-xs font-medium text-amber-700 mb-1">Últimas observaciones:</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {selectedStudentHistory.slice(0, 3).map(obs => (
                        <div key={obs.id} className="flex items-center gap-2 text-xs text-amber-800 bg-amber-100/50 px-2 py-1 rounded">
                          <span className={`w-2 h-2 rounded-full ${
                            obs.type === 'POSITIVE' ? 'bg-green-500' :
                            obs.type === 'NEGATIVE' ? 'bg-red-500' :
                            obs.type === 'COMMITMENT' ? 'bg-amber-500' : 'bg-slate-400'
                          }`} />
                          <span className="text-amber-600">{new Date(obs.date).toLocaleDateString('es-CO')}</span>
                          <span className="truncate flex-1">{obs.description.substring(0, 50)}...</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusConfig[obs.status].bgColor} ${statusConfig[obs.status].color}`}>
                            {statusConfig[obs.status].label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Observación *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ObservationType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="POSITIVE">✅ Positiva (Logro, reconocimiento)</option>
                    <option value="NEGATIVE">❌ Negativa (Falta, llamado de atención)</option>
                    <option value="NEUTRAL">ℹ️ Informativa (Observación general)</option>
                    <option value="COMMITMENT">🤝 Compromiso (Acuerdo firmado)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ObservationCategory })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="ACADEMIC">Académico</option>
                    <option value="BEHAVIORAL">Comportamental</option>
                    <option value="ATTENDANCE">Asistencia</option>
                    <option value="UNIFORM">Uniforme/Presentación</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Describa la situación observada..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Acción Tomada</label>
                <textarea
                  value={formData.actionTaken}
                  onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="¿Qué acción se tomó? (opcional)"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.parentNotified}
                    onChange={(e) => setFormData({ ...formData, parentNotified: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700">Acudiente notificado</span>
                </label>
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
                <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Seguimiento</label>
                    <input
                      type="date"
                      value={formData.followUpDate}
                      onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notas de Seguimiento</label>
                    <input
                      type="text"
                      value={formData.followUpNotes}
                      onChange={(e) => setFormData({ ...formData, followUpNotes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.studentId || !formData.description}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isEditing ? 'Guardar Cambios' : 'Registrar Observación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {showDetailModal && selectedObservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Detalle de Observación</h3>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig[selectedObservation.type].bgColor}`}>
                  {(() => {
                    const Icon = typeConfig[selectedObservation.type].icon
                    return <Icon className={`w-5 h-5 ${typeConfig[selectedObservation.type].color}`} />
                  })()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedObservation.studentName}</p>
                  <p className="text-sm text-slate-500">{selectedObservation.group} • {new Date(selectedObservation.date).toLocaleDateString('es-CO')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig[selectedObservation.type].bgColor} ${typeConfig[selectedObservation.type].color}`}>
                  {typeConfig[selectedObservation.type].label}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${categoryConfig[selectedObservation.category].color}`}>
                  {categoryConfig[selectedObservation.category].label}
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Descripción</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedObservation.description}</p>
              </div>

              {selectedObservation.actionTaken && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Acción Tomada</p>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedObservation.actionTaken}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Acudiente Notificado</p>
                  <p className="font-medium">{selectedObservation.parentNotified ? 'Sí' : 'No'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Requiere Seguimiento</p>
                  <p className="font-medium">{selectedObservation.requiresFollowUp ? 'Sí' : 'No'}</p>
                </div>
              </div>

              {selectedObservation.requiresFollowUp && selectedObservation.followUpDate && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-purple-700">Fecha de Seguimiento</p>
                  <p className="text-sm text-purple-600">{new Date(selectedObservation.followUpDate).toLocaleDateString('es-CO')}</p>
                  {selectedObservation.followUpNotes && (
                    <p className="text-sm text-purple-600 mt-1">{selectedObservation.followUpNotes}</p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                <p>Registrado por: {selectedObservation.author}</p>
                <p>Fecha de registro: {new Date(selectedObservation.createdAt).toLocaleString('es-CO')}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  handleEdit(selectedObservation)
                }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seguimiento (Coordinador) */}
      {showFollowUpModal && selectedObservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-900">Registrar Seguimiento</h3>
              </div>
              <button onClick={() => setShowFollowUpModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedObservation.studentName}</p>
                <p className="text-sm text-slate-500">{selectedObservation.group} • {typeConfig[selectedObservation.type].label}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas de Seguimiento *</label>
                <textarea
                  value={followUpData.notes}
                  onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Describa el avance o situación actual..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Próxima Fecha de Seguimiento</label>
                <input
                  type="date"
                  value={followUpData.nextDate}
                  onChange={(e) => setFollowUpData({ ...followUpData, nextDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFollowUp}
                disabled={!followUpData.notes}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Guardar Seguimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cerrar Caso (Coordinador) */}
      {showCloseModal && selectedObservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-slate-900">Cerrar Caso</h3>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedObservation.studentName}</p>
                <p className="text-sm text-slate-500">{selectedObservation.group} • {typeConfig[selectedObservation.type].label}</p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Atención:</strong> Al cerrar este caso, se marcará como resuelto y no podrá ser modificado.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas de Cierre *</label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Describa la resolución del caso..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseCase}
                disabled={!closureNotes}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                Cerrar Caso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración (Admin/Rector) */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-900">Configuración del Observador</h3>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Tipos de Observación</h4>
                <div className="space-y-2">
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <config.icon className={`w-4 h-4 ${config.color}`} />
                        <span className="text-sm">{config.label}</span>
                      </div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                        <span className="text-xs text-slate-500">Activo</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-3">Categorías</h4>
                <div className="space-y-2">
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <span className={`px-2 py-1 rounded text-xs ${config.color}`}>{config.label}</span>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                        <span className="text-xs text-slate-500">Activo</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-3">Notificaciones</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm">Notificar a coordinación en observaciones negativas</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm">Recordatorio de seguimientos pendientes</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <input type="checkbox" className="w-4 h-4 rounded" />
                    <span className="text-sm">Notificar automáticamente a acudientes</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
