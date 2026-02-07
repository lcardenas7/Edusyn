import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../lib/api'

interface InstitutionModule {
  module: string
  features: string[]
  isActive: boolean
}

interface Institution {
  id: string
  name: string
  daneCode?: string
  nit?: string
  modules?: InstitutionModule[]
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: { role: { name: string } }[]
  institution?: Institution
  isSuperAdmin?: boolean
}

interface AuthContextType {
  user: User | null
  institution: Institution | null
  isAuthenticated: boolean
  isLoading: boolean
  isSuperAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  enabledModules: string[]
  enabledFeatures: string[]
  hasModule: (moduleId: string) => boolean
  hasFeature: (featureId: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authApi.me()
        .then((res) => {
          setUser(res.data)
          if (res.data.institution) {
            setInstitution(res.data.institution)
          }
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('token', res.data.access_token)
    const userData = res.data.user
    setUser(userData)
    if (userData?.institution) {
      setInstitution(userData.institution)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setInstitution(null)
  }

  // Calcular módulos y features habilitados
  const enabledModules = institution?.modules
    ?.filter(m => m.isActive)
    ?.map(m => m.module) || []

  const enabledFeatures = institution?.modules
    ?.filter(m => m.isActive)
    ?.flatMap(m => m.features || []) || []

  // Verificar si es SuperAdmin usando el campo isSuperAdmin del backend
  const isSuperAdmin = user?.isSuperAdmin === true

  const hasModule = (moduleId: string) => {
    // SuperAdmin tiene acceso a todo
    if (isSuperAdmin) return true
    return enabledModules.includes(moduleId)
  }

  const hasFeature = (featureId: string) => {
    // SuperAdmin tiene acceso a todo
    if (isSuperAdmin) return true
    return enabledFeatures.includes(featureId)
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      institution, 
      isAuthenticated: !!user, 
      isLoading, 
      isSuperAdmin,
      login, 
      logout,
      enabledModules,
      enabledFeatures,
      hasModule,
      hasFeature,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
