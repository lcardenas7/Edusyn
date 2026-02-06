import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  Search,
  Plus,
  RefreshCw,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
} from 'lucide-react'

type ObligationStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'OVERDUE'

interface Obligation {
  id: string
  thirdParty: { id: string; name: string }
  concept: { id: string; name: string; category: { name: string } }
  originalAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: ObligationStatus
  dueDate?: string
  reference?: string
}

const statusConfig: Record<ObligationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: 'Pendiente', icon: <Clock className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL: { label: 'Parcial', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  PAID: { label: 'Pagado', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', icon: <XCircle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  OVERDUE: { label: 'Vencido', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Obligations() {
  const token = localStorage.getItem('token')
  const [searchParams, setSearchParams] = useSearchParams()
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | ''>(
    (searchParams.get('status') as ObligationStatus) || ''
  )
  const [showMassiveModal, setShowMassiveModal] = useState(false)

  const fetchObligations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await fetch(`/api/finance/obligations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setObligations(data)
      }
    } catch (err) {
      console.error('Error fetching obligations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchObligations()
  }, [token, statusFilter])

  const filteredObligations = obligations.filter(obl => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      obl.thirdParty.name.toLowerCase().includes(searchLower) ||
      obl.concept.name.toLowerCase().includes(searchLower) ||
      obl.reference?.toLowerCase().includes(searchLower)
    )
  })

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
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Obligaciones</h1>
                <p className="text-gray-500">Gestión de cobros y cartera</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMassiveModal(true)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Asignación Masiva
              </button>
              <Link
                to="/finance/obligations/new"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nueva Obligación
              </Link>
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
                  placeholder="Buscar por tercero, concepto, referencia..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ObligationStatus | '')
                  if (e.target.value) {
                    setSearchParams({ status: e.target.value })
                  } else {
                    setSearchParams({})
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="PENDING">Pendientes</option>
                <option value="PARTIAL">Parciales</option>
                <option value="OVERDUE">Vencidas</option>
                <option value="PAID">Pagadas</option>
                <option value="CANCELLED">Canceladas</option>
              </select>
            </div>
            <button
              onClick={fetchObligations}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(['PENDING', 'PARTIAL', 'OVERDUE', 'PAID'] as ObligationStatus[]).map(status => {
            const config = statusConfig[status]
            const count = obligations.filter(o => o.status === status).length
            const total = obligations
              .filter(o => o.status === status)
              .reduce((sum, o) => sum + Number(o.balance), 0)
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  statusFilter === status
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`p-1 rounded ${config.color}`}>{config.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{config.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{formatCurrency(total)}</p>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : filteredObligations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay obligaciones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tercero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredObligations.map((obl) => {
                    const config = statusConfig[obl.status]
                    return (
                      <tr key={obl.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link
                            to={`/finance/obligations/${obl.id}`}
                            className="font-mono text-sm text-blue-600 hover:text-blue-700"
                          >
                            {obl.reference || obl.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/finance/third-parties/${obl.thirdParty.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {obl.thirdParty.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-gray-900">{obl.concept.name}</div>
                          <div className="text-xs text-gray-500">{obl.concept.category.name}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(Number(obl.totalAmount))}
                        </td>
                        <td className="px-6 py-4 text-right text-green-600">
                          {formatCurrency(Number(obl.paidAmount))}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(Number(obl.balance))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                            {config.icon}
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {obl.dueDate
                            ? new Date(obl.dueDate).toLocaleDateString('es-CO')
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Massive Assignment Modal - Placeholder */}
      {showMassiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Asignación Masiva</h2>
            <p className="text-gray-500 mb-4">
              Asigna un concepto de cobro a múltiples estudiantes de un grado o grupo.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar concepto...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="GRADE">Por Grado</option>
                  <option value="GROUP">Por Grupo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar...</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowMassiveModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
                Generar Obligaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
