import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  RefreshCw,
  DollarSign,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { financeThirdPartiesApi } from '../../lib/api'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

const typeLabels: Record<string, string> = {
  STUDENT: 'Estudiante',
  TEACHER: 'Docente',
  GUARDIAN: 'Acudiente',
  EXTERNAL: 'Externo',
  PROVIDER: 'Proveedor',
}

export default function ThirdPartyDetail() {
  const { id } = useParams<{ id: string }>()
  const [thirdParty, setThirdParty] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const [tpRes, sumRes] = await Promise.all([
          financeThirdPartiesApi.getById(id),
          financeThirdPartiesApi.getSummary(id),
        ])
        setThirdParty(tpRes.data)
        setSummary(sumRes.data)
      } catch (err) {
        console.error('Error loading third party:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!thirdParty) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Tercero no encontrado</p>
          <Link to="/finance/third-parties" className="text-blue-500 hover:underline mt-2 inline-block">Volver</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to="/finance/third-parties" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Terceros
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{thirdParty.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  {typeLabels[thirdParty.type] || thirdParty.type}
                </span>
                {!thirdParty.isActive && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Inactivo</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {thirdParty.document && (
              <div>
                <span className="text-gray-500">Documento:</span>
                <span className="ml-2 font-medium text-gray-900">{thirdParty.documentType || ''} {thirdParty.document}</span>
              </div>
            )}
            {thirdParty.email && (
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 text-gray-700">{thirdParty.email}</span>
              </div>
            )}
            {thirdParty.phone && (
              <div>
                <span className="text-gray-500">Teléfono:</span>
                <span className="ml-2 text-gray-700">{thirdParty.phone}</span>
              </div>
            )}
            {thirdParty.address && (
              <div>
                <span className="text-gray-500">Dirección:</span>
                <span className="ml-2 text-gray-700">{thirdParty.address}</span>
              </div>
            )}
            {thirdParty.businessName && (
              <div>
                <span className="text-gray-500">Razón Social:</span>
                <span className="ml-2 text-gray-700">{thirdParty.businessName}</span>
              </div>
            )}
            {thirdParty.nit && (
              <div>
                <span className="text-gray-500">NIT:</span>
                <span className="ml-2 text-gray-700">{thirdParty.nit}</span>
              </div>
            )}
            {thirdParty.notes && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Notas:</span>
                <span className="ml-2 text-gray-700">{thirdParty.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total Cobrado</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(Number(summary.totalCharged || 0))}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Total Pagado</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(Number(summary.totalPaid || 0))}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Saldo Pendiente</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(Number(summary.totalBalance || 0))}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Obligaciones</p>
                <p className="text-lg font-bold text-gray-900">{summary.obligationCount || 0}</p>
              </div>
            </div>

            {/* Obligations List */}
            {summary.obligations && summary.obligations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Obligaciones</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {summary.obligations.map((obl: any) => {
                        const statusIcons: Record<string, React.ReactNode> = {
                          PENDING: <Clock className="w-3 h-3" />,
                          PARTIAL: <AlertTriangle className="w-3 h-3" />,
                          PAID: <CheckCircle className="w-3 h-3" />,
                          CANCELLED: <XCircle className="w-3 h-3" />,
                          OVERDUE: <AlertTriangle className="w-3 h-3" />,
                        }
                        const statusColors: Record<string, string> = {
                          PENDING: 'bg-yellow-100 text-yellow-700',
                          PARTIAL: 'bg-orange-100 text-orange-700',
                          PAID: 'bg-green-100 text-green-700',
                          CANCELLED: 'bg-gray-100 text-gray-700',
                          OVERDUE: 'bg-red-100 text-red-700',
                        }
                        return (
                          <tr key={obl.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <Link to={`/finance/obligations/${obl.id}`} className="font-mono text-sm text-blue-600 hover:underline">
                                {obl.reference || obl.id.slice(0, 8)}
                              </Link>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900">{obl.concept?.name}</td>
                            <td className="px-6 py-3 text-right text-sm">{formatCurrency(Number(obl.totalAmount))}</td>
                            <td className="px-6 py-3 text-right text-sm font-bold">{formatCurrency(Number(obl.balance))}</td>
                            <td className="px-6 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[obl.status] || ''}`}>
                                {statusIcons[obl.status]} {obl.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments List */}
            {summary.payments && summary.payments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Pagos Realizados</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recibo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Método</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {summary.payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-mono text-sm text-blue-600">{p.receiptNumber || p.id.slice(0, 8)}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">
                            {new Date(p.paymentDate).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-6 py-3 text-center text-sm text-gray-600">{p.paymentMethod}</td>
                          <td className="px-6 py-3 text-right font-bold text-green-600">{formatCurrency(Number(p.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
