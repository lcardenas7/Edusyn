import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CreditCard,
  FileText,
} from 'lucide-react'
import { financeObligationsApi, financePaymentsApi } from '../../lib/api'

type ObligationStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'OVERDUE'

const statusConfig: Record<ObligationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: 'Pendiente', icon: <Clock className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL: { label: 'Parcial', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  PAID: { label: 'Pagado', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', icon: <XCircle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  OVERDUE: { label: 'Vencido', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

export default function ObligationDetail() {
  const { id } = useParams<{ id: string }>()
  const [obligation, setObligation] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const [oblRes, payRes] = await Promise.all([
          financeObligationsApi.getById(id),
          financePaymentsApi.getAll({ obligationId: id }),
        ])
        setObligation(oblRes.data)
        setPayments(payRes.data)
      } catch (err) {
        console.error('Error loading obligation:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    )
  }

  if (!obligation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Obligación no encontrada</p>
          <Link to="/finance/obligations" className="text-blue-500 hover:underline mt-2 inline-block">Volver</Link>
        </div>
      </div>
    )
  }

  const config = statusConfig[obligation.status as ObligationStatus] || statusConfig.PENDING
  const progressPercent = Number(obligation.totalAmount) > 0
    ? Math.min(100, (Number(obligation.paidAmount) / Number(obligation.totalAmount)) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to="/finance/obligations" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Obligaciones
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Obligación {obligation.reference || obligation.id.slice(0, 8)}
                </h1>
                <p className="text-gray-500">{obligation.concept?.name}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
              {config.icon} {config.label}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Monto Original</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(Number(obligation.originalAmount))}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Descuento</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(Number(obligation.discountAmount))}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total a Pagar</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(Number(obligation.totalAmount))}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Saldo Pendiente</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(Number(obligation.balance))}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Progreso de pago</span>
            <span className="font-medium text-gray-700">{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${progressPercent >= 100 ? 'bg-green-500' : progressPercent > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
              style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Pagado: {formatCurrency(Number(obligation.paidAmount))}</span>
            <span>Total: {formatCurrency(Number(obligation.totalAmount))}</span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Tercero:</span>
              <Link to={`/finance/third-parties/${obligation.thirdParty?.id}`} className="ml-2 font-medium text-blue-600 hover:underline">
                {obligation.thirdParty?.name}
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Concepto:</span>
              <span className="ml-2 font-medium text-gray-900">{obligation.concept?.name}</span>
            </div>
            {obligation.concept?.category && (
              <div>
                <span className="text-gray-500">Categoría:</span>
                <span className="ml-2 text-gray-700">{obligation.concept.category.name}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Fecha emisión:</span>
              <span className="ml-2 text-gray-700">{new Date(obligation.issueDate).toLocaleDateString('es-CO')}</span>
            </div>
            {obligation.dueDate && (
              <div>
                <span className="text-gray-500">Vencimiento:</span>
                <span className="ml-2 text-gray-700">{new Date(obligation.dueDate).toLocaleDateString('es-CO')}</span>
              </div>
            )}
            {obligation.discountReason && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Motivo descuento:</span>
                <span className="ml-2 text-gray-700">{obligation.discountReason}</span>
              </div>
            )}
            {obligation.notes && (
              <div className="md:col-span-2">
                <span className="text-gray-500">Notas:</span>
                <span className="ml-2 text-gray-700">{obligation.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payments History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-500" /> Pagos Asociados
            </h2>
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No hay pagos registrados para esta obligación</p>
            </div>
          ) : (
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
                  {payments.map((p: any) => (
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
          )}
        </div>
      </div>
    </div>
  )
}
