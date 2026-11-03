import axios from 'axios'
import { browserTimeZone } from '../utils/localDate'
import { SUBSCRIPTION_EXPIRED_CODE } from './types'

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7115/api'

/** Evento emitido tras un refresh de tokens exitoso; `detail` = UserDto. */
export const AUTH_REFRESHED_EVENT = 'auth:refreshed'

/** Evento emitido ante un 403 `subscription_expired`; `detail.method` = método HTTP de la petición. */
export const SUBSCRIPTION_EXPIRED_EVENT = 'auth:subscription-expired'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Zona horaria del navegador (IANA) para que el backend calcule "hoy"/"ahora" en hora local (D2).
const TIME_ZONE = browserTimeZone()

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (TIME_ZONE) config.headers['X-Time-Zone'] = TIME_ZONE
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    // AC-9: suscripción vencida inesperada → AuthContext refresca `me` y Layout muestra el bloqueo.
    if (
      error.response?.status === 403 &&
      (error.response.data as { code?: string } | undefined)?.code === SUBSCRIPTION_EXPIRED_CODE
    ) {
      window.dispatchEvent(
        new CustomEvent(SUBSCRIPTION_EXPIRED_EVENT, { detail: { method: original?.method } }),
      )
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_URL}/auth/refresh`,
            { refreshToken },
            { headers: TIME_ZONE ? { 'X-Time-Zone': TIME_ZONE } : undefined },
          )
          localStorage.setItem('access_token', data.accessToken)
          localStorage.setItem('refresh_token', data.refreshToken)
          // AuthContext escucha este evento para actualizar `user` (membresía/rol/tenant).
          if (data.user) {
            window.dispatchEvent(new CustomEvent(AUTH_REFRESHED_EVENT, { detail: data.user }))
          }
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined
    // `message`: forma del 403 subscription_expired (y otros errores con { code, message }).
    return data?.error || data?.message || 'Error de conexión'
  }
  return 'Error desconocido'
}