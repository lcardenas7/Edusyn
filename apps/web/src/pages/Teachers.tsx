import { useState, useRef, useEffect } from 'react'
import { Search, Plus, User, X, Edit2, Eye, Trash2, Upload, Download, Phone, Mail, MapPin, Users, Briefcase, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { generateTemplate, parseExcelFile, exportToExcel, ImportResult } from '../utils/excelImport'
import { teachersApi } from '../lib/api'

type TeacherStatus = 'ACTIVE' | 'INACTIVE' | 'RETIRED'
type ContractType = 'PLANTA' | 'PROVISIONAL' | 'CONTRATO' | 'HORA_CATEDRA'
type ViewMode = 'list' | 'detail'

interface Teacher {
  id: string
  documentType: 'CC' | 'CE' | 'TI' | 'PP'
  documentNumber: string
  firstName: string
  secondName?: string
  firstLastName: string
  secondLastName?: string
  gender: 'M' | 'F' | 'O'
  birthDate: string
  birthPlace?: string
  address?: string
  phone?: string
  mobile: string
  email: string
  institutionalEmail?: string
  contractType: ContractType
  status: TeacherStatus
  createdAt: string
  specialty?: string
  title?: string
}


const contractLabels: Record<ContractType, { label: string, color: string }> = {
  PLANTA: { label: 'Planta', color: 'bg-green-100 text-green-700' },
  PROVISIONAL: { label: 'Provisional', color: 'bg-amber-100 text-amber-700' },
  CONTRATO: { label: 'Contrato', color: 'bg-blue-100 text-blue-700' },
  HORA_CATEDRA: { label: 'Hora Catedra', color: 'bg-purple-100 text-purple-700' },
}

const statusLabels: Record<TeacherStatus, { label: string, color: string }> = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  INACTIVE: { label: 'Inactivo', color: 'bg-slate-100 text-slate-600' },
  RETIRED: { label: 'Retirado', color: 'bg-red-100 text-red-700' },
}

type DocumentType = 'CC' | 'CE' | 'TI' | 'PP'
type Gender = 'M' | 'F' | 'O'

const emptyTeacher = {
  documentType: 'CC' as DocumentType, documentNumber: '', firstName: '', secondName: '', firstLastName: '', secondLastName: '',
  gender: 'M' as Gender, birthDate: '', birthPlace: '', address: '', phone: '', mobile: '', email: '', institutionalEmail: '',
  contractType: 'PLANTA' as ContractType, status: 'ACTIVE' as TeacherStatus, specialty: '', title: ''
}

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<TeacherStatus | 'ALL'>('ALL')
  const [filterContract, setFilterContract] = useState<ContractType | 'ALL'>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Teacher | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(emptyTeacher)

  // Cargar docentes desde la API
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await teachersApi.getAll()
        const apiTeachers: Teacher[] = (response.data || []).map((t: any) => ({
          id: t.id,
          documentType: (t.documentType || 'CC') as DocumentType,
          documentNumber: t.documentNumber || '',
          firstName: t.firstName || '',
          secondName: '',
          firstLastName: t.lastName || '',
          secondLastName: '',
          gender: 'M' as Gender,
          birthDate: '',
          mobile: '',
          email: t.email || '',
          institutionalEmail: '',
          contractType: 'PLANTA' as ContractType,
          status: t.isActive ? 'ACTIVE' : 'INACTIVE' as TeacherStatus,
          createdAt: t.createdAt || '',
          specialty: '',
          title: ''
        }))
        setTeachers(apiTeachers)
      } catch (err: any) {
        console.error('Error loading teachers:', err)
        setError('Error al cargar docentes. Verifique la conexion.')
      } finally {
        setLoading(false)
      }
    }
    fetchTeachers()
  }, [])

  const filteredTeachers = teachers.filter(t => {
    const fullName = `${t.firstName} ${t.secondName || ''} ${t.firstLastName} ${t.secondLastName || ''} ${t.documentNumber} ${t.email}`.toLowerCase()
    const matchesSearch = fullName.includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus
    const matchesContract = filterContract === 'ALL' || t.contractType === filterContract
    return matchesSearch && matchesStatus && matchesContract
  })

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'ACTIVE').length,
    inactive: teachers.filter(t => t.status !== 'ACTIVE').length,
    byContract: Object.keys(contractLabels).map(c => ({ type: c, count: teachers.filter(t => t.contractType === c && t.status === 'ACTIVE').length }))
  }

  const handleOpenNew = () => {
    setEditingTeacher(null)
    setForm(emptyTeacher)
    setShowModal(true)
  }

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setForm({
      documentType: teacher.documentType, documentNumber: teacher.documentNumber, firstName: teacher.firstName,
      secondName: teacher.secondName || '', firstLastName: teacher.firstLastName, secondLastName: teacher.secondLastName || '',
      gender: teacher.gender, birthDate: teacher.birthDate, birthPlace: teacher.birthPlace || '', address: teacher.address || '',
      phone: teacher.phone || '', mobile: teacher.mobile, email: teacher.email, institutionalEmail: teacher.institutionalEmail || '',
      contractType: teacher.contractType, status: teacher.status, specialty: teacher.specialty || '', title: teacher.title || ''
    })
    setShowModal(true)
  }

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Generar nombre de usuario: primeraLetraNombre + primerApellido + 4últimosDigitos + d (docente)
  const generateUsername = (firstName: string, lastName: string, documentNumber: string) => {
    const firstLetter = firstName.charAt(0).toLowerCase()
    const cleanLastName = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')
    const last4Digits = documentNumber.slice(-4)
    return `${firstLetter}${cleanLastName}${last4Digits}d`
  }

  const handleSave = async () => {
    if (!form.documentNumber || !form.firstName || !form.firstLastName || !form.email) {
      setSaveMessage({ type: 'error', text: 'Complete los campos obligatorios: Nombre, Apellido, Documento y Email' })
      return
    }
    
    setSaving(true)
    setSaveMessage(null)
    
    try {
      if (editingTeacher) {
        // Actualizar docente existente
        await teachersApi.update(editingTeacher.id, {
          firstName: form.firstName,
          lastName: form.firstLastName,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          isActive: form.status === 'ACTIVE'
        })
        
        // Actualizar estado local
        setTeachers(teachers.map(t => t.id === editingTeacher.id ? { ...t, ...form } as Teacher : t))
        setSaveMessage({ type: 'success', text: 'Docente actualizado correctamente' })
      } else {
        // Crear nuevo docente - la contraseña es el número de documento
        const generatedUsername = generateUsername(form.firstName, form.firstLastName, form.documentNumber)
        
        const response = await teachersApi.create({
          email: form.email,
          password: form.documentNumber, // Contraseña = número de documento
          firstName: form.firstName,
          lastName: form.firstLastName,
          documentType: form.documentType,
          documentNumber: form.documentNumber,
          phone: form.mobile
        })
        
        // Agregar al estado local
        const newTeacher: Teacher = { 
          ...form, 
          id: response.data.id, 
          createdAt: new Date().toISOString().split('T')[0] 
        }
        setTeachers([...teachers, newTeacher])
        
        setSaveMessage({ 
          type: 'success', 
          text: `Docente creado. Usuario: ${generatedUsername} | Contraseña: ${form.documentNumber}` 
        })
      }
      
      // Cerrar modal después de 2 segundos si fue exitoso
      setTimeout(() => {
        setShowModal(false)
        setSaveMessage(null)
      }, 3000)
      
    } catch (err: any) {
      console.error('Error saving teacher:', err)
      const errorMsg = err.response?.data?.message || 'Error al guardar el docente'
      setSaveMessage({ type: 'error', text: errorMsg })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await teachersApi.delete(deleteConfirm.id)
      setTeachers(teachers.filter(t => t.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (err: any) {
      console.error('Error deleting teacher:', err)
      alert(err.response?.data?.message || 'Error al eliminar el docente')
      setDeleteConfirm(null)
    }
  }

  const handleViewDetail = (teacher: Teacher) => {
    setSelectedTeacher(teacher)
    setViewMode('detail')
  }

  const getFullName = (t: Teacher) => [t.firstName, t.secondName, t.firstLastName, t.secondLastName].filter(Boolean).join(' ')

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const handleDownloadTemplate = () => {
    generateTemplate('teachers')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await parseExcelFile(file, 'teachers')
      setImportResult(result)
    } catch {
      setImportResult({ success: false, data: [], errors: [{ row: 0, field: '', message: 'Error al procesar el archivo' }], totalRows: 0, validRows: 0 })
    } finally {
      setImporting(false)
    }
  }

  const handleConfirmImport = () => {
    if (!importResult || importResult.data.length === 0) return
    const newTeachers: Teacher[] = importResult.data.map((row, index) => ({
      id: `imported-${Date.now()}-${index}`,
      documentType: (row.documentType || 'CC') as DocumentType,
      documentNumber: row.documentNumber || '',
      firstName: row.firstName || '',
      secondName: row.secondName || '',
      firstLastName: row.firstLastName || '',
      secondLastName: row.secondLastName || '',
      gender: (row.gender || 'M') as Gender,
      birthDate: row.birthDate || '',
      birthPlace: row.birthPlace || '',
      address: row.address || '',
      phone: row.phone || '',
      mobile: row.mobile || '',
      email: row.email || '',
      institutionalEmail: row.institutionalEmail || '',
      contractType: (row.contractType || 'PLANTA') as ContractType,
      status: 'ACTIVE' as TeacherStatus,
      createdAt: new Date().toISOString().split('T')[0],
      specialty: row.specialty || '',
      title: row.title || ''
    }))
    setTeachers([...teachers, ...newTeachers])
    setShowImportModal(false)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleExport = () => {
    const columns = [
      { header: 'Documento', key: 'documentNumber' },
      { header: 'Tipo Doc', key: 'documentType' },
      { header: 'Nombres', key: 'firstName' },
      { header: 'Apellidos', key: 'firstLastName' },
      { header: 'Celular', key: 'mobile' },
      { header: 'Email', key: 'email' },
      { header: 'Contrato', key: 'contractType' },
      { header: 'Estado', key: 'status' },
      { header: 'Especialidad', key: 'specialty' },
    ]
    exportToExcel(teachers, columns, 'Listado_Docentes.xlsx')
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando docentes...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {viewMode === 'list' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Docentes</h1>
              <p className="text-slate-500 mt-1">Gestion del personal docente de la institucion</p>
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
                Nuevo Docente
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
                  <p className="text-xs text-slate-500">Total Docentes</p>
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
                  <p className="text-xs text-slate-500">Inactivos/Retirados</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2">Por Tipo Contrato</p>
              <div className="flex flex-wrap gap-1">
                {stats.byContract.map(c => (
                  <span key={c.type} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">{contractLabels[c.type as ContractType].label}: {c.count}</span>
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
                  <input type="text" placeholder="Buscar por nombre, documento o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                  <option value="RETIRED">Retirados</option>
                </select>
                <select value={filterContract} onChange={(e) => setFilterContract(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="ALL">Todos los contratos</option>
                  <option value="PLANTA">Planta</option>
                  <option value="PROVISIONAL">Provisional</option>
                  <option value="CONTRATO">Contrato</option>
                  <option value="HORA_CATEDRA">Hora Catedra</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Docente</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Documento</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Contacto</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Contrato</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-slate-600">{teacher.firstName[0]}{teacher.firstLastName[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{teacher.firstName} {teacher.secondName || ''} {teacher.firstLastName} {teacher.secondLastName || ''}</p>
                            <p className="text-xs text-slate-500">{teacher.specialty || 'Sin especialidad'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-900">{teacher.documentNumber}</p>
                        <p className="text-xs text-slate-500">{teacher.documentType}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-900">{teacher.mobile}</p>
                        <p className="text-xs text-slate-500">{teacher.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${contractLabels[teacher.contractType].color}`}>{contractLabels[teacher.contractType].label}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusLabels[teacher.status].color}`}>{statusLabels[teacher.status].label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleViewDetail(teacher)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600" title="Ver ficha"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleEdit(teacher)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirm(teacher)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">Mostrando {filteredTeachers.length} de {teachers.length} docentes</p>
            </div>
          </div>
        </>
      ) : selectedTeacher && (
        /* Ficha del Docente */
        <div>
          <button onClick={() => setViewMode('list')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
            <X className="w-4 h-4" /> Volver al listado
          </button>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold">{selectedTeacher.firstName[0]}{selectedTeacher.firstLastName[0]}</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{getFullName(selectedTeacher)}</h2>
                  <p className="text-blue-100">{selectedTeacher.documentType}: {selectedTeacher.documentNumber}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${contractLabels[selectedTeacher.contractType].color}`}>{contractLabels[selectedTeacher.contractType].label}</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${selectedTeacher.status === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-500'}`}>{statusLabels[selectedTeacher.status].label}</span>
                  </div>
                </div>
                <button onClick={() => handleEdit(selectedTeacher)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2">
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">Datos Personales</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">Fecha Nacimiento:</span><p className="font-medium">{new Date(selectedTeacher.birthDate).toLocaleDateString('es-CO')}</p></div>
                    <div><span className="text-slate-500">Edad:</span><p className="font-medium">{calculateAge(selectedTeacher.birthDate)} anos</p></div>
                    <div><span className="text-slate-500">Genero:</span><p className="font-medium">{selectedTeacher.gender === 'M' ? 'Masculino' : selectedTeacher.gender === 'F' ? 'Femenino' : 'Otro'}</p></div>
                    <div><span className="text-slate-500">Lugar Nacimiento:</span><p className="font-medium">{selectedTeacher.birthPlace || 'No registrado'}</p></div>
                  </div>
                  <h3 className="font-semibold text-slate-900 border-b pb-2 mt-6">Contacto</h3>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" />{selectedTeacher.address || 'No registrada'}</p>
                    <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{selectedTeacher.mobile} {selectedTeacher.phone && `/ ${selectedTeacher.phone}`}</p>
                    <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{selectedTeacher.email}</p>
                    {selectedTeacher.institutionalEmail && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{selectedTeacher.institutionalEmail} (Institucional)</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-2">Informacion Laboral</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-400" /><span className="text-sm"><strong>Tipo Contrato:</strong> {contractLabels[selectedTeacher.contractType].label}</span></div>
                    <div><span className="text-sm"><strong>Especialidad:</strong> {selectedTeacher.specialty || 'No registrada'}</span></div>
                    <div><span className="text-sm"><strong>Titulo:</strong> {selectedTeacher.title || 'No registrado'}</span></div>
                    <div><span className="text-sm"><strong>Fecha Ingreso:</strong> {new Date(selectedTeacher.createdAt).toLocaleDateString('es-CO')}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingTeacher ? 'Editar Docente' : 'Nuevo Docente'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primer Nombre *</label>
                  <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Nombre</label>
                  <input type="text" value={form.secondName} onChange={(e) => setForm({ ...form, secondName: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primer Apellido *</label>
                  <input type="text" value={form.firstLastName} onChange={(e) => setForm({ ...form, firstLastName: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Segundo Apellido</label>
                  <input type="text" value={form.secondLastName} onChange={(e) => setForm({ ...form, secondLastName: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Documento</label>
                  <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="CC">Cedula de Ciudadania</option>
                    <option value="CE">Cedula de Extranjeria</option>
                    <option value="TI">Tarjeta de Identidad</option>
                    <option value="PP">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numero Documento *</label>
                  <input type="text" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Nacimiento *</label>
                  <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Genero</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as any })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lugar Nacimiento</label>
                  <input type="text" value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Celular *</label>
                  <input type="text" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefono Fijo</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
                  <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-medium text-slate-900 mb-3">Informacion Laboral</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Institucional</label>
                  <input type="email" value={form.institutionalEmail} onChange={(e) => setForm({ ...form, institutionalEmail: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Contrato</label>
                  <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="PLANTA">Planta</option>
                    <option value="PROVISIONAL">Provisional</option>
                    <option value="CONTRATO">Contrato</option>
                    <option value="HORA_CATEDRA">Hora Catedra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TeacherStatus })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                    <option value="RETIRED">Retirado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad</label>
                  <input type="text" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ej: Matematicas, Ciencias..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Titulo Profesional</label>
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ej: Licenciado en Matematicas" />
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
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmacion Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Eliminar docente?</h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estas a punto de eliminar a <strong>{getFullName(deleteConfirm)}</strong>.
              <span className="text-red-600 font-medium"> Esta accion no se puede deshacer.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-green-600" />Importar Docentes</h3>
              <button onClick={closeImportModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {!importResult ? (
                <>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" className="hidden" id="teacher-file-upload" />
                    {importing ? (
                      <>
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-600">Procesando archivo...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">Arrastra un archivo Excel aqui o</p>
                        <label htmlFor="teacher-file-upload" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer inline-block">Seleccionar Archivo</label>
                        <p className="text-xs text-slate-500 mt-4">Formatos aceptados: .xlsx, .xls, .csv</p>
                      </>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Descarga la plantilla para asegurar el formato correcto</p>
                    <button onClick={handleDownloadTemplate} className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1"><Download className="w-4 h-4" />Descargar plantilla de docentes</button>
                  </div>
                </>
              ) : (
                <>
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
                          <p key={i} className="text-sm text-red-700 flex items-start gap-2"><XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>Fila {err.row}: {err.message}</span></p>
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
                              <th className="px-2 py-1 text-left">Celular</th>
                              <th className="px-2 py-1 text-left">Contrato</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.data.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-t border-slate-200">
                                <td className="px-2 py-1">{row.documentNumber}</td>
                                <td className="px-2 py-1">{row.firstName} {row.firstLastName}</td>
                                <td className="px-2 py-1">{row.mobile}</td>
                                <td className="px-2 py-1">{row.contractType}</td>
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
                    Importar {importResult.validRows} docentes
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
