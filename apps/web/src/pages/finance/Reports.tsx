import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
} from 'lucide-react'
import { financeReportsApi } from '../../lib/api'

type ReportTab = 'portfolio' | 'debtors' | 'monthly' | 'profitability'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

export default function FinanceReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('portfolio')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [year, setYear] = useState(new Date().getFullYear())

  const fetchReport = async () => {
    setLoading(true)
    setData(null)
    try {
      let response
      switch (activeTab) {
        case 'portfolio':
          response = await financeReportsApi.getPortfolioByGrade()
          break
        case 'debtors':
          response = await financeReportsApi.getTopDebtors(20)
          break
        case 'monthly':
          response = await financeReportsApi.getMonthlyBalance(year)
          break
        case 'profitability':
          response = await financeReportsApi.getProfitabilityByConcept()
          break
      }
      setData(response.data)
    } catch (err) {
      console.error('Error fetching report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [activeTab, year])

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'portfolio', label: 'Cartera', icon: <DollarSign className="w-4 h-4" /> },
    { key: 'debtors', label: 'Morosos', icon: <Users className="w-4 h-4" /> },
    { key: 'monthly', label: 'Balance Mensual', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'profitability', label: 'Rentabilidad', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Finanzas
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reportes Financieros</h1>
              <p className="text-gray-500">Análisis e informes de la gestión financiera</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-6">
          <div className="flex flex-wrap gap-1">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
            {activeTab === 'monthly' && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">←</button>
                <span className="font-medium text-gray-700">{year}</span>
                <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">→</button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          </div>
        ) : !data ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            Sin datos disponibles
          </div>
        ) : (
          <>
            {/* Portfolio Report */}
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm text-gray-500">Terceros con deuda</p>
                    <p className="text-2xl font-bold text-gray-900">{data.totalThirdParties}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm text-gray-500">Obligaciones activas</p>
                    <p className="text-2xl font-bold text-gray-900">{data.totalObligations}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm text-gray-500">Total facturado</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(Number(data.totalCharged))}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <p className="text-sm text-gray-500">Cartera pendiente</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(Number(data.totalPortfolio))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Debtors Report */}
            {activeTab === 'debtors' && Array.isArray(data) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Tercero</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.map((item: any, idx: number) => (
                      <tr key={item.thirdPartyId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-mono text-sm">{item.thirdPartyId}</td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">
                          {formatCurrency(Number(item._sum?.balance || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length === 0 && <p className="p-8 text-center text-gray-500">No hay morosos</p>}
              </div>
            )}

            {/* Monthly Balance */}
            {activeTab === 'monthly' && Array.isArray(data) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Egresos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.map((item: any) => (
                      <tr key={item.month} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{monthNames[item.month - 1]}</td>
                        <td className="px-6 py-4 text-right text-green-600">
                          <span className="inline-flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {formatCurrency(Number(item.income))}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-red-600">
                          <span className="inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {formatCurrency(Number(item.expense))}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${Number(item.balance) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(Number(item.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-6 py-3 font-bold text-gray-900">Total</td>
                      <td className="px-6 py-3 text-right font-bold text-green-600">
                        {formatCurrency(data.reduce((s: number, i: any) => s + Number(i.income), 0))}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-red-600">
                        {formatCurrency(data.reduce((s: number, i: any) => s + Number(i.expense), 0))}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-blue-600">
                        {formatCurrency(data.reduce((s: number, i: any) => s + Number(i.balance), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Profitability Report */}
            {activeTab === 'profitability' && Array.isArray(data) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obligaciones</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recaudado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gastos</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.map((item: any) => (
                      <tr key={item.conceptId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{item.conceptName}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{item.categoryName}</span>
                        </td>
                        <td className="px-6 py-4 text-center">{item.obligationCount}</td>
                        <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(Number(item.totalCharged))}</td>
                        <td className="px-6 py-4 text-right text-green-600">{formatCurrency(Number(item.totalCollected))}</td>
                        <td className="px-6 py-4 text-right text-red-600">{formatCurrency(Number(item.totalExpenses))}</td>
                        <td className={`px-6 py-4 text-right font-bold ${Number(item.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Number(item.profit))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length === 0 && <p className="p-8 text-center text-gray-500">Sin datos de rentabilidad</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
