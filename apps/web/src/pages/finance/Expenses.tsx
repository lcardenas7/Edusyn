import { useState, useEffect } from 'react'
import { toast } from '../../lib/toast'
import { confirmDialog } from '../../components/ui/confirm'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingDown,
  Search,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  Building,
  UserPlus,
} from 'lucide-react'
import { financeExpensesApi, financeCategoriesApi, financeThirdPartiesApi } from '../../lib/api'

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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false)

  // Modal state
  const [expenseCategories, setExpenseCategories] = useState<any[]>([])
  const [providers, setProviders] = useState<any[]>([])
  const [loadingModal, setLoadingModal] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)
  const [providerSearch, setProviderSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [showQuickProvider, setShowQuickProvider] = useState(false)
  const [quickProviderName, setQuickProviderName] = useState('')
  const [quickProviderDoc, setQuickProviderDoc] = useState('')
  const [savingProvider, setSavingProvider] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    description: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    paymentMethod: 'CASH',
    notes: '',
  })

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const response = await financeExpensesApi.getAll()
      const result = response.data
      setExpenses(Array.isArray(result) ? result : result.data || [])
    } catch (err) {
      console.error('Error fetching expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  const filteredExpenses = expenses.filter(e => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      e.description.toLowerCase().includes(searchLower) ||
      e.category.name.toLowerCase().includes(searchLower) ||
      (e.provider?.name || '').toLowerCase().includes(searchLower) ||
      (e.invoiceNumber || '').toLowerCase().includes(searchLower)
    )
  })

  const monthTotal = expenses
    .filter(e => {
      const expDate = new Date(e.expenseDate)
      const now = new Date()
      return !e.voidedAt && expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const openExpenseModal = async () => {
    setShowNewExpenseModal(true)
    setLoadingModal(true)
    setExpenseForm({ categoryId: '', description: '', amount: '', expenseDate: new Date().toISOString().split('T')[0], invoiceNumber: '', paymentMethod: 'CASH', notes: '' })
    setSelectedProvider(null)
    setProviderSearch('')
    setShowQuickProvider(false)
    try {
      const [catRes, provRes] = await Promise.all([
        financeCategoriesApi.getAll('EXPENSE'),
        financeThirdPartiesApi.getAll({ type: 'PROVIDER' }),
      ])
      setExpenseCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data.data || [])
      const provData = Array.isArray(provRes.data) ? provRes.data : provRes.data.data || []
      setProviders(provData)
    } catch (err) {
      console.error('Error loading expense modal data:', err)
    } finally {
      setLoadingModal(false)
    }
  }

  const handleSubmitExpense = async () => {
    if (!expenseForm.categoryId || !expenseForm.description.trim() || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast.warning('Categoría, descripción y monto son requeridos')
      return
    }
    setSavingExpense(true)
    try {
      await financeExpensesApi.create({
        categoryId: expenseForm.categoryId,
        providerId: selectedProvider?.id || undefined,
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate || undefined,
        invoiceNumber: expenseForm.invoiceNumber.trim() || undefined,
        paymentMethod: expenseForm.paymentMethod || undefined,
        notes: expenseForm.notes.trim() || undefined,
      })
      setShowNewExpenseModal(false)
      fetchExpenses()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al registrar egreso')
    } finally {
      setSavingExpense(false)
    }
  }

  const handleQuickCreateProvider = async () => {
    if (!quickProviderName.trim()) return
    setSavingProvider(true)
    try {
      const res = await financeThirdPartiesApi.create({
        type: 'PROVIDER',
        name: quickProviderName.trim(),
        document: quickProviderDoc.trim() || undefined,
      })
      const newProvider = res.data
      setProviders(prev => [...prev, newProvider])
      setSelectedProvider(newProvider)
      setShowQuickProvider(false)
      setQuickProviderName('')
      setQuickProviderDoc('')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear proveedor')
    } finally {
      setSavingProvider(false)
    }
  }

  const filteredProviders = providerSearch.trim()
    ? providers.filter((p: any) => {
        const s = providerSearch.toLowerCase()
        return (p.name || '').toLowerCase().includes(s) || (p.document || '').toLowerCase().includes(s)
      })
    : providers

  const handleApproveExpense = async (id: string) => {
    if (!(await confirmDialog('¿Aprobar este egreso?', { danger: true }))) return
    try {
      await financeExpensesApi.approve(id)
      await fetchExpenses()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al aprobar egreso')
    }
  }

  const handleVoidExpense = async (id: string) => {
    const reason = prompt('Motivo de anulación:')
    if (!reason) return
    try {
      await financeExpensesApi.void(id, reason)
      await fetchExpenses()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al anular egreso')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Egresos</h1>
                <p className="text-gray-500">Gastos y pagos a proveedores</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="px-4 py-2 bg-red-100 rounded-lg">
                <p className="text-xs text-red-600">Egresos del Mes</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(monthTotal)}</p>
              </div>
              <button
                onClick={openExpenseModal}
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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
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
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!expense.approvedAt && !expense.voidedAt && (
                            <button
                              onClick={() => handleApproveExpense(expense.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Aprobar"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {!expense.voidedAt && (
                            <button
                              onClick={() => handleVoidExpense(expense.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="Anular"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Expense Modal */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Registrar Egreso</h2>
                <button onClick={() => setShowNewExpenseModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {loadingModal ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-red-500 mx-auto" /></div>
              ) : (
                <div className="space-y-3">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Categoría *</label>
                    {expenseCategories.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        No hay categorías de egreso creadas. Ve a{' '}
                        <Link to="/finance/categories" className="font-semibold underline">Categorías</Link>{' '}
                        y crea al menos una categoría tipo <strong>Egreso</strong>.
                      </div>
                    ) : (
                      <select value={expenseForm.categoryId}
                        onChange={e => setExpenseForm(f => ({ ...f, categoryId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm">
                        <option value="">Seleccionar categoría...</option>
                        {expenseCategories.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción *</label>
                    <input type="text" value={expenseForm.description}
                      onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                      placeholder="Descripción del gasto" />
                  </div>

                  {/* Provider search */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor (opcional)</label>
                    {selectedProvider ? (
                      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-orange-500" />
                          <div>
                            <p className="text-sm font-semibold text-orange-900">{selectedProvider.name}</p>
                            {selectedProvider.document && <p className="text-xs text-orange-600">{selectedProvider.document}</p>}
                          </div>
                        </div>
                        <button onClick={() => { setSelectedProvider(null); setProviderSearch('') }}
                          className="text-xs text-orange-500 hover:text-orange-700 font-medium">Cambiar</button>
                      </div>
                    ) : (
                      <div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="text" value={providerSearch}
                            onChange={e => setProviderSearch(e.target.value)}
                            placeholder="Buscar proveedor por nombre o NIT..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm" />
                        </div>
                        {(providerSearch.trim() || providers.length > 0) && (
                          <div className="border border-gray-200 rounded-lg mt-1 max-h-32 overflow-y-auto divide-y divide-gray-100">
                            {filteredProviders.length === 0 ? (
                              <p className="text-xs text-gray-400 py-3 text-center">Sin resultados</p>
                            ) : filteredProviders.slice(0, 20).map((p: any) => (
                              <button key={p.id}
                                onClick={() => { setSelectedProvider(p); setProviderSearch('') }}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 transition-colors text-left">
                                <Building className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                  {p.document && <p className="text-xs text-gray-400">{p.document}</p>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Quick create provider */}
                        {!showQuickProvider ? (
                          <button onClick={() => setShowQuickProvider(true)}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                            <UserPlus className="w-3.5 h-3.5" />
                            Crear proveedor nuevo
                          </button>
                        ) : (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                            <p className="text-xs font-semibold text-blue-800">Nuevo proveedor</p>
                            <input type="text" value={quickProviderName}
                              onChange={e => setQuickProviderName(e.target.value)}
                              placeholder="Nombre del proveedor *"
                              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                            <input type="text" value={quickProviderDoc}
                              onChange={e => setQuickProviderDoc(e.target.value)}
                              placeholder="NIT / Documento (opcional)"
                              className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                            <div className="flex gap-2">
                              <button onClick={() => { setShowQuickProvider(false); setQuickProviderName(''); setQuickProviderDoc('') }}
                                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                              <button onClick={handleQuickCreateProvider}
                                disabled={savingProvider || !quickProviderName.trim()}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
                                {savingProvider ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                Crear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount, Date, Payment Method */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                      <input type="number" value={expenseForm.amount}
                        onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                        placeholder="0" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                      <input type="date" value={expenseForm.expenseDate}
                        onChange={e => setExpenseForm(f => ({ ...f, expenseDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                      <select value={expenseForm.paymentMethod}
                        onChange={e => setExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm">
                        <option value="CASH">Efectivo</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                  </div>

                  {/* Invoice number */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">N° Factura (opcional)</label>
                    <input type="text" value={expenseForm.invoiceNumber}
                      onChange={e => setExpenseForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                      placeholder="Número de factura del proveedor" />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                    <input type="text" value={expenseForm.notes}
                      onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                      placeholder="Observaciones adicionales..." />
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowNewExpenseModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmitExpense}
                disabled={savingExpense || !expenseForm.categoryId || !expenseForm.description.trim() || !expenseForm.amount || Number(expenseForm.amount) <= 0}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 disabled:opacity-50 text-sm">
                {savingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                {savingExpense ? 'Registrando...' : 'Registrar Egreso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
