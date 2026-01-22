import { useState, useRef, useEffect } from 'react'
import { 
  Users, Search, Plus, Upload, Download, X, CheckCircle2, XCircle, 
  AlertTriangle, FileSpreadsheet, User, Mail, Phone, Shield, Trash2, Edit2
} from 'lucide-react'
import { bulkUploadApi, staffApi } from '../lib/api'
import api from '../lib/api'

type TabType = 'staff' | 'bulk-upload'

interface StaffUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  documentType?: string
  documentNumber?: string
  roles: Array<{ role: { name: string } }>
  isActive: boolean
}

interface UploadResult {
  success: number
  errors: Array<{ row: number; message: string; data?: any }>
  created: Array<{ id: string; name: string; email?: string }>
}

const STAFF_ROLES = [
  { value: 'COORDINADOR', label: 'Coordinador(a)', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'SECRETARIA', label: 'Secretaria', color: 'bg-amber-100 text-amber-700' },
  { value: 'ORIENTADOR', label: 'Orientador(a)', color: 'bg-teal-100 text-teal-700' },
  { value: 'BIBLIOTECARIO', label: 'Bibliotecario(a)', color: 'bg-purple-100 text-purple-700' },
  { value: 'AUXILIAR', label: 'Auxiliar', color: 'bg-slate-100 text-slate-700' },
]

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'COORDINADOR',
  documentType: 'CC',
  documentNumber: '',
  phone: '',
}

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('staff')
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('ALL')
  
  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<StaffUser | null>(null)
  
  // Bulk upload states
  const [uploadType, setUploadType] = useState<'teachers' | 'students' | 'staff'>('staff')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load users
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await staffApi.getAll()
      // Filter only staff roles (not DOCENTE, ESTUDIANTE, ADMIN_INSTITUTIONAL)
      const staffUsers = (response.data || []).filter((u: StaffUser) => 
        u.roles.some(r => STAFF_ROLES.some(sr => sr.value === r.role.name))
      )
      setUsers(staffUsers)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(search.toLowerCase()) ||
      user.lastName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    
    const matchesRole = filterRole === 'ALL' || 
      user.roles.some(r => r.role.name === filterRole)
    
    return matchesSearch && matchesRole
  })

  const getRoleBadge = (roleName: string) => {
    const role = STAFF_ROLES.find(r => r.value === roleName)
    return role || { label: roleName, color: 'bg-slate-100 text-slate-700' }
  }

  // Form handlers
  const openCreateModal = () => {
    setForm(emptyForm)
    setEditingUser(null)
    setShowModal(true)
  }

  const openEditModal = (user: StaffUser) => {
    const mainRole = user.roles.find(r => STAFF_ROLES.some(sr => sr.value === r.role.name))
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: mainRole?.role.name || 'COORDINADOR',
      documentType: user.documentType || 'CC',
      documentNumber: user.documentNumber || '',
      phone: user.phone || '',
    })
    setEditingUser(user)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingUser) {
        await staffApi.update(editingUser.id, form)
      } else {
        await api.post('/iam/staff', form)
      }
      setShowModal(false)
      loadUsers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: StaffUser) => {
    try {
      await staffApi.delete(user.id)
      setDeleteConfirm(null)
      loadUsers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar')
    }
  }

  // Bulk upload handlers
  const downloadTemplate = async (type: 'teachers' | 'students' | 'staff') => {
    try {
      let response
      let filename
      
      switch (type) {
        case 'teachers':
          response = await bulkUploadApi.downloadTeacherTemplate()
          filename = 'plantilla_docentes.xlsx'
          break
        case 'students':
          response = await bulkUploadApi.downloadStudentTemplate()
          filename = 'plantilla_estudiantes.xlsx'
          break
        case 'staff':
          response = await bulkUploadApi.downloadStaffTemplate()
          filename = 'plantilla_personal.xlsx'
          break
      }
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading template:', error)
      alert('Error al descargar la plantilla')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)

    try {
      let response
      
      switch (uploadType) {
        case 'teachers':
          response = await bulkUploadApi.uploadTeachers(file)
          break
        case 'students':
          response = await bulkUploadApi.uploadStudents(file)
          break
        case 'staff':
          response = await bulkUploadApi.uploadStaff(file)
          break
      }
      
      setUploadResult(response.data)
      loadUsers() // Refresh list
    } catch (error: any) {
      setUploadResult({
        success: 0,
        errors: [{ row: 0, message: error.response?.data?.message || 'Error al procesar el archivo' }],
        created: []
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Otros Usuarios</h1>
              <p className="text-slate-500">Gestiona coordinadores, secretarias, orientadores y más</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'staff'
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Personal
          </button>
          <button
            onClick={() => setActiveTab('bulk-upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'bulk-upload'
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            Carga Masiva
          </button>
        </div>

        {activeTab === 'staff' ? (
          <>
            {/* Filters & Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                >
                  <option value="ALL">Todos los roles</option>
                  {STAFF_ROLES.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Usuario
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Cargando...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No hay usuarios registrados</p>
                  <p className="text-sm mt-1">Crea uno nuevo o usa la carga masiva</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Usuario</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Contacto</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Rol</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{user.firstName} {user.lastName}</p>
                              {user.documentNumber && (
                                <p className="text-sm text-slate-500">{user.documentType}: {user.documentNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1 text-sm text-slate-600">
                              <Mail className="w-3 h-3" /> {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1 text-sm text-slate-500">
                                <Phone className="w-3 h-3" /> {user.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((r, idx) => {
                              const badge = getRoleBadge(r.role.name)
                              return (
                                <span key={idx} className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                                  {badge.label}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(user)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          /* Bulk Upload Tab */
          <div className="space-y-6">
            {/* Upload Type Selection */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Tipo de Carga</h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setUploadType('teachers')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    uploadType === 'teachers'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="font-medium text-slate-900">Docentes</p>
                  <p className="text-sm text-slate-500 mt-1">Profesores y tutores</p>
                </button>
                
                <button
                  onClick={() => setUploadType('students')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    uploadType === 'students'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-medium text-slate-900">Estudiantes</p>
                  <p className="text-sm text-slate-500 mt-1">Alumnos matriculados</p>
                </button>
                
                <button
                  onClick={() => setUploadType('staff')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    uploadType === 'staff'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-violet-600" />
                  </div>
                  <p className="font-medium text-slate-900">Personal</p>
                  <p className="text-sm text-slate-500 mt-1">Coordinadores, secretarias...</p>
                </button>
              </div>
            </div>

            {/* Download Template & Upload */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">1. Descargar Plantilla</h3>
                    <p className="text-sm text-slate-500">Formato Excel con las columnas requeridas</p>
                  </div>
                </div>
                <button
                  onClick={() => downloadTemplate(uploadType)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Descargar Plantilla de {uploadType === 'teachers' ? 'Docentes' : uploadType === 'students' ? 'Estudiantes' : 'Personal'}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">2. Subir Archivo</h3>
                    <p className="text-sm text-slate-500">Archivo Excel (.xlsx) completado</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Subir Archivo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Resultado de la Carga</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-green-700">{uploadResult.success}</p>
                      <p className="text-sm text-green-600">Registros creados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                    <XCircle className="w-8 h-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-700">{uploadResult.errors.length}</p>
                      <p className="text-sm text-red-600">Errores encontrados</p>
                    </div>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Errores
                    </h4>
                    <div className="max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-3">
                      {uploadResult.errors.map((err, idx) => (
                        <div key={idx} className="text-sm py-1 border-b border-slate-200 last:border-0">
                          <span className="font-medium text-red-600">Fila {err.row}:</span>{' '}
                          <span className="text-slate-600">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadResult.created.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Usuarios Creados
                    </h4>
                    <div className="max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-3">
                      {uploadResult.created.map((user, idx) => (
                        <div key={idx} className="text-sm py-1 border-b border-slate-200 last:border-0">
                          <span className="font-medium text-slate-900">{user.name}</span>
                          {user.email && <span className="text-slate-500 ml-2">({user.email})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombres *</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos *</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  >
                    {STAFF_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Documento</label>
                    <select
                      value={form.documentType}
                      onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    >
                      <option value="CC">Cédula de Ciudadanía</option>
                      <option value="CE">Cédula de Extranjería</option>
                      <option value="TI">Tarjeta de Identidad</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número Documento</label>
                    <input
                      type="text"
                      value={form.documentNumber}
                      onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-md mx-4 p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">¿Eliminar Usuario?</h2>
                <p className="text-slate-500 mb-6">
                  Esta acción eliminará permanentemente a <strong>{deleteConfirm.firstName} {deleteConfirm.lastName}</strong>.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
