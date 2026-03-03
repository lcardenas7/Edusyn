import { useState, useEffect, useRef, useCallback } from 'react'
import { liveSessionApi } from '../lib/api'
import {
  Zap, Play, SkipForward, Trophy, X, CheckCircle2, XCircle,
  Clock, Users, Loader2, BarChart3, Image as ImageIcon, Volume2, VolumeX,
  ChevronRight, Award, Timer, Radio
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LiveQuizProps {
  classroomId: string
  isTeacher: boolean
  onClose: () => void
  // Teacher: pass activityId to create session
  activityId?: string
  activityTitle?: string
  // Student: pass existing sessionId
  sessionId?: string
}

interface RankEntry {
  rank: number
  name: string
  totalPoints: number
  correctAnswers?: number
  studentEnrollmentId?: string
  teamId?: string
  color?: string
}

// Color palette for avatar backgrounds
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LiveQuiz({ classroomId, isTeacher, onClose, activityId, activityTitle, sessionId: initialSessionId }: LiveQuizProps) {
  const [sessionId, setSessionId] = useState(initialSessionId || '')
  const [session, setSession] = useState<any>(null)
  const [phase, setPhase] = useState<'loading' | 'lobby' | 'question' | 'answer_reveal' | 'ranking' | 'finished'>('loading')
  const [error, setError] = useState('')

  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [questionIndex, setQuestionIndex] = useState(-1)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeLimit, setTimeLimit] = useState(15)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isBonus, setIsBonus] = useState(false)
  const [multiplier, setMultiplier] = useState(1)

  // Student answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [multiAnswers, setMultiAnswers] = useState<string[]>([])
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({})
  const [blankAnswers, setBlankAnswers] = useState<string[]>([])
  const [orderAnswers, setOrderAnswers] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null)
  const [answerStartTime, setAnswerStartTime] = useState(0)

  // Progress + ranking
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [ranking, setRanking] = useState<RankEntry[]>([])

  // Reveal state
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)

  // Music (teacher only)
  const [musicOn, setMusicOn] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscRef = useRef<OscillatorNode | null>(null)

  // SSE
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isTeacher && activityId) {
      createSession()
    } else if (initialSessionId) {
      setSessionId(initialSessionId)
      loadSession(initialSessionId)
    } else {
      checkActiveSession()
    }
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (timerRef.current) clearInterval(timerRef.current)
      stopMusic()
    }
  }, [])

  const createSession = async () => {
    try {
      const { data } = await liveSessionApi.create({ classroomId, activityId: activityId! })
      setSessionId(data.id)
      setSession(data)
      setTotalQuestions(data.activity?.questions?.length || 0)
      setPhase('lobby')
      connectSSE(data.id)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear sesión')
    }
  }

  const loadSession = async (sid: string) => {
    try {
      const { data } = await liveSessionApi.get(sid)
      setSession(data)
      setTotalQuestions(data.activity?.questions?.length || 0)
      if (data.status === 'FINISHED') {
        setPhase('finished')
      } else if (data.status === 'WAITING') {
        setPhase('lobby')
      } else {
        setPhase('question')
      }
      connectSSE(sid)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sesión no encontrada')
    }
  }

  const checkActiveSession = async () => {
    try {
      const { data } = await liveSessionApi.getActive(classroomId)
      if (data && data.id) {
        setSessionId(data.id)
        loadSession(data.id)
      } else {
        setError('No hay sesión activa en este momento')
      }
    } catch {
      setError('No hay sesión activa en este momento')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const connectSSE = useCallback((sid: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close()

    const token = localStorage.getItem('token')
    const baseUrl = liveSessionApi.streamUrl(sid)
    const url = `${baseUrl}?token=${token}`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('SESSION_STARTED', () => {
      setPhase('lobby')
    })

    es.addEventListener('QUESTION', (e: any) => {
      const data = JSON.parse(e.data)
      setCurrentQuestion(data)
      setQuestionIndex(data.index)
      setTotalQuestions(data.total)
      setTimeLimit(data.timeLimit || 15)
      setTimeLeft(data.timeLimit || 15)
      setIsBonus(data.isBonus || false)
      setMultiplier(data.multiplier || 1)
      setSelectedAnswer('')
      setMultiAnswers([])
      setMatchAnswers({})
      setBlankAnswers([])
      setOrderAnswers(data.options && data.type === 'ORDERING' ? [...(data.options as string[])] : [])
      setAnswered(false)
      setAnswerResult(null)
      setCorrectAnswer(null)
      setExplanation(null)
      setTotalAnswered(0)
      setAnswerStartTime(Date.now())
      setPhase('question')
      startTimer(data.timeLimit || 15)
    })

    es.addEventListener('ANSWER_PROGRESS', (e: any) => {
      const data = JSON.parse(e.data)
      setTotalAnswered(data.totalAnswered)
    })

    es.addEventListener('QUESTION_CLOSED', (e: any) => {
      const data = JSON.parse(e.data)
      setCorrectAnswer(data.correctAnswer)
      setExplanation(data.explanation)
      setPhase('answer_reveal')
      stopTimer()
    })

    es.addEventListener('RANKING', (e: any) => {
      const data = JSON.parse(e.data)
      setRanking(data)
      setPhase('ranking')
    })

    es.addEventListener('SESSION_FINISHED', (e: any) => {
      const data = JSON.parse(e.data)
      setRanking(data)
      setPhase('finished')
      stopTimer()
    })

    es.addEventListener('PING', () => { /* keep alive */ })

    es.onerror = () => {
      // Auto-reconnect is built into EventSource
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER
  // ═══════════════════════════════════════════════════════════════════════════

  const startTimer = (seconds: number) => {
    stopTimer()
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopTimer()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSIC (Web Audio API - lightweight tones, no mp3 files)
  // ═══════════════════════════════════════════════════════════════════════════

  const startMusic = () => {
    if (audioCtxRef.current) return
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 220
    gain.gain.value = 0.03
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    // Modulate frequency for ambient feel
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.3
    lfoGain.gain.value = 30
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start()
    oscRef.current = osc
    setMusicOn(true)
  }

  const stopMusic = () => {
    if (oscRef.current) {
      try { oscRef.current.stop() } catch {}
      oscRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
    setMusicOn(false)
  }

  const toggleMusic = () => {
    if (musicOn) stopMusic()
    else startMusic()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStart = async () => {
    try {
      await liveSessionApi.start(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleNextQuestion = async () => {
    try {
      await liveSessionApi.nextQuestion(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleCloseQuestion = async () => {
    try {
      await liveSessionApi.closeQuestion(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleShowRanking = async () => {
    try {
      await liveSessionApi.showRanking(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleFinish = async () => {
    try {
      await liveSessionApi.finish(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENT: SUBMIT ANSWER
  // ═══════════════════════════════════════════════════════════════════════════

  const submitAnswer = async (answerValue: string) => {
    if (answered || !currentQuestion) return
    setAnswered(true)
    const responseTimeMs = Date.now() - answerStartTime
    try {
      const { data } = await liveSessionApi.answer(sessionId, {
        questionId: currentQuestion.questionId,
        answer: answerValue,
        responseTimeMs,
      })
      setAnswerResult(data)
    } catch (err: any) {
      setAnswerResult({ isCorrect: false, points: 0 })
    }
  }

  const handleSelectOption = (opt: string) => {
    if (answered) return
    setSelectedAnswer(opt)
    submitAnswer(opt)
  }

  const handleMultiSelect = (opt: string) => {
    if (answered) return
    setMultiAnswers(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])
  }

  const submitMultiAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(multiAnswers))
  }

  const handleMatchAnswer = (left: string, right: string) => {
    setMatchAnswers(prev => ({ ...prev, [left]: right }))
  }

  const submitMatchAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(matchAnswers))
  }

  const submitBlankAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(blankAnswers))
  }

  const handleOrderMove = (from: number, to: number) => {
    if (answered) return
    const arr = [...orderAnswers]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    setOrderAnswers(arr)
  }

  const submitOrderAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(orderAnswers))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (error && phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-400 mx-auto" />
          <p className="text-white text-lg">{error}</p>
          <button onClick={onClose} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Volver</button>
        </div>
      </div>
    )
  }

  // Timer bar width
  const timerPercent = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0
  const timerColor = timeLeft > timeLimit * 0.5 ? 'bg-green-500' : timeLeft > timeLimit * 0.25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-400" />
          <span className="text-white font-bold text-lg">Live Quiz</span>
          {session?.activity?.title && (
            <span className="text-white/60 text-sm hidden sm:block">— {session.activity.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isTeacher && (
            <button onClick={toggleMusic} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              {musicOn ? <Volume2 className="w-5 h-5 text-yellow-400" /> : <VolumeX className="w-5 h-5 text-white/40" />}
            </button>
          )}
          <button onClick={() => { stopMusic(); onClose() }} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm text-center">{error}</div>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
          <div className="text-center space-y-3">
            <Radio className="w-16 h-16 text-indigo-400 mx-auto animate-pulse" />
            <h1 className="text-3xl sm:text-5xl font-black text-white">
              {activityTitle || session?.activity?.title || 'Live Quiz'}
            </h1>
            <p className="text-indigo-300 text-lg">{totalQuestions} preguntas</p>
          </div>

          {isTeacher ? (
            <div className="space-y-4 text-center">
              <p className="text-white/60">Los estudiantes pueden unirse desde su aula virtual</p>
              <button
                onClick={handleNextQuestion}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 flex items-center gap-3 mx-auto"
              >
                <Play className="w-6 h-6" /> Iniciar primera pregunta
              </button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-indigo-500/30 flex items-center justify-center mx-auto">
                <Users className="w-10 h-10 text-indigo-400" />
              </div>
              <p className="text-white/60 text-lg">Esperando a que el profesor inicie...</p>
            </div>
          )}
        </div>
      )}

      {/* QUESTION */}
      {phase === 'question' && currentQuestion && (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Timer bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div className={`absolute inset-y-0 left-0 ${timerColor} rounded-full transition-all duration-1000`} style={{ width: `${timerPercent}%` }} />
          </div>

          {/* Question header */}
          <div className="flex items-center justify-between">
            <span className="text-indigo-300 font-semibold">Pregunta {questionIndex + 1} / {totalQuestions}</span>
            <div className="flex items-center gap-2">
              {isBonus && <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold">BONUS x{multiplier}</span>}
              <span className="text-3xl font-black text-white">{timeLeft}s</span>
            </div>
          </div>

          {/* Question text + image */}
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed">{currentQuestion.text}</p>
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt="" className="mt-4 max-h-64 rounded-xl mx-auto object-contain" />
            )}
          </div>

          {/* Answer area */}
          {isTeacher ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-black text-white">{totalAnswered}</p>
                  <p className="text-white/50 text-sm">respuestas</p>
                </div>
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <button onClick={handleCloseQuestion} className="px-5 py-3 bg-amber-500/20 text-amber-400 rounded-xl font-semibold hover:bg-amber-500/30 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Cerrar pregunta
                </button>
                <button onClick={handleShowRanking} className="px-5 py-3 bg-purple-500/20 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Ver ranking
                </button>
                <button onClick={handleNextQuestion} className="px-5 py-3 bg-indigo-500/20 text-indigo-400 rounded-xl font-semibold hover:bg-indigo-500/30 flex items-center gap-2">
                  <SkipForward className="w-4 h-4" /> Siguiente
                </button>
              </div>
            </div>
          ) : (
            /* Student answer UI */
            <div className="space-y-3">
              {answered && answerResult ? (
                <div className={`text-center p-6 rounded-2xl ${answerResult.isCorrect ? 'bg-green-500/20 border-2 border-green-500/40' : 'bg-red-500/20 border-2 border-red-500/40'}`}>
                  {answerResult.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
                      <p className="text-green-400 text-2xl font-bold">¡Correcto!</p>
                      <p className="text-green-300 text-lg mt-1">+{Math.round(answerResult.points)} pts</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
                      <p className="text-red-400 text-2xl font-bold">Incorrecto</p>
                      <p className="text-red-300 text-sm mt-1">0 pts</p>
                    </>
                  )}
                </div>
              ) : timeLeft <= 0 && !answered ? (
                <div className="text-center p-6 rounded-2xl bg-white/5">
                  <Clock className="w-14 h-14 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-xl font-bold">Tiempo agotado</p>
                </div>
              ) : (
                renderAnswerOptions()
              )}
            </div>
          )}
        </div>
      )}

      {/* ANSWER REVEAL */}
      {phase === 'answer_reveal' && (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-white/10 rounded-2xl p-6 text-center space-y-4 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-white">Respuesta correcta</h2>
            {correctAnswer && <p className="text-green-400 text-xl font-semibold">{correctAnswer}</p>}
            {explanation && <p className="text-white/60">{explanation}</p>}
          </div>
          {isTeacher && (
            <div className="flex justify-center gap-3">
              <button onClick={handleShowRanking} className="px-5 py-3 bg-purple-500/20 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Ver ranking
              </button>
              <button onClick={handleNextQuestion} className="px-5 py-3 bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500/30 flex items-center gap-2">
                <SkipForward className="w-4 h-4" /> Siguiente pregunta
              </button>
            </div>
          )}
        </div>
      )}

      {/* RANKING */}
      {(phase === 'ranking' || phase === 'finished') && (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="text-center space-y-2">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
            <h2 className="text-3xl font-black text-white">
              {phase === 'finished' ? 'Resultados finales' : 'Ranking'}
            </h2>
          </div>

          <div className="space-y-3">
            {ranking.map((entry, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const bgColor = i === 0 ? 'bg-yellow-500/20 border-yellow-500/40' : i === 1 ? 'bg-slate-400/20 border-slate-400/40' : i === 2 ? 'bg-amber-700/20 border-amber-700/40' : 'bg-white/5 border-white/10'
              const color = entry.color || getAvatarColor(entry.name)
              return (
                <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${bgColor} transition-all`}>
                  <div className="text-2xl font-black text-white w-8 text-center">
                    {medal || entry.rank}
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: color }}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{entry.name}</p>
                    {entry.correctAnswers !== undefined && (
                      <p className="text-white/40 text-xs">{entry.correctAnswers} correctas</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{entry.totalPoints.toLocaleString()}</p>
                    <p className="text-white/40 text-xs">pts</p>
                  </div>
                </div>
              )
            })}
            {ranking.length === 0 && (
              <p className="text-white/40 text-center py-8">Sin respuestas aún</p>
            )}
          </div>

          {isTeacher && phase === 'ranking' && (
            <div className="flex justify-center gap-3">
              <button onClick={handleNextQuestion} className="px-5 py-3 bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500/30 flex items-center gap-2">
                <SkipForward className="w-4 h-4" /> Siguiente pregunta
              </button>
              <button onClick={handleFinish} className="px-5 py-3 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 flex items-center gap-2">
                <X className="w-4 h-4" /> Finalizar
              </button>
            </div>
          )}

          {phase === 'finished' && (
            <div className="text-center">
              <button onClick={onClose} className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-lg font-bold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg">
                Volver al aula
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWER OPTIONS RENDERER (student)
  // ═══════════════════════════════════════════════════════════════════════════

  function renderAnswerOptions() {
    if (!currentQuestion) return null
    const q = currentQuestion
    const type = q.type
    const options = q.options

    // MULTIPLE_CHOICE / TRUE_FALSE
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      const opts = Array.isArray(options) ? options as string[] : []
      const optColors = ['from-blue-500 to-blue-600', 'from-red-500 to-red-600', 'from-green-500 to-green-600', 'from-yellow-500 to-yellow-600', 'from-purple-500 to-purple-600', 'from-pink-500 to-pink-600']
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opts.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => handleSelectOption(opt)}
              disabled={answered}
              className={`p-4 sm:p-5 rounded-2xl text-white font-bold text-base sm:text-lg text-center transition-all bg-gradient-to-br ${optColors[i % optColors.length]} hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-lg`}
            >
              <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          ))}
        </div>
      )
    }

    // MULTIPLE_SELECT
    if (type === 'MULTIPLE_SELECT') {
      const opts = Array.isArray(options) ? options as string[] : []
      return (
        <div className="space-y-3">
          {opts.map((opt: string, i: number) => {
            const sel = multiAnswers.includes(opt)
            return (
              <button
                key={i}
                onClick={() => handleMultiSelect(opt)}
                className={`w-full p-4 rounded-2xl text-left font-semibold transition-all ${sel ? 'bg-indigo-500/40 border-2 border-indigo-400 text-white' : 'bg-white/10 border-2 border-white/10 text-white/80 hover:border-white/30'}`}
              >
                <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>{opt}
              </button>
            )
          })}
          <button onClick={submitMultiAnswer} disabled={multiAnswers.length === 0} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
            Confirmar selección
          </button>
        </div>
      )
    }

    // SHORT_ANSWER
    if (type === 'SHORT_ANSWER') {
      return (
        <div className="flex gap-2">
          <input
            value={selectedAnswer}
            onChange={e => setSelectedAnswer(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={() => submitAnswer(selectedAnswer)} disabled={!selectedAnswer.trim()} className="px-6 py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
            Enviar
          </button>
        </div>
      )
    }

    // FILL_BLANK
    if (type === 'FILL_BLANK') {
      const parts = q.text.split('___')
      const blankCount = parts.length - 1
      return (
        <div className="space-y-4">
          <div className="text-white/80 text-lg leading-relaxed">
            {parts.map((part: string, i: number) => (
              <span key={i}>
                {part}
                {i < blankCount && (
                  <input
                    value={blankAnswers[i] || ''}
                    onChange={e => { const arr = [...blankAnswers]; arr[i] = e.target.value; setBlankAnswers(arr) }}
                    className="inline-block w-32 mx-1 px-3 py-1 border-b-2 border-indigo-400 bg-indigo-900/50 text-indigo-200 font-medium text-center focus:outline-none"
                    placeholder={`(${i + 1})`}
                  />
                )}
              </span>
            ))}
          </div>
          <button onClick={submitBlankAnswer} disabled={blankAnswers.filter(b => b?.trim()).length === 0} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
            Confirmar respuesta
          </button>
        </div>
      )
    }

    // ORDERING
    if (type === 'ORDERING') {
      return (
        <div className="space-y-3">
          {orderAnswers.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/10">
              <span className="w-7 h-7 rounded-lg bg-amber-500/30 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 text-white">{item}</span>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => i > 0 && handleOrderMove(i, i - 1)} disabled={i === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-white/60">▲</button>
                <button onClick={() => i < orderAnswers.length - 1 && handleOrderMove(i, i + 1)} disabled={i === orderAnswers.length - 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-white/60">▼</button>
              </div>
            </div>
          ))}
          <button onClick={submitOrderAnswer} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40">
            Confirmar orden
          </button>
        </div>
      )
    }

    // MATCHING
    if (type === 'MATCHING') {
      const leftItems = options?.left || []
      const rightItems = options?.right || []
      return (
        <div className="space-y-3">
          {leftItems.map((left: string, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/10">
              <div className="flex-1 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 font-medium">{left}</div>
              <span className="text-white/30 text-center hidden sm:block">→</span>
              <select
                value={matchAnswers[left] || ''}
                onChange={e => handleMatchAnswer(left, e.target.value)}
                className="flex-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="" className="bg-slate-800">Seleccionar...</option>
                {rightItems.map((right: string, j: number) => (
                  <option key={j} value={right} className="bg-slate-800">{right}</option>
                ))}
              </select>
            </div>
          ))}
          <button onClick={submitMatchAnswer} disabled={Object.keys(matchAnswers).length < leftItems.length} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
            Confirmar emparejamiento
          </button>
        </div>
      )
    }

    return <p className="text-white/50 text-center">Tipo de pregunta no soportado</p>
  }
}
