import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api'
import { AUTH_REFRESHED_EVENT } from '../api/client'
import type { AuthResponse, LoginResult, MembershipSelectionResponse, UserDto } from '../api/types'
import { isMembershipSelection } from '../api/types'

interface AuthContextType {
  user: UserDto | null
  loading: boolean
  /** Devuelve la selección pendiente si hay >1 membresía; null si ya inició sesión. */
  login: (email: string, password: string) => Promise<MembershipSelectionResponse | null>
  /** Procesa una respuesta de login/google-login (misma semántica que `login`). */
  handleLoginResult: (res: LoginResult) => MembershipSelectionResponse | null
  selectMembership: (selectionToken: string, membershipId: string) => Promise<void>
  switchMembership: (membershipId: string) => Promise<void>
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
  setAuth: (accessToken: string, refreshToken: string, user: UserDto) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const sameUser = (a: UserDto | null, b: UserDto) => !!a && JSON.stringify(a) === JSON.stringify(b)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  // El interceptor de refresh (client.ts) notifica el usuario devuelto por /auth/refresh.
  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const next = (e as CustomEvent<UserDto>).detail
      if (next) setUser((prev) => (sameUser(prev, next) ? prev : next))
    }
    window.addEventListener(AUTH_REFRESHED_EVENT, onRefreshed)
    return () => window.removeEventListener(AUTH_REFRESHED_EVENT, onRefreshed)
  }, [])

  const setAuth = useCallback((accessToken: string, refreshToken: string, u: UserDto) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    setUser(u)
  }, [])

  const applyAuth = useCallback(
    (res: AuthResponse) => setAuth(res.accessToken, res.refreshToken, res.user),
    [setAuth],
  )

  const handleLoginResult = useCallback(
    (res: LoginResult) => {
      if (isMembershipSelection(res)) return res
      applyAuth(res)
      return null
    },
    [applyAuth],
  )

  const login = async (email: string, password: string) =>
    handleLoginResult(await authApi.login(email, password))

  const selectMembership = async (selectionToken: string, membershipId: string) => {
    applyAuth(await authApi.selectMembership(selectionToken, membershipId))
  }

  const switchMembership = async (membershipId: string) => {
    // Se envía el refresh token actual para revocar solo el de este dispositivo (D10 backend).
    const currentRefresh = localStorage.getItem('refresh_token') ?? undefined
    applyAuth(await authApi.switchMembership(membershipId, currentRefresh))
  }

  const refreshUser = async () => {
    const me = await authApi.me()
    setUser(me)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        handleLoginResult,
        selectMembership,
        switchMembership,
        refreshUser,
        logout,
        setAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
