import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Wallet,
  Search,
  Plus,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  XCircle,
  FileDown,
  Loader2,
  Eye,
  X,
  Receipt,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { financePaymentsApi, financeThirdPartiesApi, financeObligationsApi, financeConceptsApi, academicGradesApi, groupsApi } from '../../lib/api'

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'PSE' | 'NEQUI' | 'DAVIPLATA' | 'OTHER'
type MainTab = 'pending' | 'history'

interface Payment {
  id: string
  thirdParty: { id: string; name: string }
  obligation?: { id: string; concept: { name: string } }
  amount: number
  paymentMethod: PaymentMethod
  receiptNumber?: string
  paymentDate: string
  receivedBy: { firstName: string; lastName: string }
  voidedAt?: string
}

interface Obligation {
  id: string
  reference?: string
  thirdParty: { id: string; name: string; document?: string; type?: string }
  concept: { name: string; category?: { name: string } }
  totalAmount: number
  paidAmount: number
  balance: number
  dueDate?: string
  status: string
  studentGroup?: string
  studentGrade?: string
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

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-600 bg-yellow-50' },
  PARTIAL: { label: 'Parcial', color: 'text-blue-600 bg-blue-50' },
  OVERDUE: { label: 'Vencida', color: 'text-red-600 bg-red-50' },
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Payments() {
  const [mainTab, setMainTab] = useState<MainTab>('pending')

  // ═══ PENDING OBLIGATIONS STATE ═══
  const [pendingObligations, setPendingObligations] = useState<Obligation[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [pendingSearch, setPendingSearch] = useState('')
  const [debouncedPendingSearch, setDebouncedPendingSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [conceptFilter, setConceptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pendingPage, setPendingPage] = useState(1)
  const [pendingTotal, setPendingTotal] = useState(0)

  // ═══ HISTORY STATE ═══
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('')

  // ═══ FILTER OPTIONS ═══
  const [filterGrades, setFilterGrades] = useState<any[]>([])
  const [filterGroups, setFilterGroups] = useState<any[]>([])
  const [filterConcepts, setFilterConcepts] = useState<any[]>([])
  const filtersLoaded = useRef(false)

  // ═══ PAYMENT MODAL STATE ═══
  const [showPayModal, setShowPayModal] = useState(false)
  const [payingObligation, setPayingObligation] = useState<Obligation | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'CASH' as PaymentMethod,
    transactionRef: '',
    notes: '',
  })

  // ═══ GENERAL PAYMENT MODAL STATE ═══
  const [showGeneralModal, setShowGeneralModal] = useState(false)
  const [allThirdParties, setAllThirdParties] = useState<any[]>([])
  const [loadingGeneralModal, setLoadingGeneralModal] = useState(false)
  const [generalForm, setGeneralForm] = useState({
    thirdPartyId: '',
    amount: '',
    paymentMethod: 'CASH' as PaymentMethod,
    transactionRef: '',
    notes: '',
  })

  // ═══ PDF PREVIEW ═══
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')

  // ═══ DEBOUNCE ═══
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPendingSearch(pendingSearch), 400)
    return () => clearTimeout(t)
  }, [pendingSearch])

  // ═══ LOAD FILTER OPTIONS ═══
  useEffect(() => {
    if (filtersLoaded.current) return
    filtersLoaded.current = true
    Promise.all([
      academicGradesApi.getActive(),
      groupsApi.getAll(),
      financeConceptsApi.getAll({ isActive: 'true' }),
    ]).then(([gRes, grRes, cRes]) => {
      setFilterGrades(Array.isArray(gRes.data) ? gRes.data : gRes.data.data || [])
      setFilterGroups(Array.isArray(grRes.data) ? grRes.data : grRes.data.data || [])
      setFilterConcepts(Array.isArray(cRes.data) ? cRes.data : cRes.data.data || [])
    }).catch(err => console.error('Error loading filters:', err))
  }, [])

  // ═══ FETCH PENDING OBLIGATIONS ═══
  const fetchPendingObligations = useCallback(async (page = pendingPage) => {
    setLoadingPending(true)
    try {
      const params: any = { page, limit: 25 }
      if (statusFilter) params.status = statusFilter
      if (gradeFilter) params.gradeId = gradeFilter
      if (groupFilter) params.groupId = groupFilter
      if (conceptFilter) params.conceptId = conceptFilter
      if (debouncedPendingSearch) params.search = debouncedPendingSearch
      const res = await financeObligationsApi.getAll(params)
      const result = res.data
      const items = Array.isArray(result) ? result : result.data || []
      // Only show obligations with balance > 0
      setPendingObligations(items.filter((o: any) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(o.status)))
      setPendingTotal(result.meta?.total || result.total || items.length)
    } catch (err) {
      console.error('Error fetching pending obligations:', err)
    } finally {
      setLoadingPending(false)
    }
  }, [gradeFilter, groupFilter, conceptFilter, statusFilter, debouncedPendingSearch, pendingPage])

  useEffect(() => {
    if (mainTab === 'pending') fetchPendingObligations()
  }, [mainTab, gradeFilter, groupFilter, conceptFilter, statusFilter, debouncedPendingSearch, pendingPage])

  // ═══ FETCH PAYMENT HISTORY ═══
  const fetchPayments = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const params: any = {}
      if (methodFilter) params.paymentMethod = methodFilter
      const response = await financePaymentsApi.getAll(params)
      const result = response.data
      setPayments(Array.isArray(result) ? result : result.data || [])
    } catch (err) {
      console.error('Error fetching payments:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [methodFilter])

  useEffect(() => {
    if (mainTab === 'history') fetchPayments()
  }, [mainTab, methodFilter])

  // ═══ OPEN PAY MODAL (from obligation row) ═══
  const openPayModal = (obl: Obligation) => {
    setPayingObligation(obl)
    setPaymentForm({
      amount: String(Number(obl.balance)),
      paymentMethod: 'CASH',
      transactionRef: '',
      notes: '',
    })
    setShowPayModal(true)
  }

  // ═══ SUBMIT OBLIGATION PAYMENT ═══
  const handleSubmitPayment = async () => {
    if (!payingObligation || !paymentForm.amount || Number(paymentForm.amount) <= 0) return
    setSavingPayment(true)
    try {
      await financePaymentsApi.create({
        thirdPartyId: payingObligation.thirdParty.id,
        obligationId: payingObligation.id,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionRef: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
      })
      setShowPayModal(false)
      setPayingObligation(null)
      fetchPendingObligations()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al registrar pago')
    } finally {
      setSavingPayment(false)
    }
  }

  // ═══ OPEN GENERAL PAYMENT MODAL ═══
  const openGeneralModal = async () => {
    setShowGeneralModal(true)
    setLoadingGeneralModal(true)
    setGeneralForm({ thirdPartyId: '', amount: '', paymentMethod: 'CASH', transactionRef: '', notes: '' })
    try {
      const res = await financeThirdPartiesApi.getAll({ isActive: 'true' })
      setAllThirdParties(Array.isArray(res.data) ? res.data : res.data.data || [])
    } catch (err) {
      console.error('Error loading third parties:', err)
    } finally {
      setLoadingGeneralModal(false)
    }
  }

  // ═══ SUBMIT GENERAL PAYMENT ═══
  const handleSubmitGeneralPayment = async () => {
    if (!generalForm.thirdPartyId || !generalForm.amount || Number(generalForm.amount) <= 0) {
      alert('Tercero y monto son requeridos')
      return
    }
    setSavingPayment(true)
    try {
      await financePaymentsApi.create({
        thirdPartyId: generalForm.thirdPartyId,
        amount: Number(generalForm.amount),
        paymentMethod: generalForm.paymentMethod,
        transactionRef: generalForm.transactionRef || undefined,
        notes: generalForm.notes || undefined,
      })
      setShowGeneralModal(false)
      if (mainTab === 'history') fetchPayments()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al registrar pago')
    } finally {
      setSavingPayment(false)
    }
  }

  // ═══ VOID PAYMENT ═══
  const handleVoidPayment = async (id: string) => {
    const reason = prompt('Motivo de anulación:')
    if (!reason) return
    try {
      await financePaymentsApi.void(id, reason)
      fetchPayments()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al anular pago')
    }
  }

  // ═══ RECEIPT HANDLERS ═══
  const handleDownloadReceipt = async (id: string, receiptNumber?: string) => {
    try {
      const response = await financePaymentsApi.downloadReceipt(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `recibo-${receiptNumber || id.slice(0, 8)}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error al descargar recibo')
    }
  }

  const handlePreviewReceipt = async (id: string, receiptNumber?: string) => {
    try {
      const response = await financePaymentsApi.downloadReceipt(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewTitle(`Recibo ${receiptNumber || id.slice(0, 8)}`)
    } catch (err: any) {
      alert('Error al generar vista previa')
    }
  }

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setPreviewTitle('')
  }

  // ═══ DERIVED DATA ═══
  const filteredPayments = payments.filter(p => {
    if (!historySearch) return true
    const s = historySearch.toLowerCase()
    return (
      p.thirdParty.name.toLowerCase().includes(s) ||
      p.receiptNumber?.toLowerCase().includes(s) ||
      p.obligation?.concept.name.toLowerCase().includes(s)
    )
  })

  const todayTotal = payments
    .filter(p => new Date(p.paymentDate).toDateString() === new Date().toDateString())
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const filteredGroups = gradeFilter
    ? filterGroups.filter((g: any) => g.gradeId === gradeFilter || g.grade?.id === gradeFilter)
    : filterGroups

  const totalPages = Math.ceil(pendingTotal / 25)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caja / Recaudos</h1>
                <p className="text-gray-500">Gestión de cobros y recibos</p>
              </div>
            </div>
            <button onClick={openGeneralModal}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Pago General
            </button>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setMainTab('pending')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              mainTab === 'pending' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Receipt className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Pendientes de Cobro
          </button>
          <button onClick={() => setMainTab('history')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              mainTab === 'history' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Historial de Pagos
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB: PENDIENTES DE COBRO                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === 'pending' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Nombre, apellido o N° documento..."
                    value={pendingSearch} onChange={e => { setPendingSearch(e.target.value); setPendingPage(1) }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
                </div>
                <select value={gradeFilter}
                  onChange={e => { setGradeFilter(e.target.value); setGroupFilter(''); setPendingPage(1) }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos los grados</option>
                  {filterGrades.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select value={groupFilter}
                  onChange={e => { setGroupFilter(e.target.value); setPendingPage(1) }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos los grupos</option>
                  {filteredGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select value={conceptFilter}
                  onChange={e => { setConceptFilter(e.target.value); setPendingPage(1) }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos los conceptos</option>
                  {filterConcepts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPendingPage(1) }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos los estados</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="OVERDUE">Vencida</option>
                </select>
                <button onClick={() => fetchPendingObligations()}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Recargar">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Count */}
            <p className="text-sm text-gray-500 mb-3">
              Mostrando {Math.min(pendingObligations.length, 25)} de {pendingTotal} obligaciones pendientes
            </p>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingPending ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                </div>
              ) : pendingObligations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay obligaciones pendientes de cobro</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grupo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pagado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vence</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pendingObligations.map(obl => {
                        const st = statusConfig[obl.status] || { label: obl.status, color: 'text-gray-600 bg-gray-50' }
                        const isOverdue = obl.status === 'OVERDUE'
                        return (
                          <tr key={obl.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-blue-600">{obl.reference || obl.id.slice(0, 12)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 text-sm">{obl.thirdParty.name}</p>
                              {obl.thirdParty.document && <p className="text-xs text-gray-400">{obl.thirdParty.document}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {obl.studentGroup ? (
                                <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600">
                                  {obl.studentGrade ? `${obl.studentGrade} ` : ''}{obl.studentGroup}
                                </span>
                              ) : <span className="text-xs text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700">{obl.concept.name}</p>
                              {obl.concept.category?.name && <p className="text-xs text-gray-400">{obl.concept.category.name}</p>}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{formatCurrency(Number(obl.totalAmount))}</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-500">{formatCurrency(Number(obl.paidAmount))}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(Number(obl.balance))}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">
                              {obl.dueDate ? new Date(obl.dueDate).toLocaleDateString('es-CO') : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => openPayModal(obl)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-xs font-medium transition-colors">
                                <DollarSign className="w-3.5 h-3.5" />
                                Pagar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">Página {pendingPage} de {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage <= 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPendingPage(p => Math.min(totalPages, p + 1))} disabled={pendingPage >= totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* TAB: HISTORIAL DE PAGOS                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mainTab === 'history' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Buscar por tercero, recibo, concepto..."
                    value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm" />
                </div>
                <select value={methodFilter}
                  onChange={e => setMethodFilter(e.target.value as PaymentMethod | '')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Todos los métodos</option>
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="PSE">PSE</option>
                  <option value="NEQUI">Nequi</option>
                  <option value="DAVIPLATA">Daviplata</option>
                </select>
                <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-600">Recaudo Hoy</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(todayTotal)}</p>
                </div>
                <button onClick={() => fetchPayments()}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Recargar">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingHistory ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recibo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tercero</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Concepto</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Método</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recibido por</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPayments.map(payment => {
                        const method = methodConfig[payment.paymentMethod]
                        return (
                          <tr key={payment.id} className={`hover:bg-gray-50 ${payment.voidedAt ? 'opacity-50 line-through' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-blue-600">{payment.receiptNumber || payment.id.slice(0, 8)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(payment.paymentDate).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
                              <Link to={`/finance/third-parties/${payment.thirdParty.id}`}
                                className="font-medium text-sm text-gray-900 hover:text-blue-600">
                                {payment.thirdParty.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {payment.obligation?.concept.name || <span className="italic text-gray-400">Pago general</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${method.color}`}>
                                {method.icon} {method.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-green-600 text-sm">
                              {formatCurrency(Number(payment.amount))}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {payment.receivedBy.firstName} {payment.receivedBy.lastName}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handlePreviewReceipt(payment.id, payment.receiptNumber)} title="Vista Previa"
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDownloadReceipt(payment.id, payment.receiptNumber)} title="Descargar"
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                                  <FileDown className="w-4 h-4" />
                                </button>
                                {!payment.voidedAt && (
                                  <button onClick={() => handleVoidPayment(payment.id)} title="Anular"
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
          </>
        )}
      </div>

      {/* ═══ MODAL: PAGO A OBLIGACIÓN (small, focused) ═══ */}
      {showPayModal && payingObligation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Registrar Pago</h2>
                <button onClick={() => { setShowPayModal(false); setPayingObligation(null) }}
                  className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Obligation info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900 text-sm">{payingObligation.thirdParty.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{payingObligation.concept.name} · {payingObligation.reference || ''}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-gray-500">Saldo pendiente</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(Number(payingObligation.balance))}</span>
                </div>
              </div>

              {/* Payment form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Monto a pagar *</label>
                    <input type="number" value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="0" min="1" max={Number(payingObligation.balance)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                    <select value={paymentForm.paymentMethod}
                      onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm">
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="PSE">PSE</option>
                      <option value="NEQUI">Nequi</option>
                      <option value="DAVIPLATA">Daviplata</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                </div>
                {paymentForm.paymentMethod !== 'CASH' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                    <input type="text" value={paymentForm.transactionRef}
                      onChange={e => setPaymentForm(f => ({ ...f, transactionRef: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                      placeholder="N° transferencia, aprobación..." />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                  <input type="text" value={paymentForm.notes}
                    onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Observaciones opcionales..." />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowPayModal(false); setPayingObligation(null) }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmitPayment}
                disabled={savingPayment || !paymentForm.amount || Number(paymentForm.amount) <= 0}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2 disabled:opacity-50 text-sm">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                {savingPayment ? 'Registrando...' : 'Confirmar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: PAGO GENERAL (sin obligación) ═══ */}
      {showGeneralModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Pago General</h2>
                <button onClick={() => setShowGeneralModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mb-4">
                Registre ingresos sin obligación específica (uniformes, eventos, donaciones, etc.)
              </div>

              {loadingGeneralModal ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" /></div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tercero / Pagador *</label>
                    <select value={generalForm.thirdPartyId}
                      onChange={e => setGeneralForm(f => ({ ...f, thirdPartyId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm">
                      <option value="">Seleccionar tercero...</option>
                      {allThirdParties.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tp.name} {tp.document ? `(${tp.document})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                      <input type="number" value={generalForm.amount}
                        onChange={e => setGeneralForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="0" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                      <select value={generalForm.paymentMethod}
                        onChange={e => setGeneralForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm">
                        <option value="CASH">Efectivo</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="PSE">PSE</option>
                        <option value="NEQUI">Nequi</option>
                        <option value="DAVIPLATA">Daviplata</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                  </div>
                  {generalForm.paymentMethod !== 'CASH' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                      <input type="text" value={generalForm.transactionRef}
                        onChange={e => setGeneralForm(f => ({ ...f, transactionRef: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="N° transferencia, aprobación..." />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Concepto / Notas *</label>
                    <textarea value={generalForm.notes}
                      onChange={e => setGeneralForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                      rows={2} placeholder="Describa el concepto (ej: Venta de uniforme, Donación...)" />
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowGeneralModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmitGeneralPayment}
                disabled={savingPayment || !generalForm.thirdPartyId || !generalForm.amount || Number(generalForm.amount) <= 0}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 disabled:opacity-50 text-sm">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {savingPayment ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PDF Preview Modal ═══ */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">{previewTitle}</h3>
              <div className="flex items-center gap-2">
                <a href={previewUrl} download={`${previewTitle}.pdf`}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm">
                  <FileDown className="w-4 h-4" /> Descargar
                </a>
                <button onClick={closePreview} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={previewUrl} className="w-full h-full border-0" title="Vista previa del recibo" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
