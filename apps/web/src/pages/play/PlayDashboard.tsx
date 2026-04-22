import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePlayAuth } from '../../contexts/PlayAuthContext'
import { playPanelApi } from '../../lib/playApi'
import {
  FileQuestion,
  BookOpen,
  Radio,
  Users,
  Plus,
  TrendingUp,
  Copy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface DashboardData {
  quizzesCount: number
  lessonsCount: number
  sessionsCount: number
  recentSessions: Array<{
    id: string
    joinCode?: string
    status: string
    guestsCount: number
    createdAt: string
    activity?: { name: string }
    lesson?: { title: string }
  }>
}

export default function PlayDashboard() {
  const { user } = usePlayAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    playPanelApi.dashboard()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  const stats = [
    { label: 'Quizzes', value: data?.quizzesCount ?? 0, icon: FileQuestion, color: 'violet', href: '/play/quizzes' },
    { label: 'Lecciones', value: data?.lessonsCount ?? 0, icon: BookOpen, color: 'fuchsia', href: '/play/lessons' },
    { label: 'Sesiones', value: data?.sessionsCount ?? 0, icon: Radio, color: 'purple', href: '/play/sessions' },
  ]

  const colorMap: Record<string, string> = {
    violet: 'from-violet-500 to-violet-600',
    fuchsia: 'from-fuchsia-500 to-fuchsia-600',
    purple: 'from-purple-500 to-purple-600',
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'En vivo' },
      WAITING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Esperando' },
      FINISHED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Finalizada' },
      PAUSED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pausada' },
    }
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
  }

  const isEmpty = !data?.quizzesCount && !data?.lessonsCount && !data?.sessionsCount

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.firstName} <span className="text-2xl">👋</span>
        </h1>
        <p className="text-gray-500 mt-1">Bienvenido a tu panel de Edusyn Play</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[s.color]} flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100 p-8 text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">¡Empieza tu primera sesión!</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Crea un quiz o lección, genera un código de acceso y compártelo con tus participantes. Es gratis y no necesitan cuenta.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/play/quizzes"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition"
            >
              <Plus className="w-4 h-4" /> Crear Quiz
            </Link>
            <Link
              to="/play/lessons"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50 font-medium transition"
            >
              <Plus className="w-4 h-4" /> Crear Lección
            </Link>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {(data?.recentSessions?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-500" />
              Sesiones recientes
            </h2>
            <Link to="/play/sessions" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recentSessions.map((session) => (
              <div key={session.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.activity?.name || session.lesson?.title || 'Sesión sin título'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(session.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {session.joinCode && (
                  <button
                    onClick={() => copyJoinCode(session.joinCode!)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg text-sm font-mono hover:bg-violet-100 transition"
                  >
                    {copiedCode === session.joinCode ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> {session.joinCode}</>
                    )}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" /> {session.guestsCount}
                  </span>
                  {statusBadge(session.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
