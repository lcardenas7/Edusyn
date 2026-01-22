import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../lib/api'
import { GraduationCap, User, Lock, AlertCircle, Eye, EyeOff, ShieldAlert } from 'lucide-react'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Detectar si estamos en la página de login de SuperAdmin
  const isSuperAdminLogin = location.pathname.includes('/superadmin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Primero hacer login normal
      const loginRes = await authApi.login(identifier, password)
      localStorage.setItem('token', loginRes.data.access_token)
      
      // Obtener perfil del usuario para verificar si es SuperAdmin
      const profileRes = await authApi.me()
      
      // Si estamos en /superadmin/login, verificar que sea SuperAdmin
      if (isSuperAdminLogin) {
        if (!profileRes.data.isSuperAdmin) {
          // No es SuperAdmin - limpiar token y mostrar error
          localStorage.removeItem('token')
          setError('Acceso denegado. Esta área es exclusiva para SuperAdmin del sistema.')
          setIsLoading(false)
          return
        }
        // Es SuperAdmin, continuar con login normal
        await login(identifier, password)
        navigate('/superadmin')
      } else {
        // Login normal de institución
        await login(identifier, password)
        navigate('/dashboard')
      }
    } catch (err: any) {
      localStorage.removeItem('token')
      setError(err.response?.data?.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isSuperAdminLogin ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-blue-600 to-blue-800'}`}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            {isSuperAdminLogin ? (
              <>
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-10 h-10 text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">SuperAdmin</h1>
                <p className="text-slate-500 mt-1">Acceso exclusivo para administradores del sistema</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Edusyn</h1>
                <p className="text-slate-500 mt-1">Sistema de Gestión Académica</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Usuario o correo electrónico
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="usuario o correo@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            © 2026 Edusyn - Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
