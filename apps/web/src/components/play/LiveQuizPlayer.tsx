import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy,
  Play,
  Radio,
  SkipForward,
  Square,
  Trophy,
  Users,
  Clock,
} from 'lucide-react'
import { Podium, CircularTimer } from '../AnimalAvatars'

interface LiveGuest {
  id: string
  nickname: string
  avatarEmoji?: string | null
  score?: number
  correctAnswers?: number
  totalAnswers?: number
}

interface LiveQuestion {
  id: string
  type: string
  text: string
  options?: any
  points?: number
  timeLimitSeconds?: number | null
}

interface LiveSessionState {
  id: string
  joinCode?: string
  status: 'WAITING' | 'ACTIVE' | 'FINISHED'
  guestsCount?: number
  currentQuestionIdx?: number
  totalQuestions?: number
  questions?: LiveQuestion[]
  guests?: LiveGuest[]
  currentQuestion?: LiveQuestion | null
}

interface LiveQuizPlayerProps {
  liveSession: LiveSessionState
  sseConnected: boolean
  sseFallback: boolean
  onCopyJoinCode: () => void
  onStartGame: () => void
  onNextQuestion: () => void
  onFinishGame: () => void
  onClose: () => void
}

export default function LiveQuizPlayer({
  liveSession,
  sseConnected,
  sseFallback,
  onCopyJoinCode,
  onStartGame,
  onNextQuestion,
  onFinishGame,
  onClose,
}: LiveQuizPlayerProps) {
  const currentQuestion = useMemo(() => {
    if (liveSession.currentQuestion) return liveSession.currentQuestion
    const idx = liveSession.currentQuestionIdx ?? -1
    if (idx < 0 || !liveSession.questions?.[idx]) return null
    return liveSession.questions[idx]
  }, [liveSession])

  const totalQuestions = liveSession.totalQuestions || liveSession.questions?.length || 0
  const currentQuestionNumber = (liveSession.currentQuestionIdx ?? 0) + 1
  const progressPercent = totalQuestions > 0 ? (currentQuestionNumber / totalQuestions) * 100 : 0
  const timeLimit = currentQuestion?.timeLimitSeconds ?? 15
  const [timeLeft, setTimeLeft] = useState(timeLimit)

  useEffect(() => {
    if (liveSession.status !== 'ACTIVE') return
    setTimeLeft(timeLimit)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [liveSession.status, currentQuestion?.id, timeLimit])

  const podiumEntries = useMemo(() => {
    return (liveSession.guests || []).slice(0, 3).map((guest, index) => ({
      name: guest.nickname,
      score: guest.score || 0,
      rank: index + 1,
    }))
  }, [liveSession.guests])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-fuchsia-600 to-cyan-500 text-white shadow-xl"
    >
      <div className="border-b border-white/10 px-6 py-4 backdrop-blur-sm bg-black/10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${liveSession.status === 'ACTIVE' ? 'text-rose-200 animate-pulse' : 'animate-pulse'}`} />
              <span className="text-lg font-black tracking-tight">
                {liveSession.status === 'WAITING' ? 'Lobby en vivo' : liveSession.status === 'ACTIVE' ? 'Quiz en vivo' : 'Resultados finales'}
              </span>
            </div>
            {sseFallback && (
              <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs text-yellow-100">
                Conexión degradada
              </span>
            )}
            {sseConnected && !sseFallback && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-emerald-100">
                ● SSE conectado
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-sm text-white/70 transition hover:text-white">
            {liveSession.status === 'FINISHED' ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {liveSession.status === 'WAITING' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="text-center">
                <p className="mb-2 text-sm text-violet-100">Comparte este código con tus participantes</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="select-all rounded-2xl bg-white px-6 py-3 font-mono text-4xl font-black tracking-[0.3em] text-violet-700 shadow-lg">
                    {liveSession.joinCode}
                  </div>
                  <button onClick={onCopyJoinCode} className="rounded-xl bg-white/15 p-3 transition hover:bg-white/25" title="Copiar código">
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-violet-100">Los participantes entran en <strong>edusyn.co/join</strong></p>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="font-semibold">Participantes conectados</span>
                  </div>
                  <div className="mb-4 text-3xl font-black">{liveSession.guestsCount || 0}</div>
                  {liveSession.guests && liveSession.guests.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {liveSession.guests.map((guest) => (
                        <span key={guest.id} className="rounded-full bg-white/15 px-3 py-1 text-sm">
                          {guest.avatarEmoji || '👤'} {guest.nickname}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-end">
                  <button
                    onClick={onStartGame}
                    disabled={!liveSession.guestsCount}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar juego
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {liveSession.status === 'ACTIVE' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                      Pregunta {currentQuestionNumber} / {totalQuestions}
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                      {liveSession.guestsCount || 0} jugadores
                    </span>
                  </div>
                  <h3 className="max-w-3xl text-2xl font-black leading-tight">
                    {currentQuestion?.text || 'Esperando pregunta...'}
                  </h3>
                  <div className="mt-3 flex items-center gap-3 text-sm text-violet-50/90">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-3 py-1">
                      <Clock className="h-4 w-4" /> {timeLimit}s
                    </span>
                    <span className="rounded-full bg-black/15 px-3 py-1">
                      {currentQuestion?.points || 0} pts
                    </span>
                    <span className="rounded-full bg-black/15 px-3 py-1">
                      {currentQuestion?.type || 'QUIZ'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-center lg:justify-end">
                  <CircularTimer timeLeft={timeLeft} totalTime={timeLimit} size={84} />
                </div>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-white"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <p className="mb-3 text-sm font-semibold text-violet-100">Vista previa</p>
                  {Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {currentQuestion.options.map((option: any, index: number) => (
                        <motion.div
                          key={option.id || `${index}-${option.text}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm font-medium text-white/95"
                        >
                          <span className="mr-2 font-black text-cyan-200">{String.fromCharCode(65 + index)}.</span>
                          {option.text}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/90">
                      Pregunta de respuesta abierta
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <p className="mb-3 text-sm font-semibold text-violet-100">Ranking en vivo</p>
                  {liveSession.guests && liveSession.guests.length > 0 ? (
                    <div className="space-y-2">
                      {liveSession.guests.slice(0, 5).map((guest, index) => (
                        <div key={guest.id} className="flex items-center gap-3 rounded-xl bg-black/10 px-3 py-2">
                          <span className="w-6 text-center font-black text-cyan-200">{index + 1}</span>
                          <span className="text-lg">{guest.avatarEmoji || '👤'}</span>
                          <span className="flex-1 truncate font-semibold">{guest.nickname}</span>
                          <span className="font-black">{guest.score || 0}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-black/10 px-3 py-4 text-sm text-white/80">
                      Aún no hay puntajes acumulados.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={onNextQuestion}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-violet-700 transition hover:bg-violet-50"
                >
                  <SkipForward className="h-4 w-4" />
                  {currentQuestionNumber >= totalQuestions ? 'Finalizar' : 'Siguiente pregunta'}
                </button>
                <button
                  onClick={onFinishGame}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/90 px-6 py-3 font-bold text-white transition hover:bg-rose-500"
                >
                  <Square className="h-4 w-4" />
                  Terminar
                </button>
              </div>
            </motion.div>
          )}

          {liveSession.status === 'FINISHED' && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-300/20 p-3">
                  <Trophy className="h-6 w-6 text-yellow-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-black">Juego terminado</h3>
                  <p className="text-sm text-violet-100">Resultados finales del quiz</p>
                </div>
              </div>

              {podiumEntries.length > 0 ? (
                <div className="rounded-3xl bg-black/15 p-4 backdrop-blur-sm">
                  <Podium entries={podiumEntries} />
                </div>
              ) : (
                <div className="rounded-2xl bg-white/10 px-4 py-5 text-sm text-violet-100">
                  No hubo participantes en esta sesión.
                </div>
              )}

              {liveSession.guests && liveSession.guests.length > 0 && (
                <div className="space-y-2">
                  {liveSession.guests.slice(0, 10).map((guest, index) => (
                    <motion.div
                      key={guest.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3"
                    >
                      <span className="w-8 text-center text-lg font-black">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </span>
                      <span className="text-lg">{guest.avatarEmoji || '👤'}</span>
                      <span className="flex-1 truncate font-semibold">{guest.nickname}</span>
                      <span className="font-black">{guest.score || 0} pts</span>
                      <span className="text-xs text-violet-100/80">{guest.correctAnswers || 0}/{guest.totalAnswers || 0}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-2xl bg-white px-6 py-3 font-black text-violet-700 transition hover:bg-violet-50"
              >
                Cerrar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
