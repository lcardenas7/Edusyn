import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, DollarSign, Save, Loader2 } from 'lucide-react'
import { financeObligationsApi, financeThirdPartiesApi, financeConceptsApi } from '../../lib/api'

interface ThirdParty {
  id: string
  name: string
  type: string
}

interface Concept {
  id: string
  name: string
  defaultAmount: number
  category: { name: string }
}

export default function NewObligation() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    thirdPartyId: '',
    conceptId: '',
    amount: '',
    discountAmount: '',
    discountReason: '',
    dueDate: '',
    notes: '',
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tpRes, conceptsRes] = await Promise.all([
          financeThirdPartiesApi.getAll(),
          financeConceptsApi.getAll({ isActive: 'true' }),
        ])
        setThirdParties(Array.isArray(tpRes.data) ? tpRes.data : tpRes.data.data || [])
        setConcepts(Array.isArray(conceptsRes.data) ? conceptsRes.data : conceptsRes.data.data || [])
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const selectedConcept = concepts.find(c => c.id === form.conceptId)

  const handleConceptChange = (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId)
    setForm({
      ...form,
      conceptId,
      amount: concept ? String(concept.defaultAmount) : '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.thirdPartyId || !form.conceptId) {
      setError('Tercero y concepto son requeridos')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await financeObligationsApi.create({
        thirdPartyId: form.thirdPartyId,
        conceptId: form.conceptId,
        amount: form.amount ? Number(form.amount) : undefined,
        discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
        discountReason: form.discountReason || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      })
      navigate('/finance/obligations')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear obligación')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to="/finance/obligations" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Obligaciones
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nueva Obligación</h1>
              <p className="text-gray-500">Asignar cobro a un tercero</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tercero *</label>
              <select
                value={form.thirdPartyId}
                onChange={(e) => setForm({ ...form, thirdPartyId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Seleccionar tercero...</option>
                {thirdParties.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.name} ({tp.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concepto de Cobro *</label>
              <select
                value={form.conceptId}
                onChange={(e) => handleConceptChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Seleccionar concepto...</option>
                {concepts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - ${Number(c.defaultAmount).toLocaleString('es-CO')}</option>
                ))}
              </select>
              {selectedConcept && (
                <p className="text-xs text-gray-500 mt-1">Categoría: {selectedConcept.category.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Dejar vacío para usar valor del concepto</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento</label>
                <input
                  type="number"
                  value={form.discountAmount}
                  onChange={(e) => setForm({ ...form, discountAmount: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo Descuento</label>
                <input
                  type="text"
                  value={form.discountReason}
                  onChange={(e) => setForm({ ...form, discountReason: e.target.value })}
                  placeholder="Ej: Beca, convenio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Observaciones adicionales"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
            <Link
              to="/finance/obligations"
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving || !form.thirdPartyId || !form.conceptId}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Crear Obligación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
