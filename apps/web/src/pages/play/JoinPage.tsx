import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { guestApi } from '../../lib/playApi'
import {
  Sparkles,
  Hash,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  Users,
  Trophy,
  Clock,
  Smile,
} from 'lucide-react'

const AVATAR_EMOJIS = ['😎', '🦊', '🐱', '🦁', '🐸', '🐼', '🦄', '🐙', '🦋', '🐢', '🎯', '⭐', '🔥', '💎', '🎪', '🚀']

interface SessionInfo {
  sessionId: string
  title: string
  teacherName: string
  guestsCount: number
  status: string
  type: 'quiz' | 'lesson'
}

type Step = 'code' | 'nickname' | 'lobby' | 'active' | 'finished' | 'error'

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
  }
}

export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(urlCode ? 'nickname' : 'code')
  const [code, setCode] = useState(urlCode || '')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lookingUp, setLookingUp] = useState(!!urlCode)
  const [pollingInterval, setPollingInterval] = useState<any>(null)

  const codeInputRef = useRef<HTMLInputElement>(null)

  // Auto-lookup if code in URL
  useEffect(() => {
    if (urlCode) {
      lookupCode(urlCode)
    }
  }, [urlCode])

  // Polling for session status after joining
  useEffect(() => {
    if (step === 'lobby' && session?.sessionId) {
      // Start polling every 3 seconds
      const interval = setInterval(async () => {
        try {
          const res = await guestApi.getSessionStatus(session.sessionId)
          const status = res.data
          setSessionStatus(status)

          // Handle state transitions
          if (status.status === 'ACTIVE') {
            setStep('active')
          } else if (status.status === 'FINISHED') {
            setStep('finished')
            // Stop polling when finished
            if (pollingInterval) clearInterval(pollingInterval)
          }
        } catch (err) {
          // Silently fail polling
        }
      }, 3000)
      setPollingInterval(interval)

      // Cleanup on unmount or step change
      return () => clearInterval(interval)
    } else if (step === 'active' && session?.sessionId) {
      // Keep polling during active state for question changes
      const interval = setInterval(async () => {
        try {
          const res = await guestApi.getSessionStatus(session.sessionId)
          const status = res.data
          setSessionStatus(status)
          if (status.status === 'FINISHED') {
            setStep('finished')
            if (pollingInterval) clearInterval(pollingInterval)
          }
        } catch {}
      }, 2000)
      setPollingInterval(interval)
      return () => clearInterval(interval)
    } else {
      // Clear polling when not in lobby/active
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
    }
  }, [step, session?.sessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [pollingInterval])

  const lookupCode = async (joinCode: string) => {
    setLookingUp(true)
    setError('')
    try {
      const res = await guestApi.lookup(joinCode)
      setSession(res.data)
      setStep('nickname')
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Código no encontrado. Verifica e intenta de nuevo.')
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
      const res = await guestApi.join(code.replace(/\s/g, ''), {
        nickname: nickname.trim(),
        avatarEmoji: avatar,
      })
      // Save guest token
      localStorage.setItem('guest_token', res.data.guestToken)
      localStorage.setItem('guest_session', JSON.stringify({
        sessionId: res.data.sessionId,
        guestId: res.data.guestId,
        nickname: nickname.trim(),
        avatar,
      }))
      setStep('lobby')
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo unir a la sesión')
    } finally {
      setLoading(false)
    }
  }

  // Submit answer
  const handleAnswer = async (questionId: string, selectedOption?: string, answerText?: string) => {
    try {
      await guestApi.submitAnswer(session!.sessionId, {
        questionId,
        selectedOption,
        answerText,
        timeTakenMs: 0, // Could track time if needed
      })
    } catch (err) {
      // Silently fail answer submission
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

      <div className="relative z-10 w-full max-w-sm">
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
              {/* Avatar selector */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2 justify-center">
                  {AVATAR_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        avatar === emoji
                          ? 'bg-violet-100 ring-2 ring-violet-500 scale-110'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nickname */}
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">{avatar}</span>
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-5xl mb-4">{avatar}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{nickname}</h2>
            <p className="text-sm text-gray-500 mb-6">Estás conectado. Esperando al profesor...</p>

            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-gray-400">Esperando que inicie la sesión</span>
            </div>

            <div className="bg-violet-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2">
                <Users className="w-5 h-5 text-violet-600" />
                <span className="text-lg font-bold text-violet-900">{sessionStatus?.guestsCount || session?.guestsCount || 0}</span>
                <span className="text-sm text-violet-600">conectados</span>
              </div>
            </div>

            {session && (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-900">{session.title}</p>
                <p className="text-xs text-gray-400 mt-1">por {session.teacherName}</p>
              </div>
            )}

            <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Ranking en vivo</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Responde rápido</span>
              <span className="flex items-center gap-1"><Smile className="w-3.5 h-3.5" /> Reacciones</span>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Active Question ═══ */}
        {step === 'active' && sessionStatus?.currentQuestion && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="text-3xl">{avatar}</div>
                <div>
                  <h3 className="font-bold text-gray-900">{nickname}</h3>
                  <p className="text-xs text-gray-500">Pregunta {sessionStatus.currentQuestionIdx + 1} / {sessionStatus.totalQuestions}</p>
                </div>
              </div>
              <div className="bg-violet-100 px-3 py-1 rounded-full text-sm font-medium text-violet-700">
                {sessionStatus.guestsCount} jugadores
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div
                className="bg-violet-600 rounded-full h-2 transition-all"
                style={{ width: `${((sessionStatus.currentQuestionIdx + 1) / sessionStatus.totalQuestions) * 100}%` }}
              />
            </div>

            {/* Question */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{sessionStatus.currentQuestion.text}</h2>
              
              {/* Multiple Choice */}
              {sessionStatus.currentQuestion.type === 'MULTIPLE_CHOICE' && sessionStatus.currentQuestion.options && (
                <div className="space-y-3">
                  {JSON.parse(sessionStatus.currentQuestion.options).map((opt: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(sessionStatus.currentQuestion!.id, opt.text)}
                      className="w-full text-left p-4 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-xl transition-colors"
                    >
                      <span className="font-medium text-gray-700">{String.fromCharCode(65 + idx)}.</span> {opt.text}
                    </button>
                  ))}
                </div>
              )}

              {/* True/False */}
              {sessionStatus.currentQuestion.type === 'TRUE_FALSE' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAnswer(sessionStatus.currentQuestion!.id, 'true')}
                    className="p-4 bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-300 rounded-xl transition-colors font-medium text-green-700"
                  >
                    ✅ Verdadero
                  </button>
                  <button
                    onClick={() => handleAnswer(sessionStatus.currentQuestion!.id, 'false')}
                    className="p-4 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 rounded-xl transition-colors font-medium text-red-700"
                  >
                    ❌ Falso
                  </button>
                </div>
              )}

              {/* Short Answer */}
              {sessionStatus.currentQuestion.type === 'SHORT_ANSWER' && (
                <div>
                  <textarea
                    placeholder="Escribe tu respuesta..."
                    className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        const text = (e.target as HTMLTextAreaElement).value.trim()
                        if (text) handleAnswer(sessionStatus.currentQuestion!.id, undefined, text)
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const textarea = e.currentTarget.parentElement?.querySelector('textarea')
                      const text = textarea?.value.trim()
                      if (text) handleAnswer(sessionStatus.currentQuestion!.id, undefined, text)
                    }}
                    className="mt-3 w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors"
                  >
                    Enviar respuesta
                  </button>
                </div>
              )}
            </div>

            <div className="text-center text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Responde rápido para más puntos
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Finished - Ranking ═══ */}
        {step === 'finished' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Juego Terminado!</h2>
            <p className="text-gray-500 mb-6">Gracias por participar</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="font-medium text-gray-900">{session?.title}</p>
              <p className="text-xs text-gray-400 mt-1">por {session?.teacherName}</p>
            </div>

            <div className="flex justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Ranking en vivo</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Responde rápido</span>
              <span className="flex items-center gap-1"><Smile className="w-3.5 h-3.5" /> Reacciones</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          edusyn.co/join
        </p>
      </div>
    </div>
  )
}
