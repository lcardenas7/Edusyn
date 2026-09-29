/**
 * Tabla de posiciones.
 *
 * Las cifras las calcula el servidor a partir de duelos ya terminados; aquí solo
 * se muestran. El criterio de orden se enseña completo para que cualquiera pueda
 * comprobar su posición: sin fórmulas ocultas no hay sensación de trampa.
 *
 * La tabla es interna del aula. Nunca sale de Edusyn y usa el mismo nombre corto
 * (nombre + inicial del apellido) que el resto de la Arena.
 */
import { Info, Medal } from 'lucide-react'
import { Avatar, type Ranking, type RankingScope } from './shared'

const PODIUM = ['#FFC94A', '#C9D3E0', '#D79A6A']

export default function RankingBoard({
  ranking, scope, onScope, loading,
}: {
  ranking: Ranking | null
  scope: RankingScope
  onScope: (next: RankingScope) => void
  loading: boolean
}) {
  return (
    <div className="pb-4">
      <div className="flex rounded-2xl bg-white/[.07] p-1" role="tablist" aria-label="Alcance del ranking">
        {([['group', 'Mi curso'], ['grade', 'Mi grado'], ['general', 'General']] as const).map(([value, label]) => (
          <button
            key={value} type="button" role="tab" aria-selected={scope === value}
            onClick={() => onScope(value)}
            className={`min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors ${
              scope === value ? 'bg-amber-300 text-[#1A1633]' : 'text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-center text-sm text-slate-400">Calculando posiciones…</p>}

      {!loading && ranking && (
        <>
          <p className="mt-4 text-sm font-bold text-white">{ranking.scopeLabel}</p>
          <p className="text-xs leading-5 text-slate-400">{ranking.scopeHint}</p>

          {ranking.rows.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <Medal className="mx-auto text-slate-500" size={34} />
              <p className="mt-3 font-bold">Todavía no hay posiciones</p>
              <p className="mt-1 text-sm text-slate-400">La tabla aparece cuando termine el primer duelo.</p>
            </div>
          ) : (
            <>
              <ol className="mt-4 space-y-2">
                {ranking.rows.map((row) => (
                  <li
                    key={row.enrollmentId}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      row.isMe ? 'border-amber-300/50 bg-amber-300/10' : 'border-white/10 bg-white/[.05]'
                    }`}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums"
                      style={row.rank <= 3
                        ? { backgroundColor: PODIUM[row.rank - 1], color: '#1A1633' }
                        : { backgroundColor: 'rgba(255,255,255,.08)', color: '#cbd5e1' }}
                    >
                      {row.rank}
                    </span>
                    <Avatar name={row.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        {row.name}
                        {row.isMe && <span className="ml-2 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black uppercase text-[#1A1633]">Tú</span>}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-400">
                        {row.played} {row.played === 1 ? 'duelo' : 'duelos'} · {row.wins}G {row.draws}E {row.losses}P
                        {row.perfects > 0 && <span className="text-amber-300/90"> · {row.perfects} perfecta{row.perfects > 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      <strong className="block text-xl font-black tabular-nums text-amber-300">{row.points}</strong>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">pts</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <p className="flex items-center gap-2 text-sm font-bold"><Info size={15} className="text-teal-300" /> Cómo se ganan los puntos</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Los puntos se ganan <strong className="text-slate-200">por duelo, no por pregunta</strong>: acertar muchas preguntas en partidas perdidas no sube posiciones.
                </p>
                <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-slate-300">
                  <li>· Ganar un duelo: <strong className="text-amber-300">{ranking.criteria.win}</strong> · empatar: <strong className="text-amber-300">{ranking.criteria.draw}</strong> · perder: <strong className="text-amber-300">{ranking.criteria.loss}</strong></li>
                  <li>· <strong className="text-amber-300">+{ranking.criteria.perfect}</strong> si aciertas las siete preguntas del duelo.</li>
                  <li>· <strong className="text-amber-300">+{ranking.criteria.upset}</strong> si le ganas a alguien que iba por delante de ti en la tabla.</li>
                  <li>· Solo cuentan los duelos que ambos terminaron.</li>
                  <li>· Empate en puntos: va primero quien tenga más aciertos; luego quien haya jugado más duelos; y al final, orden alfabético.</li>
                </ul>
                {ranking.truncated && (
                  <p className="mt-3 text-xs text-amber-200">La tabla usa los duelos más recientes; los más antiguos quedan fuera.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
