import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playPanelApi } from '../../lib/playApi'
import { usePlayAuth } from '../../contexts/PlayAuthContext'
import {
  Trophy,
  Target,
  Calendar,
  Loader2,
  History,
  Sparkles,
  Award,
  Link2,
} from 'lucide-react'

interface HistoryEntry {
  guestId: string
  sessionId: string
  sessionKind: 'QUIZ' | 'LESSON' | string
  sessionTitle: string
  nickname: string
  avatarEmoji: string | null
  score: number
  correctAnswers: number
  totalAnswers: number
  finalRank: number | null
  percent: number | null
  joinedAt: string
  finishedAt: string | null
  claimedAt: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default function PlayMe() {
  const { user } = usePlayAuth()
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await playPanelApi.playerHistory()
      setHistory(res.data || [])
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Auto-claim: si hay guest_token en localStorage (jugó como anónimo antes de loguearse), reclamarlo
  useEffect(() => {
    const guestToken = localStorage.getItem('guest_token')
    if (!guestToken || !user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await playPanelApi.claimGuestSession(guestToken)
        if (!cancelled && res.data?.ok && !res.data.alreadyClaimed) {
          setClaimMsg('✓ Vinculamos tu última sesión de invitado a tu cuenta')
          await load()
        }
      } catch {
        // silencioso: el guest token puede ser inválido o ya reclamado por otra cuenta
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // Stats agregadas
  const finished = history.filter(h => (h.totalAnswers ?? 0) > 0)
  const totalScore = finished.reduce((s, h) => s + (h.score || 0), 0)
  const totalCorrect = finished.reduce((s, h) => s + (h.correctAnswers || 0), 0)
  const totalAnswered = finished.reduce((s, h) => s + (h.totalAnswers || 0), 0)
  const avgPercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
  const podiums = finished.filter(h => h.finalRank !== null && h.finalRank! <= 3).length

  const handleManualClaim = async () => {
    const token = prompt('Pega el token de invitado (lo encuentras en otro dispositivo donde jugaste sin cuenta):')
    if (!token) return
    setClaiming(true)
    setClaimMsg(null)
    try {
      const res = await playPanelApi.claimGuestSession(token.trim())
      if (res.data?.alreadyClaimed) {
        setClaimMsg('Esa sesión ya estaba reclamada por tu cuenta')
      } else {
        setClaimMsg('✓ Sesión reclamada y vinculada')
      }
      await load()
    } catch (e: any) {
      setClaimMsg(e.response?.data?.message || 'No se pudo reclamar la sesión')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-2">
            <History className="w-7 h-7 text-violet-600" />
            Mi historial
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Todas las sesiones donde participaste con tu cuenta {user?.email ? <span className="font-mono">{user.email}</span> : null}
          </p>
        </div>
        <button
          onClick={handleManualClaim}
          disabled={claiming}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 text-sm font-medium disabled:opacity-50"
          title="Reclamar una sesión jugada como invitado"
        >
          {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Reclamar sesión anónima
        </button>
      </div>

      {claimMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {claimMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Sparkles} label="Sesiones jugadas" value={history.length} color="violet" />
        <StatCard icon={Trophy} label="Puntos totales" value={totalScore.toLocaleString('es-CO')} color="amber" />
        <StatCard icon={Target} label="% Aciertos" value={`${avgPercent}%`} color="emerald" />
        <StatCard icon={Award} label="Podios (Top 3)" value={podiums} color="rose" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : history.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">Aún no has jugado ninguna sesión con tu cuenta</p>
          <p className="text-sm text-gray-500 mt-1">
            Únete a un quiz desde{' '}
            <Link to="/join" className="text-violet-600 hover:underline font-medium">edusyn.co/join</Link>
            {' '}o pídele el código al docente.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Sesión</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Apodo</th>
                <th className="px-4 py-3 text-right">Puntos</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Aciertos</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">%</th>
                <th className="px-4 py-3 text-center">Rank</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map(h => (
                <tr key={h.guestId} className="hover:bg-violet-50/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 truncate max-w-[200px]" title={h.sessionTitle}>
                      {h.sessionTitle}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                      {h.sessionKind === 'QUIZ' ? 'Quiz' : 'Lección'}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base">{h.avatarEmoji || '🎮'}</span>
                      <span className="text-gray-700">{h.nickname}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{h.score}</td>
                  <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                    {h.correctAnswers}/{h.totalAnswers}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">
                    {h.percent !== null ? `${Math.round(h.percent)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {h.finalRank === null ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : h.finalRank <= 3 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-white text-xs font-black">
                        {h.finalRank}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-600">#{h.finalRank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(h.finishedAt || h.joinedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, color,
}: { icon: any; label: string; value: string | number; color: 'violet' | 'amber' | 'emerald' | 'rose' }) {
  const palette = {
    violet: 'from-violet-500 to-fuchsia-500',
    amber: 'from-amber-400 to-orange-500',
    emerald: 'from-emerald-500 to-teal-500',
    rose: 'from-rose-500 to-pink-500',
  }[color]
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${palette} flex items-center justify-center text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{label}</div>
          <div className="text-lg font-black text-gray-900">{value}</div>
        </div>
      </div>
    </div>
  )
}
