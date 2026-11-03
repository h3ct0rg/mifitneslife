import type { SubscriptionStatus, UserDto } from '../api/types'

/** Vencida o sin suscripción (status None). `subscription` null = SuperAdmin o backend sin el dato. */
export const isSubscriptionInactive = (user: UserDto | null) =>
  user?.subscription?.status === 'Expired' || user?.subscription?.status === 'None'

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  Active: 'Vigente',
  ExpiringSoon: 'Por vencer',
  Expired: 'Vencida',
  None: 'Sin plan',
}

export const SUBSCRIPTION_STATUS_BADGE: Record<SubscriptionStatus, string> = {
  Active: 'badge--success',
  ExpiringSoon: 'badge--warning',
  Expired: 'badge--danger',
  None: 'badge--neutral',
}

/** Fecha corta en la zona del navegador (dd/mm/aaaa). */
export const fmtShortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const fmtUsd = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
