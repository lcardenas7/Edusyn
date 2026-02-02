import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { managementTasksApi, staffApi } from '../lib/api'
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  X,
  Check,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Upload,
  Eye,
  ChevronDown,
  Users,
  UserPlus,
  Trash2,
  Calendar,
  Flag,
  FileText,
  Send,
  RefreshCw,
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description?: string
  category: string
  priority: string
  dueDate?: string
  isActive: boolean
  createdAt: string
  createdBy: { id: string; firstName: string; lastName: string }
  assignments: TaskAssignment[]
}

interface TaskAssignment {
  id: string
  taskId: string
  status: string
  startedAt?: string
  completedAt?: string
  responseNote?: string
  evidenceUrl?: string
  evidenceFileName?: string
  verifiedAt?: string
  verificationNote?: string
  assignee: { id: string; firstName: string; lastName: string; email?: string }
  verifiedBy?: { id: string; firstName: string; lastName: string }
  task?: Task
}

interface Leader {
  id: string
  area: string
  isActive: boolean
  user: { id: string; firstName: string; lastName: string; email: string }
  assignedBy: { id: string; firstName: string; lastName: string }
}

interface EnumOption {
  value: string
  label: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendiente', color: 'bg-slate-100 text-slate-700', icon: Clock },
  IN_PROGRESS: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  SUBMITTED: { label: 'Entregada', color: 'bg-amber-100 text-amber-700', icon: Send },
  APPROVED: { label: 'Aprobada', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500', icon: X },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  BAJA: { label: 'Baja', color: 'bg-slate-100 text-slate-600' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
  ALTA: { label: 'Alta', color: 'bg-amber-100 text-amber-600' },
  URGENTE: { label: 'Urgente', color: 'bg-red-100 text-red-600' },
}

export default function ManagementTasks() {
  const { user, institution } = useAuth()
  const institutionId = institution?.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'my-tasks' | 'all-tasks' | 'verifications' | 'leaders'>('my-tasks')
  const [myTasks, setMyTasks] = useState<TaskAssignment[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [pendingVerifications, setPendingVerifications] = useState<TaskAssignment[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [enums, setEnums] = useState<{ areas: EnumOption[]; priorities: EnumOption[]; categories: EnumOption[]; statuses: EnumOption[] } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLeaderModal, setShowLeaderModal] = useState(false)
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<TaskAssignment | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [responseNote, setResponseNote] = useState('')
  const [verificationNote, setVerificationNote] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'OTRO',
    priority: 'NORMAL',
    dueDate: '',
    assigneeIds: [] as string[],
  })

  const [leaderForm, setLeaderForm] = useState({
    userId: '',
    area: 'ACADEMICA',
  })

  const userRoles = user?.roles?.map((r: any) => r.role?.name || r.name) || []
  const isAdmin = userRoles.some((r: string) => 
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r)
  )
  const [isLeader, setIsLeader] = useState(false)

  useEffect(() => {
    if (institutionId) {
      loadEnums()
      loadMyTasks()
      loadLeaders()
      if (isAdmin) {
        loadAllTasks()
        loadPendingVerifications()
        loadTeachers()
      }
    }
  }, [institutionId])

  useEffect(() => {
    // Check if current user is a leader
    if (leaders.length > 0 && user?.id) {
      const userIsLeader = leaders.some(l => l.user.id === user.id && l.isActive)
      setIsLeader(userIsLeader)
      if (userIsLeader && !isAdmin) {
        loadAllTasks()
        loadPendingVerifications()
        loadTeachers()
      }
    }
  }, [leaders, user?.id])

  const loadEnums = async () => {
    try {
      const response = await managementTasksApi.getEnums()
      setEnums(response.data)
    } catch (error) {
      console.error('Error loading enums:', error)
    }
  }

  const loadMyTasks = async () => {
    try {
      setLoading(true)
      const response = await managementTasksApi.getMyTasks(filterStatus || undefined)
      setMyTasks(response.data || [])
    } catch (error) {
      console.error('Error loading my tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllTasks = async () => {
    try {
      const response = await managementTasksApi.getTasks(institutionId!)
      setAllTasks(response.data || [])
    } catch (error) {
      console.error('Error loading all tasks:', error)
    }
  }

  const loadPendingVerifications = async () => {
    try {
      const response = await managementTasksApi.getPendingVerifications(institutionId!)
      setPendingVerifications(response.data || [])
    } catch (error) {
      console.error('Error loading verifications:', error)
    }
  }

  const loadLeaders = async () => {
    try {
      const response = await managementTasksApi.getLeaders(institutionId!)
      setLeaders(response.data || [])
    } catch (error) {
      console.error('Error loading leaders:', error)
    }
  }

  const loadTeachers = async () => {
    try {
      const response = await staffApi.getAll()
      const teachersList = (response.data || []).filter((u: any) => 
        u.roles?.some((r: any) => (r.role?.name || r.name) === 'DOCENTE')
      )
      setTeachers(teachersList)
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }

  const handleCreateTask = async () => {
    if (!taskForm.title || taskForm.assigneeIds.length === 0) {
      alert('Complete el título y seleccione al menos un docente')
      return
    }

    try {
      await managementTasksApi.createTask({
        institutionId: institutionId!,
        title: taskForm.title,
        description: taskForm.description,
        category: taskForm.category,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        assigneeIds: taskForm.assigneeIds,
      })
      
      setShowCreateModal(false)
      setTaskForm({ title: '', description: '', category: 'OTRO', priority: 'NORMAL', dueDate: '', assigneeIds: [] })
      loadAllTasks()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear tarea')
    }
  }

  const handleCreateLeader = async () => {
    if (!leaderForm.userId) return

    try {
      await managementTasksApi.createLeader({
        institutionId: institutionId!,
        userId: leaderForm.userId,
        area: leaderForm.area,
      })
      
      setShowLeaderModal(false)
      setLeaderForm({ userId: '', area: 'ACADEMICA' })
      loadLeaders()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al asignar líder')
    }
  }

  const handleRemoveLeader = async (id: string) => {
    if (!confirm('¿Está seguro de remover este líder?')) return

    try {
      await managementTasksApi.removeLeader(id)
      loadLeaders()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al remover líder')
    }
  }

  const handleStartTask = async (assignmentId: string) => {
    try {
      await managementTasksApi.startTask(assignmentId)
      loadMyTasks()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al iniciar tarea')
    }
  }

  const handleSubmitEvidence = async () => {
    if (!selectedAssignment) return

    try {
      if (selectedFile) {
        const formData = new FormData()
        formData.append('evidence', selectedFile)
        if (responseNote) formData.append('responseNote', responseNote)
        await managementTasksApi.submitEvidence(selectedAssignment.id, formData)
      } else {
        await managementTasksApi.completeTask(selectedAssignment.id, responseNote)
      }
      
      setShowEvidenceModal(false)
      setSelectedAssignment(null)
      setSelectedFile(null)
      setResponseNote('')
      loadMyTasks()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al enviar')
    }
  }

  const handleVerifyTask = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedAssignment) return

    try {
      await managementTasksApi.verifyTask(selectedAssignment.id, {
        status,
        verificationNote,
      })
      
      setShowVerifyModal(false)
      setSelectedAssignment(null)
      setVerificationNote('')
      loadPendingVerifications()
      loadAllTasks()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al verificar')
    }
  }

  const openEvidenceModal = (assignment: TaskAssignment) => {
    setSelectedAssignment(assignment)
    setShowEvidenceModal(true)
  }

  const openVerifyModal = (assignment: TaskAssignment) => {
    setSelectedAssignment(assignment)
    setShowVerifyModal(true)
  }

  const canManageTasks = isAdmin || isLeader

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Tareas</h1>
          <p className="text-slate-500">Asignación y seguimiento de actividades docentes</p>
        </div>
        {canManageTasks && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('my-tasks')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'my-tasks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Mis Tareas
          </button>
          {canManageTasks && (
            <>
              <button
                onClick={() => setActiveTab('all-tasks')}
                className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                  activeTab === 'all-tasks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Todas las Tareas
              </button>
              <button
                onClick={() => setActiveTab('verifications')}
                className={`px-4 py-2 border-b-2 font-medium transition-colors relative ${
                  activeTab === 'verifications'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Por Verificar
                {pendingVerifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingVerifications.length}
                  </span>
                )}
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('leaders')}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === 'leaders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Líderes de Gestión
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'my-tasks' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-4">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setTimeout(loadMyTasks, 0); }}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Todos los estados</option>
              {enums?.statuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : myTasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No tienes tareas asignadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTasks.map((assignment) => {
                const task = assignment.task!
                const statusConfig = STATUS_CONFIG[assignment.status]
                const priorityConfig = PRIORITY_CONFIG[task.priority]
                const StatusIcon = statusConfig.icon

                return (
                  <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{task.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Asignada por: {task.createdBy.firstName} {task.createdBy.lastName}</span>
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Vence: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {assignment.verificationNote && (
                          <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                            <span className="font-medium">Nota de verificación:</span> {assignment.verificationNote}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(assignment.status) && (
                          <div className="flex gap-2">
                            {assignment.status === 'PENDING' && (
                              <button
                                onClick={() => handleStartTask(assignment.id)}
                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                              >
                                Iniciar
                              </button>
                            )}
                            <button
                              onClick={() => openEvidenceModal(assignment)}
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            >
                              {assignment.status === 'REJECTED' ? 'Reenviar' : 'Completar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'all-tasks' && canManageTasks && (
        <div className="space-y-3">
          {allTasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay tareas creadas</p>
            </div>
          ) : (
            allTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{task.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_CONFIG[task.priority].color}`}>
                        {PRIORITY_CONFIG[task.priority].label}
                      </span>
                    </div>
                    {task.description && <p className="text-sm text-slate-600 mt-1">{task.description}</p>}
                  </div>
                  {task.dueDate && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.assignments.map((a) => {
                    const sc = STATUS_CONFIG[a.status]
                    return (
                      <span key={a.id} className={`px-2 py-1 text-xs rounded-full ${sc.color}`}>
                        {a.assignee.firstName} {a.assignee.lastName}: {sc.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'verifications' && canManageTasks && (
        <div className="space-y-3">
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay tareas pendientes de verificación</p>
            </div>
          ) : (
            pendingVerifications.map((assignment) => (
              <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{assignment.task?.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Entregada por: <span className="font-medium">{assignment.assignee.firstName} {assignment.assignee.lastName}</span>
                    </p>
                    {assignment.responseNote && (
                      <p className="text-sm text-slate-500 mt-1">Nota: {assignment.responseNote}</p>
                    )}
                    {assignment.evidenceUrl && (
                      <a
                        href={assignment.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                      >
                        <FileText className="w-4 h-4" />
                        Ver evidencia: {assignment.evidenceFileName}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openVerifyModal(assignment)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      Verificar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'leaders' && isAdmin && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowLeaderModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <UserPlus className="w-4 h-4" />
              Asignar Líder
            </button>
          </div>
          
          {leaders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay líderes de gestión asignados</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Docente</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Área de Gestión</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Asignado por</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaders.map((leader) => (
                    <tr key={leader.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{leader.user.firstName} {leader.user.lastName}</p>
                          <p className="text-sm text-slate-500">{leader.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                          {enums?.areas.find(a => a.value === leader.area)?.label || leader.area}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {leader.assignedBy.firstName} {leader.assignedBy.lastName}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveLeader(leader.id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">Nueva Tarea</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Título de la tarea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Descripción detallada"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                  <select
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {enums?.categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {enums?.priorities.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a *</label>
                <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1">
                  {teachers.map((teacher) => (
                    <label key={teacher.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taskForm.assigneeIds.includes(teacher.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm({ ...taskForm, assigneeIds: [...taskForm.assigneeIds, teacher.id] })
                          } else {
                            setTaskForm({ ...taskForm, assigneeIds: taskForm.assigneeIds.filter(id => id !== teacher.id) })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">{taskForm.assigneeIds.length} docente(s) seleccionado(s)</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!taskForm.title || taskForm.assigneeIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Crear Tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leader Modal */}
      {showLeaderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Asignar Líder de Gestión</h2>
              <button onClick={() => setShowLeaderModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Docente</label>
                <select
                  value={leaderForm.userId}
                  onChange={(e) => setLeaderForm({ ...leaderForm, userId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Seleccionar docente</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Área de Gestión</label>
                <select
                  value={leaderForm.area}
                  onChange={(e) => setLeaderForm({ ...leaderForm, area: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {enums?.areas.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowLeaderModal(false)} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleCreateLeader}
                disabled={!leaderForm.userId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Modal */}
      {showEvidenceModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Completar Tarea</h2>
              <button onClick={() => { setShowEvidenceModal(false); setSelectedAssignment(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nota / Comentario</label>
                <textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={3}
                  placeholder="Descripción de lo realizado..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Evidencia (opcional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                />
                <p className="text-xs text-slate-500 mt-1">Máximo 5MB. PDF, Word o imágenes.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => { setShowEvidenceModal(false); setSelectedAssignment(null); }} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleSubmitEvidence}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {showVerifyModal && selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Verificar Tarea</h2>
              <button onClick={() => { setShowVerifyModal(false); setSelectedAssignment(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-900">{selectedAssignment.task?.title}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Entregada por: {selectedAssignment.assignee.firstName} {selectedAssignment.assignee.lastName}
                </p>
                {selectedAssignment.responseNote && (
                  <p className="text-sm text-slate-500 mt-2">"{selectedAssignment.responseNote}"</p>
                )}
              </div>
              {selectedAssignment.evidenceUrl && (
                <a
                  href={selectedAssignment.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <FileText className="w-4 h-4" />
                  Ver evidencia adjunta
                </a>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nota de verificación</label>
                <textarea
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                  placeholder="Comentario opcional..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => handleVerifyTask('REJECTED')}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
              <button
                onClick={() => handleVerifyTask('APPROVED')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprobar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
