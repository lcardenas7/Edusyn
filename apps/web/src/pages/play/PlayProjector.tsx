import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { playPanelApi } from '../../lib/playApi'
import { usePlaySSE, PlaySSEEvent } from '../../lib/play-sse'
import QRCode from 'react-qr-code'
import { Users, Maximize2, SkipForward, Pause, Play, XCircle, Loader2 } from 'lucide-react'

const KAHOOT_COLORS = [
  { bg: 'bg-red-500', shape: '▲' },
  { bg: 'bg-blue-500', shape: '◆' },
  { bg: 'bg-amber-400', shape: '●' },
  { bg: 'bg-green-600', shape: '■' },
]

export default function PlayProjector() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<any>(null)
  const [answerStats, setAnswerStats] = useState<{ answeredCount: number; totalGuests: number; percent: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [actioning, setActioning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const playToken = typeof window !== 'undefined' ? localStorage.getItem('play_token') ?? undefined : undefined
  const joinUrl = session?.joinCode ? `${window.location.origin}/join/${session.joinCode}` : ''

  const refreshSession = useCallback(() => {
    if (!sessionId) return
    playPanelApi.getLiveQuizStatus(sessionId)
      .then(r => setSession(r.data))
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    refreshSession()
    // Poll cada 8s como fallback por si se pierde algún evento SSE
    pollRef.current = setInterval(refreshSession, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [refreshSession])

  const doStart = async () => {
    if (!sessionId || actioning) return
    setActioning(true)
    try { await playPanelApi.startLiveQuiz(sessionId) } catch {}
    finally { setActioning(false) }
  }

  const doNext = async () => {
    if (!sessionId || actioning) return
    setActioning(true)
    try { await playPanelApi.nextQuestionLive(sessionId) } catch {}
    finally { setActioning(false) }
  }
  const doPause = async () => {
    if (!sessionId || actioning) return
    setActioning(true)
    try { await playPanelApi.pauseSession(sessionId) } catch {}
    finally { setActioning(false) }
  }
  const doResume = async () => {
    if (!sessionId || actioning) return
    setActioning(true)
    try { await playPanelApi.resumeSession(sessionId) } catch {}
    finally { setActioning(false) }
  }
  const doFinish = async () => {
    if (!sessionId || actioning) return
    setActioning(true)
    try { await playPanelApi.finishLiveQuiz(sessionId) } catch {}
    finally { setActioning(false) }
  }

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSSEEvent = useCallback((event: PlaySSEEvent) => {
    if (event.type === 'GUEST_JOINED' || event.type === 'GUEST_LEFT' || event.type === 'SESSION_STATE') {
      if (event.data?.guestsCount !== undefined) {
        setSession((prev: any) => prev ? { ...prev, guestsCount: event.data.guestsCount } : prev)
      }
    } else if (event.type === 'SESSION_PAUSED') {
      setSession((prev: any) => prev ? { ...prev, status: 'PAUSED' } : prev)
    } else if (event.type === 'SESSION_RESUMED') {
      setSession((prev: any) => prev ? { ...prev, status: 'ACTIVE' } : prev)
    } else if (event.type === 'QUESTION_OPENED') {
      setAnswerStats(null)
      const q = event.data.question
      setSession((prev: any) => prev ? {
        ...prev, status: 'ACTIVE',
        currentQuestionIdx: event.data.questionIndex,
        totalQuestions: event.data.totalQuestions,
        currentQuestion: q,
      } : prev)
      if (q?.timeLimitSeconds) startTimer(q.timeLimitSeconds)
    } else if (event.type === 'QUESTION_CLOSED') {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(0)
    } else if (event.type === 'ANSWER_STATS') {
      setAnswerStats(event.data)
    } else if (event.type === 'SESSION_FINISHED') {
      setSession((prev: any) => prev ? { ...prev, status: 'FINISHED', guests: event.data.ranking } : prev)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTimer])

  usePlaySSE({ sessionId: sessionId ?? '', token: playToken, onEvent: handleSSEEvent, enabled: !!sessionId })

  if (!session) return (
    <div className="min-h-screen bg-violet-900 flex items-center justify-center text-white text-xl">Cargando sesión…</div>
  )

  const q = session.currentQuestion
  const totalQ = session.totalQuestions ?? 0
  const currentIdx = (session.currentQuestionIdx ?? 0) + 1
  const timerPercent = q?.timeLimitSeconds && timeLeft !== null ? (timeLeft / q.timeLimitSeconds) * 100 : 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 text-white flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/20">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight">edusyn<span className="text-yellow-300">play</span></span>
          {session.status === 'WAITING' && (
            <span className="rounded-full bg-yellow-300/20 px-3 py-1 text-xs font-bold text-yellow-200">LOBBY</span>
          )}
          {session.status === 'ACTIVE' && (
            <span className="rounded-full bg-green-400/20 px-3 py-1 text-xs font-bold text-green-300">EN VIVO</span>
          )}
          {session.status === 'PAUSED' && (
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300">PAUSADO</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-violet-200">
            <Users className="w-5 h-5" />
            <span className="text-xl font-black">{session.guestsCount ?? 0}</span>
          </div>
          {session.status === 'ACTIVE' && totalQ > 0 && (
            <span className="text-sm font-bold text-violet-200">{currentIdx} / {totalQ}</span>
          )}

          {/* ── Controles del docente ── */}
          {session.status === 'ACTIVE' && (
            <>
              <button onClick={doPause} disabled={actioning}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/40 px-3 py-1.5 text-sm font-bold text-amber-200 transition disabled:opacity-50">
                {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />} Pausar
              </button>
              <button onClick={doNext} disabled={actioning}
                className="flex items-center gap-1.5 rounded-xl bg-green-400/20 hover:bg-green-400/40 px-3 py-1.5 text-sm font-bold text-green-200 transition disabled:opacity-50">
                {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />} Siguiente
              </button>
              <button onClick={doFinish} disabled={actioning}
                className="flex items-center gap-1.5 rounded-xl bg-red-400/20 hover:bg-red-400/40 px-3 py-1.5 text-sm font-bold text-red-300 transition disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Finalizar
              </button>
            </>
          )}
          {session.status === 'PAUSED' && (
            <button onClick={doResume} disabled={actioning}
              className="flex items-center gap-1.5 rounded-xl bg-green-400/20 hover:bg-green-400/40 px-3 py-1.5 text-sm font-bold text-green-200 transition disabled:opacity-50">
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Reanudar
            </button>
          )}
          {session.status === 'WAITING' && (
            <button onClick={doStart} disabled={actioning}
              className="flex items-center gap-1.5 rounded-xl bg-green-500/30 hover:bg-green-500/50 px-4 py-2 text-sm font-black text-green-200 transition disabled:opacity-50">
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Iniciar Quiz
            </button>
          )}

          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="rounded-lg p-2 hover:bg-white/10 transition"
            title="Pantalla completa"
          >
            <Maximize2 className="w-5 h-5 text-violet-200" />
          </button>
        </div>
      </div>

      {/* Timer bar */}
      {session.status === 'ACTIVE' && q?.timeLimitSeconds && (
        <div className="h-2 bg-black/20">
          <div
            className={`h-full transition-all duration-1000 ${timeLeft !== null && timeLeft <= 5 ? 'bg-red-400 animate-pulse' : 'bg-yellow-300'}`}
            style={{ width: `${timerPercent}%` }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 gap-8">
        {/* LOBBY */}
        {session.status === 'WAITING' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <div className="text-center">
              <p className="text-violet-200 text-lg mb-2">Únete en</p>
              <p className="text-white/60 text-base mb-1">edusyn.co/join</p>
              <p className="text-8xl font-black tracking-widest text-yellow-300 drop-shadow-lg mt-2">
                {session.joinCode}
              </p>
            </div>
            {joinUrl && (
              <div className="bg-white p-4 rounded-2xl shadow-2xl">
                <QRCode value={joinUrl} size={180} />
              </div>
            )}
            <div className="flex items-center gap-3 text-2xl font-bold text-violet-200">
              <Users className="w-7 h-7" />
              <span>{session.guestsCount ?? 0} participantes conectados</span>
            </div>
          </div>
        )}

        {/* QUESTION */}
        {session.status === 'ACTIVE' && q && (
          <div className="w-full max-w-5xl flex flex-col gap-6">
            {/* Timer circle */}
            {timeLeft !== null && q.timeLimitSeconds && (
              <div className={`self-center w-20 h-20 rounded-full border-8 flex items-center justify-center text-3xl font-black transition-colors ${
                timeLeft <= 5 ? 'border-red-400 text-red-300' : 'border-yellow-300 text-yellow-200'
              }`}>
                {timeLeft}
              </div>
            )}

            {/* Question text */}
            <div className="rounded-3xl bg-black/30 backdrop-blur-sm px-10 py-8 text-center">
              {q.imageUrl && (
                <img src={q.imageUrl} alt="" className="mx-auto mb-6 h-48 rounded-2xl object-cover" />
              )}
              <p className="text-3xl font-black leading-tight">{q.text}</p>
            </div>

            {/* Answer stats bar */}
            {answerStats && (
              <div className="rounded-2xl bg-black/20 px-6 py-3 flex items-center gap-4">
                <span className="text-violet-200 text-sm font-bold">{answerStats.answeredCount}/{answerStats.totalGuests} respondieron</span>
                <div className="flex-1 bg-white/20 rounded-full h-3">
                  <div className="bg-green-400 h-3 rounded-full transition-all duration-500" style={{ width: `${answerStats.percent}%` }} />
                </div>
                <span className="text-white font-black">{Math.round(answerStats.percent)}%</span>
              </div>
            )}

            {/* Options grid */}
            {(q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_SELECT') && Array.isArray(q.options) && (
              <div className="grid grid-cols-2 gap-4">
                {(q.options as any[]).map((opt: any, idx: number) => {
                  const text = typeof opt === 'string' ? opt : opt?.text ?? ''
                  const c = KAHOOT_COLORS[idx % 4]
                  return (
                    <div key={idx} className={`${c.bg} rounded-2xl flex items-center gap-4 px-6 py-5 text-2xl font-black shadow-lg`}>
                      <span className="text-3xl">{c.shape}</span>
                      <span className="flex-1">{text}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {q.type === 'TRUE_FALSE' && (
              <div className="grid grid-cols-2 gap-4">
                {[{ label: 'Verdadero', c: 'bg-green-500', shape: '▲' }, { label: 'Falso', c: 'bg-red-500', shape: '●' }].map(o => (
                  <div key={o.label} className={`${o.c} rounded-2xl flex items-center gap-4 px-6 py-5 text-2xl font-black shadow-lg`}>
                    <span className="text-3xl">{o.shape}</span>
                    {o.label}
                  </div>
                ))}
              </div>
            )}
            {q.type === 'SHORT_ANSWER' && (
              <div className="rounded-2xl bg-white/10 px-8 py-6 text-center text-2xl font-bold text-violet-100">
                Respuesta abierta — escribe tu respuesta
              </div>
            )}
          </div>
        )}

        {/* FINISHED */}
        {session.status === 'FINISHED' && (
          <div className="w-full max-w-2xl text-center flex flex-col gap-8">
            <div className="text-5xl font-black">🏆 Resultados finales</div>
            {session.guests?.slice(0, 5).map((g: any, i: number) => (
              <div key={g.id} className="flex items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 text-2xl font-bold">
                <span className="w-10 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                <span className="text-2xl">{g.avatarEmoji || '👤'}</span>
                <span className="flex-1 text-left">{g.nickname}</span>
                <span className="text-yellow-300 font-black">{g.score || 0} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
