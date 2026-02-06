import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Receipt,
  Plus,
  RefreshCw,
  Filter,
  FileDown,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from 'lucide-react'
import { financeInvoicesApi } from '../../lib/api'

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'
type InvoiceType = 'INCOME' | 'EXPENSE'

interface Invoice {
  id: string
  invoiceNumber: string
  type: InvoiceType
  status: InvoiceStatus
  thirdParty: { id: string; name: string }
  subtotal: number
  total: number
  issueDate: string
  dueDate?: string
  createdBy: { firstName: string; lastName: string }
  items: any[]
}

const statusConfig: Record<InvoiceStatus, { label: string; icon: React.ReactNode; color: string }> = {
  DRAFT: { label: 'Borrador', icon: <Clock className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  ISSUED: { label: 'Emitida', icon: <Send className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Pagada', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Anulada', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<InvoiceType | ''>('')

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter
      const response = await financeInvoicesApi.getAll(params)
      setInvoices(response.data)
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoices() }, [statusFilter, typeFilter])

  const handleIssue = async (id: string) => {
    if (!confirm('¿Emitir esta factura? Una vez emitida no se puede editar.')) return
    try {
      await financeInvoicesApi.issue(id)
      fetchInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al emitir')
    }
  }

  const handleCancel = async (id: string) => {
    const reason = prompt('Motivo de anulación:')
    if (!reason) return
    try {
      await financeInvoicesApi.cancel(id, reason)
      fetchInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al anular')
    }
  }

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      const response = await financeInvoicesApi.downloadPdf(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `factura-${invoiceNumber}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error al descargar PDF')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Receipt className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
                <p className="text-gray-500">Gestión de facturas y comprobantes</p>
              </div>
            </div>
            <Link to="/finance/invoices/new"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva Factura
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as InvoiceStatus | '')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="ISSUED">Emitida</option>
                <option value="PAID">Pagada</option>
                <option value="CANCELLED">Anulada</option>
              </select>
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as InvoiceType | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="">Todos los tipos</option>
              <option value="INCOME">Venta</option>
              <option value="EXPENSE">Compra</option>
            </select>
            <button onClick={fetchInvoices} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay facturas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Factura</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tercero</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map(inv => {
                    const config = statusConfig[inv.status]
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-900">{inv.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {inv.type === 'INCOME' ? 'Venta' : 'Compra'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{inv.thirdParty.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(inv.issueDate).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(Number(inv.total))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                            {config.icon} {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {inv.status === 'DRAFT' && (
                              <button onClick={() => handleIssue(inv.id)} title="Emitir"
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {(inv.status === 'ISSUED' || inv.status === 'PAID') && (
                              <button onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)} title="Descargar PDF"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                                <FileDown className="w-4 h-4" />
                              </button>
                            )}
                            {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && (
                              <button onClick={() => handleCancel(inv.id)} title="Anular"
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
    </div>
  )
}
