import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  PieChart,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react'
import { financeCategoriesApi } from '../../lib/api'

type MovementType = 'INCOME' | 'EXPENSE'

interface Category {
  id: string
  name: string
  description?: string
  code?: string
  type: MovementType
  budgetAmount?: number
  color?: string
  icon?: string
  isActive: boolean
  sortOrder: number
  _count: { concepts: number; expenses: number }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)

const emptyForm = { name: '', description: '', code: '', type: 'INCOME' as MovementType, budgetAmount: '', color: '#3B82F6', icon: '' }

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<MovementType | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await financeCategoriesApi.getAll(typeFilter || undefined)
      setCategories(response.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [typeFilter])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (cat: Category) => {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      description: cat.description || '',
      code: cat.code || '',
      type: cat.type,
      budgetAmount: cat.budgetAmount ? String(cat.budgetAmount) : '',
      color: cat.color || '#3B82F6',
      icon: cat.icon || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        code: form.code.trim() || undefined,
        type: form.type,
        budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
        color: form.color || undefined,
        icon: form.icon.trim() || undefined,
      }
      if (editingId) {
        await financeCategoriesApi.update(editingId, payload)
      } else {
        await financeCategoriesApi.create(payload)
      }
      setShowModal(false)
      fetchCategories()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la categoría "${name}"?`)) return
    try {
      await financeCategoriesApi.delete(id)
      fetchCategories()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar')
    }
  }

  const handleSeedDefaults = async () => {
    if (!confirm('¿Crear categorías por defecto? No se duplicarán las existentes.')) return
    setSeeding(true)
    try {
      const res = await financeCategoriesApi.seedDefaults()
      alert(`Se crearon ${res.data.created} categorías`)
      fetchCategories()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear categorías')
    } finally {
      setSeeding(false)
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
              <div className="p-3 bg-cyan-100 rounded-xl">
                <PieChart className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
                <p className="text-gray-500">Clasificación de ingresos y gastos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSeedDefaults} disabled={seeding} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50">
                <Sparkles className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} /> Defaults
              </button>
              <button onClick={openCreate} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nueva Categoría
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            {(['', 'INCOME', 'EXPENSE'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {t === '' ? 'Todas' : t === 'INCOME' ? 'Ingresos' : 'Egresos'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No hay categorías</p>
            <button onClick={handleSeedDefaults} className="mt-4 text-blue-600 hover:text-blue-700">
              Crear categorías por defecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 ${!cat.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || '#6B7280' }} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                      {cat.code && <span className="text-xs text-gray-400 font-mono">{cat.code}</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cat.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                  </span>
                </div>
                {cat.description && <p className="text-sm text-gray-500 mb-3">{cat.description}</p>}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>{cat._count.concepts} conceptos</span>
                  <span>{cat._count.expenses} movimientos</span>
                  {cat.budgetAmount && <span>Presupuesto: {formatCurrency(Number(cat.budgetAmount))}</span>}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    {cat.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                    {cat.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{editingId ? 'Editar' : 'Nueva'} Categoría</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Nombre de la categoría" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Descripción opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as MovementType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="INCOME">Ingreso</option>
                    <option value="EXPENSE">Egreso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Código contable" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto</label>
                  <input type="number" value={form.budgetAmount} onChange={e => setForm({ ...form, budgetAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
