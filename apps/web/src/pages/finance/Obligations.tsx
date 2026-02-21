import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  Search,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Ban,
  Eye,
} from 'lucide-react'
import { financeObligationsApi, financeConceptsApi, academicGradesApi, groupsApi } from '../../lib/api'

type ObligationStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'OVERDUE'

interface Obligation {
  id: string
  thirdParty: { id: string; name: string }
  concept: { id: string; name: string; category: { name: string } }
  originalAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: ObligationStatus
  dueDate?: string
  reference?: string
  studentGroup?: string | null
  studentGrade?: string | null
}

interface PaginationMeta {
  total: number
  page: number
  totalPages: number
  limit: number
}

const statusConfig: Record<ObligationStatus, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: 'Pendiente', icon: <Clock className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700' },
  PARTIAL: { label: 'Parcial', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  PAID: { label: 'Pagado', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado', icon: <XCircle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
  OVERDUE: { label: 'Vencido', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Obligations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, totalPages: 0, limit: 25 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ObligationStatus | ''>(
    (searchParams.get('status') as ObligationStatus) || ''
  )
  const [gradeFilter, setGradeFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [conceptFilter, setConceptFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showMassiveModal, setShowMassiveModal] = useState(false)

  // Filter options (loaded once)
  const [filterGrades, setFilterGrades] = useState<any[]>([])
  const [filterGroups, setFilterGroups] = useState<any[]>([])
  const [filterConcepts, setFilterConcepts] = useState<any[]>([])
  const filtersLoaded = useRef(false)

  // Massive modal state
  const [concepts, setConcepts] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loadingMassive, setLoadingMassive] = useState(false)
  const [savingMassive, setSavingMassive] = useState(false)
  const [massiveResult, setMassiveResult] = useState<any>(null)
  const [massiveForm, setMassiveForm] = useState({
    conceptId: '',
    targetType: 'GRADE' as 'GRADE' | 'GROUP',
    targetId: '',
    amount: '',
    discountAmount: '',
    discountReason: '',
    dueDate: '',
  })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Load filter options once
  useEffect(() => {
    if (filtersLoaded.current) return
    filtersLoaded.current = true
    Promise.all([
      academicGradesApi.getAll(),
      groupsApi.getAll(),
      financeConceptsApi.getAll({ isActive: 'true' }),
    ]).then(([gRes, grRes, cRes]) => {
      setFilterGrades(Array.isArray(gRes.data) ? gRes.data : gRes.data.data || [])
      setFilterGroups(Array.isArray(grRes.data) ? grRes.data : grRes.data.data || [])
      setFilterConcepts(Array.isArray(cRes.data) ? cRes.data : cRes.data.data || [])
    }).catch(err => console.error('Error loading filter options:', err))
  }, [])

  const fetchObligations = useCallback(async (page = currentPage) => {
    setLoading(true)
    try {
      const params: any = { page, limit: 25 }
      if (statusFilter) params.status = statusFilter
      if (gradeFilter) params.gradeId = gradeFilter
      if (groupFilter) params.groupId = groupFilter
      if (conceptFilter) params.conceptId = conceptFilter
      if (debouncedSearch) params.search = debouncedSearch
      const response = await financeObligationsApi.getAll(params)
      const result = response.data
      setObligations(Array.isArray(result) ? result : result.data || [])
      if (result.meta) setMeta(result.meta)
    } catch (err) {
      console.error('Error fetching obligations:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, gradeFilter, groupFilter, conceptFilter, debouncedSearch, currentPage])

  useEffect(() => {
    fetchObligations(currentPage)
  }, [statusFilter, gradeFilter, groupFilter, conceptFilter, debouncedSearch, currentPage])

  const openMassiveModal = async () => {
    setShowMassiveModal(true)
    setLoadingMassive(true)
    setMassiveResult(null)
    setMassiveForm({ conceptId: '', targetType: 'GRADE', targetId: '', amount: '', discountAmount: '', discountReason: '', dueDate: '' })
    try {
      const [conceptsRes, gradesRes, groupsRes] = await Promise.all([
        financeConceptsApi.getAll({ isActive: 'true' }),
        academicGradesApi.getAll(),
        groupsApi.getAll(),
      ])
      setConcepts(conceptsRes.data)
      setGrades(gradesRes.data)
      setGroups(groupsRes.data)
    } catch (err) {
      console.error('Error loading massive data:', err)
    } finally {
      setLoadingMassive(false)
    }
  }

  const handleConceptChangeMassive = (conceptId: string) => {
    const concept = concepts.find((c: any) => c.id === conceptId)
    setMassiveForm(f => ({
      ...f,
      conceptId,
      amount: concept ? String(Number(concept.defaultAmount)) : '',
    }))
  }

  const handleSubmitMassive = async () => {
    if (!massiveForm.conceptId || !massiveForm.targetId) {
      alert('Concepto y destino son requeridos')
      return
    }
    setSavingMassive(true)
    setMassiveResult(null)
    try {
      const res = await financeObligationsApi.createMassive({
        conceptId: massiveForm.conceptId,
        targetType: massiveForm.targetType,
        targetIds: [massiveForm.targetId],
        amount: massiveForm.amount ? Number(massiveForm.amount) : undefined,
        discountAmount: massiveForm.discountAmount ? Number(massiveForm.discountAmount) : undefined,
        discountReason: massiveForm.discountReason || undefined,
        dueDate: massiveForm.dueDate || undefined,
      })
      setMassiveResult(res.data)
      fetchObligations()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error en asignación masiva')
    } finally {
      setSavingMassive(false)
    }
  }

  const handleCancelObligation = async (id: string, reference?: string) => {
    const reason = prompt(`¿Motivo para cancelar la obligación ${reference || id.slice(0, 8)}?`)
    if (!reason) return
    try {
      await financeObligationsApi.cancel(id, reason)
      fetchObligations(currentPage)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cancelar obligación')
    }
  }

  const filteredGroups = gradeFilter
    ? filterGroups.filter((g: any) => g.gradeId === gradeFilter || g.grade?.id === gradeFilter)
    : filterGroups

  const handleGradeChange = (val: string) => {
    setGradeFilter(val)
    setGroupFilter('')
    setCurrentPage(1)
  }

  const handleGroupChange = (val: string) => {
    setGroupFilter(val)
    setCurrentPage(1)
  }

  const handleConceptChange = (val: string) => {
    setConceptFilter(val)
    setCurrentPage(1)
  }

  const handleStatusChange = (val: ObligationStatus | '') => {
    setStatusFilter(val)
    setCurrentPage(1)
    if (val) {
      setSearchParams({ status: val })
    } else {
      setSearchParams({})
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
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Obligaciones</h1>
                <p className="text-gray-500">Gestión de cobros y cartera</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openMassiveModal}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Asignación Masiva
              </button>
              <Link
                to="/finance/obligations/new"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nueva Obligación
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre, apellido o N° documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
            <select
              value={gradeFilter}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[140px]"
            >
              <option value="">Todos los grados</option>
              {filterGrades.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[140px]"
            >
              <option value="">Todos los grupos</option>
              {filteredGroups.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}{g.grade ? ` (${g.grade.name})` : ''}</option>
              ))}
            </select>
            <select
              value={conceptFilter}
              onChange={(e) => handleConceptChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[160px]"
            >
              <option value="">Todos los conceptos</option>
              {filterConcepts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as ObligationStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm min-w-[140px]"
            >
              <option value="">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="PARTIAL">Parciales</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="PAID">Pagadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
            <button
              onClick={() => fetchObligations(currentPage)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refrescar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-sm text-gray-500">
            {meta.total > 0
              ? `Mostrando ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} de ${meta.total} obligaciones`
              : 'Sin resultados'}
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : obligations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay obligaciones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grupo</th>
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
                  {obligations.map((obl) => {
                    const config = statusConfig[obl.status]
                    return (
                      <tr key={obl.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link
                            to={`/finance/obligations/${obl.id}`}
                            className="font-mono text-xs text-blue-600 hover:text-blue-700"
                          >
                            {obl.reference || obl.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/finance/third-parties/${obl.thirdParty.id}`}
                            className="font-medium text-sm text-gray-900 hover:text-blue-600"
                          >
                            {obl.thirdParty.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {obl.studentGroup ? (
                            <div className="flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{obl.studentGroup}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{obl.concept.name}</div>
                          <div className="text-xs text-gray-400">{obl.concept.category?.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(Number(obl.totalAmount))}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-green-600">
                          {formatCurrency(Number(obl.paidAmount))}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(Number(obl.balance))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                            {config.icon}
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {obl.dueDate
                            ? new Date(obl.dueDate).toLocaleDateString('es-CO')
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link to={`/finance/obligations/${obl.id}`} title="Ver detalle"
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded">
                              <Eye className="w-4 h-4" />
                            </Link>
                            {!['PAID', 'CANCELLED'].includes(obl.status) && (
                              <button onClick={() => handleCancelObligation(obl.id, obl.reference)}
                                title="Cancelar obligación"
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded">
                                <Ban className="w-4 h-4" />
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
          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong>
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={currentPage >= meta.totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Massive Assignment Modal */}
      {showMassiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Asignación Masiva</h2>
            <p className="text-gray-500 mb-4 text-sm">
              Asigna un concepto de cobro a todos los estudiantes de un grado o grupo.
            </p>
            {loadingMassive ? (
              <div className="py-8 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" /></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concepto de Cobro *</label>
                  <select value={massiveForm.conceptId} onChange={e => handleConceptChangeMassive(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value="">Seleccionar concepto...</option>
                    {concepts.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name} - ${Number(c.defaultAmount).toLocaleString('es-CO')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                  <select value={massiveForm.targetType}
                    onChange={e => setMassiveForm(f => ({ ...f, targetType: e.target.value as 'GRADE' | 'GROUP', targetId: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value="GRADE">Por Grado</option>
                    <option value="GROUP">Por Grupo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {massiveForm.targetType === 'GRADE' ? 'Grado' : 'Grupo'} *
                  </label>
                  <select value={massiveForm.targetId}
                    onChange={e => setMassiveForm(f => ({ ...f, targetId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value="">Seleccionar...</option>
                    {massiveForm.targetType === 'GRADE'
                      ? grades.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)
                      : groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.grade?.name})</option>)
                    }
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                    <input type="number" value={massiveForm.amount}
                      onChange={e => setMassiveForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Valor del concepto" />
                    <p className="text-xs text-gray-400 mt-1">Vacío = valor del concepto</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                    <input type="date" value={massiveForm.dueDate}
                      onChange={e => setMassiveForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descuento</label>
                    <input type="number" value={massiveForm.discountAmount}
                      onChange={e => setMassiveForm(f => ({ ...f, discountAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo Descuento</label>
                    <input type="text" value={massiveForm.discountReason}
                      onChange={e => setMassiveForm(f => ({ ...f, discountReason: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: Beca..." />
                  </div>
                </div>
                {massiveResult && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <p className="font-medium text-green-800">Resultado:</p>
                    <p className="text-green-700">Creadas: {massiveResult.created} | Omitidas (ya existían): {massiveResult.skipped}</p>
                    {massiveResult.errors?.length > 0 && (
                      <p className="text-red-600 mt-1">Errores: {massiveResult.errors.length}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowMassiveModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                {massiveResult ? 'Cerrar' : 'Cancelar'}
              </button>
              {!massiveResult && (
                <button onClick={handleSubmitMassive}
                  disabled={savingMassive || !massiveForm.conceptId || !massiveForm.targetId}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 disabled:opacity-50">
                  {savingMassive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {savingMassive ? 'Generando...' : 'Generar Obligaciones'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
