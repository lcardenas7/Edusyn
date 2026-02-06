import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingDown,
  Search,
  Plus,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
} from 'lucide-react'

interface Expense {
  id: string
  category: { id: string; name: string }
  provider?: { id: string; name: string }
  description: string
  amount: number
  expenseDate: string
  invoiceNumber?: string
  paymentMethod?: string
  approvedAt?: string
  voidedAt?: string
  registeredBy: { firstName: string; lastName: string }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Expenses() {
  const token = localStorage.getItem('token')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false)

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/finance/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setExpenses(data)
      }
    } catch (err) {
      console.error('Error fetching expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [token])

  const filteredExpenses = expenses.filter(e => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      e.description.toLowerCase().includes(searchLower) ||
      e.category.name.toLowerCase().includes(searchLower) ||
      e.provider?.name.toLowerCase().includes(searchLower) ||
      e.invoiceNumber?.toLowerCase().includes(searchLower)
    )
  })

  const monthTotal = expenses
    .filter(e => {
      const expDate = new Date(e.expenseDate)
      const now = new Date()
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + Number(e.amount), 0)

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
              <div className="p-3 bg-red-100 rounded-xl">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Egresos</h1>
                <p className="text-gray-500">Gastos y pagos a proveedores</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-red-100 rounded-lg">
                <p className="text-xs text-red-600">Egresos del Mes</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(monthTotal)}</p>
              </div>
              <button
                onClick={() => setShowNewExpenseModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Registrar Egreso
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descripción, categoría, proveedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={fetchExpenses}
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
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <TrendingDown className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay egresos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(expense.expenseDate).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{expense.description}</div>
                        <div className="text-xs text-gray-500">
                          Por: {expense.registeredBy.firstName} {expense.registeredBy.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {expense.category.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {expense.provider?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {expense.invoiceNumber || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        {formatCurrency(Number(expense.amount))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {expense.voidedAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            <XCircle className="w-3 h-3" />
                            Anulado
                          </span>
                        ) : expense.approvedAt ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Aprobado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Expense Modal - Placeholder */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Registrar Egreso</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar categoría...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Seleccionar proveedor...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Descripción del gasto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Factura (opcional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Número de factura"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewExpenseModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                Registrar Egreso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
