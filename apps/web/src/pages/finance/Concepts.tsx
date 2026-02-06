import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { financeConceptsApi } from '../../lib/api'

interface Concept {
  id: string
  code: string
  name: string
  description?: string
  defaultAmount: number
  isRecurring: boolean
  frequency?: string
  isActive: boolean
  category: { id: string; name: string }
  _count: { obligations: number }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function Concepts() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConcepts = async () => {
    setLoading(true)
    try {
      const response = await financeConceptsApi.getAll()
      setConcepts(response.data)
    } catch (err) {
      console.error('Error fetching concepts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConcepts()
  }, [])

  const filteredConcepts = concepts.filter(c => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower) ||
      c.category.name.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Conceptos de Cobro</h1>
                <p className="text-gray-500">Configuración de conceptos y tarifas</p>
              </div>
            </div>
            <Link
              to="/finance/concepts/new"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Concepto
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código, categoría..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={fetchConcepts}
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
          ) : filteredConcepts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay conceptos registrados</p>
              <Link to="/finance/concepts/new" className="mt-4 text-blue-600 hover:text-blue-700 inline-block">
                Crear primer concepto
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recurrente</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obligaciones</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredConcepts.map((concept) => (
                  <tr key={concept.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {concept.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{concept.name}</div>
                      {concept.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{concept.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {concept.category.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(Number(concept.defaultAmount))}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {concept.isRecurring ? (
                        <span className="text-green-600 text-sm">{concept.frequency || 'Sí'}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {concept._count.obligations}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {concept.isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <ToggleRight className="w-5 h-5" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <ToggleLeft className="w-5 h-5" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`/finance/concepts/${concept.id}/edit`}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
