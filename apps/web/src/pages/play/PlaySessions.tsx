import { useState, useEffect } from 'react'
import { playPanelApi } from '../../lib/playApi'
import {
  Radio,
  Search,
  Users,
  Clock,
  Copy,
  CheckCircle2,
  Loader2,
  Sparkles,
  BarChart3,
  ExternalLink,
  Download,
} from 'lucide-react'

interface Session {
  id: string
  joinCode?: string
  status: string
  guestsCount: number
  createdAt: string
  activity?: { name: string }
  lesson?: { title: string }
}

export default function PlaySessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    playPanelApi.listSessions()
      .then(res => setSessions(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const downloadCsv = async (sessionId: string, name: string) => {
    try {
      const res = await playPanelApi.exportSessionCsv(sessionId)
      const blob = new Blob([res.data as string], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  const filtered = sessions.filter(s => {
    const name = s.activity?.name || s.lesson?.title || ''
    return name.toLowerCase().includes(search.toLowerCase()) ||
      (s.joinCode && s.joinCode.includes(search))
  })

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string; dot: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'En vivo', dot: 'bg-green-500' },
      WAITING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Esperando', dot: 'bg-yellow-500' },
      FINISHED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Finalizada', dot: 'bg-gray-400' },
      PAUSED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pausada', dot: 'bg-orange-500' },
    }
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status, dot: 'bg-gray-400' }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
        {s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-28 bg-gray-200 rounded-lg" />
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
                <div className="h-3 w-1/3 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
              <div className="h-4 w-10 bg-gray-100 rounded" />
              <div className="h-4 w-14 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-purple-500" />
            Sesiones
          </h1>
          <p className="text-gray-500 text-sm mt-1">Historial de sesiones en vivo y sus resultados</p>
        </div>
      </div>

      {/* Search */}
      {sessions.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          />
        </div>
      )}

      {/* Empty State */}
      {sessions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin sesiones aún</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Cuando inicies un quiz o lección en vivo, las sesiones aparecerán aquí con sus resultados.
          </p>
        </div>
      )}

      {/* Sessions table */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actividad</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Invitados</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {session.activity?.name || session.lesson?.title || 'Sin título'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {session.joinCode ? (
                        <button
                          onClick={() => copyJoinCode(session.joinCode!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded text-sm font-mono hover:bg-violet-100 transition"
                        >
                          {copiedCode === session.joinCode ? (
                            <><CheckCircle2 className="w-3 h-3" /> OK</>
                          ) : (
                            <><Copy className="w-3 h-3" /> {session.joinCode}</>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">{statusBadge(session.status)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Users className="w-3.5 h-3.5" /> {session.guestsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-xs text-gray-500 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(session.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600 transition" title="Ver resultados">
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        {session.status === 'FINISHED' && (
                          <button
                            onClick={() => downloadCsv(session.id, session.activity?.name || session.lesson?.title || 'sesion')}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition"
                            title="Exportar CSV"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {(session.status === 'ACTIVE' || session.status === 'WAITING') && (
                          <button className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Abrir sesión">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
