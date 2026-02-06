import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Wallet,
  Search,
  Plus,
  RefreshCw,
  Filter,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
} from 'lucide-react'
import { financePaymentsApi } from '../../lib/api'

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'PSE' | 'NEQUI' | 'DAVIPLATA' | 'OTHER'

interface Payment {
  id: string
  thirdParty: { id: string; name: string }
  obligation?: { id: string; concept: { name: string } }
  amount: number
  paymentMethod: PaymentMethod
  receiptNumber?: string
  paymentDate: string
  receivedBy: { firstName: string; lastName: string }
}

const methodConfig: Record<PaymentMethod, { label: string; icon: React.ReactNode; color: string }> = {
  CASH: { label: 'Efectivo', icon: <Banknote className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  TRANSFER: { label: 'Transferencia', icon: <Building className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  CARD: { label: 'Tarjeta', icon: <CreditCard className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  PSE: { label: 'PSE', icon: <Building className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-700' },
  NEQUI: { label: 'Nequi', icon: <Smartphone className="w-4 h-4" />, color: 'bg-pink-100 text-pink-700' },
  DAVIPLATA: { label: 'Daviplata', icon: <Smartphone className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
  OTHER: { label: 'Otro', icon: <Wallet className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('')
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false)

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (methodFilter) params.paymentMethod = methodFilter
      const response = await financePaymentsApi.getAll(params)
      setPayments(response.data)
    } catch (err) {
      console.error('Error fetching payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [methodFilter])

  const filteredPayments = payments.filter(p => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      p.thirdParty.name.toLowerCase().includes(searchLower) ||
      p.receiptNumber?.toLowerCase().includes(searchLower) ||
      p.obligation?.concept.name.toLowerCase().includes(searchLower)
    )
  })

  const todayTotal = payments
    .filter(p => new Date(p.paymentDate).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + Number(p.amount), 0)

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
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caja / Recaudos</h1>
                <p className="text-gray-500">Registro de pagos y recibos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-green-100 rounded-lg">
                <p className="text-xs text-green-600">Recaudo Hoy</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(todayTotal)}</p>
              </div>
              <button
                onClick={() => setShowNewPaymentModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Registrar Pago
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
                  placeholder="Buscar por tercero, recibo, concepto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los métodos</option>
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CARD">Tarjeta</option>
                <option value="PSE">PSE</option>
                <option value="NEQUI">Nequi</option>
                <option value="DAVIPLATA">Daviplata</option>
              </select>
            </div>
            <button
              onClick={fetchPayments}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay pagos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recibo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tercero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recibido por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayments.map((payment) => {
                    const method = methodConfig[payment.paymentMethod]
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-blue-600">
                            {payment.receiptNumber || payment.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(payment.paymentDate).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/finance/third-parties/${payment.thirdParty.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {payment.thirdParty.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {payment.obligation?.concept.name || 'Pago general'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${method.color}`}>
                            {method.icon}
                            {method.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-green-600">
                          {formatCurrency(Number(payment.amount))}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {payment.receivedBy.firstName} {payment.receivedBy.lastName}
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

      {/* New Payment Modal - Placeholder */}
      {showNewPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registrar Pago</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tercero</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar tercero...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Obligación (opcional)</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar obligación...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="PSE">PSE</option>
                  <option value="NEQUI">Nequi</option>
                  <option value="DAVIPLATA">Daviplata</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewPaymentModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
