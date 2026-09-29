import { createContext, useContext, useState, type ReactNode } from 'react'

// DEMO AUTHENTICATION ONLY. This gates the UI for the jury demo. The backend has no authorization layer.
export const DEMO_EMAIL = 'operator@nereus.demo'
export const DEMO_PASSWORD = 'nereus2026'
const KEY = 'nereus.auth'

interface AuthState { user: string | null; signIn: (email: string, password: string, remember: boolean) => boolean; signOut: () => void }
const Ctx = createContext<AuthState>({ user: null, signIn: () => false, signOut: () => {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem(KEY) || sessionStorage.getItem(KEY))
  const signIn = (email: string, password: string, remember: boolean) => {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) return false
    ;(remember ? localStorage : sessionStorage).setItem(KEY, DEMO_EMAIL)
    setUser(DEMO_EMAIL)
    return true
  }
  const signOut = () => { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); setUser(null) }
  return <Ctx.Provider value={{ user, signIn, signOut }}>{children}</Ctx.Provider>
}
