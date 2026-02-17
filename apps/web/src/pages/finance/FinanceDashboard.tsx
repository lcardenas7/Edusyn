import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  Users,
  FileText,
  Wallet,
  Receipt,
  PieChart,
  Settings,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react'
import { financeDashboardApi } from '../../lib/api'

interface DashboardData {
  summary: {
    monthlyIncome: number
    monthlyIncomeCount: number
    monthlyExpenses: number
    monthlyExpensesCount: number
    monthlyBalance: number
    yearlyIncome: number
    yearlyExpenses: number
    yearlyBalance: number
  }
  portfolio: {
    pending: { count: number; amount: number }
    partial: { count: number; amount: number }
    overdue: { count: number; amount: number }
    paid: { count: number; amount: number }
    totalPortfolio: number
  }
  recentPayments: any[]
  overdueObligations: any[]
  incomeByCategory: { name: string; amount: number; count: number }[]
  expenseByCategory: { name: string; amount: number; count: number }[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const financeNavItems = [
  { title: 'Terceros', description: 'Estudiantes, acudientes, proveedores', icon: <Users className="w-5 h-5" />, path: '/finance/third-parties', color: 'bg-purple-500' },
  { title: 'Conceptos de Cobro', description: 'Configurar conceptos y tarifas', icon: <FileText className="w-5 h-5" />, path: '/finance/concepts', color: 'bg-indigo-500' },
  { title: 'Obligaciones', description: 'Cobros asignados y cartera', icon: <DollarSign className="w-5 h-5" />, path: '/finance/obligations', color: 'bg-green-500' },
  { title: 'Caja / Recaudos', description: 'Registrar pagos y recibos', icon: <Wallet className="w-5 h-5" />, path: '/finance/payments', color: 'bg-emerald-500' },
  { title: 'Egresos', description: 'Gastos y pagos a proveedores', icon: <TrendingDown className="w-5 h-5" />, path: '/finance/expenses', color: 'bg-red-500' },
  { title: 'Facturas', description: 'Generar y gestionar facturas', icon: <Receipt className="w-5 h-5" />, path: '/finance/invoices', color: 'bg-orange-500' },
  { title: 'Categorías', description: 'Clasificación de ingresos y gastos', icon: <PieChart className="w-5 h-5" />, path: '/finance/categories', color: 'bg-cyan-500' },
  { title: 'Reportes', description: 'Informes y análisis financiero', icon: <BarChart3 className="w-5 h-5" />, path: '/finance/reports', color: 'bg-amber-500' },
  { title: 'Configuración', description: 'Numeración, mora, cuentas bancarias', icon: <Settings className="w-5 h-5" />, path: '/finance/settings', color: 'bg-gray-500' },
]

export default function FinanceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNav, setShowNav] = useState(false)

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const response = await financeDashboardApi.get()
      setData(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al cargar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver al inicio
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Módulo Financiero</h1>
                <p className="text-gray-500">Gestión de cobros, pagos, egresos y reportes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNav(!showNav)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                {showNav ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Panel Financiero
              </button>
              <button
                onClick={fetchDashboard}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Navigation Panel */}
        {showNav && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {financeNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${item.color} text-white group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate hidden lg:block">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ingresos del Mes</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data?.summary.monthlyIncome || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {data?.summary.monthlyIncomeCount || 0} pagos
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Egresos del Mes</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data?.summary.monthlyExpenses || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {data?.summary.monthlyExpensesCount || 0} gastos
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Balance del Mes</p>
                <p className={`text-2xl font-bold ${(data?.summary.monthlyBalance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(data?.summary.monthlyBalance || 0)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Cartera Total</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(data?.portfolio.totalPortfolio || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Por cobrar</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado de Cartera</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-700">Pendientes</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-700">{formatCurrency(Number(data?.portfolio.pending.amount) || 0)}</p>
                  <p className="text-xs text-yellow-600">{data?.portfolio.pending.count || 0} obligaciones</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-orange-700">Parciales</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-700">{formatCurrency(Number(data?.portfolio.partial.amount) || 0)}</p>
                  <p className="text-xs text-orange-600">{data?.portfolio.partial.count || 0} obligaciones</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700">Vencidas</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-700">{formatCurrency(Number(data?.portfolio.overdue.amount) || 0)}</p>
                  <p className="text-xs text-red-600">{data?.portfolio.overdue.count || 0} obligaciones</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">Pagadas</span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">{formatCurrency(Number(data?.portfolio.paid.amount) || 0)}</p>
                  <p className="text-xs text-green-600">{data?.portfolio.paid.count || 0} obligaciones</p>
                </div>
              </div>
            </div>
          </div>

          {/* Income by Category */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingresos por Categoría (Mes)</h2>
            {data?.incomeByCategory && data.incomeByCategory.length > 0 ? (
              <div className="space-y-3">
                {data.incomeByCategory.slice(0, 5).map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{cat.name}</span>
                    <div className="text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(cat.amount)}</span>
                      <span className="text-xs text-gray-400 ml-2">({cat.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin datos para este mes</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Últimos Pagos</h2>
              <Link to="/finance/payments" className="text-sm text-blue-600 hover:text-blue-700">
                Ver todos
              </Link>
            </div>
            {data?.recentPayments && data.recentPayments.length > 0 ? (
              <div className="space-y-3">
                {data.recentPayments.slice(0, 5).map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{payment.thirdParty?.name}</p>
                      <p className="text-xs text-gray-500">
                        {payment.obligation?.concept?.name || 'Pago general'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(Number(payment.amount))}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(payment.paymentDate).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin pagos recientes</p>
            )}
          </div>

          {/* Overdue Obligations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Obligaciones Vencidas</h2>
              <Link to="/finance/obligations?status=OVERDUE" className="text-sm text-blue-600 hover:text-blue-700">
                Ver todas
              </Link>
            </div>
            {data?.overdueObligations && data.overdueObligations.length > 0 ? (
              <div className="space-y-3">
                {data.overdueObligations.slice(0, 5).map((obl: any) => (
                  <div key={obl.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{obl.thirdParty?.name}</p>
                      <p className="text-xs text-gray-500">{obl.concept?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{formatCurrency(Number(obl.balance))}</p>
                      <p className="text-xs text-red-400">
                        Vencido: {new Date(obl.dueDate).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Sin obligaciones vencidas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
