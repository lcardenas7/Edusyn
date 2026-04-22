import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayAuth } from '../../contexts/PlayAuthContext'
import GoogleSignInButton from '../../components/play/GoogleSignInButton'
import { 
  Sparkles, Mail, Lock, User, Eye, EyeOff, AlertCircle, 
  ArrowRight, GraduationCap, Zap, Users, Trophy 
} from 'lucide-react'

export default function RegisterPlay() {
  const navigate = useNavigate()
  const { register, googleLogin, isAuthenticated } = usePlayAuth()
  const [googleLoading, setGoogleLoading] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/play')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      await register({ email, password, firstName, lastName })
      navigate('/play')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Zap, text: 'Crea quizzes interactivos en minutos' },
    { icon: Users, text: 'Invitados se unen con un código de 6 dígitos' },
    { icon: Trophy, text: 'Ranking en vivo y resultados al instante' },
    { icon: GraduationCap, text: 'Convierte resultados en notas reales' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex">
      {/* Left Panel - Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-fuchsia-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 mb-12 hover:opacity-80 transition">
            <Sparkles className="w-8 h-8" />
            <span className="text-2xl font-bold">Edusyn Play</span>
          </Link>
          
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Enseña de forma interactiva,<br />sin complicaciones
          </h1>
          <p className="text-lg text-violet-100 mb-10">
            Crea quizzes y lecciones en vivo. Tus participantes se unen desde cualquier dispositivo con un simple código.
          </p>

          <div className="space-y-5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <span className="text-violet-50">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-violet-200 relative z-10">
          100% gratis para docentes independientes. Sin necesidad de institución.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Sparkles className="w-7 h-7 text-violet-600" />
            <span className="text-xl font-bold text-gray-900">Edusyn Play</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h2>
          <p className="text-gray-500 mb-6">Regístrate gratis y empieza a crear sesiones interactivas</p>

          {/* Google Sign-In */}
          <div className="mb-4">
            <GoogleSignInButton
              text="signup_with"
              onSuccess={async (idToken) => {
                setGoogleLoading(true)
                setError('')
                try {
                  await googleLogin(idToken)
                  navigate('/play')
                } catch (err: any) {
                  setError(err.response?.data?.message || 'Error con Google Sign-In')
                } finally {
                  setGoogleLoading(false)
                }
              }}
              onError={(err) => setError(err)}
            />
            {googleLoading && (
              <div className="flex justify-center mt-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-600 border-t-transparent" />
              </div>
            )}
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-400">o con tu correo</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                    placeholder="Juan"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  placeholder="Repite la contraseña"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>Crear cuenta gratis <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login-play" className="text-violet-600 hover:text-violet-700 font-medium">
              Inicia sesión
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400">
              ¿Eres parte de una institución?{' '}
              <Link to="/login" className="text-violet-500 hover:text-violet-600">
                Inicia sesión institucional
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
