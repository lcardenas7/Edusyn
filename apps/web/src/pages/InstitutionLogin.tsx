/**
 * Login por Institución (Multi-tenant)
 * 
 * Flujo:
 * 1. Usuario ingresa slug de institución (o viene por URL)
 * 2. Sistema valida que la institución existe y está activa
 * 3. Usuario ingresa credenciales
 * 4. Login vinculado a esa institución
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Building2, Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Search, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Detectar URL de API según entorno
const isProduction = typeof window !== 'undefined' && 
  (window.location.hostname.includes('railway.app') || window.location.hostname.includes('edusyn.co'))
const API_BASE = isProduction 
  ? 'https://api.edusyn.co/api'
  : '/api'

interface InstitutionInfo {
  id: string
  name: string
  slug?: string
  logo?: string
  status: string
}

export default function InstitutionLogin() {
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { login: authLogin, isAuthenticated } = useAuth()
  
  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])
  
  const [step, setStep] = useState<'institution' | 'credentials'>(slug ? 'credentials' : 'institution')
  const [institutionSlug, setInstitutionSlug] = useState(slug || '')
  const [institution, setInstitution] = useState<InstitutionInfo | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingInstitution, setCheckingInstitution] = useState(!!slug)
  
  // Autocompletado
  const [suggestions, setSuggestions] = useState<InstitutionInfo[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingInstitutions, setSearchingInstitutions] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Si viene con slug en URL, verificar institución automáticamente
  useEffect(() => {
    if (slug) {
      checkInstitution(slug)
    }
  }, [slug])

  const checkInstitution = async (slugToCheck: string) => {
    setCheckingInstitution(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/auth/institution/${slugToCheck}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Institución no encontrada. Verifica el código.')
        } else {
          setError('Error al verificar la institución')
        }
        setInstitution(null)
        return
      }
      
      const data = await response.json()
      setInstitution({
        id: data.id,
        name: data.name,
        logo: data.logo,
        status: data.status,
      })
      setStep('credentials')
    } catch {
      setError('Error al conectar con el servidor')
    } finally {
      setCheckingInstitution(false)
    }
  }

  // Buscar instituciones mientras escribe
  const searchInstitutions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setSearchingInstitutions(true)
    try {
      const response = await fetch(`${API_BASE}/auth/institutions/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      }
    } catch {
      // Silenciar errores de búsqueda
    } finally {
      setSearchingInstitutions(false)
    }
  }

  // Handler para cambio en el input con debounce
  const handleInstitutionInputChange = (value: string) => {
    setInstitutionSlug(value)
    setError('')
    
    // Cancelar búsqueda anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce de 300ms
    searchTimeoutRef.current = setTimeout(() => {
      searchInstitutions(value)
    }, 300)
  }

  // Seleccionar una institución de las sugerencias
  const selectInstitution = (inst: InstitutionInfo) => {
    setInstitutionSlug(inst.slug || '')
    setInstitution(inst)
    setSuggestions([])
    setShowSuggestions(false)
    setStep('credentials')
  }

  const handleInstitutionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!institutionSlug.trim()) {
      setError('Ingresa el código de tu institución')
      return
    }
    setShowSuggestions(false)
    checkInstitution(institutionSlug.toLowerCase().trim())
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Completa todos los campos')
      return
    }

    if (!institution?.id) {
      setError('Selecciona una institución primero')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Login con validación de institución
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          institutionId: institution.id, // Enviar ID de institución para validación
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Credenciales incorrectas')
      }

      // Guardar token (AuthContext carga institución automáticamente desde /auth/me)
      localStorage.setItem('token', data.access_token)
      
      // Recargar la página para que AuthContext cargue el perfil con el nuevo token
      window.location.href = '/dashboard'
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Credenciales incorrectas'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChangeInstitution = () => {
    setStep('institution')
    setInstitution(null)
    setInstitutionSlug('')
    setEmail('')
    setPassword('')
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">EduSyn</h1>
          <p className="text-slate-500 mt-1">Sistema de Gestión Académica</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
          {/* Header con institución seleccionada */}
          {institution && step === 'credentials' && (
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {institution.logo ? (
                    <img src={institution.logo} alt="" className="w-10 h-10 rounded-lg bg-white" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-semibold">{institution.name}</div>
                    <div className="text-white/70 text-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Institución verificada
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleChangeInstitution}
                  className="text-white/80 hover:text-white text-sm underline"
                >
                  Cambiar
                </button>
              </div>
            </div>
          )}

          <div className="p-6">
            {/* Step 1: Seleccionar institución */}
            {step === 'institution' && (
              <form onSubmit={handleInstitutionSubmit}>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Ingresa a tu institución
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Escribe el código o nombre corto de tu institución educativa
                </p>

                <div className="space-y-4">
                  <div className="relative" style={{ zIndex: 50 }}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Buscar institución
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={institutionSlug}
                        onChange={(e) => handleInstitutionInputChange(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Escribe el nombre o código..."
                        className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                        autoComplete="off"
                      />
                      {searchingInstitutions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    {/* Dropdown de sugerencias - Mejorado */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" style={{ maxHeight: '280px' }}>
                        {suggestions.map((inst) => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => selectInstitution(inst)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                          >
                            {inst.logo ? (
                              <img src={inst.logo} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-blue-600" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 py-0.5">
                              <div className="font-medium text-slate-900 leading-tight" title={inst.name}>
                                {inst.name}
                              </div>
                              <div className="text-sm text-slate-500 mt-0.5">/{inst.slug}</div>
                            </div>
                            {inst.status === 'TRIAL' && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex-shrink-0 mt-0.5">
                                Prueba
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-slate-400 mt-1">
                      Escribe al menos 2 caracteres para buscar
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={checkingInstitution}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                  >
                    {checkingInstitution ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Continuar
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Credenciales */}
            {step === 'credentials' && (
              <form onSubmit={handleLogin}>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Iniciar sesión
                </h2>
                <p className="text-slate-500 text-sm mb-6">
                  Ingresa tus credenciales para acceder
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Usuario o correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario o correo"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Ingresando...
                      </>
                    ) : (
                      'Ingresar'
                    )}
                  </button>

                  <div className="text-center">
                    <a href="#" className="text-sm text-blue-600 hover:underline">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
