/**
 * Edusyn Arena — duelos de preguntas entre compañeros.
 *
 * La pantalla está pensada primero para el celular y se comporta como un juego,
 * no como un formulario: tres destinos fijos abajo (Jugar · Duelos · Ranking) y,
 * cuando hay una partida abierta, esa partida ocupa toda la pantalla.
 *
 * Lo que manda sigue siendo el servidor: elige la categoría de la ruleta, congela
 * las siete preguntas, no revela la respuesta correcta hasta que ambos terminan y
 * calcula el ranking. Aquí no se guarda ninguna cifra del marcador.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Dices, Library, ListChecks, Medal, Shuffle, Swords, Trophy } from 'lucide-react'
import api from '../../lib/api/client'
import { toast } from '../../lib/toast'
import { formatBogota } from '../../lib/datetime'
import Match from './arena/Match'
import RankingBoard from './arena/RankingBoard'
import Profile from './arena/Profile'
import Wheel from './arena/Wheel'
import CategoryCard from './arena/CategoryCard'
import { categoryLook, wheelSlices } from './arena/categories'
import { ARENA_STATUS, Avatar, ProgressDots, type ArenaProfile, type Dashboard, type Duel, type Ranking, type RankingScope, type Source } from './arena/shared'

type Tab = 'play' | 'duels' | 'ranking' | 'profile'



export default function Arena() {
  const { classroomId } = useParams<{ classroomId: string }>()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [duel, setDuel] = useState<Duel | null>(null)
  const [tab, setTab] = useState<Tab>('play')
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [scope, setScope] = useState<RankingScope>('group')
  const [rankingLoading, setRankingLoading] = useState(false)
  const [profile, setProfile] = useState<ArenaProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [peer, setPeer] = useState('')
  const [category, setCategory] = useState('Mixta')
  const [pickTheme, setPickTheme] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!classroomId) return
    const response = await api.get<Dashboard>(`/classroom-duels/classrooms/${classroomId}`)
    setDashboard(response.data)
  }, [classroomId])

  const openDuel = useCallback(async (id: string) => {
    const response = await api.get<Duel>(`/classroom-duels/${id}`)
    setDuel(response.data)
  }, [])

  const loadRanking = useCallback(async (next: RankingScope) => {
    if (!classroomId) return
    setRankingLoading(true)
    try {
      const response = await api.get<Ranking>(`/classroom-duels/classrooms/${classroomId}/ranking`, { params: { scope: next } })
      setRanking(response.data)
    } catch (error) {
      toast.error(error)
    } finally {
      setRankingLoading(false)
    }
  }, [classroomId])

  useEffect(() => {
    refresh().catch((error) => toast.error(error)).finally(() => setLoading(false))
  }, [refresh])

  const loadProfile = useCallback(async () => {
    if (!classroomId) return
    setProfileLoading(true)
    try {
      const response = await api.get<ArenaProfile>(`/classroom-duels/classrooms/${classroomId}/me`)
      setProfile(response.data)
    } catch (error) {
      toast.error(error)
    } finally {
      setProfileLoading(false)
    }
  }, [classroomId])

  useEffect(() => {
    if (tab === 'ranking') void loadRanking(scope)
    if (tab === 'profile') void loadProfile()
  }, [tab, scope, loadRanking, loadProfile])

  // Mientras la partida está viva, el rival puede avanzar desde su propio
  // teléfono: se relee cada diez segundos para que el marcador no se quede atrás.
  useEffect(() => {
    if (!duel || (duel.status !== 'ACTIVE' && duel.status !== 'INVITED')) return
    const timer = window.setInterval(() => {
      api.get<Duel>(`/classroom-duels/${duel.id}`).then((response) => setDuel(response.data)).catch(() => undefined)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [duel?.id, duel?.status])

  async function act(operation: () => Promise<void>) {
    setBusy(true)
    try { await operation() } catch (error) { toast.error(error) } finally { setBusy(false) }
  }

  async function invite(mode: 'CHOSEN' | 'ROULETTE', opponent = peer, rivalMode?: 'RANDOM') {
    if (!classroomId || (!opponent && rivalMode !== 'RANDOM')) return
    await act(async () => {
      const response = await api.post<{ id: string; category: string }>(
        `/classroom-duels/classrooms/${classroomId}`,
        { opponentEnrollmentId: rivalMode === 'RANDOM' ? undefined : opponent, category, selectionMode: mode, rivalMode },
      )
      await refresh()
      await openDuel(response.data.id)
    })
  }

  async function respond(accept: boolean) {
    if (!duel) return
    await act(async () => {
      const response = await api.post<Duel>(`/classroom-duels/${duel.id}/${accept ? 'accept' : 'decline'}`)
      setDuel(response.data)
      await refresh()
    })
  }

  async function answer(option: string) {
    if (!duel?.question) return
    await act(async () => {
      const response = await api.post<Duel>(`/classroom-duels/${duel.id}/answers`, { ordinal: duel.question!.ordinal, answer: option })
      setDuel(response.data)
      await refresh()
    })
  }

  async function usePower(kind: 'FIFTY' | 'CATEGORY' = 'FIFTY', pick?: string) {
    if (!duel?.question) return
    await act(async () => {
      const response = await api.post<Duel>(`/classroom-duels/${duel.id}/power`, { ordinal: duel.question!.ordinal, kind, category: pick })
      setDuel(response.data)
    })
  }

  async function rematch() {
    if (!duel) return
    const opponent = duel.opponentEnrollmentId
    const mode = duel.category === 'Ruleta' ? 'ROULETTE' : 'CHOSEN'
    setDuel(null)
    setPeer(opponent)
    await invite(mode, opponent)
  }

  async function toggleSource(source: Source) {
    if (!classroomId) return
    await act(async () => {
      const response = await api.put<Dashboard>(`/classroom-duels/classrooms/${classroomId}/sources/${source.id}`, { enabled: !source.enabled })
      setDashboard(response.data)
      toast.success(source.enabled ? 'Cuestionario retirado de Arena' : 'Cuestionario habilitado para Arena')
    })
  }

  function wheelCategories() {
    if (!dashboard) return []
    return dashboard.categories.length ? dashboard.categories : [{ name: 'Mixta', count: dashboard.questionCount }]
  }

  if (duel) {
    return (
      <Match
        duel={duel} wheel={wheelCategories()} busy={busy}
        onClose={() => { setDuel(null); void refresh() }}
        onRespond={respond} onAnswer={answer} onPower={usePower} onRematch={rematch}
        onRanking={() => { setDuel(null); setTab('ranking') }}
      />
    )
  }

  const isTeacher = dashboard?.role === 'teacher'
  const duels = dashboard?.duels ?? []
  const myTurn = duels.filter((item) => (item.status === 'INVITED' && item.isInvitee) || (item.status === 'ACTIVE' && item.myProgress < 7))
  const waiting = duels.filter((item) => (item.status === 'INVITED' && !item.isInvitee) || (item.status === 'ACTIVE' && item.myProgress >= 7))
  const closed = duels.filter((item) => ['COMPLETED', 'DECLINED', 'EXPIRED'].includes(item.status))
  const ready = !!dashboard && dashboard.questionCount >= dashboard.minimumQuestions
  const wheel = wheelCategories()
  // Mismo orden de gajos que usa la partida: cada tema en su propio color, y la
  // vuelta repartida para que dos tonos parecidos no queden pegados.
  const slices = wheelSlices(wheel.map((item) => item.name))

  const tabs: { id: Tab; label: string; icon: typeof Swords; badge?: number }[] = isTeacher
    ? [{ id: 'play', label: 'Contenido', icon: Library }, { id: 'ranking', label: 'Ranking', icon: Trophy }]
    : [
        { id: 'play', label: 'Jugar', icon: Swords },
        { id: 'duels', label: 'Duelos', icon: ListChecks, badge: myTurn.length },
        { id: 'ranking', label: 'Ranking', icon: Trophy },
        { id: 'profile', label: 'Perfil', icon: Medal },
      ]

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0E1130] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_-5%,rgba(123,92,255,.3),transparent_40%),radial-gradient(circle_at_100%_15%,rgba(79,224,198,.14),transparent_38%)]" />

      <header className="relative flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          to={`/aula/${classroomId}/actividades`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
          aria-label="Salir de la Arena"
        >
          <ArrowLeft size={19} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-black leading-none">
            <Swords size={20} className="text-amber-300" /> Arena
          </h1>
          <p className="mt-1 truncate text-xs text-slate-400">
            {dashboard?.classroomTitle ?? 'Aula'}{dashboard?.gradeName ? ` · ${dashboard.gradeName}` : ''}
          </p>
        </div>
        {dashboard && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-center">
            <strong className="block text-sm font-black tabular-nums text-amber-300">{dashboard.questionCount}</strong>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">preguntas</span>
          </span>
        )}
      </header>

      <main className="relative flex-1 overflow-y-auto px-4 pb-4 pt-5">
        {loading && <p className="text-center text-slate-400">Cargando Arena…</p>}

        {/* ── Estudiante · Jugar ─────────────────────────────────────────── */}
        {!loading && !isTeacher && tab === 'play' && dashboard && (
          !ready ? (
            <div className="mt-6 rounded-3xl border border-amber-300/25 bg-amber-300/[.08] p-6 text-center">
              <Dices className="mx-auto text-amber-300" size={38} />
              <h2 className="mt-3 text-xl font-black">La Arena todavía no abre</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Tu docente debe habilitar al menos {dashboard.minimumQuestions} preguntas. Hay {dashboard.questionCount}.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">1 · Elige rival</h2>
              {dashboard.peers.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">No hay compañeros disponibles en este grupo.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {dashboard.peers.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button" aria-pressed={peer === item.id} onClick={() => setPeer(item.id)}
                        className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition-colors ${
                          peer === item.id ? 'border-amber-300 bg-amber-300/10' : 'border-transparent bg-white/[.06] active:bg-white/10'
                        }`}
                      >
                        <Avatar name={item.name} size={42} />
                        <span className="w-full truncate text-center text-[11px] font-semibold leading-tight text-slate-200">{item.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button" disabled={busy} onClick={() => invite('ROULETTE', '', 'RANDOM')}
                className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/25 text-sm font-bold text-slate-200 disabled:opacity-40"
              >
                <Shuffle size={17} /> O que me toque un rival al azar
              </button>

              <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">2 · Lanza el duelo</h2>
              <section className="mt-3 rounded-3xl border border-white/10 bg-white/[.05] p-5 text-center">
                <div className="mx-auto flex w-fit flex-col items-center">
                  <span className="z-10 -mb-2 h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-white" aria-hidden="true" />
                  <Wheel slices={slices} rotation={0} hub="RETAR" size={208} />
                </div>
                <h3 className="mt-5 text-lg font-black">Siete rondas al azar</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">
                  En cada ronda la ruleta saca un tema y, de ese tema, una pregunta. Los dos reciben exactamente las mismas siete.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {slices.map((slice) => {
                    const Mascota = slice.mascot
                    return (
                      <span key={slice.name} className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2.5 text-[11px] font-bold text-white" style={{ backgroundColor: slice.color }}>
                        <Mascota size={17} tone="flat" /> {slice.name}
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button" disabled={!peer || busy} onClick={() => invite('ROULETTE')}
                  className="mt-5 min-h-14 w-full rounded-2xl bg-amber-300 text-lg font-black text-[#1A1633] shadow-[0_5px_0_#C99A2E] transition-all active:translate-y-[3px] active:shadow-[0_2px_0_#C99A2E] disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none"
                >
                  {peer ? '🎡 Girar y retar' : 'Elige un rival'}
                </button>
              </section>

              <button
                type="button" onClick={() => setPickTheme((previous) => !previous)}
                aria-expanded={pickTheme}
                className="mt-5 min-h-11 w-full text-sm font-bold text-slate-400 underline underline-offset-4"
              >
                {pickTheme ? 'Ocultar' : '¿Prefieres elegir el tema tú?'}
              </button>

              {pickTheme && (
                <div className="mt-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Elige un tema</h3>
                  <p className="mt-1 text-xs text-slate-500">Las siete preguntas saldrán solo de esa categoría.</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {dashboard.categories.map((item) => (
                      <CategoryCard
                        key={item.name} name={item.name} count={item.count}
                        active={category === item.name} onSelect={() => setCategory(item.name)}
                      />
                    ))}
                  </div>
                  <button
                    type="button" aria-pressed={category === 'Mixta'} onClick={() => setCategory('Mixta')}
                    className={`mt-3 min-h-12 w-full rounded-2xl text-sm font-bold ${category === 'Mixta' ? 'bg-amber-300 text-[#1A1633]' : 'border border-white/15 bg-white/5 text-slate-200'}`}
                  >
                    🌈 Mixta · las {dashboard.questionCount} preguntas
                  </button>
                  <button
                    type="button" disabled={!peer || busy} onClick={() => invite('CHOSEN')}
                    className="mt-3 min-h-14 w-full rounded-2xl border-2 border-amber-300/60 bg-amber-300/10 font-black text-amber-200 disabled:opacity-40"
                  >
                    Retar · {category}
                  </button>
                </div>
              )}
            </>
          )
        )}

        {/* ── Estudiante · Duelos ────────────────────────────────────────── */}
        {!loading && !isTeacher && tab === 'duels' && (
          duels.length === 0 ? (
            <div className="mt-10 text-center">
              <Swords className="mx-auto text-slate-600" size={44} />
              <p className="mt-4 font-bold">Sin partidas todavía</p>
              <p className="mt-1 text-sm text-slate-400">Reta a alguien desde «Jugar».</p>
            </div>
          ) : (
            <div className="space-y-6">
              {([['Te toca', myTurn], ['Esperando al rival', waiting], ['Terminados', closed]] as const).map(([title, list]) => list.length > 0 && (
                <section key={title}>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{title} <span className="tabular-nums text-slate-500">· {list.length}</span></h2>
                  <ul className="mt-3 space-y-2">
                    {list.map((item) => {
                      const status = ARENA_STATUS[item.status] ?? { label: item.status, tone: 'bg-white/10 text-slate-200 border-white/15' }
                      return (
                        <li key={item.id}>
                          <button
                            type="button" onClick={() => act(() => openDuel(item.id))}
                            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-3 text-left active:bg-white/10"
                          >
                            <Avatar name={item.opponent} size={44} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <strong className="truncate">{item.opponent}</strong>
                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.tone}`}>{status.label}</span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-400">
                                {item.category} · {formatBogota(item.createdAt, { day: 'numeric', month: 'short' })}
                              </span>
                              {item.status === 'ACTIVE' && (
                                <span className="mt-2 flex items-center gap-2">
                                  <ProgressDots total={7} done={item.myProgress} tone="bg-amber-300" />
                                  <span className="h-3 w-px bg-white/20" />
                                  <ProgressDots total={7} done={item.opponentProgress} tone="bg-slate-400" />
                                </span>
                              )}
                            </span>
                            <ChevronRight size={18} className="shrink-0 text-slate-500" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )
        )}

        {/* ── Docente · Contenido ────────────────────────────────────────── */}
        {!loading && isTeacher && tab === 'play' && dashboard && (
          <>
            <section className="rounded-3xl border border-teal-300/20 bg-teal-300/[.07] p-5">
              <h2 className="text-lg font-black">Banco de cuestionarios</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">Crea preguntas por grado, materia y categoría en una biblioteca independiente del aula.</p>
              <Link to={`/aula/${classroomId}/banco-preguntas`} className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-teal-300 py-3 font-black text-[#0E2B33]">
                Abrir el banco <ChevronRight size={17} />
              </Link>
            </section>

            <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">Reutilizar cuestionarios del aula</h2>
            {dashboard.sources.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">No hay cuestionarios publicados en esta aula para reutilizar.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dashboard.sources.map((source) => (
                  <li key={source.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] p-3.5">
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">{source.title}</strong>
                      <span className="text-xs text-slate-400">{source.questionCount} preguntas</span>
                    </span>
                    <button
                      type="button" disabled={busy} onClick={() => toggleSource(source)}
                      className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${source.enabled ? 'bg-teal-300 text-[#0E2B33]' : 'border border-white/25 text-white'}`}
                    >
                      {source.enabled ? 'Habilitado' : 'Habilitar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <section className="mt-7 rounded-3xl border border-amber-300/20 bg-amber-300/[.07] p-5">
              <h2 className="font-black text-amber-200">Cómo funciona el juego</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                <li>· Una categoría se puede jugar cuando reúne 7 preguntas compatibles; «Mixta» las combina todas.</li>
                <li>· Los dos rivales reciben exactamente las mismas 7 preguntas.</li>
                <li>· Cada quien responde cuando puede: no hace falta coincidir.</li>
                <li>· Cada jugador tiene un descarte 50/50 por duelo.</li>
                <li>· Las respuestas correctas solo se revelan cuando ambos terminan.</li>
                <li>· Cada estudiante envía hasta 3 retos en 24 horas y mantiene un duelo abierto por compañero.</li>
                <li>· El resultado es interno de la institución y no cambia las notas.</li>
              </ul>
            </section>
          </>
        )}

        {/* ── Ranking (ambos roles) ──────────────────────────────────────── */}
        {!loading && tab === 'ranking' && (
          <RankingBoard ranking={ranking} scope={scope} onScope={setScope} loading={rankingLoading} />
        )}

        {/* ── Estudiante · Perfil e insignias ────────────────────────────── */}
        {!loading && !isTeacher && tab === 'profile' && <Profile profile={profile} loading={profileLoading} />}
      </main>

      <nav className="relative border-t border-white/10 bg-[#141838] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2" aria-label="Secciones de la Arena">
        <ul className="flex">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <li key={id} className="flex-1">
              <button
                type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold ${tab === id ? 'text-amber-300' : 'text-slate-400'}`}
              >
                <Icon size={21} />
                {label}
                {!!badge && (
                  <span className="absolute right-[22%] top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
