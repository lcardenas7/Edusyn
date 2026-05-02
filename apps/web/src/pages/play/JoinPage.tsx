import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { guestApi } from '../../lib/playApi'
import { usePlaySSE, PlaySSEEvent } from '../../lib/play-sse'
import { playSound, fireConfetti } from '../../lib/play-effects'
import { ANIMAL_AVATARS, getAvatar, AnimalAvatar, AvatarSelector } from '../../components/AnimalAvatars'
import {
  Sparkles,
  Hash,
  ArrowRight,
  AlertCircle,
  Loader2,
  Users,
  Trophy,
  Clock,
  LogOut,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'

const KAHOOT_OPTS = [
  { bg: 'bg-red-500',    active: 'hover:bg-red-600',    shape: '▲', text: 'text-white' },
  { bg: 'bg-blue-500',   active: 'hover:bg-blue-600',   shape: '◆', text: 'text-white' },
  { bg: 'bg-amber-400',  active: 'hover:bg-amber-500',  shape: '●', text: 'text-amber-900' },
  { bg: 'bg-green-600',  active: 'hover:bg-green-700',  shape: '■', text: 'text-white' },
]

const REACTIONS = ['�', '🤔', '❤️', '�', '🔥', '�']

interface SessionInfo {
  sessionId: string
  title: string
  teacherName: string
  guestsCount: number
  status: string
  type: 'quiz' | 'lesson'
}

type Step = 'code' | 'nickname' | 'lobby' | 'active' | 'interlude' | 'finished' | 'error'

interface InterludeData {
  ranking: Array<{ id: string; nickname: string; avatarEmoji: string; score: number; correctAnswers: number }>
  answeredCount: number
  totalGuests: number
}

interface LobbyGuest {
  id: string
  nickname: string
  avatarEmoji: string | null
}

interface AnswerStats {
  questionId: string
  answeredCount: number
  totalGuests: number
  percent: number
}

interface SessionStatus {
  id: string
  status: 'WAITING' | 'ACTIVE' | 'FINISHED'
  currentQuestionIdx: number
  guestsCount: number
  activityTitle: string
  totalQuestions: number
  currentQuestion?: {
    id: string
    type: string
    text: string
    options?: any
    points: number
    imageUrl?: string | null
    timeLimitSeconds?: number | null
  }
}

interface AnswerFeedback {
  questionId: string
  sent: boolean
  isCorrect?: boolean
  pointsAwarded?: number
  revealed?: boolean
  error?: string
}

function getQuestionOptions(rawOptions: unknown): Array<{ id?: string; text?: string }> {
  if (Array.isArray(rawOptions)) {
    return rawOptions as Array<{ id?: string; text?: string }>
  }
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions)
      return Array.isArray(parsed) ? (parsed as Array<{ id?: string; text?: string }>) : []
    } catch {
      return []
    }
  }
  return []
}

export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>()

  const [step, setStep] = useState<Step>(urlCode ? 'nickname' : 'code')
  const [code, setCode] = useState(urlCode || '')
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState(() => ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)].id)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('play_sound') !== 'false')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lookingUp, setLookingUp] = useState(!!urlCode)
  const [guestToken, setGuestToken] = useState<string | undefined>(undefined)
  const [sseFallback, setSseFallback] = useState(false)
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null)
  const [totalScore, setTotalScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [interludeData, setInterludeData] = useState<InterludeData | null>(null)
  const [reactionCooldown, setReactionCooldown] = useState(false)
  const [lobbyGuests, setLobbyGuests] = useState<LobbyGuest[]>([])
  const [streak, setStreak] = useState(0)
  const [answerStats, setAnswerStats] = useState<AnswerStats | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [livePoints, setLivePoints] = useState<number | null>(null)
  const [finalRanking, setFinalRanking] = useState<Array<{ id: string; nickname: string; avatarEmoji: string; score: number; correctAnswers: number; totalAnswers?: number }> | null>(null)

  const questionStartRef = useRef<number>(0)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const interludeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundEnabledRef = useRef(soundEnabled)
  const streakRef = useRef(streak)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const currentQuestionIdRef = useRef<string>('')

  useEffect(() => { streakRef.current = streak }, [streak])

  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  const toggleSound = () => {
    setSoundEnabled(prev => {
      localStorage.setItem('play_sound', String(!prev))
      return !prev
    })
  }

  // Auto-lookup if code in URL
  useEffect(() => {
    if (urlCode) {
      lookupCode(urlCode)
    }
  }, [urlCode])

  // Restaurar sesión de invitado tras refresh — valida contra la API antes de restaurar (F6.5)
  useEffect(() => {
    const savedToken = localStorage.getItem('guest_token') || undefined
    const savedSessionRaw = localStorage.getItem('guest_session')
    if (!savedToken || !savedSessionRaw) return

    let saved: { sessionId: string; nickname?: string; avatar?: string; title?: string; teacherName?: string } | null = null
    try {
      saved = JSON.parse(savedSessionRaw)
    } catch {
      localStorage.removeItem('guest_token')
      localStorage.removeItem('guest_session')
      return
    }
    if (!saved?.sessionId) return

    // Validate session is still active before restoring
    guestApi.getSessionStatus(saved.sessionId)
      .then(res => {
        const status = res.data?.status
        if (status === 'FINISHED' || !status) {
          localStorage.removeItem('guest_token')
          localStorage.removeItem('guest_session')
          return
        }
        setGuestToken(savedToken)
        if (saved!.nickname) setNickname(saved!.nickname)
        if (saved!.avatar) setAvatarId(saved!.avatar)
        if (res.data.guests) setLobbyGuests(res.data.guests)
        setSession((prev) => prev ?? {
          sessionId: saved!.sessionId,
          title: saved!.title ?? '',
          teacherName: saved!.teacherName ?? '',
          guestsCount: res.data.guestsCount ?? 0,
          status: status,
          type: 'quiz',
        })
        if (status === 'ACTIVE') {
          setSessionStatus(res.data)
          setStep('active')
        } else {
          setStep('lobby')
        }
      })
      .catch(() => {
        localStorage.removeItem('guest_token')
        localStorage.removeItem('guest_session')
      })
  }, [])

  const sseSessionId = session?.sessionId ?? ''

  const handleFallbackPoll = useCallback(async () => {
    if (!sseSessionId) return
    try {
      const res = await guestApi.getSessionStatus(sseSessionId)
      const status = res.data
      setSessionStatus(status)
      if (status.status === 'ACTIVE') setStep('active')
      if (status.status === 'FINISHED') setStep('finished')
    } catch {}
  }, [sseSessionId])

  const handleSSEEvent = useCallback((event: PlaySSEEvent) => {
    if (event.type === 'PING') return

    if (event.type === 'SESSION_STATE') {
      if (event.data?._fallback) {
        setSseFallback(true)
        return
      }
      setSseFallback(false)
      setSessionStatus((prev) => (prev ? { ...prev, ...event.data } : event.data))
      if (event.data?.status === 'ACTIVE') setStep('active')
      if (event.data?.status === 'FINISHED') setStep('finished')
      return
    }

    if (event.type === 'GUEST_JOINED') {
      setSessionStatus((prev) => (prev ? { ...prev, guestsCount: event.data.guestsCount } : prev))
      setSession((prev) => (prev ? { ...prev, guestsCount: event.data.guestsCount } : prev))
      // F6.6: añadir al lobby (evitar duplicados)
      if (event.data.guestId && event.data.nickname) {
        setLobbyGuests(prev => {
          if (prev.find(g => g.id === event.data.guestId)) return prev
          return [...prev, { id: event.data.guestId, nickname: event.data.nickname, avatarEmoji: event.data.avatarEmoji ?? null }]
        })
      }
      return
    }

    if (event.type === 'ANSWER_STATS') {
      setAnswerStats(event.data)
      return
    }

    if (event.type === 'QUESTION_OPENED') {
      if (interludeTimerRef.current) clearTimeout(interludeTimerRef.current)
      setInterludeData(null)
      setAnswerStats(null)
      const now = Date.now()
      questionStartRef.current = event.data.questionOpenedAt ?? now
      currentQuestionIdRef.current = event.data.question?.id ?? ''
      // Start client timer
      const limit = event.data.question?.timeLimitSeconds ?? null
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (limit && limit > 0) {
        setTimeLeft(limit)
        timerIntervalRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === null || prev <= 1) {
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current!)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        setTimeLeft(null)
      }
      setSessionStatus((prev) =>
        prev
          ? {
              ...prev,
              status: 'ACTIVE',
              currentQuestionIdx: event.data.questionIndex,
              totalQuestions: event.data.totalQuestions,
              currentQuestion: event.data.question,
            }
          : {
              id: sseSessionId,
              status: 'ACTIVE',
              currentQuestionIdx: event.data.questionIndex,
              guestsCount: session?.guestsCount ?? 0,
              activityTitle: session?.title ?? '',
              totalQuestions: event.data.totalQuestions,
              currentQuestion: event.data.question,
            }
      )
      setLivePoints(Number(event.data.question?.points) || 1000)
      setSelectedAnswer(null)
      setAnswerFeedback(null)
      setStep('active')
      return
    }

    // F6.2 + F6.11 + F6.12 + F6.13 + F6.15 — QUESTION_CLOSED
    if (event.type === 'QUESTION_CLOSED') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      setTimeLeft(0)
      setInterludeData({
        ranking: event.data.ranking ?? [],
        answeredCount: event.data.answeredCount ?? 0,
        totalGuests: event.data.totalGuests ?? 0,
      })
      setAnswerFeedback(prev => {
        if (!prev) {
          // Student didn't answer before question closed — mark as missed
          return { questionId: currentQuestionIdRef.current, sent: false, isCorrect: false, pointsAwarded: 0, revealed: true }
        }
        // Efectos de sonido + háptica + confetti al revelar
        requestAnimationFrame(() => {
          if (prev.isCorrect) {
            if (soundEnabledRef.current) playSound('correct')
            fireConfetti('correct')
            if ('vibrate' in navigator) navigator.vibrate([80, 40, 80])
          } else if (prev.sent) {
            if (soundEnabledRef.current) playSound('incorrect')
            if ('vibrate' in navigator) navigator.vibrate([200])
          }
        })
        // F6.16: streak
        requestAnimationFrame(() => {
          if (prev.isCorrect) setStreak(s => s + 1)
          else setStreak(0)
        })
        return { ...prev, revealed: true }
      })
      // Transición a interlude tras 2.5s
      interludeTimerRef.current = setTimeout(() => setStep('interlude'), 2500)
      return
    }

    if (event.type === 'SESSION_FINISHED') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (interludeTimerRef.current) clearTimeout(interludeTimerRef.current)
      if (soundEnabledRef.current) playSound('winner')
      fireConfetti('celebration')
      if (event.data?.ranking) setFinalRanking(event.data.ranking)
      setSessionStatus((prev) => (prev ? { ...prev, status: 'FINISHED' } : prev))
      setStep('finished')
      return
    }
  }, [session?.guestsCount, session?.title, sseSessionId])

  usePlaySSE({
    sessionId: sseSessionId,
    guestToken,
    onEvent: handleSSEEvent,
    onFallback: handleFallbackPoll,
    enabled: !!sseSessionId && !!guestToken && (step === 'lobby' || step === 'active'),
  })

  // Safety net: polling explícito cada 4s en lobby/active
  // Esto garantiza que si el SSE falla, el estudiante igual recibe actualizaciones
  useEffect(() => {
    if (!sseSessionId || !guestToken) return
    if (step !== 'lobby' && step !== 'active') return
    const interval = setInterval(() => {
      handleFallbackPoll().catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [sseSessionId, guestToken, step, handleFallbackPoll])

  // Cuando cambia la pregunta: limpiar feedback y asegurar que questionStartRef tiene timestamp válido
  // SSE setea questionStartRef en QUESTION_OPENED; polling lo inicializa aquí si SSE no llegó
  useEffect(() => {
    setAnswerFeedback(null)
    setSelectedAnswer(null)
    questionStartRef.current = Date.now()
  }, [sessionStatus?.currentQuestion?.id])

  // Live points ticker — mirrors backend speedFactor formula so the display matches awarded points
  useEffect(() => {
    const q = sessionStatus?.currentQuestion
    if (!q) { setLivePoints(null); return }
    const basePoints = Number(q.points) || 1000
    if (!q.timeLimitSeconds || q.timeLimitSeconds <= 0 || timeLeft === null) {
      setLivePoints(basePoints); return
    }
    const elapsed = q.timeLimitSeconds - timeLeft
    const speedFactor = Math.max(0.5, 1 - 0.5 * (Math.max(0, elapsed) / q.timeLimitSeconds))
    setLivePoints(Math.round(basePoints * speedFactor))
  }, [timeLeft, sessionStatus?.currentQuestion])

  const lookupCode = async (joinCode: string) => {
    setLookingUp(true)
    setError('')
    try {
      const res = await guestApi.lookup(joinCode)
      if (!res.data.allowJoin) {
        setError('Esta sesión ya terminó. Pide el código actualizado al docente.')
        setStep('code')
        return
      }
      setSession(res.data)
      setStep('nickname')
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Código no válido o sesión no encontrada. Verifica e intenta de nuevo.')
      } else if (err.response?.status === 403) {
        setError(err.response.data?.message || 'No puedes unirte a esta sesión.')
      } else {
        setError('Error al buscar la sesión')
      }
      setStep('code')
    } finally {
      setLookingUp(false)
    }
  }

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = code.replace(/\s/g, '')
    if (cleaned.length !== 6 || !/^\d{6}$/.test(cleaned)) {
      setError('El código debe tener 6 dígitos')
      return
    }
    lookupCode(cleaned)
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Ingresa un nombre para continuar')
      return
    }
    setLoading(true)
    setError('')
    try {
      const avatarEmoji = getAvatar(avatarId).emoji
      const res = await guestApi.join(code.replace(/\s/g, ''), {
        nickname: nickname.trim(),
        avatarEmoji,
      })

      // Save guest token
      localStorage.setItem('guest_token', res.data.guestToken)
      localStorage.setItem('guest_session', JSON.stringify({
        sessionId: res.data.sessionId,
        guestId: res.data.guestId,
        nickname: nickname.trim(),
        avatar: avatarId,
        title: session?.title ?? '',
        teacherName: session?.teacherName ?? '',
      }))
      setGuestToken(res.data.guestToken)
      setGuestId(res.data.guestId ?? null)
      setTotalScore(0)
      setAnswerFeedback(null)
      setInterludeData(null)
      setSseFallback(false)
      setStep('lobby')
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo unir a la sesión')
    } finally {
      setLoading(false)
    }
  }

  // F6.5: Exit current session
  const handleExit = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    if (interludeTimerRef.current) clearTimeout(interludeTimerRef.current)
    localStorage.removeItem('guest_token')
    localStorage.removeItem('guest_session')
    setGuestToken(undefined)
    setGuestId(null)
    setSession(null)
    setSessionStatus(null)
    setAnswerFeedback(null)
    setInterludeData(null)
    setTotalScore(0)
    setTimeLeft(null)
    setReactionCooldown(false)
    setLobbyGuests([])
    setStreak(0)
    setAnswerStats(null)
    setSelectedAnswer(null)
    setLivePoints(null)
    setFinalRanking(null)
    setStep('code')
    setCode('')
  }

  // F6.14 — Reacciones flotantes
  const handleReaction = useCallback(async (emoji: string) => {
    if (!session?.sessionId || reactionCooldown) return
    setReactionCooldown(true)
    setTimeout(() => setReactionCooldown(false), 2000)
    try {
      await guestApi.submitReaction(session.sessionId, {
        emoji,
        slideIndex: sessionStatus?.currentQuestionIdx,
      })
    } catch { /* no-op */ }
  }, [session?.sessionId, sessionStatus?.currentQuestionIdx, reactionCooldown])

  // Submit answer — F6.1: real timeTakenMs; F6.2: only shows "Esperando..."
  const handleAnswer = async (questionId: string, selectedOption?: string, answerText?: string) => {
    if (!session?.sessionId) return
    if (answerFeedback?.questionId === questionId && !answerFeedback.error) return
    if (selectedAnswer !== null) return

    const timeTakenMs = Date.now() - questionStartRef.current
    const optKey = selectedOption ?? answerText ?? ''
    setSelectedAnswer(optKey)
    setAnswerFeedback({ questionId, sent: true })

    if ('vibrate' in navigator) navigator.vibrate(40)

    try {
      const res = await guestApi.submitAnswer(session.sessionId, {
        questionId,
        selectedOption,
        answerText,
        timeTakenMs,
      })
      const points = Number(res.data?.pointsAwarded || 0)
      const isCorrect = Boolean(res.data?.isCorrect)
      setAnswerFeedback({
        questionId,
        sent: true,
        isCorrect,
        pointsAwarded: points,
        revealed: false,
      })
      setTotalScore(prev => prev + points)
    } catch (err: any) {
      setSelectedAnswer(null)
      const status = err?.response?.status
      const msg = status === 429
        ? 'Demasiados intentos. Espera un momento e intenta de nuevo.'
        : status === 401
        ? 'Sesión expirada. Recarga la página para reconectarte.'
        : 'No se pudo enviar la respuesta. Intenta de nuevo.'
      setAnswerFeedback({ questionId, sent: true, error: msg })
    }
  }

  // Format code as user types (XXX XXX)
  const handleCodeChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    if (digits.length > 3) {
      setCode(digits.slice(0, 3) + ' ' + digits.slice(3))
    } else {
      setCode(digits)
    }
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-fuchsia-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-400/5 rounded-full blur-3xl" />
      </div>

      <div className={`relative z-10 w-full ${step === 'active' || step === 'interlude' || step === 'finished' ? 'max-w-md' : 'max-w-sm'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">Edusyn Play</span>
          </div>
        </div>

        {/* ═══ STEP 1: Enter Code ═══ */}
        {step === 'code' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
              <Hash className="w-7 h-7 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Unirse a la sesión</h2>
            <p className="text-sm text-gray-500 mb-6">Ingresa el código de 6 dígitos que te compartió tu profesor</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleCodeSubmit}>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition placeholder:text-gray-300 placeholder:tracking-[0.2em] placeholder:text-2xl"
                placeholder="000 000"
                maxLength={7}
              />
              <button
                type="submit"
                disabled={lookingUp || code.replace(/\s/g, '').length !== 6}
                className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {lookingUp ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Buscar sesión <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ═══ STEP 2: Nickname + Avatar ═══ */}
        {step === 'nickname' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Session info */}
            {session && (
              <div className="bg-violet-50 rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-violet-600 font-medium">{session.title}</p>
                <p className="text-xs text-violet-400 mt-1">por {session.teacherName}</p>
                <div className="flex items-center justify-center gap-3 mt-2 text-xs text-violet-500">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {session.guestsCount} conectados</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${session.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                    {session.status === 'ACTIVE' ? 'En vivo' : 'Esperando'}
                  </span>
                </div>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">¿Cómo te llamas?</h2>
            <p className="text-sm text-gray-500 mb-5 text-center">Elige un nombre y un avatar</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleJoin}>
              {/* Avatar selector — F6.10 */}
              <div className="mb-5">
                <AvatarSelector selected={avatarId} onSelect={setAvatarId} />
              </div>

              {/* Nickname */}
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">{getAvatar(avatarId).emoji}</span>
                <input
                  type="text"
                  autoFocus
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setError('') }}
                  maxLength={20}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition text-lg font-medium"
                  placeholder="Tu nombre..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || !nickname.trim()}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Unirme <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <button
              onClick={() => { setStep('code'); setSession(null); setCode('') }}
              className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Cambiar código
            </button>
          </div>
        )}

        {/* ═══ STEP 3: Lobby (waiting) ═══ */}
        {step === 'lobby' && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Gradient player-card header */}
            <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 px-6 py-8 text-white text-center">
              <AnimalAvatar avatarId={avatarId} name={nickname} size="xl" />
              <h2 className="text-xl font-black mt-3 mb-0.5 tracking-tight">{nickname}</h2>
              {session && (
                <div className="mt-1.5">
                  <p className="text-sm font-semibold text-violet-100">{session.title}</p>
                  <p className="text-xs text-violet-300 mt-0.5">por {session.teacherName}</p>
                </div>
              )}
            </div>

            <div className="p-5">
              {/* Waiting animation + player count */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-gray-500">Esperando al profesor...</span>
                </div>
                {sseFallback && (
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-yellow-50 border border-yellow-200 px-3 py-1 text-xs text-yellow-700">
                    Conexión degradada
                  </div>
                )}
                <div className="inline-flex items-center gap-2 bg-violet-50 rounded-2xl px-5 py-2.5">
                  <Users className="w-5 h-5 text-violet-600" />
                  <span className="text-2xl font-black text-violet-900">{sessionStatus?.guestsCount || session?.guestsCount || 0}</span>
                  <span className="text-sm text-violet-600 font-medium">jugadores</span>
                </div>
              </div>

              {/* Avatar grid */}
              {lobbyGuests.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 text-center mb-2">{lobbyGuests.length} conectado{lobbyGuests.length !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap justify-center gap-3 max-h-28 overflow-hidden">
                    {lobbyGuests.map((g, i) => (
                      <motion.div
                        key={g.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.04, type: 'spring', stiffness: 300 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span className="text-2xl">{g.avatarEmoji || '😎'}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[48px]">{g.nickname}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reactions */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 text-center mb-2">Reacciona mientras esperas</p>
                <div className="flex justify-center gap-2">
                  {REACTIONS.map(r => (
                    <button key={r} onClick={() => handleReaction(r)}
                      className={`text-xl p-2 rounded-xl transition-all ${reactionCooldown ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 active:scale-125'}`}
                    >{r}</button>
                  ))}
                </div>
              </div>

              {/* Bottom bar: sound + exit */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <button onClick={toggleSound} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {soundEnabled ? 'Sonido activo' : 'Silencio'}
                </button>
                <button onClick={handleExit} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
                  <LogOut className="w-3.5 h-3.5" /> Salir
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 4: Active Question ═══ */}
        {step === 'active' && sessionStatus?.currentQuestion && (() => {
          const q = sessionStatus.currentQuestion
          const hasAnswered = selectedAnswer !== null
          const isRevealed = answerFeedback?.revealed === true
          const isCorrect = answerFeedback?.isCorrect === true
          const didAnswer = answerFeedback?.sent === true
          const options = getQuestionOptions(q.options)

          const HEADER_GRADIENTS = [
            'from-violet-600 to-fuchsia-600',
            'from-blue-600 to-cyan-500',
            'from-orange-500 to-amber-500',
            'from-emerald-600 to-teal-500',
            'from-rose-600 to-pink-500',
          ]
          const baseGrad = HEADER_GRADIENTS[sessionStatus.currentQuestionIdx % HEADER_GRADIENTS.length]
          const headerGrad = isRevealed && didAnswer
            ? isCorrect ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'
            : baseGrad

          return (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* ── Colored header ── */}
            <div className={`bg-gradient-to-br ${headerGrad} px-4 pt-3 pb-4 text-white transition-colors duration-500`}>
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AnimalAvatar avatarId={avatarId} name={nickname} size="sm" />
                  <div>
                    <p className="text-xs font-bold text-white leading-none truncate max-w-[90px]">{nickname}</p>
                    <p className="text-[10px] text-white/60">P. {sessionStatus.currentQuestionIdx + 1}/{sessionStatus.totalQuestions}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {streak >= 2 && (
                    <span className="text-xs font-bold bg-orange-400/80 rounded-full px-2 py-0.5">🔥 {streak}</span>
                  )}
                  <span className="flex items-center gap-0.5 text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
                    <Zap className="w-3 h-3" /> {totalScore}
                  </span>
                  <button onClick={toggleSound} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition">
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={handleExit} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question text OR revealed result */}
              <AnimatePresence mode="wait">
                {!isRevealed ? (
                  <motion.h2
                    key="qtext"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-base sm:text-lg font-bold text-white leading-snug mb-3"
                  >
                    {q.text}
                  </motion.h2>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="text-center py-1 mb-2"
                  >
                    {didAnswer ? (
                      <>
                        <div className="text-5xl mb-1">{isCorrect ? '🎉' : '😔'}</div>
                        <p className="text-xl font-black">{isCorrect ? '¡Correcto!' : 'Incorrecto'}</p>
                        {isCorrect && (
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="text-3xl font-black mt-1"
                          >
                            +{answerFeedback?.pointsAwarded ?? 0} pts
                          </motion.p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-3xl mb-1">⏰</div>
                        <p className="font-bold text-lg">Sin respuesta</p>
                        <p className="text-sm text-white/75">No respondiste a tiempo</p>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timer bar */}
              {!isRevealed && timeLeft !== null && q.timeLimitSeconds && (
                <div>
                  <div className="flex items-center justify-between text-xs text-white/80 mb-1">
                    <span className={`font-bold flex items-center gap-1 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
                      <Clock className="w-3 h-3" />{timeLeft}s
                    </span>
                    {livePoints !== null && !hasAnswered && (
                      <span className="font-semibold">{livePoints} pts disponibles</span>
                    )}
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${timeLeft <= 5 ? 'bg-red-300' : 'bg-white'}`}
                      style={{ width: `${(timeLeft / q.timeLimitSeconds) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Content area ── */}
            <div className="p-4">

              {/* Image */}
              {q.imageUrl && !hasAnswered && !isRevealed && (
                <img src={q.imageUrl} alt="" className="w-full rounded-xl object-cover max-h-40 mb-4 border border-gray-100" />
              )}

              <AnimatePresence mode="wait">
                {/* STATE A: Not answered + not revealed → show options */}
                {!hasAnswered && !isRevealed && (
                  <motion.div key="options" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                    {q.type === 'MULTIPLE_CHOICE' && options.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {options.map((opt, idx) => {
                          const style = KAHOOT_OPTS[idx % KAHOOT_OPTS.length]
                          return (
                            <button
                              key={opt.id || idx}
                              onClick={() => handleAnswer(q.id, opt.id || opt.text || '')}
                              className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl font-semibold text-sm min-h-[80px] transition-all active:scale-95 shadow-md hover:shadow-lg ${style.bg} ${style.active} ${style.text}`}
                            >
                              <span className="text-xl">{style.shape}</span>
                              <span className="text-center leading-tight">{opt.text}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {q.type === 'MULTIPLE_CHOICE' && options.length === 0 && (
                      <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-700">
                        Esta pregunta no tiene opciones válidas.
                      </div>
                    )}
                    {q.type === 'TRUE_FALSE' && (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { val: 'true',  label: 'Verdadero', shape: '✔', style: KAHOOT_OPTS[3] },
                          { val: 'false', label: 'Falso',     shape: '✖', style: KAHOOT_OPTS[0] },
                        ].map(o => (
                          <button key={o.val} onClick={() => handleAnswer(q.id, o.val)}
                            className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl font-semibold min-h-[80px] transition-all active:scale-95 shadow-md ${o.style.bg} ${o.style.active} ${o.style.text}`}
                          >
                            <span className="text-2xl">{o.shape}</span>
                            <span>{o.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'SHORT_ANSWER' && (
                      <div>
                        <textarea
                          id="short-answer-input"
                          placeholder="Escribe tu respuesta..."
                          className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                          rows={3}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              const text = (e.target as HTMLTextAreaElement).value.trim()
                              if (text) handleAnswer(q.id, undefined, text)
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const input = document.getElementById('short-answer-input') as HTMLTextAreaElement
                            const text = input?.value.trim()
                            if (text) handleAnswer(q.id, undefined, text)
                          }}
                          className="mt-3 w-full py-3 rounded-xl font-semibold bg-violet-600 text-white hover:bg-violet-700 transition"
                        >
                          Enviar respuesta
                        </button>
                      </div>
                    )}
                    {answerFeedback?.error && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center"
                      >
                        {answerFeedback.error}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* STATE B: Answered, waiting for reveal */}
                {hasAnswered && !isRevealed && (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-8 text-center"
                  >
                    {(() => {
                      let selText = ''
                      let selBg = 'bg-violet-600'
                      let selTextColor = 'text-white'
                      if (q.type === 'MULTIPLE_CHOICE' && options.length > 0) {
                        const idx = options.findIndex(o => (o.id || o.text || '') === selectedAnswer)
                        if (idx >= 0) {
                          selText = options[idx].text ?? ''
                          selBg = KAHOOT_OPTS[idx % 4].bg
                          selTextColor = KAHOOT_OPTS[idx % 4].text
                        }
                      } else if (q.type === 'TRUE_FALSE') {
                        selText = selectedAnswer === 'true' ? 'Verdadero' : 'Falso'
                        selBg = selectedAnswer === 'true' ? KAHOOT_OPTS[3].bg : KAHOOT_OPTS[0].bg
                        selTextColor = selectedAnswer === 'true' ? KAHOOT_OPTS[3].text : KAHOOT_OPTS[0].text
                      } else {
                        selText = 'Respuesta enviada'
                      }
                      return selText ? (
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm mb-5 shadow-md ${selBg} ${selTextColor}`}
                        >
                          <span>✓</span>
                          <span className="max-w-[180px] truncate">{selText}</span>
                        </motion.div>
                      ) : null
                    })()}
                    <p className="text-sm font-semibold text-gray-500">¡Respuesta enviada!</p>
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs mt-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Esperando resultados...
                    </div>
                  </motion.div>
                )}

                {/* STATE C: Revealed */}
                {isRevealed && (
                  <motion.div
                    key="revealed-summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-4 text-center"
                  >
                    <p className="text-sm text-gray-600">
                      Puntaje total: <strong className="text-violet-700 text-base">{totalScore} pts</strong>
                    </p>
                    {streak >= 2 && didAnswer && isCorrect && (
                      <p className="text-xs font-bold text-orange-500 mt-1">🔥 Racha de {streak} seguidas</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reactions bar */}
              <div className="border-t border-gray-100 mt-4 pt-3 flex justify-center gap-2">
                {REACTIONS.map(r => (
                  <button key={r} onClick={() => handleReaction(r)}
                    className={`text-lg p-1.5 rounded-xl transition-all ${
                      reactionCooldown ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 active:scale-125'
                    }`}
                  >{r}</button>
                ))}
              </div>

              {/* Answer stats */}
              {answerStats && answerStats.totalGuests > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-gray-400 mb-0.5">
                    <span>{answerStats.answeredCount} de {answerStats.totalGuests} respondieron</span>
                    <span>{answerStats.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-fuchsia-500 rounded-full h-1.5 transition-all duration-500" style={{ width: `${answerStats.percent}%` }} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          )
        })()}

        {/* ═══ STEP 4.5: Interlude (ranking entre preguntas) — F6.15 ═══ */}
        {step === 'interlude' && (() => {
          const myPos = interludeData?.ranking.findIndex(r => r.id === guestId) ?? -1
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Colored result header */}
              <div className={`px-6 py-7 text-center ${
                answerFeedback?.revealed
                  ? answerFeedback.isCorrect
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                  : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white'
              }`}>
                <div className="text-5xl mb-2">
                  {answerFeedback?.revealed
                    ? answerFeedback.isCorrect ? '🎉' : '😔'
                    : '⏱️'}
                </div>
                <h2 className="text-xl font-black mb-1">
                  {answerFeedback?.revealed
                    ? answerFeedback.isCorrect ? '¡Correcto!' : 'Incorrecto'
                    : 'Pregunta cerrada'}
                </h2>
                {answerFeedback?.revealed && answerFeedback.isCorrect && (
                  <p className="text-4xl font-black">+{answerFeedback.pointsAwarded ?? 0} pts</p>
                )}
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  <span className="bg-white/20 backdrop-blur rounded-full px-3 py-1 text-sm font-bold">
                    <Zap className="w-3.5 h-3.5 inline mr-1" />{totalScore} pts total
                  </span>
                  {streak >= 2 && (
                    <span className="bg-orange-400/80 rounded-full px-3 py-1 text-sm font-bold">
                      🔥 Racha {streak}
                    </span>
                  )}
                </div>
                {myPos >= 0 && (
                  <p className="mt-2 text-sm font-semibold text-white/80">Posición #{myPos + 1}</p>
                )}
              </div>

              <div className="p-4">
                {interludeData && interludeData.ranking.length > 0 && (
                  <div className="bg-gray-50 rounded-2xl p-3 mb-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">Clasificación</p>
                    <div className="space-y-1.5">
                      {interludeData.ranking.slice(0, 5).map((p, i) => {
                        const isMe = p.id === guestId
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                        return (
                          <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                            isMe ? 'bg-violet-100 ring-1 ring-violet-400' : 'bg-white'
                          }`}>
                            <span className="text-sm font-bold w-6 text-center">{medal}</span>
                            <span className="text-base">{p.avatarEmoji || '😎'}</span>
                            <span className={`flex-1 text-sm font-semibold truncate ${
                              isMe ? 'text-violet-800' : 'text-gray-800'
                            }`}>{p.nickname}{isMe ? ' (tú)' : ''}</span>
                            <span className="text-sm font-bold text-gray-600">{p.score}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">
                      {interludeData.answeredCount}/{interludeData.totalGuests} respondieron
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Esperando siguiente pregunta...
                </div>
              </div>
            </motion.div>
          )
        })()}

        {/* ═══ STEP 5: Finished ═══ */}
        {step === 'finished' && (() => {
          const myPos = finalRanking ? finalRanking.findIndex(r => r.id === guestId) + 1 : 0
          const myData = finalRanking?.find(r => r.id === guestId)
          const accuracy = myData && (myData.totalAnswers ?? 0) > 0
            ? Math.round((myData.correctAnswers / myData.totalAnswers!) * 100)
            : null
          const medal = myPos === 1 ? '🥇' : myPos === 2 ? '🥈' : myPos === 3 ? '🥉' : '🏆'
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Gradient header */}
              <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 px-6 py-8 text-center text-white">
                <div className="text-6xl mb-2">{medal}</div>
                <h2 className="text-2xl font-black mb-1">¡Juego Terminado!</h2>
                <p className="text-violet-200 text-sm">{nickname} · {session?.title}</p>
                {myPos > 0 && finalRanking && (
                  <div className="mt-3 inline-block bg-white/20 backdrop-blur rounded-full px-4 py-1.5 text-sm font-bold">
                    Posición #{myPos} de {finalRanking.length}
                  </div>
                )}
              </div>

              <div className="p-5">
                {/* Score + Accuracy */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-violet-50 rounded-2xl p-4 text-center">
                    <p className="text-xs text-violet-500 font-bold uppercase tracking-wide mb-1">Puntaje</p>
                    <p className="text-3xl font-black text-violet-900">{totalScore}</p>
                    <p className="text-xs text-violet-400">pts</p>
                  </div>
                  {accuracy !== null ? (
                    <div className="bg-fuchsia-50 rounded-2xl p-4 text-center">
                      <p className="text-xs text-fuchsia-500 font-bold uppercase tracking-wide mb-1">Precisión</p>
                      <p className="text-3xl font-black text-fuchsia-900">{accuracy}%</p>
                      <p className="text-xs text-fuchsia-400">{myData?.correctAnswers}/{myData?.totalAnswers} correctas</p>
                    </div>
                  ) : (
                    <div className="bg-orange-50 rounded-2xl p-4 text-center">
                      <p className="text-xs text-orange-500 font-bold uppercase tracking-wide mb-1">Racha máx.</p>
                      <p className="text-3xl font-black text-orange-700">{streak > 0 ? `🔥${streak}` : '—'}</p>
                      <p className="text-xs text-orange-400">seguidas</p>
                    </div>
                  )}
                </div>

                {/* Final ranking */}
                {finalRanking && finalRanking.length > 0 && (
                  <div className="bg-gray-50 rounded-2xl p-3 mb-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">Clasificación final</p>
                    <div className="space-y-1.5">
                      {finalRanking.slice(0, 5).map((p, i) => {
                        const isMe = p.id === guestId
                        const rankMedal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                        return (
                          <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                            isMe ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-white'
                          }`}>
                            <span className="text-base font-bold w-6 text-center">{rankMedal}</span>
                            <span className="text-lg">{p.avatarEmoji || '😎'}</span>
                            <span className={`flex-1 text-sm font-semibold truncate ${
                              isMe ? 'text-violet-800' : 'text-gray-800'
                            }`}>{p.nickname}{isMe ? ' (tú)' : ''}</span>
                            <span className="text-sm font-bold text-gray-600">{p.score}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleExit}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold hover:from-violet-700 hover:to-fuchsia-700 transition text-base"
                >
                  Volver al inicio
                </button>
              </div>
            </motion.div>
          )
        })()}

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">edusyn.co/join</p>
      </div>
    </div>
  )
}

