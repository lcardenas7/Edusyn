import { useState, useEffect, useRef, useCallback } from 'react'
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
  XCircle,
  FileDown,
  Loader2,
  Eye,
  X,
  CheckCircle2,
  UserCircle,
  Receipt,
} from 'lucide-react'
import { financePaymentsApi, financeThirdPartiesApi, financeObligationsApi, financeConceptsApi, academicGradesApi, groupsApi } from '../../lib/api'

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'PSE' | 'NEQUI' | 'DAVIPLATA' | 'OTHER'
type ModalTab = 'obligation' | 'general'

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

interface ThirdPartyOption {
  id: string
  name: string
  type: string
  document?: string
}

interface ObligationOption {
  id: string
  concept: { name: string; category?: { name: string } }
  totalAmount: number
  paidAmount: number
  balance: number
  reference?: string
  dueDate?: string
  status: string
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

  // Modal state
  const [modalTab, setModalTab] = useState<ModalTab>('obligation')
  const [allThirdParties, setAllThirdParties] = useState<ThirdPartyOption[]>([])
  const [obligations, setObligations] = useState<ObligationOption[]>([])
  const [loadingModal, setLoadingModal] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    thirdPartyId: '',
    obligationId: '',
    amount: '',
    paymentMethod: 'CASH' as PaymentMethod,
    transactionRef: '',
    notes: '',
  })

  // Modal filter state
  const [modalGrades, setModalGrades] = useState<any[]>([])
  const [modalGroups, setModalGroups] = useState<any[]>([])
  const [modalGradeFilter, setModalGradeFilter] = useState('')
  const [modalGroupFilter, setModalGroupFilter] = useState('')
  const [modalSearch, setModalSearch] = useState('')
  const [debouncedModalSearch, setDebouncedModalSearch] = useState('')
  const [loadingThirdParties, setLoadingThirdParties] = useState(false)
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdPartyOption | null>(null)
  const [concepts, setConcepts] = useState<any[]>([])
  const modalFiltersLoaded = useRef(false)

  // Debounce modal search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedModalSearch(modalSearch), 350)
    return () => clearTimeout(t)
  }, [modalSearch])

  // Auto-search when debounced search or filters change
  useEffect(() => {
    if (!showNewPaymentModal) return
    if (modalTab !== 'obligation') return
    searchThirdParties()
  }, [debouncedModalSearch, modalGradeFilter, modalGroupFilter])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (methodFilter) params.paymentMethod = methodFilter
      const response = await financePaymentsApi.getAll(params)
      const result = response.data
      setPayments(Array.isArray(result) ? result : result.data || [])
    } catch (err) {
      console.error('Error fetching payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [methodFilter])

  const openNewPaymentModal = async () => {
    setShowNewPaymentModal(true)
    setLoadingModal(true)
    setModalTab('obligation')
    resetForm()
    try {
      const promises: Promise<any>[] = [
        financeThirdPartiesApi.getAll({ isActive: 'true' }),
      ]
      if (!modalFiltersLoaded.current) {
        promises.push(academicGradesApi.getActive(), groupsApi.getAll(), financeConceptsApi.getAll({ isActive: 'true' }))
      }
      const [tpRes, ...rest] = await Promise.all(promises)
      const tpArr = Array.isArray(tpRes.data) ? tpRes.data : tpRes.data.data || []
      setAllThirdParties(tpArr)
      if (!modalFiltersLoaded.current && rest.length >= 3) {
        const gradesArr = Array.isArray(rest[0].data) ? rest[0].data : rest[0].data.data || []
        const groupsArr = Array.isArray(rest[1].data) ? rest[1].data : rest[1].data.data || []
        const conceptsArr = Array.isArray(rest[2].data) ? rest[2].data : rest[2].data.data || []
        setModalGrades(gradesArr)
        setModalGroups(groupsArr)
        setConcepts(conceptsArr)
        modalFiltersLoaded.current = true
      }
    } catch (err) {
      console.error('Error loading modal data:', err)
    } finally {
      setLoadingModal(false)
    }
  }

  const resetForm = () => {
    setPaymentForm({ thirdPartyId: '', obligationId: '', amount: '', paymentMethod: 'CASH', transactionRef: '', notes: '' })
    setObligations([])
    setSelectedThirdParty(null)
    setModalGradeFilter('')
    setModalGroupFilter('')
    setModalSearch('')
    setDebouncedModalSearch('')
  }

  // Search third parties via obligations endpoint (finds students by grade/group/name)
  const searchThirdParties = useCallback(async () => {
    if (!modalGradeFilter && !modalGroupFilter && !debouncedModalSearch) return
    setLoadingThirdParties(true)
    try {
      const params: any = { limit: 50 }
      if (modalGradeFilter) params.gradeId = modalGradeFilter
      if (modalGroupFilter) params.groupId = modalGroupFilter
      if (debouncedModalSearch) params.search = debouncedModalSearch
      const res = await financeObligationsApi.getAll(params)
      const oblArr = Array.isArray(res.data) ? res.data : res.data.data || []
      const tpMap = new Map<string, ThirdPartyOption>()
      for (const o of oblArr) {
        if (o.thirdParty && !tpMap.has(o.thirdParty.id)) {
          tpMap.set(o.thirdParty.id, { id: o.thirdParty.id, name: o.thirdParty.name, type: o.thirdParty.type || 'STUDENT', document: o.thirdParty.document })
        }
      }
      setAllThirdParties([...tpMap.values()])
    } catch (err) {
      console.error('Error filtering:', err)
    } finally {
      setLoadingThirdParties(false)
    }
  }, [modalGradeFilter, modalGroupFilter, debouncedModalSearch])

  const handleSelectThirdParty = async (tp: ThirdPartyOption) => {
    setSelectedThirdParty(tp)
    setPaymentForm(f => ({ ...f, thirdPartyId: tp.id, obligationId: '', amount: '' }))
    setObligations([])
    try {
      const res = await financeObligationsApi.getAll({ thirdPartyId: tp.id, limit: 50 })
      const oblArr = Array.isArray(res.data) ? res.data : res.data.data || []
      setObligations(oblArr.filter((o: any) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(o.status)))
    } catch (err) {
      console.error('Error loading obligations:', err)
    }
  }

  const handleSelectObligation = (oblId: string) => {
    const obl = obligations.find(o => o.id === oblId)
    if (paymentForm.obligationId === oblId) {
      setPaymentForm(f => ({ ...f, obligationId: '', amount: '' }))
    } else {
      setPaymentForm(f => ({
        ...f,
        obligationId: oblId,
        amount: obl ? String(Number(obl.balance)) : f.amount,
      }))
    }
  }

  const handleSubmitPayment = async () => {
    if (!paymentForm.thirdPartyId || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      alert('Tercero y monto son requeridos')
      return
    }
    setSavingPayment(true)
    try {
      await financePaymentsApi.create({
        thirdPartyId: paymentForm.thirdPartyId,
        obligationId: paymentForm.obligationId || undefined,
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionRef: paymentForm.transactionRef || undefined,
        notes: paymentForm.notes || undefined,
      })
      setShowNewPaymentModal(false)
      fetchPayments()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al registrar pago')
    } finally {
      setSavingPayment(false)
    }
  }

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

  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [previewTitle, setPreviewTitle] = useState('')

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
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Caja / Recaudos</h1>
                <p className="text-gray-500">Registro de pagos y recibos</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="px-4 py-2 bg-green-100 rounded-lg">
                <p className="text-xs text-green-600">Recaudo Hoy</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(todayTotal)}</p>
              </div>
              <button
                onClick={openNewPaymentModal}
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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
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
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handlePreviewReceipt(payment.id, payment.receiptNumber)} title="Vista Previa"
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDownloadReceipt(payment.id, payment.receiptNumber)} title="Descargar Recibo"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                              <FileDown className="w-4 h-4" />
                            </button>
                            {!payment.voidedAt && (
                              <button onClick={() => handleVoidPayment(payment.id)} title="Anular Pago"
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

      {/* New Payment Modal */}
      {showNewPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header with tabs */}
            <div className="px-6 pt-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Registrar Pago</h2>
                <button onClick={() => setShowNewPaymentModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex border-b border-gray-200">
                <button onClick={() => { setModalTab('obligation'); resetForm() }}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    modalTab === 'obligation' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <Receipt className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Pago a Obligación
                </button>
                <button onClick={() => { setModalTab('general'); resetForm() }}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    modalTab === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <Wallet className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Pago General
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              {loadingModal ? (
                <div className="py-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
              ) : modalTab === 'obligation' ? (
                /* ═══ TAB: PAGO A OBLIGACIÓN ═══ */
                <div className="space-y-4">
                  {/* Selected student banner */}
                  {selectedThirdParty ? (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900">{selectedThirdParty.name}</p>
                          {selectedThirdParty.document && <p className="text-xs text-blue-600">{selectedThirdParty.document}</p>}
                        </div>
                      </div>
                      <button onClick={() => { setSelectedThirdParty(null); setPaymentForm(f => ({ ...f, thirdPartyId: '', obligationId: '', amount: '' })); setObligations([]) }}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium">Cambiar</button>
                    </div>
                  ) : (
                    /* Search area */
                    <div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <select value={modalGradeFilter}
                          onChange={e => { setModalGradeFilter(e.target.value); setModalGroupFilter('') }}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[130px]">
                          <option value="">Todos los grados</option>
                          {modalGrades.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <select value={modalGroupFilter}
                          onChange={e => setModalGroupFilter(e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm min-w-[130px]">
                          <option value="">Todos los grupos</option>
                          {(modalGradeFilter
                            ? modalGroups.filter((g: any) => g.gradeId === modalGradeFilter || g.grade?.id === modalGradeFilter)
                            : modalGroups
                          ).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input type="text" value={modalSearch}
                            onChange={e => setModalSearch(e.target.value)}
                            placeholder="Escriba nombre, apellido o documento..."
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      {/* Results list */}
                      {loadingThirdParties ? (
                        <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" /></div>
                      ) : (modalGradeFilter || modalGroupFilter || debouncedModalSearch) ? (
                        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                          {allThirdParties.length === 0 ? (
                            <p className="text-sm text-gray-400 py-4 text-center">Sin resultados</p>
                          ) : allThirdParties.map(tp => (
                            <button key={tp.id} onClick={() => handleSelectThirdParty(tp)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 transition-colors text-left">
                              <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{tp.name}</p>
                                {tp.document && <p className="text-xs text-gray-400">{tp.document}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-3">Seleccione un grado/grupo o escriba para buscar</p>
                      )}
                    </div>
                  )}

                  {/* Obligations table */}
                  {selectedThirdParty && (
                    <>
                      {obligations.length === 0 ? (
                        <div className="text-center py-3 text-sm text-gray-400 bg-gray-50 rounded-lg">
                          Este estudiante no tiene obligaciones pendientes
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">Obligaciones pendientes ({obligations.length})</p>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr className="text-xs text-gray-500">
                                  <th className="py-2 px-2 text-left w-6"></th>
                                  <th className="py-2 px-2 text-left">Concepto</th>
                                  <th className="py-2 px-2 text-right">Saldo</th>
                                  <th className="py-2 px-2 text-center">Vence</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {obligations.map(obl => {
                                  const selected = paymentForm.obligationId === obl.id
                                  return (
                                    <tr key={obl.id} onClick={() => handleSelectObligation(obl.id)}
                                      className={`cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                      <td className="py-2 px-2">
                                        {selected
                                          ? <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                          : <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />}
                                      </td>
                                      <td className="py-2 px-2">
                                        <p className="font-medium text-gray-900">{obl.concept.name}</p>
                                        <p className="text-xs text-gray-400">{obl.reference || ''} {obl.concept.category?.name ? `· ${obl.concept.category.name}` : ''}</p>
                                      </td>
                                      <td className="py-2 px-2 text-right font-bold text-gray-900">{formatCurrency(Number(obl.balance))}</td>
                                      <td className="py-2 px-2 text-center text-xs text-gray-500">
                                        {obl.dueDate ? new Date(obl.dueDate).toLocaleDateString('es-CO') : '-'}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Payment details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                          <input type="number" value={paymentForm.amount}
                            onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="0" min="1" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                          <select value={paymentForm.paymentMethod}
                            onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="N° transferencia, aprobación..." />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                        <input type="text" value={paymentForm.notes}
                          onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Observaciones opcionales..." />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* ═══ TAB: PAGO GENERAL ═══ */
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    Use este modo para registrar ingresos que no están asociados a una obligación específica de un estudiante (ej: venta de uniformes, eventos, donaciones, etc.)
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tercero / Pagador *</label>
                    <select value={paymentForm.thirdPartyId}
                      onChange={e => setPaymentForm(f => ({ ...f, thirdPartyId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                      <option value="">Seleccionar tercero...</option>
                      {allThirdParties.map(tp => (
                        <option key={tp.id} value={tp.id}>{tp.name} {tp.document ? `(${tp.document})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                      <input type="number" value={paymentForm.amount}
                        onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="0" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                      <select value={paymentForm.paymentMethod}
                        onChange={e => setPaymentForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Referencia de transacción</label>
                      <input type="text" value={paymentForm.transactionRef}
                        onChange={e => setPaymentForm(f => ({ ...f, transactionRef: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="N° transferencia, aprobación..." />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas / Concepto del pago *</label>
                    <textarea value={paymentForm.notes}
                      onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      rows={2} placeholder="Describa el concepto del pago (ej: Venta de uniforme, Donación, etc.)" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowNewPaymentModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={handleSubmitPayment}
                disabled={savingPayment || !paymentForm.thirdPartyId || !paymentForm.amount || Number(paymentForm.amount) <= 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50 text-sm">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {savingPayment ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
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
