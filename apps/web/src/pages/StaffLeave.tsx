import { useState, useEffect } from 'react'
import { confirmDialog } from '../components/ui/confirm'
import { useAuth } from '../contexts/AuthContext'
import {
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  AlertTriangle,
  Calendar,
  Upload,
  Eye,
  Filter,
  Paperclip,
} from 'lucide-react'
import { staffLeaveApi, storageApi, toPublicFileUrl } from '../lib/api'

type TabType = 'my-requests' | 'all-requests'

interface LeaveRequest {
  id: string
  type: string
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
  reason: string
  attachmentUrl?: string
  status: string
  reviewerNote?: string
  reviewedAt?: string
  createdAt: string
  requester?: { id: string; firstName: string; lastName: string; email: string }
  reviewedBy?: { id: string; firstName: string; lastName: string }
}

const TYPE_LABELS: Record<string, string> = {
  AUSENCIA: 'Ausencia',
  SALIDA_TEMPRANA: 'Salida Temprana',
  LLEGADA_TARDE: 'Llegada Tarde',
  PERMISO_ESPECIAL: 'Permiso Especial',
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  AUSENCIA: { bg: 'bg-purple-100', text: 'text-purple-700' },
  SALIDA_TEMPRANA: { bg: 'bg-blue-100', text: 'text-blue-700' },
  LLEGADA_TARDE: { bg: 'bg-amber-100', text: 'text-amber-700' },
  PERMISO_ESPECIAL: { bg: 'bg-teal-100', text: 'text-teal-700' },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Pendiente' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Aprobado' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Rechazado' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', icon: XCircle, label: 'Cancelado' },
}

export default function StaffLeave() {
  const { user, institution } = useAuth()

  const isManager = user?.roles?.some((r: any) => {
    const roleName = r.role?.name || r.name || ''
    return ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].some(rn => roleName.includes(rn))
  }) ?? false

  const [activeTab, setActiveTab] = useState<TabType>('my-requests')
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    type: 'AUSENCIA' as string,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    startTime: '',
    endTime: '',
    reason: '',
  })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null)

  // Filter
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (isManager && activeTab === 'all-requests') {
      loadAllRequests()
    }
  }, [activeTab, filterStatus, filterType])

  const loadData = async () => {
    setLoading(true)
    try {
      const [myRes, statsRes] = await Promise.all([
        staffLeaveApi.getMyRequests(),
        isManager ? staffLeaveApi.getStats() : Promise.resolve({ data: { total: 0, pending: 0, approved: 0, rejected: 0 } }),
      ])
      setMyRequests(myRes.data || [])
      if (statsRes.data) setStats(statsRes.data)
    } catch (err) {
      console.error('Error loading staff leave data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllRequests = async () => {
    try {
      const params: any = {}
      if (filterStatus) params.status = filterStatus
      if (filterType) params.type = filterType
      const res = await staffLeaveApi.getAll(params)
      setAllRequests(res.data || [])
    } catch (err) {
      console.error('Error loading all requests:', err)
    }
  }

  const handleCreate = async () => {
    if (!form.reason.trim()) {
      setMessage({ type: 'error', text: 'El motivo es requerido' })
      setTimeout(() => setMessage(null), 3000)
      return
    }
    setCreating(true)
    try {
      let attachmentUrl: string | undefined
      if (attachmentFile) {
        setUploadingAttachment(true)
        const uploadRes = await storageApi.uploadGalleryImage(attachmentFile, institution?.id || '')
        attachmentUrl = uploadRes.data?.path || uploadRes.data?.key
        setUploadingAttachment(false)
      }

      await staffLeaveApi.create({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        reason: form.reason,
        attachmentUrl,
      })

      setMessage({ type: 'success', text: 'Solicitud creada correctamente' })
      setShowCreateModal(false)
      setForm({ type: 'AUSENCIA', startDate: new Date().toISOString().split('T')[0], endDate: '', startTime: '', endTime: '', reason: '' })
      setAttachmentFile(null)
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Error al crear la solicitud' })
    } finally {
      setCreating(false)
      setUploadingAttachment(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedRequest) return
    setReviewing(true)
    try {
      await staffLeaveApi.review(selectedRequest.id, { status, reviewerNote: reviewNote || undefined })
      setMessage({ type: 'success', text: status === 'APPROVED' ? 'Solicitud aprobada' : 'Solicitud rechazada' })
      setShowReviewModal(false)
      setSelectedRequest(null)
      setReviewNote('')
      loadData()
      loadAllRequests()
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Error al revisar la solicitud' })
    } finally {
      setReviewing(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleCancel = async (id: string) => {
    if (!(await confirmDialog('¿Está seguro de cancelar esta solicitud?', { danger: true }))) return
    try {
      await staffLeaveApi.cancel(id)
      setMessage({ type: 'success', text: 'Solicitud cancelada' })
      loadData()
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Error al cancelar' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    )
  }

  const renderTypeBadge = (type: string) => {
    const cfg = TYPE_COLORS[type] || TYPE_COLORS.AUSENCIA
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
        {TYPE_LABELS[type] || type}
      </span>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  const renderRequestRow = (req: LeaveRequest, showRequester = false) => (
    <tr key={req.id} className="hover:bg-slate-50">
      {showRequester && (
        <td className="px-4 py-3">
          <p className="font-medium text-slate-900 text-sm">{req.requester?.lastName} {req.requester?.firstName}</p>
          <p className="text-xs text-slate-500">{req.requester?.email}</p>
        </td>
      )}
      <td className="px-4 py-3">{renderTypeBadge(req.type)}</td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDate(req.startDate)}
        {req.endDate && req.endDate !== req.startDate ? ` - ${formatDate(req.endDate)}` : ''}
        {req.startTime && <span className="text-slate-500 ml-1">({req.startTime}{req.endTime ? ` - ${req.endTime}` : ''})</span>}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{req.reason}</td>
      <td className="px-4 py-3 text-center">
        {req.attachmentUrl ? (
          <a href={toPublicFileUrl(req.attachmentUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
            <Paperclip className="w-4 h-4 inline" />
          </a>
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">{renderStatusBadge(req.status)}</td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => { setDetailRequest(req); setShowDetailModal(true) }}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Ver detalle"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isManager && req.status === 'PENDING' && (
            <button
              onClick={() => { setSelectedRequest(req); setReviewNote(''); setShowReviewModal(true) }}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Revisar
            </button>
          )}
          {req.requester?.id === user?.id && req.status === 'PENDING' && (
            <button
              onClick={() => handleCancel(req.id)}
              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </td>
    </tr>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Permisos y Ausencias</h1>
          <p className="text-sm text-slate-500 mt-1">Solicita y gestiona permisos de ausencia</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Solicitud
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Stats for managers */}
      {isManager && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
                <p className="text-xs text-amber-600">Pendientes</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
                <p className="text-xs text-green-600">Aprobados</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
                <p className="text-xs text-red-600">Rechazados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {isManager && (
        <div className="border-b border-slate-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('my-requests')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                activeTab === 'my-requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Mis Solicitudes
            </button>
            <button
              onClick={() => setActiveTab('all-requests')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm ${
                activeTab === 'all-requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Todas las Solicitudes
              {stats.pending > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs">{stats.pending}</span>
              )}
            </button>
          </nav>
        </div>
      )}

      {/* Filters for all-requests */}
      {activeTab === 'all-requests' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos</option>
              <option value="AUSENCIA">Ausencia</option>
              <option value="SALIDA_TEMPRANA">Salida Temprana</option>
              <option value="LLEGADA_TARDE">Llegada Tarde</option>
              <option value="PERMISO_ESPECIAL">Permiso Especial</option>
            </select>
          </div>
          <button onClick={loadAllRequests} className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">
            <Filter className="w-4 h-4" /> Filtrar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {activeTab === 'all-requests' && <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Solicitante</th>}
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Motivo</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Soporte</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(activeTab === 'my-requests' ? myRequests : allRequests).length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'all-requests' ? 7 : 6} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No hay solicitudes{activeTab === 'my-requests' ? '. Crea tu primera solicitud.' : ' con los filtros seleccionados.'}</p>
                  </td>
                </tr>
              ) : (
                (activeTab === 'my-requests' ? myRequests : allRequests).map(req =>
                  renderRequestRow(req, activeTab === 'all-requests')
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Nueva Solicitud de Permiso</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Permiso *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AUSENCIA">Ausencia (dia completo)</option>
                  <option value="SALIDA_TEMPRANA">Salida Temprana</option>
                  <option value="LLEGADA_TARDE">Llegada Tarde</option>
                  <option value="PERMISO_ESPECIAL">Permiso Especial (cita medica, calamidad, etc.)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {(form.type === 'SALIDA_TEMPRANA' || form.type === 'LLEGADA_TARDE') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Inicio</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Fin</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Describa el motivo de su solicitud..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Soporte / Adjunto</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="attachment-input"
                  />
                  <label htmlFor="attachment-input" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    {attachmentFile ? (
                      <p className="text-sm text-blue-600 font-medium">{attachmentFile.name}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Haga clic para adjuntar un archivo (imagen, PDF, documento)</p>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setAttachmentFile(null) }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.reason.trim() || !form.startDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingAttachment ? 'Subiendo archivo...' : creating ? 'Creando...' : 'Crear Solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Revisar Solicitud</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-slate-900">
                  {selectedRequest.requester?.lastName} {selectedRequest.requester?.firstName}
                </p>
                <div className="flex gap-2">
                  {renderTypeBadge(selectedRequest.type)}
                </div>
                <p className="text-sm text-slate-600">
                  <strong>Fecha:</strong> {formatDate(selectedRequest.startDate)}
                  {selectedRequest.endDate && selectedRequest.endDate !== selectedRequest.startDate ? ` - ${formatDate(selectedRequest.endDate)}` : ''}
                </p>
                <p className="text-sm text-slate-600"><strong>Motivo:</strong> {selectedRequest.reason}</p>
                {selectedRequest.attachmentUrl && (
                  <a href={toPublicFileUrl(selectedRequest.attachmentUrl)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                    <Paperclip className="w-4 h-4" /> Ver soporte adjunto
                  </a>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observacion (opcional)</label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Observacion para el solicitante..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReview('REJECTED')}
                disabled={reviewing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Rechazar
              </button>
              <button
                onClick={() => handleReview('APPROVED')}
                disabled={reviewing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Aprobar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && detailRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Detalle de Solicitud</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                {renderTypeBadge(detailRequest.type)}
                {renderStatusBadge(detailRequest.status)}
              </div>
              <p className="text-sm"><strong>Solicitante:</strong> {detailRequest.requester?.lastName} {detailRequest.requester?.firstName}</p>
              <p className="text-sm"><strong>Fecha:</strong> {formatDate(detailRequest.startDate)}
                {detailRequest.endDate && detailRequest.endDate !== detailRequest.startDate ? ` - ${formatDate(detailRequest.endDate)}` : ''}
              </p>
              {detailRequest.startTime && (
                <p className="text-sm"><strong>Hora:</strong> {detailRequest.startTime}{detailRequest.endTime ? ` - ${detailRequest.endTime}` : ''}</p>
              )}
              <p className="text-sm"><strong>Motivo:</strong> {detailRequest.reason}</p>
              {detailRequest.attachmentUrl && (
                <a href={toPublicFileUrl(detailRequest.attachmentUrl)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                  <Paperclip className="w-4 h-4" /> Ver soporte adjunto
                </a>
              )}
              {detailRequest.reviewedBy && (
                <div className="mt-4 pt-3 border-t border-slate-200 space-y-1">
                  <p className="text-sm"><strong>Revisado por:</strong> {detailRequest.reviewedBy.lastName} {detailRequest.reviewedBy.firstName}</p>
                  {detailRequest.reviewedAt && <p className="text-sm text-slate-500">Fecha: {formatDate(detailRequest.reviewedAt)}</p>}
                  {detailRequest.reviewerNote && <p className="text-sm"><strong>Nota:</strong> {detailRequest.reviewerNote}</p>}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">Creado: {formatDate(detailRequest.createdAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
