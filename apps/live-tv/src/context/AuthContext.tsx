import { createContext, useContext, useEffect, useState } from 'react'
import type { MeResponse } from '@iptvflix/api-contracts'
import { login as apiLogin, logout as apiLogout, getMe } from '../lib/api.js'

type AuthState = {
  isAuthenticated: boolean
  username: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then((me: MeResponse) => {
        setIsAuthenticated(true)
        setUsername(me.username)
      })
      .catch(() => {
        setIsAuthenticated(false)
        setUsername(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function login(usernameInput: string, password: string): Promise<void> {
    await apiLogin(usernameInput, password)
    const me = await getMe()
    setIsAuthenticated(true)
    setUsername(me.username)
  }

  async function logout(): Promise<void> {
    await apiLogout()
    clearLastProfileId()
    setIsAuthenticated(false)
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function clearLastProfileId(): void {
  try {
    localStorage.removeItem('iptvflix_last_profile_id')
  } catch {
    // ignore
  }
}
