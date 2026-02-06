import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  Users,
  FileText,
  CreditCard,
  TrendingDown,
  Receipt,
  PieChart,
  Settings,
  BarChart3,
  Wallet,
  ArrowLeft,
} from 'lucide-react'
import { financeDashboardApi } from '../../lib/api'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

interface FinanceCard {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  color: string
  badge?: string
}

const financeCards: FinanceCard[] = [
  {
    title: 'Dashboard',
    description: 'Resumen financiero, KPIs y gráficos',
    icon: <BarChart3 className="w-6 h-6" />,
    path: '/finance/dashboard',
    color: 'bg-blue-500',
  },
  {
    title: 'Terceros',
    description: 'Estudiantes, acudientes, proveedores',
    icon: <Users className="w-6 h-6" />,
    path: '/finance/third-parties',
    color: 'bg-purple-500',
  },
  {
    title: 'Conceptos de Cobro',
    description: 'Configurar conceptos y tarifas',
    icon: <FileText className="w-6 h-6" />,
    path: '/finance/concepts',
    color: 'bg-indigo-500',
  },
  {
    title: 'Obligaciones',
    description: 'Cobros asignados y cartera',
    icon: <DollarSign className="w-6 h-6" />,
    path: '/finance/obligations',
    color: 'bg-green-500',
  },
  {
    title: 'Caja / Recaudos',
    description: 'Registrar pagos y recibos',
    icon: <Wallet className="w-6 h-6" />,
    path: '/finance/payments',
    color: 'bg-emerald-500',
  },
  {
    title: 'Egresos',
    description: 'Gastos y pagos a proveedores',
    icon: <TrendingDown className="w-6 h-6" />,
    path: '/finance/expenses',
    color: 'bg-red-500',
  },
  {
    title: 'Facturas',
    description: 'Generar y gestionar facturas',
    icon: <Receipt className="w-6 h-6" />,
    path: '/finance/invoices',
    color: 'bg-orange-500',
  },
  {
    title: 'Categorías',
    description: 'Clasificación de ingresos y gastos',
    icon: <PieChart className="w-6 h-6" />,
    path: '/finance/categories',
    color: 'bg-cyan-500',
  },
  {
    title: 'Reportes',
    description: 'Informes y análisis financiero',
    icon: <CreditCard className="w-6 h-6" />,
    path: '/finance/reports',
    color: 'bg-amber-500',
  },
  {
    title: 'Configuración',
    description: 'Numeración, mora, cuentas bancarias',
    icon: <Settings className="w-6 h-6" />,
    path: '/finance/settings',
    color: 'bg-gray-500',
  },
]

export default function FinanceHub() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    financeDashboardApi.get()
      .then(res => setStats(res.data))
      .catch(() => {})
  }, [])

  const pendingCount = stats?.portfolio?.pending?.count ?? '--'
  const overdueCount = stats?.portfolio?.overdue?.count ?? '--'
  const monthlyIncome = stats?.summary?.monthlyIncome
  const monthlyExpenses = stats?.summary?.monthlyExpenses

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Módulo Financiero
              </h1>
              <p className="text-gray-500">
                Gestión de cobros, pagos, egresos y reportes financieros
              </p>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {financeCards.map((card) => (
            <Link
              key={card.path}
              to={card.path}
              className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${card.color} text-white group-hover:scale-110 transition-transform`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {card.title}
                    </h3>
                    {card.badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Stats Preview */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Acceso Rápido
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/finance/obligations?status=PENDING"
              className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <p className="text-sm text-yellow-600 font-medium">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
            </Link>
            <Link
              to="/finance/obligations?status=OVERDUE"
              className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <p className="text-sm text-red-600 font-medium">Vencidas</p>
              <p className="text-2xl font-bold text-red-700">{overdueCount}</p>
            </Link>
            <Link
              to="/finance/payments"
              className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <p className="text-sm text-green-600 font-medium">Ingresos Mes</p>
              <p className="text-2xl font-bold text-green-700">
                {monthlyIncome != null ? formatCurrency(Number(monthlyIncome)) : '$--'}
              </p>
            </Link>
            <Link
              to="/finance/expenses"
              className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <p className="text-sm text-blue-600 font-medium">Egresos Mes</p>
              <p className="text-2xl font-bold text-blue-700">
                {monthlyExpenses != null ? formatCurrency(Number(monthlyExpenses)) : '$--'}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
