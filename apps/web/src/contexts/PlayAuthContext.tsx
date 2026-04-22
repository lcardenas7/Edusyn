import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authPlayApi } from '../lib/playApi'

interface PlayUser {
  id: string
  email: string
  firstName: string
  lastName: string
  photo?: string | null
  accountMode: string
}

interface PlayAuthContextType {
  user: PlayUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>
  googleLogin: (idToken: string) => Promise<void>
  logout: () => void
}

const PlayAuthContext = createContext<PlayAuthContextType | undefined>(undefined)

export function PlayAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlayUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('play_token')
    const saved = localStorage.getItem('play_user')
    if (token && saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('play_token')
        localStorage.removeItem('play_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authPlayApi.login({ email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('play_token', access_token)
    localStorage.setItem('play_user', JSON.stringify(userData))
    setUser(userData)
  }

  const register = async (data: { email: string; password: string; firstName: string; lastName: string }) => {
    const res = await authPlayApi.register(data)
    const { access_token, user: userData } = res.data
    localStorage.setItem('play_token', access_token)
    localStorage.setItem('play_user', JSON.stringify(userData))
    setUser(userData)
  }

  const googleLogin = async (idToken: string) => {
    const res = await authPlayApi.googleLogin(idToken)
    const { access_token, user: userData } = res.data
    localStorage.setItem('play_token', access_token)
    localStorage.setItem('play_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('play_token')
    localStorage.removeItem('play_user')
    setUser(null)
  }

  return (
    <PlayAuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      googleLogin,
      logout,
    }}>
      {children}
    </PlayAuthContext.Provider>
  )
}

export function usePlayAuth() {
  const context = useContext(PlayAuthContext)
  if (!context) {
    throw new Error('usePlayAuth must be used within a PlayAuthProvider')
  }
  return context
}
