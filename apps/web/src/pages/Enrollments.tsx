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
  Save,
  X
} from 'lucide-react'
import { enrollmentsApi, academicYearLifecycleApi, groupsApi, gradeChangeApi } from '../lib/api'
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
  
  // Estados para modales funcionales
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [enrollmentHistory, setEnrollmentHistory] = useState<any[]>([])
  
  // Formularios
  const [withdrawForm, setWithdrawForm] = useState({ reason: '', observations: '' })
  const [transferForm, setTransferForm] = useState({ reason: '', destinationInstitution: '', observations: '' })
  const [changeGroupForm, setChangeGroupForm] = useState({ newGroupId: '', reason: '', movementType: 'ACADEMIC', observations: '' })
  
  // Estados para validación de cambio de grado
  const [gradeChangeValidation, setGradeChangeValidation] = useState<any>(null)
  const [validatingChange, setValidatingChange] = useState(false)

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

  const handleWithdraw = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowWithdrawModal(true)
  }

  const handleTransfer = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowTransferModal(true)
  }

  const handleChangeGroup = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowChangeGroupModal(true)
  }

  const handleViewHistory = async (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment)
    try {
      const response = await enrollmentsApi.getHistory(enrollment.id)
      setEnrollmentHistory(response.data)
    } catch (err) {
      console.error('Error loading history:', err)
    }
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

  // Funciones para ejecutar acciones
  const executeWithdraw = async () => {
    if (!selectedEnrollment || !withdrawForm.reason) return
    
    setActionLoading('withdraw')
    try {
      await enrollmentsApi.withdraw(selectedEnrollment.id, withdrawForm)
      setSuccessMessage('Estudiante retirado exitosamente')
      setShowWithdrawModal(false)
      setWithdrawForm({ reason: '', observations: '' })
      loadEnrollments()
    } catch (err: any) {
      console.error('Error withdrawing student:', err)
      setError(err.response?.data?.message || 'Error al retirar estudiante')
    } finally {
      setActionLoading('')
    }
  }

  const executeTransfer = async () => {
    if (!selectedEnrollment || !transferForm.reason) return
    
    setActionLoading('transfer')
    try {
      await enrollmentsApi.transfer(selectedEnrollment.id, transferForm)
      setSuccessMessage('Estudiante transferido exitosamente')
      setShowTransferModal(false)
      setTransferForm({ reason: '', destinationInstitution: '', observations: '' })
      loadEnrollments()
    } catch (err: any) {
      console.error('Error transferring student:', err)
      setError(err.response?.data?.message || 'Error al transferir estudiante')
    } finally {
      setActionLoading('')
    }
  }

  const executeChangeGroup = async () => {
    if (!selectedEnrollment || !changeGroupForm.newGroupId || !changeGroupForm.reason) return
    
    // Primero validar el cambio
    setValidatingChange(true)
    try {
      const validation = await gradeChangeApi.validate({
        enrollmentId: selectedEnrollment.id,
        newGroupId: changeGroupForm.newGroupId
      })
      
      setGradeChangeValidation(validation.data)
      
      // Si no está permitido, mostrar error
      if (!validation.data.canChange) {
        setError(`Cambio no permitido: ${validation.data.restrictions.join(', ')}`)
        setValidatingChange(false)
        return
      }
      
      // Si hay advertencias, mostrarlas pero permitir continuar
      if (validation.data.warnings.length > 0) {
        console.warn('Advertencias de cambio:', validation.data.warnings)
      }
      
      // Si es cambio de grado (no mismo grado), requerir confirmación adicional
      if (validation.data.gradeChangeType !== 'SAME_GRADE') {
        if (!confirm(`¡Atención! Está a punto de cambiar de grado.\n\nDe: ${validation.data.currentGrade.name}\nA: ${validation.data.newGrade.name}\n\nRequerimientos:\n${validation.data.requirements.join('\n')}\n\n¿Desea continuar?`)) {
          setValidatingChange(false)
          return
        }
      }
      
      // Ejecutar el cambio
      setActionLoading('changeGroup')
      await gradeChangeApi.execute({
        enrollmentId: selectedEnrollment.id,
        newGroupId: changeGroupForm.newGroupId,
        gradeChangeType: validation.data.gradeChangeType,
        movementType: changeGroupForm.movementType,
        reason: changeGroupForm.reason,
        observations: changeGroupForm.observations
      })
      
      setSuccessMessage('Cambio realizado exitosamente')
      setShowChangeGroupModal(false)
      setChangeGroupForm({ newGroupId: '', reason: '', movementType: 'ACADEMIC', observations: '' })
      setGradeChangeValidation(null)
      loadEnrollments()
    } catch (err: any) {
      console.error('Error changing group:', err)
      setError(err.response?.data?.message || 'Error al realizar el cambio')
    } finally {
      setActionLoading('')
      setValidatingChange(false)
    }
  }

  // Cargar grupos disponibles para cambio de grupo
  useEffect(() => {
    if (showChangeGroupModal && institution?.id) {
      groupsApi.getAll({ institutionId: institution.id }).then(response => {
        setAvailableGroups(response.data)
      }).catch(err => {
        console.error('Error loading groups:', err)
      })
    }
  }, [showChangeGroupModal, institution])

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
                onClick={() => setShowEnrollModal(true)}
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
                onClick={() => setShowEnrollModal(true)}
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
                        <div className="text-sm text-slate-900">{enrollment.group.grade.name} {enrollment.group.name}</div>
                        <div className="text-xs text-slate-500">
                          {enrollment.group.campus.name}
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
                                onClick={() => handleChangeGroup(enrollment)}
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

      {/* Modales (placeholder por ahora) */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Nueva Matrícula</h3>
            <p className="text-slate-600 mb-4">Modal de matrícula en desarrollo...</p>
            <button
              onClick={() => setShowEnrollModal(false)}
              className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showWithdrawModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Retirar Estudiante</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Grupo actual:</strong> {selectedEnrollment.group.name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo del retiro *
                </label>
                <textarea
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Ej: Cambio de ciudad, problemas económicos, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={withdrawForm.observations}
                  onChange={(e) => setWithdrawForm(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={2}
                  placeholder="Notas adicionales sobre el retiro"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeWithdraw}
                disabled={!withdrawForm.reason || actionLoading === 'withdraw'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'withdraw' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Retirar
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transferir Estudiante</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Grupo actual:</strong> {selectedEnrollment.group.name}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo de la transferencia *
                </label>
                <textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Ej: Traslado a otra ciudad, cambio de institución, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Institución de destino (opcional)
                </label>
                <input
                  type="text"
                  value={transferForm.destinationInstitution}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, destinationInstitution: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nombre de la nueva institución"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={transferForm.observations}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Notas adicionales sobre la transferencia"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeTransfer}
                disabled={!transferForm.reason || actionLoading === 'transfer'}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'transfer' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    Transferir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeGroupModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Cambiar de Grupo</h3>
              <button
                onClick={() => setShowChangeGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Grupo actual:</strong> {selectedEnrollment.group.name} ({selectedEnrollment.group.grade.name})
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nuevo grupo *
                </label>
                <select
                  value={changeGroupForm.newGroupId}
                  onChange={(e) => {
                    setChangeGroupForm(prev => ({ ...prev, newGroupId: e.target.value }))
                    setGradeChangeValidation(null) // Resetear validación al cambiar
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                  disabled={validatingChange || actionLoading === 'changeGroup'}
                >
                  <option value="">Seleccionar grupo...</option>
                  {availableGroups
                    .filter(g => g.id !== selectedEnrollment.group.id)
                    .map(group => (
                      <option key={group.id} value={group.id}>
                        {group.grade.name} - {group.name} ({group.campus.name})
                      </option>
                    ))}
                </select>
              </div>

              {/* Sección de validación */}
              {gradeChangeValidation && (
                <div className={`p-4 rounded-lg border ${
                  gradeChangeValidation.canChange 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-medium ${
                      gradeChangeValidation.canChange ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {gradeChangeValidation.canChange ? '✓ Cambio permitido' : '✗ Cambio no permitido'}
                    </span>
                    {gradeChangeValidation.gradeChangeType !== 'SAME_GRADE' && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        Cambio de grado detectado
                      </span>
                    )}
                  </div>

                  {/* Información del cambio */}
                  {gradeChangeValidation.gradeChangeType !== 'SAME_GRADE' && (
                    <div className="text-sm text-slate-600 mb-2">
                      <div>De: <strong>{gradeChangeValidation.currentGrade.name}</strong></div>
                      <div>A: <strong>{gradeChangeValidation.newGrade.name}</strong></div>
                    </div>
                  )}

                  {/* Advertencias */}
                  {gradeChangeValidation.warnings.length > 0 && (
                    <div className="mb-2">
                      <div className="text-sm font-medium text-yellow-700 mb-1">Advertencias:</div>
                      <ul className="text-xs text-yellow-600 list-disc list-inside">
                        {gradeChangeValidation.warnings.map((warning: string, index: number) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Requerimientos */}
                  {gradeChangeValidation.requirements.length > 0 && (
                    <div className="mb-2">
                      <div className="text-sm font-medium text-blue-700 mb-1">Requerimientos:</div>
                      <ul className="text-xs text-blue-600 list-disc list-inside">
                        {gradeChangeValidation.requirements.map((req: string, index: number) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Restricciones */}
                  {gradeChangeValidation.restrictions.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-red-700 mb-1">Restricciones:</div>
                      <ul className="text-xs text-red-600 list-disc list-inside">
                        {gradeChangeValidation.restrictions.map((restriction: string, index: number) => (
                          <li key={index}>{restriction}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de movimiento
                </label>
                <select
                  value={changeGroupForm.movementType}
                  onChange={(e) => setChangeGroupForm(prev => ({ ...prev, movementType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="ACADEMIC">Académico</option>
                  <option value="ADMINISTRATIVE">Administrativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo del cambio *
                </label>
                <textarea
                  value={changeGroupForm.reason}
                  onChange={(e) => setChangeGroupForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows={3}
                  placeholder="Ej: Reubicación por cupos, compatibilidad de horarios, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={changeGroupForm.observations}
                  onChange={(e) => setChangeGroupForm(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows={2}
                  placeholder="Notas adicionales sobre el cambio"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowChangeGroupModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeChangeGroup}
                disabled={!changeGroupForm.newGroupId || !changeGroupForm.reason || actionLoading === 'changeGroup' || validatingChange || (gradeChangeValidation && !gradeChangeValidation.canChange)}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(actionLoading === 'changeGroup' || validatingChange) ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {validatingChange ? 'Validando...' : 'Procesando...'}
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4" />
                    {gradeChangeValidation?.gradeChangeType !== 'SAME_GRADE' ? 'Cambiar Grado' : 'Cambiar Grupo'}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Historial de Matrícula</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Estudiante:</strong> {selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Documento:</strong> {selectedEnrollment.student.documentType} {selectedEnrollment.student.documentNumber}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Grupo actual:</strong> {selectedEnrollment.group.name} ({selectedEnrollment.group.grade.name})
              </p>
            </div>

            {enrollmentHistory.length > 0 ? (
              <div className="space-y-3">
                {enrollmentHistory.map((event, index) => (
                  <div key={event.id || index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900">
                        {event.type === 'CREATED' && 'Matrícula creada'}
                        {event.type === 'GROUP_CHANGED' && 'Cambio de grupo'}
                        {event.type === 'WITHDRAWN' && 'Retiro'}
                        {event.type === 'TRANSFERRED' && 'Transferencia'}
                        {event.type === 'PROMOTED' && 'Promoción'}
                        {event.type === 'REPEATED' && 'Repitencia'}
                        {event.type === 'REACTIVATED' && 'Reactivación'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(event.performedAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {event.reason && (
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Motivo:</strong> {event.reason}
                      </p>
                    )}
                    
                    {event.previousValue && (
                      <div className="text-xs text-slate-500 mb-1">
                        <strong>Cambio:</strong>
                        {typeof event.previousValue === 'object' 
                          ? JSON.stringify(event.previousValue, null, 2)
                          : event.previousValue}
                      </div>
                    )}
                    
                    {event.observations && (
                      <p className="text-sm text-slate-600">
                        <strong>Observaciones:</strong> {event.observations}
                      </p>
                    )}
                    
                    <div className="text-xs text-slate-400 mt-1">
                      Realizado por: {event.performedBy?.firstName || 'Sistema'} {event.performedBy?.lastName || ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay eventos en el historial</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Enrollments
