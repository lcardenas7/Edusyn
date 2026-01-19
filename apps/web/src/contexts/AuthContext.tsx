import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../lib/api'

interface Institution {
  id: string
  name: string
  daneCode?: string
  nit?: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: { role: { name: string } }[]
  institution?: Institution
}

interface AuthContextType {
  user: User | null
  institution: Institution | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
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
    const meRes = await authApi.me()
    setUser(meRes.data)
    if (meRes.data.institution) {
      setInstitution(meRes.data.institution)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setInstitution(null)
  }

  return (
    <AuthContext.Provider value={{ user, institution, isAuthenticated: !!user, isLoading, login, logout }}>
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
