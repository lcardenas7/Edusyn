import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  RefreshCw,
  User,
  Building,
  GraduationCap,
  UserCheck,
  Filter,
} from 'lucide-react'
type ThirdPartyType = 'STUDENT' | 'TEACHER' | 'GUARDIAN' | 'PROVIDER' | 'EXTERNAL'

interface ThirdParty {
  id: string
  type: ThirdPartyType
  name: string
  document?: string
  email?: string
  phone?: string
  isActive: boolean
  _count: { obligations: number; payments: number }
}

const typeLabels: Record<ThirdPartyType, { label: string; icon: React.ReactNode; color: string }> = {
  STUDENT: { label: 'Estudiante', icon: <GraduationCap className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  TEACHER: { label: 'Docente', icon: <User className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  GUARDIAN: { label: 'Acudiente', icon: <UserCheck className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  PROVIDER: { label: 'Proveedor', icon: <Building className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  EXTERNAL: { label: 'Externo', icon: <Users className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
}

export default function ThirdParties() {
  const token = localStorage.getItem('token')
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ThirdPartyType | ''>('')
  const [syncing, setSyncing] = useState(false)

  const fetchThirdParties = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (typeFilter) params.append('type', typeFilter)
      
      const response = await fetch(`/api/finance/third-parties?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setThirdParties(data)
      }
    } catch (err) {
      console.error('Error fetching third parties:', err)
    } finally {
      setLoading(false)
    }
  }

  const syncFromAcademic = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/finance/third-parties/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncStudents: true,
          syncTeachers: true,
          syncGuardians: true,
        }),
      })
      if (response.ok) {
        const result = await response.json()
        alert(`Sincronización completada: ${result.created} creados, ${result.updated} actualizados`)
        fetchThirdParties()
      }
    } catch (err) {
      console.error('Error syncing:', err)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchThirdParties()
  }, [token, typeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchThirdParties()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Terceros</h1>
                <p className="text-gray-500">Gestión de clientes y proveedores</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={syncFromAcademic}
                disabled={syncing}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Tercero
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ThirdPartyType | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los tipos</option>
                <option value="STUDENT">Estudiantes</option>
                <option value="TEACHER">Docentes</option>
                <option value="GUARDIAN">Acudientes</option>
                <option value="PROVIDER">Proveedores</option>
                <option value="EXTERNAL">Externos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : thirdParties.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay terceros registrados</p>
              <button
                onClick={syncFromAcademic}
                className="mt-4 text-blue-600 hover:text-blue-700"
              >
                Sincronizar desde módulo académico
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obligaciones</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pagos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {thirdParties.map((tp) => {
                  const typeInfo = typeLabels[tp.type]
                  return (
                    <tr key={tp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link to={`/finance/third-parties/${tp.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {tp.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.icon}
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{tp.document || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {tp.email && <div>{tp.email}</div>}
                        {tp.phone && <div>{tp.phone}</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {tp._count.obligations}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          {tp._count.payments}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
