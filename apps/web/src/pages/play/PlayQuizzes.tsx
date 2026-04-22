import { useState, useEffect } from 'react'
import { playPanelApi } from '../../lib/playApi'
import {
  FileQuestion,
  Plus,
  Search,
  Users,
  Clock,
  MoreVertical,
  Loader2,
  Sparkles,
} from 'lucide-react'

interface Quiz {
  id: string
  name: string
  questionsCount?: number
  sessionsCount?: number
  createdAt: string
}

export default function PlayQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    playPanelApi.listQuizzes()
      .then(res => setQuizzes(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = quizzes.filter(q =>
    q.name.toLowerCase().includes(search.toLowerCase())
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
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition shadow-sm">
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
      {quizzes.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Crea tu primer quiz</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Diseña preguntas, comparte un código de acceso y tus participantes juegan en tiempo real.
          </p>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition">
            <Plus className="w-4 h-4" /> Crear Quiz
          </button>
        </div>
      )}

      {/* Quiz list */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(quiz => (
            <div key={quiz.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <FileQuestion className="w-5 h-5 text-violet-600" />
                </div>
                <button className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 truncate mb-2">{quiz.name}</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FileQuestion className="w-3.5 h-3.5" /> {quiz.questionsCount ?? 0} preguntas
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {quiz.sessionsCount ?? 0} sesiones
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(quiz.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
