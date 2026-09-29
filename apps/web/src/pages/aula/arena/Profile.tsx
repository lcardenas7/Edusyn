/**
 * Perfil de Arena: las cifras del jugador y sus insignias.
 *
 * Se muestran también las insignias que faltan, con su barra de progreso. Una
 * insignia bloqueada dice qué hacer para conseguirla, que es justo lo que hace
 * que alguien juegue un duelo más; una lista que solo enseña lo ganado no
 * propone nada.
 *
 * Todas las cifras vienen calculadas del servidor.
 */
import { Flame, Target, Trophy } from 'lucide-react'
import { categoryLook } from './categories'
import type { ArenaProfile } from './shared'

const TIER_TONE: Record<string, string> = {
  BRONCE: 'from-[#C2703D] to-[#8A4E2A]',
  PLATA: 'from-[#C9D3E0] to-[#8D99A8]',
  ORO: 'from-[#FFC94A] to-[#D79A1E]',
}

const FAMILY_TITLE: Record<string, string> = {
  victorias: 'Por duelos ganados',
  aciertos: 'Por preguntas acertadas',
  gesta: 'Por hazañas',
  categoria: 'Por categoría',
}

export default function Profile({ profile, loading }: { profile: ArenaProfile | null; loading: boolean }) {
  if (loading) return <p className="mt-6 text-center text-sm text-slate-400">Cargando tu perfil…</p>
  if (!profile) return null

  if (profile.played === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
        <Trophy className="mx-auto text-slate-500" size={36} />
        <p className="mt-3 font-bold">Tu perfil se abre con el primer duelo</p>
        <p className="mt-1 text-sm text-slate-400">Ahí empiezan a contar tus insignias.</p>
      </div>
    )
  }

  const families = ['victorias', 'aciertos', 'gesta', 'categoria'] as const

  return (
    <div className="space-y-6 pb-4">
      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Puntos del año', value: profile.points, tone: 'text-amber-300' },
          { label: 'Duelos ganados', value: `${profile.wins}/${profile.played}`, tone: 'text-white' },
          { label: 'Acierto', value: `${profile.accuracy}%`, tone: 'text-teal-300' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[.05] p-3 text-center">
            <strong className={`block text-2xl font-black tabular-nums ${item.tone}`}>{item.value}</strong>
            <span className="mt-0.5 block text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-400">{item.label}</span>
          </div>
        ))}
      </section>

      <section className="flex gap-2">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[.05] p-3">
          <Flame className="shrink-0 text-orange-400" size={20} />
          <span className="min-w-0 text-xs leading-tight">
            <strong className="block text-base font-black tabular-nums">{profile.currentStreak}</strong>
            <span className="text-slate-400">racha actual · mejor {profile.bestStreak}</span>
          </span>
        </div>
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[.05] p-3">
          <Target className="shrink-0 text-violet-300" size={20} />
          <span className="min-w-0 text-xs leading-tight">
            <strong className="block text-base font-black tabular-nums">{profile.perfects}</strong>
            <span className="text-slate-400">duelos perfectos</span>
          </span>
        </div>
      </section>

      {profile.categories.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Cómo vas por categoría</h2>
          <ul className="mt-3 space-y-2">
            {profile.categories.map((item) => {
              const look = categoryLook(item.name)
              const Mascota = look.mascot
              return (
                <li key={item.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: look.color }}>
                    <Mascota size={26} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{item.name}</strong>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full" style={{ width: `${item.accuracy}%`, backgroundColor: look.color }} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-slate-400">
                    <strong className="block text-sm text-white">{item.correct}/{item.answered}</strong>
                    {item.accuracy}%
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Insignias <span className="tabular-nums text-amber-300">· {profile.earnedCount} de {profile.badges.length}</span>
        </h2>
        {families.map((family) => {
          const list = profile.badges.filter((badge) => badge.family === family)
          if (!list.length) return null
          return (
            <div key={family} className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{FAMILY_TITLE[family]}</h3>
              <ul className="mt-2 space-y-2">
                {list.map((badge) => (
                  <li
                    key={badge.code}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${badge.earned ? 'border-amber-300/30 bg-amber-300/[.08]' : 'border-white/10 bg-white/[.04]'}`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xl ${
                        badge.earned ? TIER_TONE[badge.tier] : 'from-white/10 to-white/5 grayscale'
                      }`}
                      aria-hidden="true"
                    >
                      {badge.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className={`block truncate text-sm ${badge.earned ? 'text-white' : 'text-slate-400'}`}>{badge.name}</strong>
                      <span className="block truncate text-xs text-slate-500">{badge.description}</span>
                      {!badge.earned && (
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <span className="block h-full rounded-full bg-slate-400" style={{ width: `${Math.round((badge.current / badge.target) * 100)}%` }} />
                          </span>
                          <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">{badge.current}/{badge.target}</span>
                        </span>
                      )}
                    </span>
                    {badge.earned && <span className="shrink-0 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black uppercase text-[#1A1633]">{badge.tier}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}
