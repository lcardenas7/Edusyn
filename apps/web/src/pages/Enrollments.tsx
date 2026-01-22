import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit2, 
  UserMinus, 
  ArrowRightLeft, 
  RefreshCw,
  Calendar,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  X,
  UserPlus,
  Loader2
} from 'lucide-react'
import { enrollmentsApi, academicYearLifecycleApi, studentsApi, groupsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Student {
  id: string
  firstName: string
  lastName: string
  documentNumber: string
  documentType: string
  email?: string
  phone?: string
}

interface Group {
  id: string
  name: string
  grade: {
    id: string
    name: string
  }
  campus: {
    id: string
    name: string
  }
}

interface AcademicYear {
  id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

interface Enrollment {
  id: string
  student: Student
  group: Group
  academicYear: AcademicYear
  status: 'ACTIVE' | 'PROMOTED' | 'REPEATED' | 'WITHDRAWN' | 'TRANSFERRED'
  enrollmentType: 'NEW' | 'RENEWAL' | 'REENTRY' | 'TRANSFER'
  shift?: string
  modality?: string
  enrollmentDate: string
  withdrawalDate?: string
  withdrawalReason?: string
  observations?: string
  events?: any[]
}

interface EnrollmentFilters {
  academicYearId?: string
  gradeId?: string
  groupId?: string
  status?: string
  search?: string
}

const Enrollments: React.FC = () => {
  const navigate = useNavigate()
  const { institution } = useAuth()
  
  // Estado principal
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filtros y búsqueda
  const [filters, setFilters] = useState<EnrollmentFilters>({
    academicYearId: '',
    status: '',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  
  // Modales y acciones
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showChangeGroupModal, setShowChangeGroupModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  
  // Estados de carga
  const [actionLoading, setActionLoading] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  
  // Estados para el modal de nueva matrícula
  const [availableStudents, setAvailableStudents] = useState<Student[]>([])
  const [availableGroups, setAvailableGroups] = useState<any[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [enrollmentType, setEnrollmentType] = useState('NEW')
  const [enrollmentObservations, setEnrollmentObservations] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState('')
  const [savingEnrollment, setSavingEnrollment] = useState(false)
  
  // Estados para modal de retiro
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawObservations, setWithdrawObservations] = useState('')
  
  // Estados para modal de cambio de grupo
  const [newGroupId, setNewGroupId] = useState('')
  const [changeGroupReason, setChangeGroupReason] = useState('')
  const [changeGroupObservations, setChangeGroupObservations] = useState('')

  useEffect(() => {
    if (institution?.id) {
      loadAcademicYears()
    }
  }, [institution])

  useEffect(() => {
    if (filters.academicYearId || currentYear) {
      loadEnrollments()
    }
  }, [filters, currentYear])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearLifecycleApi.getByInstitution(institution!.id)
      const years = response.data
      setAcademicYears(years)
      
      // Obtener año actual
      try {
        const currentResponse = await academicYearLifecycleApi.getCurrent(institution!.id)
        if (currentResponse.data) {
          setCurrentYear(currentResponse.data)
          setFilters(prev => ({ ...prev, academicYearId: currentResponse.data.id }))
        } else if (years.length > 0) {
          // Si no hay año actual, usar el más reciente
          const latest = years.sort((a: AcademicYear, b: AcademicYear) => b.year - a.year)[0]
          setCurrentYear(latest)
          setFilters(prev => ({ ...prev, academicYearId: latest.id }))
        }
      } catch (err) {
        console.error('Error loading current year:', err)
      }
    } catch (err) {
      console.error('Error loading academic years:', err)
      setError('Error al cargar años académicos')
    }
  }

  const loadEnrollments = async () => {
    if (!filters.academicYearId) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await enrollmentsApi.getAll({
        academicYearId: filters.academicYearId,
        status: filters.status,
        search: filters.search
      })
      setEnrollments(response.data)
    } catch (err: any) {
      console.error('Error loading enrollments:', err)
      setError(err.response?.data?.message || 'Error al cargar matrículas')
    } finally {
      setLoading(false)
    }
  }

  // Cargar estudiantes disponibles para matricular
  const loadStudents = async (search = '') => {
    if (!institution?.id) return
    setLoadingStudents(true)
    try {
      const response = await studentsApi.getAll({ institutionId: institution.id })
      let students = response.data || []
      
      // Filtrar por búsqueda si hay término
      if (search) {
        const searchLower = search.toLowerCase()
        students = students.filter((s: Student) => 
          s.firstName?.toLowerCase().includes(searchLower) ||
          s.lastName?.toLowerCase().includes(searchLower) ||
          s.documentNumber?.includes(search)
        )
      }
      setAvailableStudents(students)
    } catch (err) {
      console.error('Error loading students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  // Cargar grupos disponibles
  const loadGroups = async () => {
    setLoadingGroups(true)
    try {
      const response = await groupsApi.getAll()
      setAvailableGroups(response.data || [])
    } catch (err) {
      console.error('Error loading groups:', err)
    } finally {
      setLoadingGroups(false)
    }
  }

  // Abrir modal de nueva matrícula
  const openEnrollModal = () => {
    setSelectedStudentId('')
    setSelectedGroupId('')
    setEnrollmentType('NEW')
    setEnrollmentObservations('')
    setEnrollmentError('')
    setStudentSearch('')
    loadStudents()
    loadGroups()
    setShowEnrollModal(true)
  }

  // Guardar nueva matrícula
  const handleSaveEnrollment = async () => {
    if (!selectedStudentId) {
      setEnrollmentError('Debe seleccionar un estudiante')
      return
    }
    if (!selectedGroupId) {
      setEnrollmentError('Debe seleccionar un grupo')
      return
    }
    if (!currentYear?.id) {
      setEnrollmentError('No hay año académico activo')
      return
    }

    setSavingEnrollment(true)
    setEnrollmentError('')

    try {
      await enrollmentsApi.create({
        studentId: selectedStudentId,
        academicYearId: currentYear.id,
        groupId: selectedGroupId,
        enrollmentType: enrollmentType,
        observations: enrollmentObservations || undefined
      })
      
      setSuccessMessage('Matrícula creada exitosamente')
      setShowEnrollModal(false)
      loadEnrollments()
      
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      console.error('Error creating enrollment:', err)
      setEnrollmentError(err.response?.data?.message || 'Error al crear la matrícula')
    } finally {
      setSavingEnrollment(false)
    }
  }

  // Confirmar retiro
  const handleConfirmWithdraw = async () => {
    if (!selectedEnrollment || !withdrawReason) return
    
    setActionLoading('withdraw')
    try {
      await enrollmentsApi.withdraw(selectedEnrollment.id, {
        reason: withdrawReason,
        observations: withdrawObservations || undefined
      })
      setSuccessMessage('Estudiante retirado exitosamente')
      setShowWithdrawModal(false)
      setWithdrawReason('')
      setWithdrawObservations('')
      loadEnrollments()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      console.error('Error withdrawing:', err)
      alert(err.response?.data?.message || 'Error al retirar estudiante')
    } finally {
      setActionLoading('')
    }
  }

  // Confirmar cambio de grupo
  const handleConfirmChangeGroup = async () => {
    if (!selectedEnrollment || !newGroupId || !changeGroupReason) return
    
    setActionLoading('changeGroup')
    try {
      await enrollmentsApi.changeGroup(selectedEnrollment.id, {
        newGroupId,
        reason: changeGroupReason,
        movementType: 'INTERNAL',
        observations: changeGroupObservations || undefined
      })
      setSuccessMessage('Grupo cambiado exitosamente')
      setShowChangeGroupModal(false)
      setNewGroupId('')
      setChangeGroupReason('')
      setChangeGroupObservations('')
      loadEnrollments()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      console.error('Error changing group:', err)
      alert(err.response?.data?.message || 'Error al cambiar de grupo')
    } finally {
      setActionLoading('')
    }
  }

  // Abrir modal de cambio de grupo
  const openChangeGroupModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setNewGroupId('')
    setChangeGroupReason('')
    setChangeGroupObservations('')
    loadGroups()
    setShowChangeGroupModal(true)
  }

  const handleWithdraw = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowWithdrawModal(true)
  }

  const handleTransfer = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowTransferModal(true)
  }

  const handleViewHistory = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowHistoryModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700'
      case 'PROMOTED': return 'bg-blue-100 text-blue-700'
      case 'REPEATED': return 'bg-yellow-100 text-yellow-700'
      case 'WITHDRAWN': return 'bg-red-100 text-red-700'
      case 'TRANSFERRED': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="w-4 h-4" />
      case 'PROMOTED': return <GraduationCap className="w-4 h-4" />
      case 'REPEATED': return <RefreshCw className="w-4 h-4" />
      case 'WITHDRAWN': return <UserMinus className="w-4 h-4" />
      case 'TRANSFERRED': return <ArrowRightLeft className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Activo'
      case 'PROMOTED': return 'Promovido'
      case 'REPEATED': return 'Repite'
      case 'WITHDRAWN': return 'Retirado'
      case 'TRANSFERRED': return 'Transferido'
      default: return status
    }
  }

  const getEnrollmentTypeText = (type: string) => {
    switch (type) {
      case 'NEW': return 'Nuevo'
      case 'RENEWAL': return 'Renovación'
      case 'REENTRY': return 'Reingreso'
      case 'TRANSFER': return 'Transferencia'
      default: return type
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gestión de Matrículas</h1>
              <p className="text-slate-600 mt-1">Administra las matrículas de estudiantes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/academic-year-wizard')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Wizard Año
              </button>
              <button
                onClick={openEnrollModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Matrícula
              </button>
            </div>
          </div>

          {/* Año académico actual */}
          {currentYear && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    currentYear.status === 'ACTIVE' ? 'bg-green-500' :
                    currentYear.status === 'CLOSED' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <span className="font-medium">{currentYear.name}</span>
                    <span className="ml-2 text-sm text-slate-500">({currentYear.year})</span>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  currentYear.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                  currentYear.status === 'CLOSED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {currentYear.status === 'ACTIVE' ? 'Activo' :
                   currentYear.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
                <select
                  value={filters.academicYearId}
                  onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name} ({year.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="PROMOTED">Promovido</option>
                  <option value="REPEATED">Repite</option>
                  <option value="WITHDRAWN">Retirado</option>
                  <option value="TRANSFERRED">Transferido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Búsqueda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Buscar por nombre, documento..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={loadEnrollments}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de matrículas */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Matrículas {enrollments.length > 0 && `(${enrollments.length})`}
              </h2>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No hay matrículas registradas</p>
              <button
                onClick={openEnrollModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Crear Primera Matrícula
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estudiante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Grupo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {enrollment.student.firstName} {enrollment.student.lastName}
                          </div>
                          {enrollment.student.email && (
                            <div className="text-xs text-slate-500">{enrollment.student.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {enrollment.student.documentType} {enrollment.student.documentNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{enrollment.group.name}</div>
                        <div className="text-xs text-slate-500">
                          {enrollment.group.grade.name} - {enrollment.group.campus.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700">
                          {getEnrollmentTypeText(enrollment.enrollmentType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getStatusColor(enrollment.status)}`}>
                            {getStatusIcon(enrollment.status)}
                            {getStatusText(enrollment.status)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(enrollment.enrollmentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewHistory(enrollment)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Ver historial"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {enrollment.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => openChangeGroupModal(enrollment)}
                                className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                                title="Cambiar de grupo"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleWithdraw(enrollment)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Retirar estudiante"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleTransfer(enrollment)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                title="Transferir estudiante"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mensajes de éxito */}
        {successMessage && (
          <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-700">{successMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nueva Matrícula */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Nueva Matrícula</h3>
                  <p className="text-sm text-slate-500">Año: {currentYear?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {enrollmentError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{enrollmentError}</p>
                </div>
              )}

              {/* Búsqueda de estudiante */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estudiante *
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      loadStudents(e.target.value)
                    }}
                    placeholder="Buscar por nombre o documento..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {loadingStudents ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                    {availableStudents.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        <p>No hay estudiantes disponibles</p>
                        <p className="text-xs mt-1">Primero debe registrar estudiantes en el sistema</p>
                      </div>
                    ) : (
                      availableStudents.map(student => (
                        <div
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`p-3 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors ${
                            selectedStudentId === student.id 
                              ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-medium text-slate-900">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-sm text-slate-500">
                            {student.documentType}: {student.documentNumber}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selección de grupo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Grupo *
                </label>
                {loadingGroups ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccione un grupo</option>
                    {availableGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.grade?.name || ''} - {group.name} ({group.campus?.name || 'Sin sede'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tipo de matrícula */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Matrícula
                </label>
                <select
                  value={enrollmentType}
                  onChange={(e) => setEnrollmentType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="NEW">Nuevo</option>
                  <option value="RENEWAL">Renovación</option>
                  <option value="REENTRY">Reingreso</option>
                  <option value="TRANSFER">Transferencia</option>
                </select>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={enrollmentObservations}
                  onChange={(e) => setEnrollmentObservations(e.target.value)}
                  rows={3}
                  placeholder="Observaciones adicionales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEnrollment}
                disabled={savingEnrollment || !selectedStudentId || !selectedGroupId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEnrollment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Crear Matrícula
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retiro */}
      {showWithdrawModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <UserMinus className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Retirar Estudiante</h3>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Grupo:</strong> {selectedEnrollment.group.grade.name} - {selectedEnrollment.group.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo del Retiro *
                </label>
                <select
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Seleccione un motivo</option>
                  <option value="VOLUNTARIO">Retiro Voluntario</option>
                  <option value="CAMBIO_CIUDAD">Cambio de Ciudad</option>
                  <option value="PROBLEMAS_ECONOMICOS">Problemas Económicos</option>
                  <option value="PROBLEMAS_SALUD">Problemas de Salud</option>
                  <option value="CAMBIO_INSTITUCION">Cambio de Institución</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={withdrawObservations}
                  onChange={(e) => setWithdrawObservations(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false)
                  setWithdrawReason('')
                  setWithdrawObservations('')
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmWithdraw}
                disabled={!withdrawReason || actionLoading === 'withdraw'}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'withdraw' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Confirmar Retiro
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Transferir Estudiante</h3>
            <p className="text-slate-600 mb-4">Modal de transferencia en desarrollo...</p>
            <button
              onClick={() => setShowTransferModal(false)}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Cambio de Grupo */}
      {showChangeGroupModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ArrowRightLeft className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Cambiar de Grupo</h3>
              </div>
              <button
                onClick={() => setShowChangeGroupModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Grupo Actual:</strong> {selectedEnrollment.group.grade.name} - {selectedEnrollment.group.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nuevo Grupo *
                </label>
                {loadingGroups ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                  </div>
                ) : (
                  <select
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="">Seleccione un grupo</option>
                    {availableGroups
                      .filter(g => g.id !== selectedEnrollment.group.id)
                      .map(group => (
                        <option key={group.id} value={group.id}>
                          {group.grade?.name || ''} - {group.name} ({group.campus?.name || 'Sin sede'})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo del Cambio *
                </label>
                <select
                  value={changeGroupReason}
                  onChange={(e) => setChangeGroupReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="">Seleccione un motivo</option>
                  <option value="SOLICITUD_PADRE">Solicitud del Padre/Acudiente</option>
                  <option value="RECOMENDACION_ACADEMICA">Recomendación Académica</option>
                  <option value="CONFLICTO_CONVIVENCIA">Conflicto de Convivencia</option>
                  <option value="REORGANIZACION_GRUPOS">Reorganización de Grupos</option>
                  <option value="CAMBIO_JORNADA">Cambio de Jornada</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={changeGroupObservations}
                  onChange={(e) => setChangeGroupObservations(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowChangeGroupModal(false)
                  setNewGroupId('')
                  setChangeGroupReason('')
                  setChangeGroupObservations('')
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmChangeGroup}
                disabled={!newGroupId || !changeGroupReason || actionLoading === 'changeGroup'}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'changeGroup' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    Confirmar Cambio
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Historial de Matrícula</h3>
            <div className="mb-4">
              <p className="text-sm text-slate-600">
                <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Documento:</strong> {selectedEnrollment.student.documentType} {selectedEnrollment.student.documentNumber}
              </p>
            </div>
            <p className="text-slate-600 mb-4">Historial en desarrollo...</p>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Enrollments
