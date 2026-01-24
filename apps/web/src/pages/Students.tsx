import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, Plus, User, X, Edit2, Eye, Trash2, Upload, Download, GraduationCap, FileText, AlertTriangle, Phone, Mail, MapPin, Users, CheckCircle2, XCircle, FileSpreadsheet, Heart, UserPlus, Loader2 } from 'lucide-react'
import { generateTemplate, parseExcelFile, exportToExcel, ImportResult } from '../utils/excelImport'
import api, { studentsApi, guardiansApi, academicYearLifecycleApi, groupsApi, enrollmentsApi, observerApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'WITHDRAWN'
type ViewMode = 'list' | 'detail'

interface Student {
  id: string
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  birthDate: string
  gender: string
  address: string
  phone: string
  email: string
  group: string
  status: StudentStatus
  enrollmentDate: string
  parentName: string
  parentPhone: string
  parentEmail: string
  bloodType: string
  eps: string
  observations: string
  photo?: string
}

interface AcademicHistory {
  year: number
  grade: string
  average: number
  status: 'APPROVED' | 'FAILED' | 'IN_PROGRESS'
  rank: number
  totalStudents: number
}

interface ObserverEntry {
  id: string
  date: string
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  category: string
  description: string
  author: string
}


// Interfaces para datos del backend
interface EnrollmentHistoryItem {
  id: string
  academicYear: { year: number }
  group: { name: string; grade: { name: string } }
  status: string
  enrollmentDate: string
}

interface ObservationItem {
  id: string
  date: string
  type: string
  category: string
  description: string
  author: { firstName: string; lastName: string }
}

// Los grupos se obtienen dinámicamente de los estudiantes cargados
const statusLabels: Record<StudentStatus, { label: string, color: string }> = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  INACTIVE: { label: 'Inactivo', color: 'bg-slate-100 text-slate-600' },
  TRANSFERRED: { label: 'Trasladado', color: 'bg-amber-100 text-amber-700' },
  GRADUATED: { label: 'Graduado', color: 'bg-blue-100 text-blue-700' },
  WITHDRAWN: { label: 'Retirado', color: 'bg-red-100 text-red-700' },
}

export default function Students() {
  const { institution } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'ALL'>('ALL')
  
  // Obtener grupos únicos de los estudiantes cargados (debe estar antes de early returns)
  const groups = useMemo(() => {
    const uniqueGroups = new Set(students.map(s => s.group).filter(Boolean))
    return Array.from(uniqueGroups).sort((a, b) => a.localeCompare(b))
  }, [students])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'academic' | 'observer' | 'guardians'>('info')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estados para importación con backend
  const [currentAcademicYear, setCurrentAcademicYear] = useState<{ id: string; year: number } | null>(null)
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; grade?: { name: string } }[]>([])
  const [studentGuardians, setStudentGuardians] = useState<any[]>([])
  const [loadingGuardians, setLoadingGuardians] = useState(false)
  
  // Estados para historial académico y observador (datos reales)
  const [academicHistory, setAcademicHistory] = useState<EnrollmentHistoryItem[]>([])
  const [observerEntries, setObserverEntries] = useState<ObservationItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingObserver, setLoadingObserver] = useState(false)

  const [formData, setFormData] = useState<Partial<Student>>({
    firstName: '', lastName: '', documentType: 'TI', documentNumber: '', birthDate: '', gender: 'M',
    address: '', phone: '', email: '', group: '9°A', status: 'ACTIVE', enrollmentDate: new Date().toISOString().split('T')[0],
    parentName: '', parentPhone: '', parentEmail: '', bloodType: '', eps: '', observations: ''
  })

  // Estados para guardar estudiante
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Estados para matrícula inmediata
  const [enrollNow, setEnrollNow] = useState(true) // Por defecto activado para nuevos
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  // Cargar año académico actual y grupos disponibles
  useEffect(() => {
    const loadInitialData = async () => {
      if (!institution?.id) return
      try {
        // Cargar año académico actual
        const yearRes = await academicYearLifecycleApi.getCurrent(institution.id)
        if (yearRes.data) {
          setCurrentAcademicYear({ id: yearRes.data.id, year: yearRes.data.year })
        }
        // Cargar grupos disponibles
        const groupsRes = await groupsApi.getAll()
        setAvailableGroups(groupsRes.data || [])
      } catch (err) {
        console.error('Error loading initial data:', err)
      }
    }
    loadInitialData()
  }, [institution?.id])

  useEffect(() => {
    const fetchStudents = async () => {
      if (!institution?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await studentsApi.getAll({ institutionId: institution.id })
        const apiStudents: Student[] = (response.data || []).map((s: any) => ({
          id: s.id,
          firstName: s.firstName || '',
          lastName: `${s.lastName || ''} ${s.secondLastName || ''}`.trim(),
          documentType: s.documentType || 'TI',
          documentNumber: s.documentNumber || '',
          birthDate: s.birthDate || '',
          gender: s.gender || '',
          address: s.address || '',
          phone: s.phone || '',
          email: s.email || '',
          group: s.enrollments?.[0]?.group ? `${s.enrollments[0].group.grade?.name || ''} ${s.enrollments[0].group.name}`.trim() : '',
          status: s.enrollments?.[0]?.status || 'ACTIVE',
          enrollmentDate: s.enrollments?.[0]?.enrollmentDate || '',
          parentName: s.guardians?.[0]?.guardian ? `${s.guardians[0].guardian.firstName} ${s.guardians[0].guardian.lastName}` : '',
          parentPhone: s.guardians?.[0]?.guardian?.phone || '',
          parentEmail: s.guardians?.[0]?.guardian?.email || '',
          bloodType: s.bloodType || '',
          eps: s.eps || '',
          observations: s.observations || ''
        }))
        setStudents(apiStudents)
      } catch (err: any) {
        console.error('Error loading students:', err)
        setError('Error al cargar estudiantes')
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [institution?.id])

  // Cargar historial académico y observador cuando se selecciona un estudiante
  const loadStudentDetails = async (studentId: string) => {
    // Cargar historial de matrículas
    setLoadingHistory(true)
    try {
      const historyRes = await enrollmentsApi.getStudentHistory(studentId)
      setAcademicHistory(historyRes.data || [])
    } catch (err) {
      console.error('Error loading academic history:', err)
      setAcademicHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Cargar observador cuando se cambia a esa pestaña
  const loadObserverEntries = async (studentId: string) => {
    setLoadingObserver(true)
    try {
      // Necesitamos el enrollmentId, no el studentId
      // Por ahora usamos el historial para obtener la matrícula actual
      const historyRes = await enrollmentsApi.getStudentHistory(studentId)
      const currentEnrollment = historyRes.data?.find((e: any) => e.status === 'ACTIVE')
      if (currentEnrollment) {
        const observerRes = await observerApi.getByStudent(currentEnrollment.id)
        setObserverEntries(observerRes.data || [])
      } else {
        setObserverEntries([])
      }
    } catch (err) {
      console.error('Error loading observer entries:', err)
      setObserverEntries([])
    } finally {
      setLoadingObserver(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName} ${s.documentNumber}`.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = filterGroup === 'ALL' || s.group === filterGroup
    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus
    return matchesSearch && matchesGroup && matchesStatus
  })

  const stats = {
    total: students.length,
    active: students.filter(s => s.status === 'ACTIVE').length,
    inactive: students.filter(s => s.status !== 'ACTIVE').length,
    byGroup: groups.map((g: string) => ({ group: g, count: students.filter(s => s.group === g && s.status === 'ACTIVE').length }))
  }

  const handleOpenNew = () => {
    setEditingStudent(null)
    setFormData({
      firstName: '', lastName: '', documentType: 'TI', documentNumber: '', birthDate: '', gender: 'M',
      address: '', phone: '', email: '', group: '', status: 'ACTIVE', enrollmentDate: new Date().toISOString().split('T')[0],
      parentName: '', parentPhone: '', parentEmail: '', bloodType: '', eps: '', observations: ''
    })
    setEnrollNow(true) // Por defecto matricular inmediatamente
    setSelectedGroupId(availableGroups[0]?.id || '')
    setShowModal(true)
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setFormData(student)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.documentNumber) {
      setSaveMessage({ type: 'error', text: 'Complete los campos obligatorios: Nombre, Apellido y Documento' })
      return
    }

    // Validar grupo si se va a matricular
    if (!editingStudent && enrollNow && !selectedGroupId) {
      setSaveMessage({ type: 'error', text: 'Seleccione un grupo para matricular al estudiante' })
      return
    }

    setSaving(true)
    setSaveMessage(null)

    try {
      if (editingStudent) {
        // Actualizar estudiante existente
        await studentsApi.update(editingStudent.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          documentType: formData.documentType,
          documentNumber: formData.documentNumber,
          birthDate: formData.birthDate,
          gender: formData.gender,
          address: formData.address,
          phone: formData.phone,
          email: formData.email
        })
        
        setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...formData } as Student : s))
        setSaveMessage({ type: 'success', text: 'Estudiante actualizado correctamente' })
      } else if (enrollNow && currentAcademicYear && selectedGroupId) {
        // Crear estudiante Y matricular en un solo paso (flujo unificado)
        const response = await api.post('/enrollments/create-and-enroll', {
          // Datos del estudiante
          firstName: formData.firstName,
          lastName: formData.lastName,
          documentType: formData.documentType || 'TI',
          documentNumber: formData.documentNumber,
          birthDate: formData.birthDate,
          gender: formData.gender || 'M',
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          eps: formData.eps,
          bloodType: formData.bloodType,
          // Datos de matrícula
          academicYearId: currentAcademicYear.id,
          groupId: selectedGroupId,
          enrollmentType: 'NEW',
          observations: formData.observations
        })
        
        const selectedGroup = availableGroups.find(g => g.id === selectedGroupId)
        const newStudent: Student = { 
          ...formData, 
          id: response.data.studentId,
          group: selectedGroup ? `${selectedGroup.grade?.name || ''} ${selectedGroup.name}`.trim() : ''
        } as Student
        setStudents([...students, newStudent])
        setSaveMessage({ type: 'success', text: 'Estudiante creado y matriculado correctamente' })
      } else {
        // Crear solo estudiante (sin matrícula)
        const response = await studentsApi.create({
          firstName: formData.firstName,
          lastName: formData.lastName,
          documentType: formData.documentType || 'TI',
          documentNumber: formData.documentNumber,
          birthDate: formData.birthDate,
          gender: formData.gender || 'M',
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          institutionId: institution?.id
        })
        
        const newStudent: Student = { 
          ...formData, 
          id: response.data.id 
        } as Student
        setStudents([...students, newStudent])
        setSaveMessage({ type: 'success', text: 'Estudiante creado correctamente (sin matrícula)' })
      }

      setTimeout(() => {
        setShowModal(false)
        setSaveMessage(null)
      }, 2000)
      
    } catch (err: any) {
      console.error('Error saving student:', err)
      const errorMsg = err.response?.data?.message || 'Error al guardar el estudiante'
      setSaveMessage({ type: 'error', text: errorMsg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Esta seguro de eliminar este estudiante?')) {
      setStudents(students.filter(s => s.id !== id))
    }
  }

  const handleViewDetail = (student: Student) => {
    setSelectedStudent(student)
    setDetailTab('info')
    setViewMode('detail')
    // Cargar historial académico al ver detalles
    loadStudentDetails(student.id)
  }

  const loadStudentGuardians = async (studentId: string) => {
    setLoadingGuardians(true)
    try {
      const response = await guardiansApi.getByStudent(studentId)
      setStudentGuardians(response.data || [])
    } catch (err) {
      console.error('Error loading guardians:', err)
      setStudentGuardians([])
    } finally {
      setLoadingGuardians(false)
    }
  }

  const relationshipLabels: Record<string, string> = {
    FATHER: 'Padre',
    MOTHER: 'Madre',
    STEPFATHER: 'Padrastro',
    STEPMOTHER: 'Madrastra',
    GRANDFATHER: 'Abuelo',
    GRANDMOTHER: 'Abuela',
    UNCLE: 'Tío',
    AUNT: 'Tía',
    SIBLING: 'Hermano/a',
    LEGAL_GUARDIAN: 'Tutor Legal',
    OTHER: 'Otro',
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const handleDownloadTemplate = () => {
    generateTemplate('students')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    setImportResult(null)
    
    try {
      const result = await parseExcelFile(file, 'students')
      setImportResult(result)
    } catch (error) {
      setImportResult({
        success: false,
        data: [],
        errors: [{ row: 0, field: '', message: 'Error al procesar el archivo' }],
        totalRows: 0,
        validRows: 0
      })
    } finally {
      setImporting(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!importResult || importResult.data.length === 0) return
    if (!institution?.id || !currentAcademicYear?.id) {
      alert('No hay año académico activo. Configure un año académico antes de importar.')
      return
    }

    setImporting(true)
    
    try {
      // Mapear grupo del Excel al ID del grupo en la BD
      const findGroupId = (groupName: string): string => {
        const group = availableGroups.find(g => {
          const fullName = g.grade?.name ? `${g.grade.name} ${g.name}` : g.name
          return fullName.toLowerCase().includes(groupName.toLowerCase()) || 
                 g.name.toLowerCase() === groupName.toLowerCase()
        })
        return group?.id || ''
      }

      const studentsToImport = importResult.data
        .map(row => ({
          documentType: row.documentType || 'TI',
          documentNumber: row.documentNumber || '',
          firstName: row.firstName || '',
          secondName: row.secondName || '',
          lastName: row.lastName || '',
          secondLastName: row.secondLastName || '',
          birthDate: row.birthDate || '',
          gender: row.gender || 'M',
          address: row.address || '',
          phone: row.phone || '',
          email: row.email || '',
          groupId: findGroupId(row.group || ''),
          bloodType: row.bloodType || '',
          eps: row.eps || '',
          guardianName: row.parentName || '',
          guardianPhone: row.parentPhone || '',
          guardianEmail: row.parentEmail || '',
        }))
        .filter(s => s.documentNumber && s.firstName && s.groupId)

      if (studentsToImport.length === 0) {
        alert('No hay estudiantes válidos para importar. Verifique que los grupos existan.')
        setImporting(false)
        return
      }

      const result = await studentsApi.bulkImport({
        institutionId: institution.id,
        academicYearId: currentAcademicYear.id,
        students: studentsToImport,
      })

      const { created, updated, errors } = result.data
      alert(`Importación completada:\n- Creados: ${created}\n- Actualizados: ${updated}\n- Errores: ${errors?.length || 0}`)

      // Recargar estudiantes
      const response = await studentsApi.getAll({ institutionId: institution.id })
      const apiStudents: Student[] = (response.data || []).map((s: any) => ({
        id: s.id,
        firstName: s.firstName || '',
        lastName: `${s.lastName || ''} ${s.secondLastName || ''}`.trim(),
        documentType: s.documentType || 'TI',
        documentNumber: s.documentNumber || '',
        birthDate: s.birthDate || '',
        gender: s.gender || '',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        group: s.enrollments?.[0]?.group ? `${s.enrollments[0].group.grade?.name || ''} ${s.enrollments[0].group.name}`.trim() : '',
        status: s.enrollments?.[0]?.status || 'ACTIVE',
        enrollmentDate: s.enrollments?.[0]?.enrollmentDate || '',
        parentName: s.guardians?.[0]?.guardian ? `${s.guardians[0].guardian.firstName} ${s.guardians[0].guardian.lastName}` : '',
        parentPhone: s.guardians?.[0]?.guardian?.phone || '',
        parentEmail: s.guardians?.[0]?.guardian?.email || '',
        bloodType: s.bloodType || '',
        eps: s.eps || '',
        observations: s.observations || ''
      }))
      setStudents(apiStudents)

      setShowImportModal(false)
      setImportResult(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      console.error('Error importing students:', err)
      alert('Error al importar estudiantes: ' + (err.response?.data?.message || err.message))
    } finally {
      setImporting(false)
    }
  }

  const handleExport = () => {
    const columns = [
      { header: 'Documento', key: 'documentNumber' },
      { header: 'Tipo Doc', key: 'documentType' },
      { header: 'Nombres', key: 'firstName' },
      { header: 'Apellidos', key: 'lastName' },
      { header: 'Grupo', key: 'group' },
      { header: 'Estado', key: 'status' },
      { header: 'Telefono', key: 'phone' },
      { header: 'Email', key: 'email' },
      { header: 'Acudiente', key: 'parentName' },
      { header: 'Tel Acudiente', key: 'parentPhone' },
    ]
    exportToExcel(students, columns, 'Listado_Estudiantes.xlsx')
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      {viewMode === 'list' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Estudiantes</h1>
              <p className="text-slate-500 mt-1">Gestion de estudiantes matriculados</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                <Upload className="w-4 h-4" />
                Importar
              </button>
              <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                <Download className="w-4 h-4" />
                Exportar
              </button>
              <button onClick={handleOpenNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Nuevo Estudiante
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total Estudiantes</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  <p className="text-xs text-slate-500">Activos</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-600">{stats.inactive}</p>
                  <p className="text-xs text-slate-500">Inactivos</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2">Por Grupo</p>
              <div className="flex flex-wrap gap-1">
                {stats.byGroup.slice(0, 4).map(g => (
                  <span key={g.group} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">{g.group}: {g.count}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Filters & Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar por nombre o documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los grupos</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                  <option value="TRANSFERRED">Trasladados</option>
                  <option value="GRADUATED">Graduados</option>
                  <option value="WITHDRAWN">Retirados</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Documento</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Grupo</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acudiente</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-slate-600">{student.firstName[0]}{student.lastName[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{student.firstName} {student.lastName}</p>
                            <p className="text-xs text-slate-500">{calculateAge(student.birthDate)} anos - {student.gender === 'M' ? 'Masculino' : 'Femenino'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900">{student.documentNumber}</p>
                        <p className="text-xs text-slate-500">{student.documentType}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">{student.group}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-900">{student.parentName}</p>
                        <p className="text-xs text-slate-500">{student.parentPhone}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusLabels[student.status].color}`}>{statusLabels[student.status].label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleViewDetail(student)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600" title="Ver ficha"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(student)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(student.id)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">Mostrando {filteredStudents.length} de {students.length} estudiantes</p>
            </div>
          </div>
        </>
      ) : selectedStudent && (
        /* Ficha del Estudiante */
        <div>
          <button onClick={() => setViewMode('list')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
            <X className="w-4 h-4" /> Volver al listado
          </button>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Header de la ficha */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold">{selectedStudent.firstName[0]}{selectedStudent.lastName[0]}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedStudent.firstName} {selectedStudent.lastName}</h2>
                  <p className="text-blue-100">{selectedStudent.documentType}: {selectedStudent.documentNumber}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">{selectedStudent.group}</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${selectedStudent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-500'}`}>{statusLabels[selectedStudent.status].label}</span>
                  </div>
                </div>
                <button onClick={() => handleEdit(selectedStudent)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2">
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <div className="flex">
                <button onClick={() => setDetailTab('info')} className={`px-6 py-3 font-medium text-sm border-b-2 ${detailTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <User className="w-4 h-4 inline mr-2" />Informacion Personal
                </button>
                <button onClick={() => { setDetailTab('guardians'); loadStudentGuardians(selectedStudent.id) }} className={`px-6 py-3 font-medium text-sm border-b-2 ${detailTab === 'guardians' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <Users className="w-4 h-4 inline mr-2" />Acudientes
                </button>
                <button onClick={() => setDetailTab('academic')} className={`px-6 py-3 font-medium text-sm border-b-2 ${detailTab === 'academic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <GraduationCap className="w-4 h-4 inline mr-2" />Historial Academico
                </button>
                <button onClick={() => { setDetailTab('observer'); loadObserverEntries(selectedStudent.id) }} className={`px-6 py-3 font-medium text-sm border-b-2 ${detailTab === 'observer' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  <FileText className="w-4 h-4 inline mr-2" />Observador
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {detailTab === 'info' && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 border-b pb-2">Datos Personales</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-slate-500">Fecha Nacimiento:</span><p className="font-medium">{new Date(selectedStudent.birthDate).toLocaleDateString('es-CO')}</p></div>
                      <div><span className="text-slate-500">Edad:</span><p className="font-medium">{calculateAge(selectedStudent.birthDate)} anos</p></div>
                      <div><span className="text-slate-500">Genero:</span><p className="font-medium">{selectedStudent.gender === 'M' ? 'Masculino' : 'Femenino'}</p></div>
                      <div><span className="text-slate-500">Tipo Sangre:</span><p className="font-medium">{selectedStudent.bloodType || 'No registrado'}</p></div>
                      <div><span className="text-slate-500">EPS:</span><p className="font-medium">{selectedStudent.eps || 'No registrada'}</p></div>
                      <div><span className="text-slate-500">Fecha Matricula:</span><p className="font-medium">{new Date(selectedStudent.enrollmentDate).toLocaleDateString('es-CO')}</p></div>
                    </div>
                    <h3 className="font-semibold text-slate-900 border-b pb-2 mt-6">Contacto</h3>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" />{selectedStudent.address}</p>
                      <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{selectedStudent.phone}</p>
                      <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{selectedStudent.email}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900 border-b pb-2">Acudiente / Padre de Familia</h3>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="font-medium text-slate-900">{selectedStudent.parentName}</p>
                      <p className="text-sm text-slate-600 flex items-center gap-2 mt-1"><Phone className="w-4 h-4" />{selectedStudent.parentPhone}</p>
                      <p className="text-sm text-slate-600 flex items-center gap-2"><Mail className="w-4 h-4" />{selectedStudent.parentEmail}</p>
                    </div>
                    {selectedStudent.observations && (
                      <>
                        <h3 className="font-semibold text-slate-900 border-b pb-2 mt-6">Observaciones Generales</h3>
                        <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">{selectedStudent.observations}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'guardians' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Acudientes / Padres de Familia</h3>
                    <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      <UserPlus className="w-4 h-4" /> Agregar Acudiente
                    </button>
                  </div>
                  
                  {loadingGuardians ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-slate-500">Cargando acudientes...</span>
                    </div>
                  ) : studentGuardians.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-lg">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No hay acudientes registrados</p>
                      <p className="text-sm text-slate-400 mt-1">Agregue un acudiente para este estudiante</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studentGuardians.map((sg: any) => (
                        <div key={sg.id} className={`p-4 rounded-lg border ${sg.isPrimary ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${sg.isPrimary ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                                <span className="text-lg font-bold">
                                  {sg.guardian?.firstName?.[0]}{sg.guardian?.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {sg.guardian?.firstName} {sg.guardian?.lastName}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {relationshipLabels[sg.relationship] || sg.relationship}
                                  {sg.isPrimary && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Principal</span>}
                                </p>
                              </div>
                            </div>
                            <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="mt-4 space-y-2 text-sm">
                            <p className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-4 h-4 text-slate-400" />
                              {sg.guardian?.phone || 'Sin teléfono'}
                            </p>
                            {sg.guardian?.email && (
                              <p className="flex items-center gap-2 text-slate-600">
                                <Mail className="w-4 h-4 text-slate-400" />
                                {sg.guardian.email}
                              </p>
                            )}
                            {sg.guardian?.address && (
                              <p className="flex items-center gap-2 text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {sg.guardian.address}
                              </p>
                            )}
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap gap-2">
                            {sg.canPickUp && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Puede recoger</span>
                            )}
                            {sg.isEmergencyContact && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Contacto emergencia</span>
                            )}
                            {sg.receivesNotifications && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">Recibe notificaciones</span>
                            )}
                            {sg.receivesGrades && (
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">Recibe notas</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'academic' && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-4">Historial Academico</h3>
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-slate-600">Cargando historial...</span>
                    </div>
                  ) : academicHistory.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Año</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Grado</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Grupo</th>
                          <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Estado</th>
                          <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Fecha Matrícula</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {academicHistory.map((h: EnrollmentHistoryItem, i: number) => (
                          <tr key={h.id || i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">{h.academicYear?.year || '-'}</td>
                            <td className="px-4 py-3">{h.group?.grade?.name || '-'}</td>
                            <td className="px-4 py-3">{h.group?.name || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                h.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                                h.status === 'PROMOTED' ? 'bg-blue-100 text-blue-700' : 
                                h.status === 'WITHDRAWN' ? 'bg-red-100 text-red-700' :
                                h.status === 'TRANSFERRED' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {h.status === 'ACTIVE' ? 'Activo' : 
                                 h.status === 'PROMOTED' ? 'Promovido' : 
                                 h.status === 'WITHDRAWN' ? 'Retirado' :
                                 h.status === 'TRANSFERRED' ? 'Trasladado' :
                                 h.status === 'REPEATED' ? 'Repitente' : h.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-slate-600">
                              {h.enrollmentDate ? new Date(h.enrollmentDate).toLocaleDateString('es-CO') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <GraduationCap className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No hay historial académico registrado</p>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'observer' && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-4">Observador del Estudiante</h3>
                  {loadingObserver ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="ml-2 text-slate-600">Cargando observador...</span>
                    </div>
                  ) : observerEntries.length > 0 ? (
                    <div className="space-y-3">
                      {observerEntries.map((o: ObservationItem) => (
                        <div key={o.id} className={`p-4 rounded-lg border-l-4 ${o.type === 'POSITIVE' ? 'bg-green-50 border-green-500' : o.type === 'NEGATIVE' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-400'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${o.type === 'POSITIVE' ? 'bg-green-100 text-green-700' : o.type === 'NEGATIVE' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>{o.category}</span>
                            <span className="text-xs text-slate-500">{new Date(o.date).toLocaleDateString('es-CO')}</span>
                          </div>
                          <p className="text-sm text-slate-700">{o.description}</p>
                          <p className="text-xs text-slate-500 mt-2">Registrado por: {o.author?.firstName} {o.author?.lastName}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No hay observaciones registradas</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombres *</label>
                  <input type="text" value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos *</label>
                  <input type="text" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Documento</label>
                  <select value={formData.documentType || 'TI'} onChange={(e) => setFormData({ ...formData, documentType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="TI">Tarjeta de Identidad</option>
                    <option value="CC">Cedula de Ciudadania</option>
                    <option value="RC">Registro Civil</option>
                    <option value="CE">Cedula de Extranjeria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numero Documento *</label>
                  <input type="text" value={formData.documentNumber || ''} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Nacimiento *</label>
                  <input type="date" value={formData.birthDate || ''} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Genero</label>
                  <select value={formData.gender || 'M'} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                {/* Sección de Matrícula Inmediata - Solo para nuevos estudiantes */}
                {!editingStudent && (
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id="enrollNow"
                        checked={enrollNow}
                        onChange={(e) => setEnrollNow(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enrollNow" className="font-medium text-blue-900">
                        Matricular inmediatamente en {currentAcademicYear?.year || 'año actual'}
                      </label>
                    </div>
                    {enrollNow && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">Grupo *</label>
                          <select 
                            value={selectedGroupId} 
                            onChange={(e) => setSelectedGroupId(e.target.value)} 
                            className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Seleccionar grupo...</option>
                            {availableGroups.map(g => (
                              <option key={g.id} value={g.id}>
                                {g.grade?.name} - {g.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">Tipo de Matrícula</label>
                          <select className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white">
                            <option value="NEW">Nuevo</option>
                            <option value="RENEWAL">Antiguo</option>
                            <option value="TRANSFER">Traslado</option>
                          </select>
                        </div>
                      </div>
                    )}
                    {!enrollNow && (
                      <p className="text-sm text-blue-700 mt-2">
                        El estudiante se creará sin matrícula. Podrá matricularlo después desde el módulo de Matrículas.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Grupo solo lectura para edición */}
                {editingStudent && formData.group && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grupo Actual</label>
                    <input type="text" value={formData.group} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                  <input type="text" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono</label>
                  <input type="text" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
                  <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-medium text-slate-900 mb-3">Datos del Acudiente</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Acudiente *</label>
                  <input type="text" value={formData.parentName || ''} onChange={(e) => setFormData({ ...formData, parentName: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono Acudiente *</label>
                  <input type="text" value={formData.parentPhone || ''} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo Acudiente</label>
                  <input type="email" value={formData.parentEmail || ''} onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">EPS</label>
                  <input type="text" value={formData.eps || ''} onChange={(e) => setFormData({ ...formData, eps: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Sangre</label>
                  <select value={formData.bloodType || ''} onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">Seleccionar</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
                  <textarea value={formData.observations || ''} onChange={(e) => setFormData({ ...formData, observations: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200">
              {saveMessage && (
                <div className={`mb-3 p-3 rounded-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {saveMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  <span className="text-sm">{saveMessage.text}</span>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowModal(false); setSaveMessage(null) }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50" disabled={saving}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600" />Importar Estudiantes</h3>
              <button onClick={closeImportModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {!importResult ? (
                <>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" className="hidden" id="file-upload" />
                    {importing ? (
                      <>
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Procesando archivo...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">Arrastra un archivo Excel aqui o</p>
                        <label htmlFor="file-upload" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block">Seleccionar Archivo</label>
                        <p className="text-xs text-slate-500 mt-4">Formatos aceptados: .xlsx, .xls, .csv</p>
                      </>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Descarga la plantilla para asegurar el formato correcto</p>
                    <button onClick={handleDownloadTemplate} className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1"><Download className="w-4 h-4" />Descargar plantilla de estudiantes</button>
                  </div>
                </>
              ) : (
                <>
                  {/* Resultado de la importación */}
                  <div className={`p-4 rounded-lg mb-4 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center gap-3">
                      {importResult.success ? <CheckCircle2 className="w-8 h-8 text-green-600" /> : <AlertTriangle className="w-8 h-8 text-amber-600" />}
                      <div>
                        <p className="font-semibold text-slate-900">{importResult.success ? 'Archivo procesado correctamente' : 'Archivo procesado con errores'}</p>
                        <p className="text-sm text-slate-600">Total filas: {importResult.totalRows} | Validas: {importResult.validRows} | Errores: {importResult.errors.length}</p>
                      </div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="mb-4">
                      <p className="font-medium text-slate-900 mb-2">Errores encontrados:</p>
                      <div className="max-h-40 overflow-y-auto bg-red-50 rounded-lg p-3 space-y-1">
                        {importResult.errors.slice(0, 20).map((err, i) => (
                          <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>Fila {err.row}: {err.message}</span>
                          </p>
                        ))}
                        {importResult.errors.length > 20 && <p className="text-sm text-red-600 font-medium">... y {importResult.errors.length - 20} errores mas</p>}
                      </div>
                    </div>
                  )}

                  {importResult.validRows > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="font-medium text-slate-900 mb-2">Vista previa ({importResult.validRows} registros validos):</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-2 py-1 text-left">Documento</th>
                              <th className="px-2 py-1 text-left">Nombre</th>
                              <th className="px-2 py-1 text-left">Grupo</th>
                              <th className="px-2 py-1 text-left">Acudiente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.data.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-t border-slate-200">
                                <td className="px-2 py-1">{row.documentNumber}</td>
                                <td className="px-2 py-1">{row.firstName} {row.lastName}</td>
                                <td className="px-2 py-1">{row.group}</td>
                                <td className="px-2 py-1">{row.parentName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importResult.data.length > 5 && <p className="text-xs text-slate-500 mt-2">... y {importResult.data.length - 5} registros mas</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={closeImportModal} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
              {importResult ? (
                <>
                  <button onClick={() => { setImportResult(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Seleccionar otro archivo</button>
                  <button onClick={handleConfirmImport} disabled={importResult.validRows === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Importar {importResult.validRows} estudiantes
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
