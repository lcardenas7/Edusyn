import { useState, useEffect } from 'react'
import { History, User, Shield, Clock, Filter, ChevronDown } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'

interface AuditLogEntry {
  id: string
  action: string
  targetUser: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  performedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  permission?: {
    code: string
    name: string
  }
  oldRole?: string
  newRole?: string
  reason?: string
  performedAt: string
  metadata?: any
}

interface PermissionAuditLogProps {
  institutionId?: string
  userId?: string
  limit?: number
  showFilters?: boolean
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  'GRANT': { label: 'Permiso otorgado', color: 'bg-green-100 text-green-700', icon: '🟢' },
  'REVOKE': { label: 'Permiso revocado', color: 'bg-red-100 text-red-700', icon: '🔴' },
  'EXPIRE': { label: 'Permiso expirado', color: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
  'ROLE_ASSIGN': { label: 'Rol asignado', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
  'ROLE_REMOVE': { label: 'Rol removido', color: 'bg-purple-100 text-purple-700', icon: '🟣' },
  'RULE_CHANGE': { label: 'Regla modificada', color: 'bg-orange-100 text-orange-700', icon: '🟠' },
  'PERIOD_OPEN': { label: 'Período abierto', color: 'bg-teal-100 text-teal-700', icon: '📅' },
  'PERIOD_CLOSE': { label: 'Período cerrado', color: 'bg-slate-100 text-slate-700', icon: '📆' },
  'WINDOW_OPEN': { label: 'Ventana abierta', color: 'bg-cyan-100 text-cyan-700', icon: '🪟' },
  'WINDOW_CLOSE': { label: 'Ventana cerrada', color: 'bg-gray-100 text-gray-700', icon: '🚪' },
}

export default function PermissionAuditLog({ 
  userId, 
  limit = 50,
  showFilters = true 
}: PermissionAuditLogProps) {
  const { getAuditLog } = usePermissions()
  
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    fromDate: '',
    toDate: ''
  })
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [userId])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await getAuditLog({
        userId,
        action: filters.action || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        limit
      })
      setLogs(data)
    } catch (err) {
      console.error('Error loading audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    loadLogs()
    setShowFilterPanel(false)
  }

  const clearFilters = () => {
    setFilters({ action: '', fromDate: '', toDate: '' })
    setTimeout(loadLogs, 0)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { 
      label: action, 
      color: 'bg-slate-100 text-slate-700', 
      icon: '⚪' 
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Historial de Cambios</h3>
          </div>
          
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              <Filter className="w-4 h-4" />
              Filtros
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Panel de filtros */}
        {showFilterPanel && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Acción</label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Todas</option>
                  {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">No hay registros de auditoría</p>
          </div>
        ) : (
          logs.map(log => {
            const config = getActionConfig(log.action)
            
            return (
              <div key={log.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="text-xl">{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                      {log.permission && (
                        <span className="text-sm font-medium text-slate-700">
                          {log.permission.name}
                        </span>
                      )}
                      {log.newRole && (
                        <span className="text-sm text-slate-600">
                          {log.oldRole && `${log.oldRole} → `}{log.newRole}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                      <User className="w-3 h-3" />
                      <span>
                        {log.targetUser.firstName} {log.targetUser.lastName}
                      </span>
                    </div>
                    
                    {log.reason && (
                      <div className="mt-1 text-sm text-slate-500 italic">
                        "{log.reason}"
                      </div>
                    )}
                    
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.performedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Por: {log.performedBy.firstName} {log.performedBy.lastName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
