import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api'
import { AUTH_REFRESHED_EVENT, SUBSCRIPTION_EXPIRED_EVENT } from '../api/client'
import type { AuthResponse, LoginResult, MembershipSelectionResponse, UserDto } from '../api/types'
import { isMembershipSelection } from '../api/types'
import { isSubscriptionInactive } from '../utils/subscription'

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
  /** AC-9: staff del tenant con suscripción vencida (o sin suscripción) → pantalla de bloqueo. */
  subscriptionLocked: boolean
  /** Vuelve a pedir `me`; si la suscripción ya está vigente se levanta el bloqueo. */
  recheckSubscription: () => Promise<UserDto>
}

/** Intervalo de re-consulta de `me` mientras hay bloqueo o solo lectura (Q1). */
const SUBSCRIPTION_RECHECK_MS = 60_000

const AuthContext = createContext<AuthContextType | null>(null)

const sameUser = (a: UserDto | null, b: UserDto) => !!a && JSON.stringify(a) === JSON.stringify(b)

/** Staff del tenant (Admin/Nutritionist/Trainer): se bloquea por completo al vencer la suscripción. */
const isTenantStaff = (role?: string) => !!role && role !== 'SuperAdmin' && role !== 'Patient'

/** Suscripción vigente según `me` (Active / ExpiringSoon). */
const hasCurrentSubscription = (user: UserDto | null) =>
  user?.subscription?.status === 'Active' || user?.subscription?.status === 'ExpiringSoon'

function isSubscriptionLocked(user: UserDto | null, blockedMembershipId: string | null): boolean {
  if (!user || !isTenantStaff(user.role)) return false
  return isSubscriptionInactive(user) || (!!blockedMembershipId && blockedMembershipId === user.membershipId)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [loading, setLoading] = useState(true)
  // Membresía para la que el backend respondió 403 subscription_expired (solo staff).
  const [blockedMembershipId, setBlockedMembershipId] = useState<string | null>(null)

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

  // AC-9: 403 `subscription_expired` inesperado → se refresca `me`; si es staff se fuerza el bloqueo
  // de esa membresía aunque `me` aún no lo refleje. Varias peticiones fallidas a la vez → un solo `me`.
  useEffect(() => {
    let inFlight = false
    const onExpired = () => {
      if (inFlight) return
      inFlight = true
      authApi
        .me()
        .then((me) => {
          setUser((prev) => (sameUser(prev, me) ? prev : me))
          if (isTenantStaff(me.role) && !hasCurrentSubscription(me)) setBlockedMembershipId(me.membershipId)
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false
        })
    }
    window.addEventListener(SUBSCRIPTION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SUBSCRIPTION_EXPIRED_EVENT, onExpired)
  }, [])

  // R2: el bloqueo forzado se limpia al cambiar de membresía, al salir o cuando `me`/refresh
  // devuelven la suscripción vigente (p. ej. tras una renovación).
  if (
    blockedMembershipId &&
    (!user || user.membershipId !== blockedMembershipId || hasCurrentSubscription(user))
  ) {
    setBlockedMembershipId(null)
  }

  const subscriptionLocked = isSubscriptionLocked(user, blockedMembershipId)
  // Q1: mientras el staff está bloqueado (o el paciente en solo lectura) se vuelve a pedir `me`
  // para recuperar el acceso tras una renovación sin recargar.
  const awaitingRenewal =
    subscriptionLocked || (user?.role === 'Patient' && isSubscriptionInactive(user))

  const recheckSubscription = useCallback(async () => {
    const me = await authApi.me()
    setUser((prev) => (sameUser(prev, me) ? prev : me))
    return me
  }, [])

  useEffect(() => {
    if (!awaitingRenewal) return
    const recheck = () => {
      recheckSubscription().catch(() => undefined)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck()
    }
    const timer = window.setInterval(recheck, SUBSCRIPTION_RECHECK_MS)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [awaitingRenewal, recheckSubscription])

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
        subscriptionLocked,
        recheckSubscription,
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
