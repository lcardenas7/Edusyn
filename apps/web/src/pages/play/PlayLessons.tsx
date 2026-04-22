import { useState, useEffect } from 'react'
import { playPanelApi } from '../../lib/playApi'
import {
  BookOpen,
  Plus,
  Search,
  Radio,
  Clock,
  MoreVertical,
  Loader2,
  Sparkles,
  Presentation,
} from 'lucide-react'

interface Lesson {
  id: string
  title: string
  slidesCount?: number
  playMode?: string
  createdAt: string
}

export default function PlayLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    playPanelApi.listLessons()
      .then(res => setLessons(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = lessons.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin" />
      </div>
    )
  }

  const playModeBadge = (mode?: string) => {
    if (mode === 'LIVE') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-fuchsia-100 text-fuchsia-700">En vivo</span>
    if (mode === 'SELF_PACED') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Auto-ritmo</span>
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-fuchsia-500" />
            Mis Lecciones
          </h1>
          <p className="text-gray-500 text-sm mt-1">Crea lecciones interactivas con slides sincronizados</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium transition shadow-sm">
          <Plus className="w-4 h-4" /> Nueva Lección
        </button>
      </div>

      {/* Search */}
      {lessons.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lección..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition"
          />
        </div>
      )}

      {/* Empty State */}
      {lessons.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-fuchsia-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-fuchsia-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Crea tu primera lección</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Diseña presentaciones interactivas. Tus participantes siguen tus slides en tiempo real desde sus dispositivos.
          </p>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium transition">
            <Plus className="w-4 h-4" /> Crear Lección
          </button>
        </div>
      )}

      {/* Lesson list */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lesson => (
            <div key={lesson.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-fuchsia-100 flex items-center justify-center">
                  <Presentation className="w-5 h-5 text-fuchsia-600" />
                </div>
                <div className="flex items-center gap-2">
                  {playModeBadge(lesson.playMode)}
                  <button className="p-1 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 truncate mb-2">{lesson.title}</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> {lesson.slidesCount ?? 0} slides
                </span>
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" /> Live
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(lesson.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
