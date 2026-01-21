import { useState, useEffect } from 'react'
import { X, Shield, Plus, Trash2, Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { usePermissions, PERMISSIONS } from '../hooks/usePermissions'

interface UserPermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    roles: Array<{ role: { name: string } }>
  }
  onPermissionsChanged?: () => void
}

interface PermissionCatalog {
  [module: string]: {
    [func: string]: Array<{
      code: string
      name: string
      description: string
      subFunction: string
    }>
  }
}

interface ExtraPermission {
  code: string
  expiresAt: string | null
  reason: string
}

const MODULE_NAMES: Record<string, string> = {
  'CONFIG_INSTITUTIONAL': '⚙️ Configuración Institucional',
  'USERS': '👥 Gestión de Personas',
  'ACADEMIC': '📚 Gestión Académica',
  'TRACKING': '📋 Seguimiento',
  'REPORTS': '📊 Reportes',
  'COMMUNICATIONS': '💬 Comunicaciones',
}

const FUNCTION_NAMES: Record<string, string> = {
  'INFO_GENERAL': 'Información General',
  'GRADING_SYSTEM': 'Sistema de Calificación',
  'PERIODS': 'Períodos Académicos',
  'GRADE_WINDOWS': 'Ventanas de Calificación',
  'RECOVERY_WINDOWS': 'Ventanas de Recuperación',
  'AREAS': 'Áreas y Asignaturas',
  'GRADES_GROUPS': 'Grados y Grupos',
  'USERS': 'Usuarios',
  'STUDENTS': 'Estudiantes',
  'GUARDIANS': 'Acudientes',
  'LOAD': 'Carga Académica',
  'GRADES': 'Calificaciones',
  'RECOVERY': 'Recuperaciones',
  'OBSERVER': 'Observador',
  'ATTENDANCE': 'Asistencia',
  'ADMIN': 'Administrativos',
  'ACADEMIC': 'Académicos',
  'BULLETINS': 'Boletines',
  'STATISTICS': 'Estadísticas',
  'EXPORT': 'Exportar',
  'MESSAGES': 'Mensajes',
  'ANNOUNCEMENTS': 'Anuncios',
}

export default function UserPermissionsModal({ 
  isOpen, 
  onClose, 
  user,
  onPermissionsChanged 
}: UserPermissionsModalProps) {
  const { 
    getUserPermissions, 
    getCatalog, 
    grantPermission, 
    revokePermission,
    can 
  } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [extraPermissions, setExtraPermissions] = useState<ExtraPermission[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalog>({})
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estado para agregar permiso
  const [newPermission, setNewPermission] = useState({
    code: '',
    reason: '',
    isPermanent: true,
    validTo: ''
  })

  // Estado para revocar permiso
  const [revokeModal, setRevokeModal] = useState<{ code: string; name: string } | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      loadData()
    }
  }, [isOpen, user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [permsData, catalogData] = await Promise.all([
        getUserPermissions(user.id),
        getCatalog()
      ])
      setRolePermissions(permsData.rolePermissions)
      setExtraPermissions(permsData.extraPermissions)
      setCatalog(catalogData)
    } catch (err) {
      console.error('Error loading permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGrantPermission = async () => {
    if (!newPermission.code || !newPermission.reason) return
    
    setSaving(true)
    try {
      await grantPermission({
        userId: user.id,
        permissionCode: newPermission.code,
        reason: newPermission.reason,
        validTo: newPermission.isPermanent ? undefined : newPermission.validTo
      })
      
      await loadData()
      setShowAddModal(false)
      setNewPermission({ code: '', reason: '', isPermanent: true, validTo: '' })
      onPermissionsChanged?.()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al otorgar permiso')
    } finally {
      setSaving(false)
    }
  }

  const handleRevokePermission = async () => {
    if (!revokeModal || !revokeReason) return
    
    setSaving(true)
    try {
      await revokePermission({
        userId: user.id,
        permissionCode: revokeModal.code,
        reason: revokeReason
      })
      
      await loadData()
      setRevokeModal(null)
      setRevokeReason('')
      onPermissionsChanged?.()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al revocar permiso')
    } finally {
      setSaving(false)
    }
  }

  const toggleModule = (module: string) => {
    const newSet = new Set(expandedModules)
    if (newSet.has(module)) {
      newSet.delete(module)
    } else {
      newSet.add(module)
    }
    setExpandedModules(newSet)
  }

  const getPermissionStatus = (code: string): 'role' | 'extra' | 'none' => {
    if (rolePermissions.includes(code)) return 'role'
    if (extraPermissions.some(ep => ep.code === code)) return 'extra'
    return 'none'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Permanente'
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return `${date.toLocaleDateString('es-CO')} (${diffDays} días)`
  }

  const userRoles = user.roles.map(r => r.role.name).join(', ')

  // Filtrar permisos disponibles para agregar (que no tenga ya)
  const getAvailablePermissions = () => {
    const available: Array<{ code: string; name: string; module: string; func: string }> = []
    
    Object.entries(catalog).forEach(([module, functions]) => {
      Object.entries(functions).forEach(([func, perms]) => {
        perms.forEach(perm => {
          const status = getPermissionStatus(perm.code)
          if (status === 'none') {
            if (!searchTerm || 
                perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                perm.code.toLowerCase().includes(searchTerm.toLowerCase())) {
              available.push({
                code: perm.code,
                name: perm.name,
                module,
                func
              })
            }
          }
        })
      })
    })
    
    return available
  }

  if (!isOpen) return null

  // Verificar si el usuario actual puede asignar permisos
  const canAssignPermissions = can(PERMISSIONS.USERS_ASSIGN_PERMISSIONS)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Permisos de {user.firstName} {user.lastName}
                </h2>
                <p className="text-sm text-slate-500">
                  Rol: <span className="font-medium text-indigo-600">{userRoles}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">{rolePermissions.length}</div>
                  <div className="text-sm text-blue-600">Permisos del rol</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{extraPermissions.length}</div>
                  <div className="text-sm text-green-600">Permisos adicionales</div>
                </div>
              </div>

              {/* Permisos adicionales */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Permisos Adicionales</h3>
                  {canAssignPermissions && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </button>
                  )}
                </div>

                {extraPermissions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <Shield className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No tiene permisos adicionales</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {extraPermissions.map(ep => {
                      const permInfo = Object.values(catalog)
                        .flatMap(funcs => Object.values(funcs).flat())
                        .find(p => p.code === ep.code)
                      
                      return (
                        <div 
                          key={ep.code}
                          className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <div>
                              <div className="font-medium text-slate-800">
                                {permInfo?.name || ep.code}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                {formatDate(ep.expiresAt)}
                                <span className="text-slate-400">•</span>
                                {ep.reason}
                              </div>
                            </div>
                          </div>
                          {canAssignPermissions && (
                            <button
                              onClick={() => setRevokeModal({ 
                                code: ep.code, 
                                name: permInfo?.name || ep.code 
                              })}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                              title="Revocar permiso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Catálogo de permisos del rol */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Permisos del Rol ({userRoles})</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {Object.entries(catalog).map(([module, functions]) => {
                    const modulePerms = Object.values(functions).flat()
                    const rolePermsInModule = modulePerms.filter(p => rolePermissions.includes(p.code))
                    
                    if (rolePermsInModule.length === 0) return null
                    
                    const isExpanded = expandedModules.has(module)
                    
                    return (
                      <div key={module} className="border-b border-slate-200 last:border-b-0">
                        <button
                          onClick={() => toggleModule(module)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="font-medium text-slate-700">
                              {MODULE_NAMES[module] || module}
                            </span>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {rolePermsInModule.length} permisos
                          </span>
                        </button>
                        
                        {isExpanded && (
                          <div className="bg-slate-50 px-4 py-2">
                            {Object.entries(functions).map(([func, perms]) => {
                              const funcRolePerms = perms.filter(p => rolePermissions.includes(p.code))
                              if (funcRolePerms.length === 0) return null
                              
                              return (
                                <div key={func} className="mb-2">
                                  <div className="text-xs font-medium text-slate-500 mb-1">
                                    {FUNCTION_NAMES[func] || func}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {funcRolePerms.map(perm => (
                                      <span
                                        key={perm.code}
                                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                                        title={perm.description}
                                      >
                                        {perm.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Agregar Permiso */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Agregar Permiso</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Buscar permiso */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Buscar permiso
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Lista de permisos disponibles */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seleccionar permiso
                </label>
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                  {getAvailablePermissions().map(perm => (
                    <button
                      key={perm.code}
                      onClick={() => setNewPermission(prev => ({ ...prev, code: perm.code }))}
                      className={`w-full text-left p-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${
                        newPermission.code === perm.code ? 'bg-indigo-50 border-indigo-200' : ''
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">{perm.name}</div>
                      <div className="text-xs text-slate-500">
                        {MODULE_NAMES[perm.module] || perm.module} → {FUNCTION_NAMES[perm.func] || perm.func}
                      </div>
                    </button>
                  ))}
                  {getAvailablePermissions().length === 0 && (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No hay permisos disponibles para agregar
                    </div>
                  )}
                </div>
              </div>

              {/* Vigencia */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vigencia
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={newPermission.isPermanent}
                      onChange={() => setNewPermission(prev => ({ ...prev, isPermanent: true }))}
                    />
                    <span className="text-sm">Permanente</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!newPermission.isPermanent}
                      onChange={() => setNewPermission(prev => ({ ...prev, isPermanent: false }))}
                    />
                    <span className="text-sm">Temporal</span>
                  </label>
                </div>
                {!newPermission.isPermanent && (
                  <input
                    type="date"
                    value={newPermission.validTo}
                    onChange={(e) => setNewPermission(prev => ({ ...prev, validTo: e.target.value }))}
                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>

              {/* Razón */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newPermission.reason}
                  onChange={(e) => setNewPermission(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Apoyo en cierre de período académico"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Obligatorio para auditoría
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewPermission({ code: '', reason: '', isPermanent: true, validTo: '' })
                  setSearchTerm('')
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleGrantPermission}
                disabled={!newPermission.code || !newPermission.reason || saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Otorgar Permiso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Revocar Permiso */}
      {revokeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Revocar Permiso</h3>
                <p className="text-sm text-slate-500">{revokeModal.name}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Razón de revocación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ej: Fin del período de apoyo"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRevokeModal(null)
                  setRevokeReason('')
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleRevokePermission}
                disabled={!revokeReason || saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Revocando...' : 'Revocar Permiso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
