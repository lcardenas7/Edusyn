import { useState, useEffect } from 'react'
import { toast } from '../../lib/toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Save, Loader2 } from 'lucide-react'
import { financeConceptsApi, financeCategoriesApi } from '../../lib/api'

interface Category {
  id: string
  name: string
  type: string
}

interface ConceptResponse {
  id: string
  name: string
  description?: string | null
  categoryId: string
  defaultAmount: number | string
  isRecurring: boolean
  isMassive: boolean
  allowPartial: boolean
  allowDiscount: boolean
}

export default function NewConcept() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    defaultAmount: '',
    isRecurring: false,
    isMassive: true,
    allowPartial: true,
    allowDiscount: true,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const categoriesRes = await financeCategoriesApi.getAll()
        const incomeCategories = categoriesRes.data.filter((c: Category) => c.type === 'INCOME')
        setCategories(incomeCategories)

        if (isEditMode && id) {
          const conceptRes = await financeConceptsApi.getById(id)
          const concept = conceptRes.data as ConceptResponse
          setForm({
            name: concept.name || '',
            description: concept.description || '',
            categoryId: concept.categoryId || incomeCategories[0]?.id || '',
            defaultAmount: String(concept.defaultAmount ?? ''),
            isRecurring: Boolean(concept.isRecurring),
            isMassive: Boolean(concept.isMassive),
            allowPartial: Boolean(concept.allowPartial),
            allowDiscount: Boolean(concept.allowDiscount),
          })
          return
        }

        if (incomeCategories.length > 0) {
          setForm(f => ({ ...f, categoryId: f.categoryId || incomeCategories[0].id }))
        }
      } catch (err) {
        console.error('Error loading concept form:', err)
        toast.error(isEditMode ? 'Error al cargar el concepto' : 'Error al cargar categorías')
        if (isEditMode) {
          navigate('/finance/concepts')
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, isEditMode, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.categoryId || !form.defaultAmount) {
      toast.warning('Por favor completa los campos requeridos')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId,
        defaultAmount: Number(form.defaultAmount),
        isRecurring: form.isRecurring,
        isMassive: form.isMassive,
        allowPartial: form.allowPartial,
        allowDiscount: form.allowDiscount,
      }

      if (isEditMode && id) {
        await financeConceptsApi.update(id, payload)
      } else {
        await financeConceptsApi.create(payload)
      }

      navigate('/finance/concepts')
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isEditMode ? 'Error al actualizar concepto' : 'Error al crear concepto'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link to="/finance/concepts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Conceptos
          </Link>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Editar Concepto de Cobro' : 'Nuevo Concepto de Cobro'}</h1>
              <p className="text-gray-500">{isEditMode ? 'Actualiza la configuración del concepto' : 'Crear un nuevo concepto para facturación'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Concepto *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Matrícula 2025, Pensión Mensual..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={2}
              placeholder="Descripción opcional del concepto..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                value={form.categoryId}
                onChange={e => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccionar categoría...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  No hay categorías de ingreso. <Link to="/finance/categories" className="underline">Crear una primero</Link>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor por Defecto *</label>
              <input
                type="number"
                value={form.defaultAmount}
                onChange={e => setForm({ ...form, defaultAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-sm text-gray-700">Recurrente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMassive}
                onChange={e => setForm({ ...form, isMassive: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-sm text-gray-700">Asignación masiva</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowPartial}
                onChange={e => setForm({ ...form, allowPartial: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-sm text-gray-700">Pago parcial</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowDiscount}
                onChange={e => setForm({ ...form, allowDiscount: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-sm text-gray-700">Permite descuento</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link to="/finance/concepts" className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving || !form.name || !form.categoryId || !form.defaultAmount}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Concepto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
