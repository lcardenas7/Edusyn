import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { institutionalDocumentsApi } from '../lib/api'
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Edit,
  Plus,
  Search,
  Filter,
  X,
  File,
  FileSpreadsheet,
  Image,
  ChevronDown,
  Eye,
  HardDrive,
} from 'lucide-react'

interface Document {
  id: string
  title: string
  description?: string
  category: string
  fileUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  isActive: boolean
  visibleToRoles: string[]
  createdAt: string
  uploadedBy: {
    id: string
    firstName: string
    lastName: string
  }
}

interface Category {
  value: string
  label: string
}

const CATEGORY_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  REGLAMENTO: 'Reglamento',
  FORMATO: 'Formato',
  CIRCULAR: 'Circular',
  PEI: 'PEI',
  SIEE: 'SIEE',
  OTRO: 'Otro',
}

const ROLE_OPTIONS = [
  { value: 'DOCENTE', label: 'Docentes' },
  { value: 'COORDINADOR', label: 'Coordinadores' },
  { value: 'SECRETARIA', label: 'Secretaría' },
  { value: 'ESTUDIANTE', label: 'Estudiantes' },
  { value: 'ACUDIENTE', label: 'Acudientes' },
]

export default function InstitutionalDocuments() {
  const { user, institution } = useAuth()
  const institutionId = institution?.id
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [storageUsage, setStorageUsage] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'OTRO',
    visibleToRoles: [] as string[],
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const userRoles = user?.roles?.map((r: any) => r.role?.name || r.name) || []
  const isAdmin = userRoles.some((r: string) => 
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r)
  )

  useEffect(() => {
    if (institutionId) {
      loadDocuments()
      loadCategories()
      if (isAdmin) {
        loadStorageUsage()
      }
    }
  }, [institutionId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await institutionalDocumentsApi.getAll(institutionId!)
      setDocuments(response.data || [])
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await institutionalDocumentsApi.getCategories()
      setCategories(response.data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadStorageUsage = async () => {
    try {
      const response = await institutionalDocumentsApi.getStorageUsage(institutionId!)
      setStorageUsage(response.data)
    } catch (error) {
      console.error('Error loading storage usage:', error)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !formData.title) return

    try {
      setUploading(true)
      const formDataToSend = new FormData()
      formDataToSend.append('file', selectedFile)
      formDataToSend.append('institutionId', institutionId!)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('category', formData.category)
      formDataToSend.append('visibleToRoles', JSON.stringify(formData.visibleToRoles))

      await institutionalDocumentsApi.create(formDataToSend)
      
      setShowUploadModal(false)
      resetForm()
      loadDocuments()
      if (isAdmin) loadStorageUsage()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al subir documento')
    } finally {
      setUploading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingDoc) return

    try {
      await institutionalDocumentsApi.update(editingDoc.id, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        visibleToRoles: formData.visibleToRoles,
      })
      
      setEditingDoc(null)
      resetForm()
      loadDocuments()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al actualizar documento')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return

    try {
      await institutionalDocumentsApi.delete(id)
      loadDocuments()
      if (isAdmin) loadStorageUsage()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar documento')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'OTRO',
      visibleToRoles: [],
    })
    setSelectedFile(null)
  }

  const openEditModal = (doc: Document) => {
    setEditingDoc(doc)
    setFormData({
      title: doc.title,
      description: doc.description || '',
      category: doc.category,
      visibleToRoles: doc.visibleToRoles,
    })
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-8 h-8 text-green-500" />
    if (mimeType.includes('image')) return <Image className="w-8 h-8 text-blue-500" />
    return <File className="w-8 h-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || doc.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const groupedDocuments = filteredDocuments.reduce((acc, doc) => {
    const cat = doc.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos Institucionales</h1>
          <p className="text-slate-500">Manuales, reglamentos, formatos y circulares</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Subir Documento
          </button>
        )}
      </div>

      {/* Storage Usage (Admin only) */}
      {isAdmin && storageUsage && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-700">Uso de Almacenamiento</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${storageUsage.documentsUsagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(storageUsage.documentsUsagePercent, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-slate-600">
              {formatFileSize(storageUsage.documentsUsage)} / {formatFileSize(storageUsage.documentsLimit)}
            </span>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No hay documentos disponibles</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([category, docs]) => (
            <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700">{CATEGORY_LABELS[category] || category}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
                    {getFileIcon(doc.mimeType)}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 truncate">{doc.title}</h4>
                      {doc.description && (
                        <p className="text-sm text-slate-500 truncate">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await institutionalDocumentsApi.getDownloadUrl(doc.id)
                            window.open(res.data.url, '_blank')
                          } catch (e) {
                            window.open(doc.fileUrl, '_blank')
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Ver documento"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await institutionalDocumentsApi.getDownloadUrl(doc.id)
                            const link = document.createElement('a')
                            link.href = res.data.url
                            link.download = doc.fileName
                            link.click()
                          } catch (e) {
                            window.open(doc.fileUrl, '_blank')
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(doc)}
                            className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Subir Documento</h2>
              <button onClick={() => { setShowUploadModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del documento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Descripción opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visible para</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <label key={role.value} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200">
                      <input
                        type="checkbox"
                        checked={formData.visibleToRoles.includes(role.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, visibleToRoles: [...formData.visibleToRoles, role.value] })
                          } else {
                            setFormData({ ...formData, visibleToRoles: formData.visibleToRoles.filter(r => r !== role.value) })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">Dejar vacío para que todos puedan ver</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Archivo *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                />
                <p className="text-xs text-slate-500 mt-1">Máximo 10MB. PDF, Word, Excel, PowerPoint o imágenes.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => { setShowUploadModal(false); resetForm(); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !formData.title}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Editar Documento</h2>
              <button onClick={() => { setEditingDoc(null); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visible para</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <label key={role.value} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200">
                      <input
                        type="checkbox"
                        checked={formData.visibleToRoles.includes(role.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, visibleToRoles: [...formData.visibleToRoles, role.value] })
                          } else {
                            setFormData({ ...formData, visibleToRoles: formData.visibleToRoles.filter(r => r !== role.value) })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => { setEditingDoc(null); resetForm(); }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
