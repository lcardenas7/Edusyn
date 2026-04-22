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

type Step = 'code' | 'nickname' | 'lobby' | 'error'

export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(urlCode ? 'nickname' : 'code')
  const [code, setCode] = useState(urlCode || '')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)])
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lookingUp, setLookingUp] = useState(!!urlCode)

  const codeInputRef = useRef<HTMLInputElement>(null)

  // Auto-lookup if code in URL
  useEffect(() => {
    if (urlCode) {
      lookupCode(urlCode)
    }
  }, [urlCode])

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

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          edusyn.co/join
        </p>
      </div>
    </div>
  )
}
