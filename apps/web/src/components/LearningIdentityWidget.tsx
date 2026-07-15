import { useEffect, useState } from 'react'
import { Flame, Trophy, Zap } from 'lucide-react'
import { gamificationApi, type LearningIdentityView } from '../lib/api'

/**
 * Widget persistente de Identidad de Aprendizaje del estudiante: nivel, progreso
 * de XP hacia el siguiente nivel y racha. Estética profesional (sirve de primaria
 * a 11°). Progreso privado: solo lo ve el propio estudiante. Falla en silencio.
 */
export default function LearningIdentityWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<LearningIdentityView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    gamificationApi.me()
      .then(({ data }) => { if (alive) setData(data) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // Si el backend aún no tiene la capa (migración no corrida) o hay error, no estorbar.
  if (failed) return null
  if (loading) {
    return <div className="h-[68px] rounded-2xl bg-slate-100 animate-pulse" />
  }
  if (!data) return null

  const span = Math.max(data.levelCeilXp - data.levelFloorXp, 1)
  const into = Math.min(Math.max(data.totalXp - data.levelFloorXp, 0), span)
  const pct = Math.round((into / span) * 100)
  const toNext = Math.max(data.levelCeilXp - data.totalXp, 0)

  return (
    <div className={`flex items-center gap-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 px-4 py-3 shadow-sm ${compact ? '' : 'sm:px-5'}`}>
      {/* Nivel */}
      <div className="flex flex-col items-center justify-center flex-shrink-0">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
          <Trophy className="h-5 w-5" />
        </div>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">Nivel {data.level}</span>
      </div>

      {/* Progreso de XP */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            <Zap className="h-4 w-4 text-amber-500" /> {data.totalXp.toLocaleString()} XP
          </span>
          <span className="text-xs text-slate-500">
            {toNext > 0 ? `${toNext.toLocaleString()} XP para nivel ${data.level + 1}` : '¡Nivel máximo del tramo!'}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Racha */}
      <div className="flex flex-col items-center justify-center flex-shrink-0" title={`Racha más larga: ${data.longestStreak} días`}>
        <div className={`flex items-center gap-1 ${data.currentStreak > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
          <Flame className="h-5 w-5" />
          <span className="text-lg font-black leading-none">{data.currentStreak}</span>
        </div>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Racha</span>
      </div>
    </div>
  )
}
