import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { gamificationApi, type BadgeView } from '../lib/api'

const TIER_RING: Record<string, string> = {
  BRONZE: 'ring-amber-300',
  SILVER: 'ring-slate-300',
  GOLD: 'ring-yellow-400',
}

/**
 * Muestra el catálogo de insignias del estudiante: ganadas a color, bloqueadas
 * atenuadas con candado. Progreso privado (solo lo ve el propio estudiante).
 * Falla en silencio si el backend no tiene la capa.
 */
export default function LearningBadges() {
  const [data, setData] = useState<{ total: number; earned: number; badges: BadgeView[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    gamificationApi.badges()
      .then(({ data }) => { if (alive) setData(data) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed || !data) return null

  // Ordenar: ganadas primero
  const badges = [...data.badges].sort((a, b) => Number(b.earned) - Number(a.earned))
  const shown = expanded ? badges : badges.slice(0, 6)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">
          Insignias <span className="ml-1 text-xs font-medium text-slate-400">{data.earned}/{data.total}</span>
        </h3>
        {badges.length > 6 && (
          <button onClick={() => setExpanded(v => !v)} className="text-xs font-semibold text-violet-600 hover:text-violet-800">
            {expanded ? 'Ver menos' : 'Ver todas'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {shown.map(b => (
          <div
            key={b.code}
            title={`${b.name} — ${b.description}${b.earned ? '' : ' (bloqueada)'}`}
            className={`flex w-16 flex-col items-center gap-1 ${b.earned ? '' : 'opacity-45'}`}
          >
            <div className={`relative flex h-12 w-12 items-center justify-center rounded-full text-2xl ring-2 ${b.earned ? `bg-gradient-to-br from-white to-amber-50 ${TIER_RING[b.tier] || 'ring-slate-200'}` : 'bg-slate-100 ring-slate-200'}`}>
              {b.earned ? b.emoji : <Lock className="h-4 w-4 text-slate-400" />}
            </div>
            <span className="text-center text-[10px] font-medium leading-tight text-slate-600 line-clamp-2">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
