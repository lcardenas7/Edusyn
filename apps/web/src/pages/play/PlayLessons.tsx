import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { playPanelApi } from '../../lib/playApi'
import {
  BookOpen,
  Plus,
  Search,
  Clock,
  Loader2,
  Sparkles,
  Presentation,
  Trash2,
  X,
  AlertCircle,
  Zap,
  Timer,
} from 'lucide-react'

interface Lesson {
  id: string
  title: string
  lesson?: { id: string; title: string; playMode?: string; estimatedMinutes?: number; badgeEmoji?: string }
  createdAt: string
}

export default function PlayLessons() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const loadLessons = () => {
    playPanelApi.listLessons()
      .then(res => setLessons(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLessons() }, [])

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      setError('El título es obligatorio')
      return
    }
    setCreating(true)
    setError('')
    try {
      const res = await playPanelApi.createLesson({
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
      })
      setShowCreate(false)
      setCreateTitle('')
      setCreateDesc('')
      loadLessons()
      if (res.data?.id) navigate(`/play/lessons/${res.data.id}/edit`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear lección')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) return
    try {
      await playPanelApi.deleteLesson(id)
      setLessons(prev => prev.filter(l => l.id !== id))
    } catch {
      alert('Error al eliminar lección')
    }
  }

  const openCreate = () => {
    setShowCreate(true)
    setError('')
    setCreateTitle('')
    setCreateDesc('')
  }

  const filtered = lessons.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-200 rounded-lg" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="h-10 w-10 bg-gray-200 rounded-xl" />
              <div className="h-5 w-3/4 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-100 rounded" />
              <div className="h-3 w-1/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const playModeBadge = (mode?: string) => {
    if (mode === 'LIVE') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-fuchsia-100 text-fuchsia-700"><Zap className="w-3 h-3" /> En vivo</span>
    if (mode === 'SELF_PACED') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Timer className="w-3 h-3" /> Auto-ritmo</span>
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
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium transition shadow-sm"
        >
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
      {lessons.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-fuchsia-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-fuchsia-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Crea tu primera lección</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Diseña presentaciones interactivas. Tus participantes siguen tus slides en tiempo real desde sus dispositivos.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium transition"
          >
            <Plus className="w-4 h-4" /> Crear Lección
          </button>
        </div>
      )}

      {/* Lesson list */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lesson => (
            <div key={lesson.id} onClick={() => navigate(`/play/lessons/${lesson.id}/edit`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-fuchsia-100 flex items-center justify-center">
                  {lesson.lesson?.badgeEmoji ? (
                    <span className="text-lg">{lesson.lesson.badgeEmoji}</span>
                  ) : (
                    <Presentation className="w-5 h-5 text-fuchsia-600" />
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id, lesson.title) }}
                  className="p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                  title="Eliminar lección"
                >
                  <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 truncate mb-2">{lesson.title}</h3>
              <div className="flex items-center gap-2">
                {playModeBadge(lesson.lesson?.playMode)}
                {lesson.lesson?.estimatedMinutes && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {lesson.lesson.estimatedMinutes} min
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(lesson.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Lesson Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Nueva Lección</h2>
            <p className="text-sm text-gray-500 mb-5">Crea una lección y luego agrega slides</p>

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
                  placeholder="Ej: Introducción a la fotosíntesis"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={createDesc}
                  onChange={e => setCreateDesc(e.target.value)}
                  placeholder="Breve descripción de la lección..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition resize-none"
                />
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
                  className="flex-1 py-2.5 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4" /> Crear Lección</>
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
