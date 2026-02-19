import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, Plus, User, X, Edit2, Eye, Trash2, Upload, Download, GraduationCap, FileText, AlertTriangle, Phone, Mail, MapPin, Users, CheckCircle2, XCircle, FileSpreadsheet, Heart, UserPlus, Loader2, Key, Shield, Printer, RefreshCw, EyeOff, Lock, Unlock } from 'lucide-react'
import * as XLSX from 'xlsx'
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
  const [rawStudents, setRawStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('ALL')
  const [filterGroup, setFilterGroup] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState<StudentStatus | 'ALL'>('ALL')
  
  // Obtener grados únicos de los estudiantes cargados
  const grades = useMemo(() => {
    const uniqueGrades = new Set(
      students
        .map(s => {
          // Extraer el grado del grupo (ej: "Sexto A" -> "Sexto", "11° A" -> "11°")
          const parts = s.group?.split(/\s+/)
          return parts && parts.length > 1 ? parts.slice(0, -1).join(' ') : s.group
        })
        .filter(Boolean)
    )
    return Array.from(uniqueGrades).sort((a, b) => a.localeCompare(b))
  }, [students])
  
  // Obtener grupos únicos, filtrados por grado si hay uno seleccionado
  const groups = useMemo(() => {
    let filteredGroups = students.map(s => s.group).filter(Boolean)
    
    if (filterGrade !== 'ALL') {
      filteredGroups = filteredGroups.filter(g => g.startsWith(filterGrade))
    }
    
    const uniqueGroups = new Set(filteredGroups)
    return Array.from(uniqueGroups).sort((a, b) => a.localeCompare(b))
  }, [students, filterGrade])
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
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string; grade?: { name: string; number?: number } }[]>([])
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
  
  // Estados para crear acceso masivo
  const [creatingAccess, setCreatingAccess] = useState(false)
  const [showAccessModal, setShowAccessModal] = useState(false)
  
  // Estados para gestión de credenciales
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentialStudents, setCredentialStudents] = useState<any[]>([])
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [credentialsSearch, setCredentialsSearch] = useState('')
  const [credentialsGroupFilter, setCredentialsGroupFilter] = useState('ALL')
  const [credentialsAccessFilter, setCredentialsAccessFilter] = useState<'ALL' | 'WITH_ACCESS' | 'WITHOUT_ACCESS'>('ALL')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [processingCredentials, setProcessingCredentials] = useState(false)

  // Estados para Listados por Grupo
  const [showListModal, setShowListModal] = useState(false)
  const [listGroupId, setListGroupId] = useState('')
  const [listTitle, setListTitle] = useState('')
  const [listTemplate, setListTemplate] = useState<'clean' | 'grades' | 'attendance' | 'full' | 'custom'>('clean')
  const [listColumns, setListColumns] = useState<Record<string, boolean>>({
    document: false, birthDate: false, age: false, guardian: false, phone: false, eps: false, bloodType: false,
  })
  const [listEmptyCols, setListEmptyCols] = useState(4)
  const [listEmptyLabels, setListEmptyLabels] = useState<string[]>(['', '', '', '', '', '', '', '', '', ''])
  const [listOrientation, setListOrientation] = useState<'portrait' | 'landscape'>('landscape')

  // Grupos únicos de los estudiantes de credenciales (debe estar antes de cualquier early return)
  const credentialGroups = useMemo(() => {
    const uniqueGroups = new Set(credentialStudents.map(s => s.group).filter(Boolean))
    return Array.from(uniqueGroups).sort((a, b) => a.localeCompare(b))
  }, [credentialStudents])

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
        const rawData = response.data || []
        setRawStudents(rawData)
        const apiStudents: Student[] = rawData.map((s: any) => ({
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
    const matchesGrade = filterGrade === 'ALL' || s.group?.startsWith(filterGrade)
    const matchesGroup = filterGroup === 'ALL' || s.group === filterGroup
    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus
    return matchesSearch && matchesGrade && matchesGroup && matchesStatus
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

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este estudiante? Esta acción no se puede deshacer.')) {
      try {
        await studentsApi.delete(id)
        setStudents(students.filter(s => s.id !== id))
      } catch (err: any) {
        console.error('Error deleting student:', err)
        alert(err.response?.data?.message || 'Error al eliminar el estudiante')
      }
    }
  }

  // Crear acceso masivo para estudiantes filtrados
  const handleBulkCreateAccess = async () => {
    const studentIds = filteredStudents.map(s => s.id)
    if (studentIds.length === 0) {
      alert('No hay estudiantes para crear acceso')
      return
    }
    
    const confirmMsg = `¿Crear acceso al sistema para ${studentIds.length} estudiantes del grupo "${filterGroup === 'ALL' ? 'Todos' : filterGroup}"?\n\nSe creará un usuario con:\n- Email: documento@estudiante.edusyn.com\n- Contraseña inicial: número de documento\n- Rol: ESTUDIANTE`
    if (!confirm(confirmMsg)) return
    
    setCreatingAccess(true)
    try {
      const response = await studentsApi.bulkActivateAccess(studentIds)
      const result = response.data
      alert(`✅ Acceso creado para ${result.activated} estudiantes${result.errors?.length > 0 ? `\n⚠️ ${result.errors.length} errores` : ''}`)
      setShowAccessModal(false)
    } catch (err: any) {
      console.error('Error creating access:', err)
      alert(err.response?.data?.message || 'Error al crear acceso')
    } finally {
      setCreatingAccess(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GESTIÓN DE CREDENCIALES
  // ═══════════════════════════════════════════════════════════════

  const loadCredentialStudents = async () => {
    if (!institution?.id) return
    setLoadingCredentials(true)
    try {
      const response = await studentsApi.getAll({ institutionId: institution.id })
      const mapped = (response.data || []).map((s: any) => ({
        id: s.id,
        firstName: s.firstName || '',
        lastName: `${s.lastName || ''} ${s.secondLastName || ''}`.trim(),
        documentNumber: s.documentNumber || '',
        group: s.enrollments?.[0]?.group ? `${s.enrollments[0].group.grade?.name || ''} ${s.enrollments[0].group.name}`.trim() : '',
        userId: s.userId || null,
        username: s.user?.username || null,
        userEmail: s.user?.email || null,
        userIsActive: s.user?.isActive ?? null,
        mustChangePassword: s.user?.mustChangePassword ?? null,
        hasAccess: !!s.userId,
        initialPassword: s.documentNumber || '',
      }))
      setCredentialStudents(mapped)
    } catch (err: any) {
      console.error('Error loading credential students:', err)
      alert('Error al cargar datos de credenciales')
    } finally {
      setLoadingCredentials(false)
    }
  }

  const handleOpenCredentials = () => {
    setShowCredentialsModal(true)
    setCredentialsSearch('')
    setCredentialsGroupFilter('ALL')
    setCredentialsAccessFilter('ALL')
    setShowPasswords({})
    loadCredentialStudents()
  }

  const handleActivateAccess = async (studentId: string) => {
    try {
      setProcessingCredentials(true)
      await studentsApi.activateAccess(studentId)
      await loadCredentialStudents()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al activar acceso')
    } finally {
      setProcessingCredentials(false)
    }
  }

  const handleDeactivateAccess = async (studentId: string) => {
    if (!confirm('¿Desactivar acceso al sistema para este estudiante? Se eliminará su usuario.')) return
    try {
      setProcessingCredentials(true)
      await studentsApi.deactivateAccess(studentId)
      await loadCredentialStudents()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al desactivar acceso')
    } finally {
      setProcessingCredentials(false)
    }
  }

  const handleResetPassword = async (studentId: string) => {
    if (!confirm('¿Resetear la contraseña de este estudiante a su número de documento?')) return
    try {
      setProcessingCredentials(true)
      await studentsApi.resetPassword(studentId)
      await loadCredentialStudents()
      alert('Contraseña reseteada correctamente')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al resetear contraseña')
    } finally {
      setProcessingCredentials(false)
    }
  }

  // Filtrar estudiantes de credenciales
  const filteredCredentialStudents = credentialStudents.filter(s => {
    const matchesSearch = `${s.firstName} ${s.lastName} ${s.documentNumber} ${s.username || ''}`.toLowerCase().includes(credentialsSearch.toLowerCase())
    const matchesGroup = credentialsGroupFilter === 'ALL' || s.group === credentialsGroupFilter
    const matchesAccess = credentialsAccessFilter === 'ALL' || 
      (credentialsAccessFilter === 'WITH_ACCESS' && s.hasAccess) ||
      (credentialsAccessFilter === 'WITHOUT_ACCESS' && !s.hasAccess)
    return matchesSearch && matchesGroup && matchesAccess
  })

  const handleBulkActivateFiltered = async () => {
    const studentsWithoutAccess = filteredCredentialStudents.filter(s => !s.hasAccess)
    if (studentsWithoutAccess.length === 0) {
      alert('Todos los estudiantes filtrados ya tienen acceso')
      return
    }
    const msg = `¿Crear acceso al sistema para ${studentsWithoutAccess.length} estudiantes?\n\n` +
      `Se creará un usuario con:\n- Usuario: inicial+apellido+doc\n- Contraseña inicial: número de documento\n- Rol: ESTUDIANTE`
    if (!confirm(msg)) return
    
    setProcessingCredentials(true)
    try {
      const result = await studentsApi.bulkActivateAccess(studentsWithoutAccess.map(s => s.id))
      alert(`Acceso creado para ${result.data.activated} estudiantes${result.data.errors?.length > 0 ? `\n${result.data.errors.length} errores` : ''}`)
      await loadCredentialStudents()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear acceso masivo')
    } finally {
      setProcessingCredentials(false)
    }
  }

  const handleBulkResetFiltered = async () => {
    const studentsWithAccess = filteredCredentialStudents.filter(s => s.hasAccess)
    if (studentsWithAccess.length === 0) {
      alert('No hay estudiantes con acceso para resetear')
      return
    }
    if (!confirm(`¿Resetear contraseña a ${studentsWithAccess.length} estudiantes?\nLa contraseña será su número de documento.`)) return
    
    setProcessingCredentials(true)
    try {
      const result = await studentsApi.bulkResetPassword(studentsWithAccess.map(s => s.id))
      alert(`Contraseñas reseteadas: ${result.data.reset}${result.data.errors?.length > 0 ? `\n${result.data.errors.length} errores` : ''}`)
      await loadCredentialStudents()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al resetear contraseñas')
    } finally {
      setProcessingCredentials(false)
    }
  }

  const handleExportCredentials = () => {
    const studentsWithAccess = filteredCredentialStudents.filter(s => s.hasAccess)
    if (studentsWithAccess.length === 0) {
      alert('No hay estudiantes con credenciales para exportar')
      return
    }
    const columns = [
      { header: 'Nombre', key: 'fullName' },
      { header: 'Documento', key: 'documentNumber' },
      { header: 'Grupo', key: 'group' },
      { header: 'Usuario', key: 'username' },
      { header: 'Contraseña Inicial', key: 'initialPassword' },
    ]
    const data = studentsWithAccess.map(u => ({
      fullName: `${u.firstName} ${u.lastName}`,
      documentNumber: u.documentNumber,
      group: u.group,
      username: u.username,
      initialPassword: u.initialPassword,
    }))
    exportToExcel(data, columns, `Credenciales_Estudiantes_${credentialsGroupFilter !== 'ALL' ? credentialsGroupFilter.replace(/\s+/g, '_') : 'Todos'}.xlsx`)
  }

  const handlePrintCredentials = () => {
    const studentsWithAccess = filteredCredentialStudents.filter(s => s.hasAccess)
    if (studentsWithAccess.length === 0) {
      alert('No hay estudiantes con credenciales para imprimir')
      return
    }
    const printContent = `
      <html>
        <head>
          <title>Credenciales Estudiantes</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
            h2 { color: #1e293b; margin-bottom: 4px; }
            h3 { color: #64748b; margin-top: 0; font-weight: normal; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .password { font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
            .username { font-family: monospace; background: #dbeafe; padding: 2px 6px; border-radius: 4px; }
            .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h2>Credenciales de Acceso - Estudiantes</h2>
          <h3>${credentialsGroupFilter !== 'ALL' ? `Grupo: ${credentialsGroupFilter}` : 'Todos los grupos'} | ${studentsWithAccess.length} estudiantes</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Grupo</th>
                <th>Usuario</th>
                <th>Contraseña</th>
              </tr>
            </thead>
            <tbody>
              ${studentsWithAccess.map((u, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${u.firstName} ${u.lastName}</td>
                  <td>${u.documentNumber}</td>
                  <td>${u.group}</td>
                  <td><span class="username">${u.username}</span></td>
                  <td><span class="password">${u.initialPassword}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="footer">Generado por EduSyn - ${new Date().toLocaleDateString('es-CO')} | La contraseña inicial es el número de documento</p>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Borrar estudiantes sin registros (solo admin)
  const handleBulkDeleteWithoutRecords = async () => {
    if (!institution?.id) return
    
    const confirmMsg = '⚠️ ADVERTENCIA: Esta acción eliminará TODOS los estudiantes que NO tengan:\n- Notas\n- Asistencias\n- Observaciones\n\n¿Está seguro de continuar?'
    if (!confirm(confirmMsg)) return
    if (!confirm('¿CONFIRMAR ELIMINACIÓN MASIVA? Esta acción NO se puede deshacer.')) return
    
    try {
      const response = await studentsApi.bulkDeleteWithoutRecords(institution.id)
      const result = response.data
      alert(`✅ Eliminados ${result.deleted} estudiantes sin registros`)
      // Recargar lista
      const studentsRes = await studentsApi.getAll({ institutionId: institution.id })
      const apiStudents = (studentsRes.data || []).map((s: any) => ({
        id: s.id,
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        documentType: s.documentType || 'TI',
        documentNumber: s.documentNumber || '',
        birthDate: s.birthDate?.split('T')[0] || '',
        gender: s.gender || 'M',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        group: s.enrollments?.[0]?.group?.name || 'Sin grupo',
        status: s.enrollments?.[0]?.status || 'ACTIVE',
        enrollmentDate: s.enrollments?.[0]?.enrollmentDate?.split('T')[0] || '',
        parentName: '', parentPhone: '', parentEmail: '',
        bloodType: s.bloodType || '', eps: s.eps || '', observations: s.observations || ''
      }))
      setStudents(apiStudents)
    } catch (err: any) {
      console.error('Error deleting students:', err)
      alert(err.response?.data?.message || 'Error al eliminar estudiantes')
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
      // ═══════════════════════════════════════════════════════════════════════════
      // NORMALIZACIÓN DE GRUPOS - Soporta múltiples formatos de entrada
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Tabla de equivalencias: nombres textuales de grados → número
      const gradeTextToNumber: Record<string, string> = {
        'primero': '1', 'segundo': '2', 'tercero': '3', 'cuarto': '4',
        'quinto': '5', 'sexto': '6', 'septimo': '7', 'octavo': '8',
        'noveno': '9', 'decimo': '10', 'undecimo': '11', 'once': '11',
        'transicion': '0', 'prejardin': '-2', 'jardin': '-1', 'kinder': '-1'
      }
      
      // Helper para convertir número a TODOS los nombres posibles del grado
      const numberToGradeNames = (num: string): string[] => {
        const names: Record<string, string[]> = {
          '-2': ['prejardin'], '-1': ['jardin'], '0': ['transicion'],
          '1': ['primero'], '2': ['segundo'], '3': ['tercero'], '4': ['cuarto'],
          '5': ['quinto'], '6': ['sexto'], '7': ['septimo'], '8': ['octavo'],
          '9': ['noveno'], '10': ['decimo'], '11': ['undecimo', 'once']
        }
        return names[num] || [num]
      }

      // Normalizar texto: quitar tildes, °, espacios
      const normalizeText = (text: string): string => {
        if (!text) return ''
        return text.toString().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
          .replace(/°/g, '')
          .replace(/[\-\s]+/g, '') // Quitar guiones y espacios
          .trim()
      }
      
      // Normalizar sección: letra A-Z o número 01-99
      const normalizeSection = (section: string): string => {
        if (!section) return ''
        const cleaned = section.toString().trim().toUpperCase()
        // Si es una sola letra
        if (/^[A-Z]$/.test(cleaned)) return cleaned
        // Si es un número, normalizar a dos dígitos
        const num = parseInt(cleaned, 10)
        if (!isNaN(num) && num >= 1 && num <= 99) {
          return num.toString().padStart(2, '0')
        }
        return cleaned
      }
      
      // Detectar grado desde texto (puede ser número o nombre textual)
      const detectGrade = (text: string): string | null => {
        const normalized = normalizeText(text)
        // Primero intentar como número directo
        if (/^\d{1,2}$/.test(normalized)) return normalized
        // Luego buscar en tabla de equivalencias
        for (const [name, num] of Object.entries(gradeTextToNumber)) {
          if (normalized.includes(name)) return num
        }
        return null
      }
      
      // Detectar sección desde texto restante
      const detectSection = (text: string): string | null => {
        const cleaned = normalizeText(text).replace(/^[\-\s]+/, '')
        if (!cleaned) return null
        // Si es una sola letra
        if (/^[a-z]$/.test(cleaned)) return cleaned.toUpperCase()
        // Si es un número
        const num = parseInt(cleaned, 10)
        if (!isNaN(num) && num >= 1 && num <= 99) {
          return num.toString().padStart(2, '0')
        }
        return null
      }
      
      // Parsear grupo combinado (11A, 11-A, Undécimo A, 11-01, etc.)
      const parseGroupString = (groupStr: string): { grade: string | null; section: string | null } => {
        if (!groupStr) return { grade: null, section: null }
        const normalized = normalizeText(groupStr)
        
        // Patrón 1: número + letra/número (11a, 10b, 11-01)
        const match1 = normalized.match(/^(\d{1,2})([a-z]|\d{1,2})$/)
        if (match1) {
          const grade = match1[1]
          const section = detectSection(match1[2])
          return { grade, section }
        }
        
        // Patrón 2: nombre textual + sección (undecimoa, sextob)
        for (const [name, num] of Object.entries(gradeTextToNumber)) {
          if (normalized.startsWith(name)) {
            const remaining = normalized.slice(name.length)
            const section = detectSection(remaining)
            return { grade: num, section }
          }
        }
        
        return { grade: null, section: null }
      }
      
      // Mapear grupo del Excel al ID del grupo en la BD
      const findGroupId = (row: any): { id: string; matched: string; original: string } => {
        let gradeNum: string | null = null
        let section: string | null = null
        let original = ''
        
        // PRIORIDAD 1: Columnas separadas grado + seccion
        if (row.grado && row.seccion) {
          gradeNum = detectGrade(row.grado)
          section = normalizeSection(row.seccion)
          original = `${row.grado}-${row.seccion}`
        }
        // PRIORIDAD 2: Columna grupo combinada
        else if (row.grupo) {
          const parsed = parseGroupString(row.grupo)
          gradeNum = parsed.grade
          section = parsed.section
          original = row.grupo
        }
        // PRIORIDAD 3: Columna group (compatibilidad con plantilla anterior)
        else if (row.group) {
          const parsed = parseGroupString(row.group)
          gradeNum = parsed.grade
          section = parsed.section
          original = row.group
        }
        
        if (!gradeNum || !section) {
          return { id: '', matched: '', original }
        }
        
        const gradeNamesExpected = numberToGradeNames(gradeNum)
        
        // Buscar grupo en la BD con múltiples estrategias
        const gradeNumInt = parseInt(gradeNum, 10)
        const group = availableGroups.find(g => {
          if (!g.grade) return false
          const gradeObj = g.grade as any
          const gradeNameNorm = normalizeText(g.grade.name || '')
          const groupNameNorm = normalizeText(g.name)
          
          // Estrategia 1: Comparar por campo numérico del grado (más confiable)
          const gradeMatchByNumber = gradeObj.number != null && gradeObj.number === gradeNumInt
          // Estrategia 2: El nombre del grado contiene el número o alguno de los nombres esperados
          const gradeMatchByName = gradeNameNorm.includes(gradeNum!) || 
                                   gradeNamesExpected.some(name => gradeNameNorm.includes(name))
          const gradeMatches = gradeMatchByNumber || gradeMatchByName
          
          // La sección debe coincidir (soporta nombres simples "A" y combinados "11A")
          const sectionUpper = section!.toUpperCase()
          const combinedName = normalizeText(`${gradeNum}${section}`)
          const sectionMatches = groupNameNorm === section!.toLowerCase() ||
                                 g.name.toUpperCase() === sectionUpper ||
                                 normalizeText(g.name) === normalizeText(section!) ||
                                 groupNameNorm === combinedName
          
          return gradeMatches && sectionMatches
        })
        
        // Fallback: buscar por nombre combinado (ej: "6A" contra grade.number + group.name)
        if (!group) {
          const combinedSearch = normalizeText(`${gradeNum}${section}`)
          const groupFallback = availableGroups.find(g => {
            const gradeObj = g.grade as any
            // Solo match exacto con grade.number + group.name
            if (gradeObj?.number != null) {
              const fullName = normalizeText(`${gradeObj.number}${g.name}`)
              if (fullName === combinedSearch) return true
            }
            // También: si el group.name ES el combinado (ej: grupo se llama "11A") 
            // pero SOLO si el grado también coincide por nombre
            const groupNameNorm = normalizeText(g.name)
            if (groupNameNorm === combinedSearch) {
              // Verificar que el grado realmente corresponde
              const gradeNameNorm = normalizeText(g.grade?.name || '')
              if (gradeNamesExpected.some(name => gradeNameNorm.includes(name)) || gradeNameNorm.includes(gradeNum!)) {
                return true
              }
            }
            return false
          })
          if (groupFallback) {
            return { id: groupFallback.id, matched: `${groupFallback.grade?.name} ${groupFallback.name}`, original }
          }
        }
        
        if (group) {
          return { id: group.id, matched: `${group.grade?.name} ${group.name}`, original }
        }
        
        return { id: '', matched: '', original }
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // PRE-VALIDACIÓN Y RESUMEN DE MAPEO
      // ═══════════════════════════════════════════════════════════════════════════
      
      const groupMappingResults: Record<string, { id: string; matched: string; count: number }> = {}
      importResult.data.forEach(row => {
        const result = findGroupId(row)
        const groupCode = result.original || row.grupo || row.group || `${row.grado || ''}-${row.seccion || ''}`
        if (!groupMappingResults[groupCode]) {
          groupMappingResults[groupCode] = { id: result.id, matched: result.matched, count: 0 }
        }
        groupMappingResults[groupCode].count++
      })
      
      // Mostrar resumen de mapeo
      const mappedGroups = Object.entries(groupMappingResults).filter(([, v]) => v.id)
      const unmappedGroups = Object.entries(groupMappingResults).filter(([, v]) => !v.id)
      
      let summaryMsg = '📋 MAPEO DE GRUPOS:\n\n'
      if (mappedGroups.length > 0) {
        summaryMsg += '✅ Grupos encontrados:\n'
        mappedGroups.forEach(([code, v]) => {
          summaryMsg += `   "${code}" → ${v.matched} (${v.count} estudiantes)\n`
        })
      }
      if (unmappedGroups.length > 0) {
        summaryMsg += '\n❌ Grupos NO encontrados:\n'
        unmappedGroups.forEach(([code, v]) => {
          summaryMsg += `   "${code}" (${v.count} estudiantes)\n`
        })
        summaryMsg += '\n⚠️ Estos estudiantes NO se importarán.\n'
        summaryMsg += `\nGrupos disponibles en el sistema (${availableGroups.length}):\n`
        const availableGroupNames = availableGroups
          .map(g => {
            const gradeObj = g.grade as any
            const num = gradeObj?.number ?? '?'
            return `${g.grade?.name || '?'} (${num}) → "${g.name}"`
          })
          .sort()
          .join('\n   ')
        summaryMsg += '   ' + (availableGroupNames || 'Ninguno')
        // Log para debugging
        console.log('[Import Debug] availableGroups:', availableGroups.map(g => ({ id: g.id, name: g.name, gradeName: g.grade?.name, gradeNumber: (g.grade as any)?.number })))
      }
      
      summaryMsg += '\n\n¿Desea continuar con la importación?'
      
      if (!confirm(summaryMsg)) {
        setImporting(false)
        return
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PREPARAR DATOS PARA IMPORTACIÓN
      // ═══════════════════════════════════════════════════════════════════════════
      
      const studentsToImport = importResult.data
        .map(row => {
          const groupResult = findGroupId(row)
          return {
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
            groupId: groupResult.id,
            bloodType: row.bloodType || '',
            eps: row.eps || '',
            // Soportar ambos nombres de columnas para acudiente
            guardianName: row.guardianName || row.parentName || '',
            guardianPhone: row.guardianPhone || row.parentPhone || '',
            guardianEmail: row.guardianEmail || row.parentEmail || '',
            guardianDocumentNumber: row.guardianDocumentNumber || '',
            guardianRelationship: row.guardianRelationship || '',
          }
        })
        .filter(s => s.documentNumber && s.firstName && s.groupId)

      if (studentsToImport.length === 0) {
        alert('No hay estudiantes válidos para importar. Verifique que los grupos existan en el sistema.')
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
    // Exportar en formato compatible con la plantilla de importación
    // para que el usuario pueda modificar y reimportar
    const exportData = rawStudents.map((s: any) => {
      const enrollment = s.enrollments?.[0]
      const group = enrollment?.group
      const grade = group?.grade
      const guardian = s.guardians?.[0]?.guardian
      const birthDate = s.birthDate ? new Date(s.birthDate).toISOString().split('T')[0] : ''
      return {
        'Tipo Documento': s.documentType || 'TI',
        'Numero Documento': s.documentNumber || '',
        'Primer Nombre': s.firstName || '',
        'Segundo Nombre': s.secondName || '',
        'Primer Apellido': s.lastName || '',
        'Segundo Apellido': s.secondLastName || '',
        'Fecha Nacimiento': birthDate,
        'Genero': s.gender || '',
        'Direccion': s.address || '',
        'Telefono': s.phone || '',
        'Email': s.email || '',
        'Grupo': group ? `${grade?.name || ''} ${group.name}`.trim() : '',
        'Grado': grade?.name || '',
        'Seccion': group?.name || '',
        'Nombre Acudiente': guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : '',
        'Telefono Acudiente': guardian?.phone || '',
        'Email Acudiente': guardian?.email || '',
        'Documento Acudiente': guardian?.documentNumber || '',
        'Parentesco': s.guardians?.[0]?.relationship || '',
        'EPS': s.eps || '',
        'Tipo Sangre': s.bloodType || '',
        'Estado': enrollment?.status || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(exportData)
    // Ajustar anchos de columna
    const colWidths = Object.keys(exportData[0] || {}).map(h => ({ wch: Math.max(h.length + 3, 15) }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes')
    XLSX.writeFile(wb, 'Listado_Estudiantes.xlsx')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTADOS POR GRUPO — Generador de listas imprimibles
  // ═══════════════════════════════════════════════════════════════════════════

  const applyListTemplate = (tpl: typeof listTemplate) => {
    setListTemplate(tpl)
    switch (tpl) {
      case 'clean':
        setListColumns({ document: false, birthDate: false, age: false, guardian: false, phone: false, eps: false, bloodType: false })
        setListEmptyCols(4)
        setListEmptyLabels(['', '', '', '', '', '', '', '', '', ''])
        break
      case 'grades':
        setListColumns({ document: true, birthDate: false, age: false, guardian: false, phone: false, eps: false, bloodType: false })
        setListEmptyCols(4)
        setListEmptyLabels(['P1', 'P2', 'P3', 'P4', '', '', '', '', '', ''])
        break
      case 'attendance':
        setListColumns({ document: false, birthDate: false, age: false, guardian: false, phone: false, eps: false, bloodType: false })
        setListEmptyCols(5)
        setListEmptyLabels(['L', 'M', 'Mi', 'J', 'V', '', '', '', '', ''])
        break
      case 'full':
        setListColumns({ document: true, birthDate: false, age: true, guardian: true, phone: true, eps: false, bloodType: false })
        setListEmptyCols(0)
        setListEmptyLabels(['', '', '', '', '', '', '', '', '', ''])
        break
      case 'custom':
        break
    }
  }

  const getListStudents = () => {
    if (!listGroupId) return []
    const group = availableGroups.find(g => g.id === listGroupId)
    if (!group) return []
    const groupFullName = group.grade ? `${group.grade.name} ${group.name}`.trim() : group.name
    return rawStudents
      .filter((s: any) => {
        const enrollment = s.enrollments?.[0]
        if (!enrollment || enrollment.status !== 'ACTIVE') return false
        return enrollment.groupId === listGroupId
      })
      .sort((a: any, b: any) => {
        const nameA = `${a.lastName || ''} ${a.secondLastName || ''} ${a.firstName || ''}`.trim().toLowerCase()
        const nameB = `${b.lastName || ''} ${b.secondLastName || ''} ${b.firstName || ''}`.trim().toLowerCase()
        return nameA.localeCompare(nameB)
      })
  }

  const getListGroupName = () => {
    const group = availableGroups.find(g => g.id === listGroupId)
    if (!group) return ''
    return group.grade ? `${group.grade.name} ${group.name}`.trim() : group.name
  }

  const handleListExcelDownload = () => {
    const listStudents = getListStudents()
    if (listStudents.length === 0) return
    const rows = listStudents.map((s: any, idx: number) => {
      const row: Record<string, any> = { 'Nro': idx + 1 }
      row['Estudiante'] = `${s.lastName || ''} ${s.secondLastName || ''} ${s.firstName || ''} ${s.secondName || ''}`.replace(/\s+/g, ' ').trim()
      if (listColumns.document) row['Documento'] = s.documentNumber || ''
      if (listColumns.birthDate) row['Fecha Nac.'] = s.birthDate ? new Date(s.birthDate).toISOString().split('T')[0] : ''
      if (listColumns.age) row['Edad'] = s.birthDate ? String(calculateAge(s.birthDate)) : ''
      if (listColumns.guardian) {
        const g = s.guardians?.[0]?.guardian
        row['Acudiente'] = g ? `${g.firstName || ''} ${g.lastName || ''}`.trim() : ''
      }
      if (listColumns.phone) row['Teléfono'] = s.phone || ''
      if (listColumns.eps) row['EPS'] = s.eps || ''
      if (listColumns.bloodType) row['RH'] = s.bloodType || ''
      for (let i = 0; i < listEmptyCols; i++) {
        const label = listEmptyLabels[i] || `Col ${i + 1}`
        row[label] = ''
      }
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = Object.keys(rows[0] || {}).map((h, i) => ({ wch: i === 0 ? 5 : i === 1 ? 30 : Math.max(h.length + 2, 10) }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Listado')
    const groupName = getListGroupName().replace(/\s+/g, '_')
    XLSX.writeFile(wb, `Listado_${groupName}.xlsx`)
  }

  const handleListPdfDownload = () => {
    const listStudents = getListStudents()
    if (listStudents.length === 0) return
    const jsPDFLib = (window as any).jspdf?.jsPDF
    if (!jsPDFLib) {
      // Fallback: use dynamic import
      import('jspdf').then(mod => {
        const jsPDF = mod.default || mod.jsPDF
        generateListPdf(jsPDF, listStudents)
      })
      return
    }
    generateListPdf(jsPDFLib, listStudents)
  }

  const generateListPdf = (jsPDF: any, listStudents: any[]) => {
    const isLandscape = listOrientation === 'landscape'
    const doc = new jsPDF({ orientation: listOrientation, unit: 'mm', format: 'letter' })
    const pageW = isLandscape ? 279.4 : 215.9
    const pageH = isLandscape ? 215.9 : 279.4
    const margin = 12
    const contentW = pageW - margin * 2

    // Build column definitions
    const cols: { label: string; width: number; key: string; align?: string }[] = []
    cols.push({ label: 'Nro', width: 8, key: 'nro', align: 'center' })
    cols.push({ label: 'Estudiante', width: 0, key: 'name' }) // flex width
    if (listColumns.document) cols.push({ label: 'Documento', width: 22, key: 'doc', align: 'center' })
    if (listColumns.birthDate) cols.push({ label: 'F. Nac.', width: 18, key: 'birth', align: 'center' })
    if (listColumns.age) cols.push({ label: 'Edad', width: 10, key: 'age', align: 'center' })
    if (listColumns.guardian) cols.push({ label: 'Acudiente', width: 35, key: 'guardian' })
    if (listColumns.phone) cols.push({ label: 'Teléfono', width: 20, key: 'phone', align: 'center' })
    if (listColumns.eps) cols.push({ label: 'EPS', width: 18, key: 'eps' })
    if (listColumns.bloodType) cols.push({ label: 'RH', width: 10, key: 'rh', align: 'center' })
    for (let i = 0; i < listEmptyCols; i++) {
      const label = listEmptyLabels[i] || ''
      cols.push({ label, width: 14, key: `empty_${i}`, align: 'center' })
    }

    // Calculate flex width for name column, then scale all if overflowing
    const fixedWidth = cols.filter(c => c.key !== 'name').reduce((s, c) => s + c.width, 0)
    const nameCol = cols.find(c => c.key === 'name')!
    nameCol.width = Math.max(contentW - fixedWidth, 40)
    const totalW = cols.reduce((s, c) => s + c.width, 0)
    if (totalW > contentW) {
      const scale = contentW / totalW
      for (const col of cols) col.width = Math.round(col.width * scale * 100) / 100
    }
    const tableW = cols.reduce((s, c) => s + c.width, 0)

    const rowH = 6
    const headerH = 7
    const fontSize = 7
    const headerFontSize = 7

    // Title
    const groupName = getListGroupName()
    const title = listTitle || `Listado - ${groupName}`
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, pageW / 2, margin + 4, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(institution?.name || '', pageW / 2, margin + 9, { align: 'center' })

    let y = margin + 14

    // Header row
    const drawHeader = () => {
      doc.setFillColor(51, 65, 85) // slate-700
      doc.rect(margin, y, tableW, headerH, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(headerFontSize)
      doc.setFont('helvetica', 'bold')
      let x = margin
      for (const col of cols) {
        const textX = col.align === 'center' ? x + col.width / 2 : x + 1.5
        doc.text(col.label, textX, y + headerH - 2, { align: col.align === 'center' ? 'center' : 'left', maxWidth: col.width - 2 })
        x += col.width
      }
      doc.setTextColor(0, 0, 0)
      y += headerH
    }

    drawHeader()

    // Data rows
    listStudents.forEach((s: any, idx: number) => {
      if (y + rowH > pageH - margin - 5) {
        doc.addPage()
        y = margin + 4
        drawHeader()
      }

      // Alternate row background
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252) // slate-50
        doc.rect(margin, y, tableW, rowH, 'F')
      }

      // Grid lines
      doc.setDrawColor(203, 213, 225) // slate-300
      doc.setLineWidth(0.2)
      let x = margin
      for (const col of cols) {
        doc.rect(x, y, col.width, rowH, 'S')
        x += col.width
      }

      // Cell data
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', 'normal')
      x = margin
      const fullName = `${s.lastName || ''} ${s.secondLastName || ''} ${s.firstName || ''} ${s.secondName || ''}`.replace(/\s+/g, ' ').trim()
      const guardian = s.guardians?.[0]?.guardian
      const guardianName = guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : ''

      for (const col of cols) {
        let val = ''
        switch (col.key) {
          case 'nro': val = String(idx + 1); break
          case 'name': val = fullName; break
          case 'doc': val = s.documentNumber || ''; break
          case 'birth': val = s.birthDate ? new Date(s.birthDate).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; break
          case 'age': val = s.birthDate ? String(calculateAge(s.birthDate)) : ''; break
          case 'guardian': val = guardianName; break
          case 'phone': val = s.phone || ''; break
          case 'eps': val = s.eps || ''; break
          case 'rh': val = s.bloodType || ''; break
          default: val = ''; break // empty columns
        }
        const textX = col.align === 'center' ? x + col.width / 2 : x + 1.5
        doc.text(val, textX, y + rowH - 1.8, { align: col.align === 'center' ? 'center' : 'left', maxWidth: col.width - 2 })
        x += col.width
      }

      y += rowH
    })

    // Footer
    doc.setFontSize(6)
    doc.setTextColor(150, 150, 150)
    doc.text(`Total: ${listStudents.length} estudiantes | Generado: ${new Date().toLocaleDateString('es-CO')}`, margin, pageH - 5)

    const groupFileName = groupName.replace(/\s+/g, '_')
    doc.save(`Listado_${groupFileName}.pdf`)
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Estudiantes</h1>
              <p className="text-slate-500 mt-1">Gestion de estudiantes matriculados</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenCredentials}
                className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm"
                title="Gestionar credenciales de acceso de estudiantes"
              >
                <Key className="w-4 h-4" />
                Credenciales
              </button>
              {/* Botón temporal para borrar estudiantes sin registros - DESHABILITADO hasta nueva orden */}
              {/* <button 
                onClick={handleBulkDeleteWithoutRecords}
                className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                title="Eliminar estudiantes sin registros académicos"
              >
                <Trash2 className="w-4 h-4" />
                Limpiar
              </button> */}
              <button onClick={() => setShowListModal(true)} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
                <Printer className="w-4 h-4" />
                Listados
              </button>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar por nombre o documento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterGroup('ALL') }} className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="ALL">Todos los grados</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="ALL">Todos los grupos</option>
                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                  <option value="TRANSFERRED">Trasladados</option>
                  <option value="GRADUATED">Graduados</option>
                  <option value="WITHDRAWN">Retirados</option>
                </select>
                </div>
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

      {/* Modal Credenciales */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Credenciales de Estudiantes</h3>
                  <p className="text-sm text-slate-500">Gestionar acceso al sistema para estudiantes</p>
                </div>
              </div>
              <button onClick={() => setShowCredentialsModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Stats bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 text-sm flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600">Total: <strong>{credentialStudents.length}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-slate-600">Con acceso: <strong className="text-green-600">{credentialStudents.filter(s => s.hasAccess).length}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Sin acceso: <strong className="text-slate-500">{credentialStudents.filter(s => !s.hasAccess).length}</strong></span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleExportCredentials}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white text-sm"
                  title="Exportar credenciales a Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar
                </button>
                <button
                  onClick={handlePrintCredentials}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white text-sm"
                  title="Imprimir credenciales"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3 flex-shrink-0">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, documento o usuario..."
                  value={credentialsSearch}
                  onChange={(e) => setCredentialsSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm"
                />
              </div>
              <select
                value={credentialsGroupFilter}
                onChange={(e) => setCredentialsGroupFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[160px]"
              >
                <option value="ALL">Todos los grupos</option>
                {credentialGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <select
                value={credentialsAccessFilter}
                onChange={(e) => setCredentialsAccessFilter(e.target.value as any)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[160px]"
              >
                <option value="ALL">Todos</option>
                <option value="WITH_ACCESS">Con acceso</option>
                <option value="WITHOUT_ACCESS">Sin acceso</option>
              </select>
              {/* Bulk actions */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleBulkActivateFiltered}
                  disabled={processingCredentials}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                  title="Activar acceso para los estudiantes filtrados que no tengan"
                >
                  {processingCredentials ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Activar Masivo ({filteredCredentialStudents.filter(s => !s.hasAccess).length})
                </button>
                <button
                  onClick={handleBulkResetFiltered}
                  disabled={processingCredentials}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm disabled:opacity-50"
                  title="Resetear contraseñas para los estudiantes filtrados"
                >
                  {processingCredentials ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reset Masivo ({filteredCredentialStudents.filter(s => s.hasAccess).length})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {loadingCredentials ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                  <span className="ml-3 text-slate-500">Cargando estudiantes...</span>
                </div>
              ) : filteredCredentialStudents.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Key className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No hay estudiantes que coincidan con los filtros</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estudiante</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Documento</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Grupo</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Usuario</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Contraseña</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCredentialStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{student.firstName} {student.lastName}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{student.documentNumber}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{student.group || 'Sin grupo'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {student.hasAccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <Shield className="w-3 h-3" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                              <Lock className="w-3 h-3" /> Sin acceso
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {student.hasAccess ? (
                            <code className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">{student.username}</code>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {student.hasAccess ? (
                            <div className="flex items-center gap-1">
                              <code className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-mono">
                                {showPasswords[student.id] ? student.initialPassword : '••••••••'}
                              </code>
                              <button
                                onClick={() => setShowPasswords(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                                title={showPasswords[student.id] ? 'Ocultar' : 'Mostrar'}
                              >
                                {showPasswords[student.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {student.hasAccess ? (
                              <>
                                <button
                                  onClick={() => handleResetPassword(student.id)}
                                  disabled={processingCredentials}
                                  className="p-1.5 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-600 disabled:opacity-50"
                                  title="Resetear contraseña"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeactivateAccess(student.id)}
                                  disabled={processingCredentials}
                                  className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 disabled:opacity-50"
                                  title="Desactivar acceso"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleActivateAccess(student.id)}
                                disabled={processingCredentials}
                                className="p-1.5 hover:bg-green-50 rounded text-slate-400 hover:text-green-600 disabled:opacity-50"
                                title="Activar acceso"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 flex-shrink-0">
              <p>Mostrando {filteredCredentialStudents.length} de {credentialStudents.length} estudiantes</p>
              <p className="text-xs text-slate-400">La contraseña inicial es el número de documento del estudiante</p>
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
                    <p className="text-sm text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Formatos de grupo aceptados: 11A, 11-A, Undécimo A, 11-01</p>
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
                                <td className="px-2 py-1">{row.grupo || row.group || `${row.grado || ''}-${row.seccion || ''}`}</td>
                                <td className="px-2 py-1">{row.guardianName || row.parentName}</td>
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
                  <button onClick={handleConfirmImport} disabled={importResult.validRows === 0 || importing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Importar {importResult.validRows} estudiantes
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal: Listados por Grupo ═══ */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-teal-600" />
                  Generador de Listados
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Configura y descarga listas imprimibles por grupo</p>
              </div>
              <button onClick={() => setShowListModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">

              {/* Grupo + Título */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grupo *</label>
                  <select
                    value={listGroupId}
                    onChange={e => setListGroupId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Seleccionar grupo...</option>
                    {availableGroups
                      .sort((a: any, b: any) => {
                        const nameA = `${a.grade?.name || ''} ${a.name}`.trim()
                        const nameB = `${b.grade?.name || ''} ${b.name}`.trim()
                        return nameA.localeCompare(nameB, 'es', { numeric: true })
                      })
                      .map((g: any) => (
                        <option key={g.id} value={g.id}>
                          {g.grade ? `${g.grade.name} ${g.name}` : g.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título del listado (opcional)</label>
                  <input
                    type="text"
                    value={listTitle}
                    onChange={e => setListTitle(e.target.value)}
                    placeholder={listGroupId ? `Listado - ${getListGroupName()}` : 'Ej: Lista de asistencia'}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Plantillas predefinidas */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Plantilla</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'clean' as const, label: 'Limpia', desc: 'Nombre + columnas vacías', icon: '📋' },
                    { id: 'grades' as const, label: 'Notas', desc: 'Doc + P1, P2, P3, P4', icon: '📝' },
                    { id: 'attendance' as const, label: 'Asistencia', desc: 'L, M, Mi, J, V', icon: '✅' },
                    { id: 'full' as const, label: 'Completa', desc: 'Doc + Edad + Acudiente', icon: '📄' },
                    { id: 'custom' as const, label: 'Personalizada', desc: 'Configura todo', icon: '⚙️' },
                  ].map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => applyListTemplate(tpl.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        listTemplate === tpl.id
                          ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-200'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-lg mb-1">{tpl.icon}</div>
                      <div className="text-xs font-semibold text-slate-800">{tpl.label}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Columnas de datos */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Columnas con datos del estudiante</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'document', label: 'Documento' },
                    { key: 'birthDate', label: 'Fecha Nac.' },
                    { key: 'age', label: 'Edad' },
                    { key: 'guardian', label: 'Acudiente' },
                    { key: 'phone', label: 'Teléfono' },
                    { key: 'eps', label: 'EPS' },
                    { key: 'bloodType', label: 'RH' },
                  ].map(col => (
                    <label
                      key={col.key}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                        listColumns[col.key]
                          ? 'border-teal-400 bg-teal-50 text-teal-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={listColumns[col.key]}
                        onChange={e => {
                          setListColumns(prev => ({ ...prev, [col.key]: e.target.checked }))
                          setListTemplate('custom')
                        }}
                        className="sr-only"
                      />
                      <CheckCircle2 className={`w-3.5 h-3.5 ${listColumns[col.key] ? 'text-teal-600' : 'text-slate-300'}`} />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Columnas vacías (cuadriculadas) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Columnas vacías (cuadriculadas)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setListEmptyCols(Math.max(0, listEmptyCols - 1)); setListTemplate('custom') }}
                      className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-sm font-bold"
                    >−</button>
                    <span className="text-sm font-semibold text-slate-800 w-6 text-center">{listEmptyCols}</span>
                    <button
                      onClick={() => { setListEmptyCols(Math.min(10, listEmptyCols + 1)); setListTemplate('custom') }}
                      className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 text-sm font-bold"
                    >+</button>
                  </div>
                </div>
                {listEmptyCols > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: listEmptyCols }).map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        value={listEmptyLabels[i] || ''}
                        onChange={e => {
                          const newLabels = [...listEmptyLabels]
                          newLabels[i] = e.target.value
                          setListEmptyLabels(newLabels)
                        }}
                        placeholder={`Col ${i + 1}`}
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        maxLength={10}
                      />
                    ))}
                    <span className="text-[10px] text-slate-400 self-center ml-1">Etiquetas de encabezado</span>
                  </div>
                )}
              </div>

              {/* Orientación */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Orientación del PDF</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setListOrientation('landscape')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      listOrientation === 'landscape' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-6 h-4 border-2 border-current rounded-sm" />
                    Horizontal
                  </button>
                  <button
                    onClick={() => setListOrientation('portrait')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm transition-all ${
                      listOrientation === 'portrait' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-4 h-6 border-2 border-current rounded-sm" />
                    Vertical
                  </button>
                </div>
              </div>

              {/* Vista previa resumida */}
              {listGroupId && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-700">Vista previa</h4>
                    <span className="text-xs text-slate-500">{getListStudents().length} estudiantes</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="bg-slate-700 text-white">
                          <th className="px-1.5 py-1 text-center border border-slate-500">Nro</th>
                          <th className="px-1.5 py-1 text-left border border-slate-500">Estudiante</th>
                          {listColumns.document && <th className="px-1.5 py-1 text-center border border-slate-500">Documento</th>}
                          {listColumns.birthDate && <th className="px-1.5 py-1 text-center border border-slate-500">F. Nac.</th>}
                          {listColumns.age && <th className="px-1.5 py-1 text-center border border-slate-500">Edad</th>}
                          {listColumns.guardian && <th className="px-1.5 py-1 text-left border border-slate-500">Acudiente</th>}
                          {listColumns.phone && <th className="px-1.5 py-1 text-center border border-slate-500">Teléfono</th>}
                          {listColumns.eps && <th className="px-1.5 py-1 text-left border border-slate-500">EPS</th>}
                          {listColumns.bloodType && <th className="px-1.5 py-1 text-center border border-slate-500">RH</th>}
                          {Array.from({ length: listEmptyCols }).map((_, i) => (
                            <th key={i} className="px-1.5 py-1 text-center border border-slate-500 min-w-[40px]">
                              {listEmptyLabels[i] || ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getListStudents().slice(0, 5).map((s: any, idx: number) => {
                          const guardian = s.guardians?.[0]?.guardian
                          return (
                            <tr key={s.id} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                              <td className="px-1.5 py-0.5 text-center border border-slate-200">{idx + 1}</td>
                              <td className="px-1.5 py-0.5 border border-slate-200 whitespace-nowrap">
                                {`${s.lastName || ''} ${s.secondLastName || ''} ${s.firstName || ''} ${s.secondName || ''}`.replace(/\s+/g, ' ').trim()}
                              </td>
                              {listColumns.document && <td className="px-1.5 py-0.5 text-center border border-slate-200">{s.documentNumber || ''}</td>}
                              {listColumns.birthDate && <td className="px-1.5 py-0.5 text-center border border-slate-200">{s.birthDate ? new Date(s.birthDate).toLocaleDateString('es-CO') : ''}</td>}
                              {listColumns.age && <td className="px-1.5 py-0.5 text-center border border-slate-200">{s.birthDate ? calculateAge(s.birthDate) : ''}</td>}
                              {listColumns.guardian && <td className="px-1.5 py-0.5 border border-slate-200">{guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : ''}</td>}
                              {listColumns.phone && <td className="px-1.5 py-0.5 text-center border border-slate-200">{s.phone || ''}</td>}
                              {listColumns.eps && <td className="px-1.5 py-0.5 border border-slate-200">{s.eps || ''}</td>}
                              {listColumns.bloodType && <td className="px-1.5 py-0.5 text-center border border-slate-200">{s.bloodType || ''}</td>}
                              {Array.from({ length: listEmptyCols }).map((_, i) => (
                                <td key={i} className="px-1.5 py-0.5 border border-slate-200 min-w-[40px]">&nbsp;</td>
                              ))}
                            </tr>
                          )
                        })}
                        {getListStudents().length > 5 && (
                          <tr>
                            <td colSpan={99} className="px-1.5 py-1 text-center text-slate-400 text-[9px] border border-slate-200">
                              ... y {getListStudents().length - 5} estudiantes más
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {listGroupId ? `${getListStudents().length} estudiantes en ${getListGroupName()}` : 'Selecciona un grupo para continuar'}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowListModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                  Cerrar
                </button>
                <button
                  onClick={handleListExcelDownload}
                  disabled={!listGroupId || getListStudents().length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
                <button
                  onClick={handleListPdfDownload}
                  disabled={!listGroupId || getListStudents().length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
