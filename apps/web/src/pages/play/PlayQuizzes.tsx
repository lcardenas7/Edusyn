import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { playPanelApi } from '../../lib/playApi'
import {
  FileQuestion,
  Plus,
  Search,
  Clock,
  Loader2,
  Sparkles,
  X,
  Trash2,
  AlertCircle,
  Zap,
  Home,
} from 'lucide-react'

interface Quiz {
  id: string
  title: string
  description?: string
  type: string
  isPublished: boolean
  createdAt: string
}

const QUIZ_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  LIVE_QUIZ: { label: 'En vivo', icon: Zap, color: 'bg-violet-100 text-violet-700' },
  HOME_QUIZ: { label: 'Para casa', icon: Home, color: 'bg-blue-100 text-blue-700' },
  QUIZ: { label: 'Quiz', icon: FileQuestion, color: 'bg-amber-100 text-amber-700' },
}

export default function PlayQuizzes() {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createType, setCreateType] = useState('LIVE_QUIZ')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadQuizzes = () => {
    playPanelApi.listQuizzes()
      .then(res => setQuizzes(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadQuizzes() }, [])

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      setError('El título es obligatorio')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await playPanelApi.createQuiz({
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        type: createType,
      })
      setShowCreate(false)
      setCreateTitle('')
      setCreateDesc('')
      setCreateType('LIVE_QUIZ')
      navigate(`/play/quizzes/${res.data.id}/edit`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear quiz')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return
    try {
      await playPanelApi.deleteQuiz(id)
      setQuizzes(prev => prev.filter(q => q.id !== id))
    } catch {
      alert('Error al eliminar quiz')
    }
  }

  const openCreate = () => {
    setShowCreate(true)
    setError('')
    setCreateTitle('')
    setCreateDesc('')
    setCreateType('LIVE_QUIZ')
  }

  const filtered = quizzes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileQuestion className="w-6 h-6 text-violet-500" />
            Mis Quizzes
          </h1>
          <p className="text-gray-500 text-sm mt-1">Crea y administra tus quizzes interactivos</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Quiz
        </button>
      </div>

      {/* Search */}
      {quizzes.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar quiz..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
          />
        </div>
      )}

      {/* Empty State */}
      {quizzes.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Crea tu primer quiz</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Diseña preguntas, comparte un código de acceso y tus participantes juegan en tiempo real.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition"
          >
            <Plus className="w-4 h-4" /> Crear Quiz
          </button>
        </div>
      )}

      {/* Quiz list */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(quiz => {
            const typeInfo = QUIZ_TYPE_LABELS[quiz.type] || QUIZ_TYPE_LABELS['QUIZ']
            const TypeIcon = typeInfo.icon
            return (
              <div key={quiz.id} onClick={() => navigate(`/play/quizzes/${quiz.id}/edit`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                    <FileQuestion className="w-5 h-5 text-violet-600" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(quiz.id, quiz.title) }}
                    className="p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                    title="Eliminar quiz"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900 truncate mb-1">{quiz.title}</h3>
                {quiz.description && (
                  <p className="text-xs text-gray-500 truncate mb-2">{quiz.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                    <TypeIcon className="w-3 h-3" /> {typeInfo.label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {quiz.isPublished ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(quiz.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Quiz Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Nuevo Quiz</h2>
            <p className="text-sm text-gray-500 mb-5">Crea un quiz y luego agrega preguntas</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="Ej: Quiz de Matemáticas - Tema 1"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  placeholder="Breve descripción del quiz..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de quiz</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'LIVE_QUIZ', label: 'En vivo', desc: 'Juegan al mismo tiempo', icon: Zap },
                    { value: 'HOME_QUIZ', label: 'Para casa', desc: 'Cada uno a su ritmo', icon: Home },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCreateType(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        createType === opt.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <opt.icon className={`w-5 h-5 mb-1 ${createType === opt.value ? 'text-violet-600' : 'text-gray-400'}`} />
                      <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4" /> Crear Quiz</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
