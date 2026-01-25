import { useState, useEffect } from 'react'
import { Search, Plus, X, Send, Mail, Bell, Users, Calendar, Eye, Trash2, FileText, MessageSquare, Megaphone, Loader2 } from 'lucide-react'
import { communicationsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type CommunicationType = 'CIRCULAR' | 'NOTIFICATION' | 'MESSAGE' | 'ANNOUNCEMENT'
type RecipientType = 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS' | 'GROUP' | 'INDIVIDUAL'
type CommunicationStatus = 'DRAFT' | 'SENT' | 'SCHEDULED'

interface Communication {
  id: string
  type: CommunicationType
  subject: string
  content: string
  recipientType: RecipientType
  recipients?: string[]
  status: CommunicationStatus
  createdAt: string
  sentAt?: string
  scheduledAt?: string
  author: string
  readCount?: number
  totalRecipients?: number
}

const typeLabels: Record<CommunicationType, { label: string; icon: typeof Mail; color: string }> = {
  CIRCULAR: { label: 'Circular', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  NOTIFICATION: { label: 'Notificacion', icon: Bell, color: 'bg-amber-100 text-amber-700' },
  MESSAGE: { label: 'Mensaje', icon: MessageSquare, color: 'bg-green-100 text-green-700' },
  ANNOUNCEMENT: { label: 'Anuncio', icon: Megaphone, color: 'bg-purple-100 text-purple-700' },
}

const recipientLabels: Record<RecipientType, string> = {
  ALL: 'Toda la comunidad',
  TEACHERS: 'Docentes',
  STUDENTS: 'Estudiantes',
  PARENTS: 'Acudientes',
  GROUP: 'Grupo especifico',
  INDIVIDUAL: 'Individual',
}

const statusLabels: Record<CommunicationStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-slate-100 text-slate-600' },
  SENT: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
  SCHEDULED: { label: 'Programado', color: 'bg-blue-100 text-blue-700' },
}


export default function Communications() {
  const { institution } = useAuth()
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<CommunicationType | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<CommunicationStatus | 'ALL'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Communication | null>(null)

  const [form, setForm] = useState({
    type: 'CIRCULAR' as CommunicationType,
    subject: '',
    content: '',
    recipientType: 'ALL' as RecipientType,
    scheduledAt: '',
  })
  const [saving, setSaving] = useState(false)

  // Cargar comunicaciones desde la API
  useEffect(() => {
    const loadCommunications = async () => {
      if (!institution?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await communicationsApi.getAll({ institutionId: institution.id })
        const apiComms: Communication[] = (response.data || []).map((c: any) => ({
          id: c.id,
          type: (c.type || 'CIRCULAR') as CommunicationType,
          subject: c.subject || '',
          content: c.content || '',
          recipientType: mapRecipientType(c.recipients),
          status: (c.status || 'DRAFT') as CommunicationStatus,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
          sentAt: c.sentAt ? new Date(c.sentAt).toISOString().split('T')[0] : undefined,
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().split('T')[0] : undefined,
          author: c.author ? `${c.author.firstName} ${c.author.lastName}` : 'Sistema',
          readCount: c.readCount || 0,
          totalRecipients: c.recipients?.length || 0,
        }))
        setCommunications(apiComms)
      } catch (err: any) {
        console.error('Error loading communications:', err)
        setError('Error al cargar comunicaciones')
      } finally {
        setLoading(false)
      }
    }
    loadCommunications()
  }, [institution?.id])

  // Mapear tipo de destinatario desde recipients
  const mapRecipientType = (recipients: any[]): RecipientType => {
    if (!recipients || recipients.length === 0) return 'ALL'
    const types = recipients.map((r: any) => r.recipientType)
    if (types.includes('ALL_TEACHERS') && types.includes('ALL_STUDENTS')) return 'ALL'
    if (types.includes('ALL_TEACHERS')) return 'TEACHERS'
    if (types.includes('ALL_STUDENTS')) return 'STUDENTS'
    if (types.includes('ALL_PARENTS')) return 'PARENTS'
    return 'INDIVIDUAL'
  }

  const filteredCommunications = communications.filter(c => {
    const matchesSearch = c.subject.toLowerCase().includes(search.toLowerCase()) || c.content.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || c.type === filterType
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  const stats = {
    total: communications.length,
    sent: communications.filter(c => c.status === 'SENT').length,
    drafts: communications.filter(c => c.status === 'DRAFT').length,
    scheduled: communications.filter(c => c.status === 'SCHEDULED').length,
  }

  const handleOpenNew = () => {
    setForm({ type: 'CIRCULAR', subject: '', content: '', recipientType: 'ALL', scheduledAt: '' })
    setShowModal(true)
  }

  const handleView = (comm: Communication) => {
    setSelectedCommunication(comm)
    setShowViewModal(true)
  }

  // Mapear recipientType a formato de API
  const getRecipientsForApi = (recipientType: RecipientType): string[] => {
    switch (recipientType) {
      case 'ALL': return ['ALL_TEACHERS', 'ALL_STUDENTS', 'ALL_PARENTS']
      case 'TEACHERS': return ['ALL_TEACHERS']
      case 'STUDENTS': return ['ALL_STUDENTS']
      case 'PARENTS': return ['ALL_PARENTS']
      default: return []
    }
  }

  const handleSaveDraft = async () => {
    if (!form.subject.trim() || !institution?.id) return
    setSaving(true)
    try {
      const response = await communicationsApi.create({
        institutionId: institution.id,
        type: form.type,
        subject: form.subject,
        content: form.content,
        recipients: getRecipientsForApi(form.recipientType)
      })
      
      const newComm: Communication = {
        id: response.data.id,
        type: form.type,
        subject: form.subject,
        content: form.content,
        recipientType: form.recipientType,
        status: 'DRAFT',
        createdAt: new Date().toISOString().split('T')[0],
        author: 'Usuario Actual',
        totalRecipients: 0,
      }
      setCommunications([newComm, ...communications])
      setShowModal(false)
    } catch (err: any) {
      console.error('Error saving draft:', err)
      alert(err.response?.data?.message || 'Error al guardar borrador')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!form.subject.trim() || !institution?.id) return
    setSaving(true)
    try {
      const response = await communicationsApi.create({
        institutionId: institution.id,
        type: form.type,
        subject: form.subject,
        content: form.content,
        recipients: getRecipientsForApi(form.recipientType)
      })
      
      const newComm: Communication = {
        id: response.data.id,
        type: form.type,
        subject: form.subject,
        content: form.content,
        recipientType: form.recipientType,
        status: form.scheduledAt ? 'SCHEDULED' : 'SENT',
        createdAt: new Date().toISOString().split('T')[0],
        sentAt: form.scheduledAt ? undefined : new Date().toISOString().split('T')[0],
        scheduledAt: form.scheduledAt || undefined,
        author: 'Usuario Actual',
        totalRecipients: 0,
        readCount: 0,
      }
      setCommunications([newComm, ...communications])
      setShowModal(false)
    } catch (err: any) {
      console.error('Error sending:', err)
      alert(err.response?.data?.message || 'Error al enviar comunicación')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!deleteConfirm) return
    setCommunications(communications.filter(c => c.id !== deleteConfirm.id))
    setDeleteConfirm(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-slate-600">Cargando comunicaciones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Mail className="w-12 h-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Comunicaciones</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Gestion de circulares, notificaciones y mensajes</p>
        </div>
        <button onClick={handleOpenNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Nueva Comunicacion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
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
              <Send className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
              <p className="text-xs text-slate-500">Enviados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-600">{stats.drafts}</p>
              <p className="text-xs text-slate-500">Borradores</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.scheduled}</p>
              <p className="text-xs text-slate-500">Programados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar por asunto o contenido..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg">
                <option value="ALL">Todos los tipos</option>
                <option value="CIRCULAR">Circulares</option>
                <option value="NOTIFICATION">Notificaciones</option>
                <option value="MESSAGE">Mensajes</option>
                <option value="ANNOUNCEMENT">Anuncios</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg">
                <option value="ALL">Todos los estados</option>
                <option value="SENT">Enviados</option>
                <option value="DRAFT">Borradores</option>
                <option value="SCHEDULED">Programados</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredCommunications.map((comm) => {
            const TypeIcon = typeLabels[comm.type].icon
            return (
              <div key={comm.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeLabels[comm.type].color}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-900 truncate">{comm.subject}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[comm.status].color}`}>{statusLabels[comm.status].label}</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">{comm.content}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{recipientLabels[comm.recipientType]}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{comm.sentAt || comm.scheduledAt || comm.createdAt}</span>
                      {comm.status === 'SENT' && comm.readCount !== undefined && (
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{comm.readCount}/{comm.totalRecipients} leidos</span>
                      )}
                      <span>Por: {comm.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleView(comm)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600" title="Ver"><Eye className="w-4 h-4" /></button>
                    {comm.status === 'DRAFT' && (
                      <button onClick={() => setDeleteConfirm(comm)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-red-600" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredCommunications.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No se encontraron comunicaciones</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-200">
          <p className="text-sm text-slate-500">Mostrando {filteredCommunications.length} de {communications.length} comunicaciones</p>
        </div>
      </div>

      {/* Modal Nueva Comunicacion */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nueva Comunicacion</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Comunicacion</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CommunicationType })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="CIRCULAR">Circular</option>
                    <option value="NOTIFICATION">Notificacion</option>
                    <option value="MESSAGE">Mensaje</option>
                    <option value="ANNOUNCEMENT">Anuncio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Destinatarios</label>
                  <select value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value as RecipientType })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="ALL">Toda la comunidad</option>
                    <option value="TEACHERS">Solo Docentes</option>
                    <option value="STUDENTS">Solo Estudiantes</option>
                    <option value="PARENTS">Solo Acudientes</option>
                    <option value="GROUP">Grupo especifico</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asunto *</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ingrese el asunto de la comunicacion" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contenido *</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" placeholder="Escriba el contenido de la comunicacion..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Programar envio (opcional)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                <p className="text-xs text-slate-500 mt-1">Deje vacio para enviar inmediatamente</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button onClick={handleSaveDraft} disabled={saving || !form.subject.trim()} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar Borrador
              </button>
              <button onClick={handleSend} disabled={saving || !form.subject.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {form.scheduledAt ? 'Programar' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Comunicacion */}
      {showViewModal && selectedCommunication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeLabels[selectedCommunication.type].color}`}>
                  {(() => { const Icon = typeLabels[selectedCommunication.type].icon; return <Icon className="w-5 h-5" /> })()}
                </div>
                <div>
                  <h3 className="font-semibold">{typeLabels[selectedCommunication.type].label}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[selectedCommunication.status].color}`}>{statusLabels[selectedCommunication.status].label}</span>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <h2 className="text-xl font-bold text-slate-900 mb-4">{selectedCommunication.subject}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-500 mb-6 pb-4 border-b border-slate-200">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{recipientLabels[selectedCommunication.recipientType]}</span>
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{selectedCommunication.sentAt || selectedCommunication.scheduledAt || selectedCommunication.createdAt}</span>
                <span>Por: {selectedCommunication.author}</span>
              </div>
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap">{selectedCommunication.content}</p>
              </div>
              {selectedCommunication.status === 'SENT' && selectedCommunication.readCount !== undefined && (
                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700">Estadisticas de lectura</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(selectedCommunication.readCount / (selectedCommunication.totalRecipients || 1)) * 100}%` }}></div>
                    </div>
                    <span className="text-sm text-slate-600">{selectedCommunication.readCount} de {selectedCommunication.totalRecipients} ({Math.round((selectedCommunication.readCount / (selectedCommunication.totalRecipients || 1)) * 100)}%)</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">Eliminar comunicacion?</h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estas a punto de eliminar "<strong>{deleteConfirm.subject}</strong>".
              <span className="text-red-600 font-medium"> Esta accion no se puede deshacer.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
