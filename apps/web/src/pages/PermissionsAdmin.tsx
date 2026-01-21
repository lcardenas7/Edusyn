import { useState, useEffect } from 'react'
import { Shield, Search, Users, ChevronRight, CheckCircle, AlertTriangle, History } from 'lucide-react'
import api from '../lib/api'
import { usePermissions, PERMISSIONS } from '../hooks/usePermissions'
import UserPermissionsModal from '../components/UserPermissionsModal'
import PermissionAuditLog from '../components/PermissionAuditLog'

interface UserWithPermissions {
  id: string
  firstName: string
  lastName: string
  email: string
  roles: Array<{ role: { name: string } }>
  extraPermissionsCount: number
}

type TabType = 'users' | 'audit'

export default function PermissionsAdmin() {
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('ALL')
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/iam/users')
      // Transformar datos para incluir conteo de permisos extra
      const usersData = response.data.map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.roles || [],
        extraPermissionsCount: user.extraPermissions?.length || 0
      }))
      setUsers(usersData)
    } catch (err) {
      console.error('Error loading users:', err)
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

  const getRoleBadgeColor = (roleName: string) => {
    const colors: Record<string, string> = {
      'ADMIN_INSTITUTIONAL': 'bg-purple-100 text-purple-700',
      'RECTOR': 'bg-blue-100 text-blue-700',
      'COORDINADOR': 'bg-indigo-100 text-indigo-700',
      'DOCENTE': 'bg-green-100 text-green-700',
      'SECRETARIA': 'bg-amber-100 text-amber-700',
    }
    return colors[roleName] || 'bg-slate-100 text-slate-700'
  }

  // Verificar permisos
  const canViewPermissions = can(PERMISSIONS.USERS_LIST_VIEW)

  if (!canViewPermissions) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
          <p className="text-slate-500 mt-2">No tienes permiso para ver esta sección</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Gestión de Permisos</h1>
              <p className="text-slate-500">Administra permisos adicionales por usuario</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            Auditoría
          </button>
        </div>

        {activeTab === 'users' ? (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="ALL">Todos los roles</option>
                  <option value="ADMIN_INSTITUTIONAL">Admin Institucional</option>
                  <option value="RECTOR">Rector</option>
                  <option value="COORDINADOR">Coordinador</option>
                  <option value="DOCENTE">Docente</option>
                  <option value="SECRETARIA">Secretaria</option>
                </select>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No se encontraron usuarios</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600">
                            {user.firstName[0]}{user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Roles */}
                        <div className="flex gap-1">
                          {user.roles.map((r, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(r.role.name)}`}
                            >
                              {r.role.name}
                            </span>
                          ))}
                        </div>

                        {/* Extra permissions indicator */}
                        {user.extraPermissionsCount > 0 && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs font-medium">
                              +{user.extraPermissionsCount} extra
                            </span>
                          </div>
                        )}

                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-500">
                  Mostrando {filteredUsers.length} de {users.length} usuarios
                </p>
              </div>
            </div>

            {/* Info box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Sobre los permisos</h4>
                  <ul className="mt-2 text-sm text-blue-700 space-y-1">
                    <li>• Los <strong>permisos del rol</strong> son fijos y definidos por el sistema</li>
                    <li>• Los <strong>permisos adicionales</strong> pueden ser temporales o permanentes</li>
                    <li>• Todos los cambios quedan registrados en la auditoría</li>
                    <li>• Los permisos temporales expiran automáticamente</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Audit Tab */
          <PermissionAuditLog showFilters={true} limit={100} />
        )}
      </div>

      {/* User Permissions Modal */}
      {selectedUser && (
        <UserPermissionsModal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          onPermissionsChanged={loadUsers}
        />
      )}
    </div>
  )
}
