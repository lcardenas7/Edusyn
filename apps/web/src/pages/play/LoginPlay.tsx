import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlayAuth } from '../../contexts/PlayAuthContext'
import GoogleSignInButton from '../../components/play/GoogleSignInButton'
import { Sparkles, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'

export default function LoginPlay() {
  const navigate = useNavigate()
  const { login, googleLogin, isAuthenticated } = usePlayAuth()
  const [googleLoading, setGoogleLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/play')
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/play')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 hover:opacity-80 transition">
            <Sparkles className="w-8 h-8 text-violet-600" />
            <span className="text-2xl font-bold text-gray-900">Edusyn Play</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-violet-100/50 border border-violet-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Iniciar sesión</h2>
          <p className="text-gray-500 text-sm mb-5">Accede a tu panel de docente personal</p>

          {/* Google Sign-In */}
          <div className="mb-4">
            <GoogleSignInButton
              text="signin_with"
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  placeholder="Tu contraseña"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-fuchsia-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>Entrar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link to="/register-play" className="text-violet-600 hover:text-violet-700 font-medium">
              Regístrate gratis
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            ¿Eres parte de una institución?{' '}
            <Link to="/login" className="text-violet-500 hover:text-violet-600">
              Inicia sesión institucional
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
