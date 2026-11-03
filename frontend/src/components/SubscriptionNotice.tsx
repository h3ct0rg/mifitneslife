import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import { roleLabel } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { fmtShortDate, isSubscriptionInactive } from '../utils/subscription'
import { membershipLabel, membershipTenant, roleIcon, sortMemberships } from './membershipUtils'

/**
 * AC-9: pantalla de bloqueo para staff (Admin/Nutricionista/Entrenador) con la suscripción del centro
 * vencida. Sin navegación clínica: solo cambiar a otro perfil (si tiene) o salir.
 */
export function SubscriptionLockScreen() {
  const { user, switchMembership, logout, recheckSubscription } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rechecking, setRechecking] = useState(false)

  const handleRecheck = async () => {
    setRechecking(true)
    try {
      const me = await recheckSubscription()
      // Si se renovó, Layout desmonta esta pantalla; si no, se informa y la pantalla permanece.
      const status = me.subscription?.status
      if (status !== 'Active' && status !== 'ExpiringSoon')
        toast.show('La suscripción del centro sigue vencida.', 'info')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRechecking(false)
    }
  }

  if (!user) return null
  const current = user.memberships?.find((m) => m.id === user.membershipId)
  const others = sortMemberships((user.memberships ?? []).filter((m) => m.id !== user.membershipId))
  const endsAt = user.subscription?.endsAt

  const handleSwitch = async (membershipId: string) => {
    setBusyId(membershipId)
    try {
      await switchMembership(membershipId)
      const m = others.find((x) => x.id === membershipId)
      navigate('/')
      if (m) toast.success(`Ahora estás como ${membershipLabel(m)}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="auth-page">
      <main className="auth-card subscription-lock" aria-labelledby="subscription-lock-title">
        <div className="auth-brand">
          <span className="brand-mark auth-logo subscription-lock-icon" aria-hidden="true">
            <span className="material-symbols-outlined">lock_clock</span>
          </span>
          <h1 id="subscription-lock-title">Suscripción vencida</h1>
          <p className="auth-subtitle">
            {current ? `${membershipTenant(current)} · ${roleLabel(current.role)}` : roleLabel(user.role)}
          </p>
        </div>
        <p className="subscription-lock-text">
          La suscripción de este centro {endsAt ? `venció el ${fmtShortDate(endsAt)}` : 'no está vigente'}. Contacta
          al administrador de la plataforma para renovarla.
        </p>

        {others.length > 0 && (
          <div className="subscription-lock-switch">
            <p className="membership-picker-hint">Puedes continuar con otro perfil:</p>
            <div className="membership-cards">
              {others.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="membership-card"
                  onClick={() => handleSwitch(m.id)}
                  disabled={busyId !== null}
                  aria-busy={busyId === m.id || undefined}
                >
                  <span className="icon-chip icon-chip--soft membership-card-icon" aria-hidden="true">
                    <span className="material-symbols-outlined">{roleIcon(m.role)}</span>
                  </span>
                  <span className="membership-card-body">
                    <strong>{membershipTenant(m)}</strong>
                    <span>{roleLabel(m.role)}</span>
                  </span>
                  {busyId === m.id && <span className="membership-card-tag">Cambiando...</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn--secondary membership-back subscription-lock-retry"
          onClick={handleRecheck}
          disabled={rechecking || busyId !== null}
          aria-busy={rechecking || undefined}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
          {rechecking ? 'Comprobando...' : 'Ya se renovó, reintentar'}
        </button>
        <button
          type="button"
          className="btn btn--ghost membership-back"
          onClick={handleLogout}
          disabled={busyId !== null}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            logout
          </span>
          Salir
        </button>
      </main>
    </div>
  )
}

/**
 * AC-9: avisos dentro del shell. Admin del tenant: plan por vencer (≤7 días).
 * Paciente con suscripción del centro vencida: aviso discreto de solo lectura.
 */
export function SubscriptionBanner() {
  const { user } = useAuth()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  if (!user?.subscription) return null
  const sub = user.subscription

  if (user.role === 'Patient' && isSubscriptionInactive(user)) {
    return (
      <div className="subscription-banner subscription-banner--info" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">
          visibility
        </span>
        <span>Modo solo lectura: puedes consultar tu información, pero por ahora no se pueden registrar cambios.</span>
      </div>
    )
  }

  if (user.role === 'Admin' && sub.status === 'ExpiringSoon' && dismissedFor !== user.membershipId) {
    const days = sub.daysLeft ?? null
    const when = days === null ? '' : days <= 0 ? ' (hoy)' : days === 1 ? ' (mañana)' : ` (en ${days} días)`
    return (
      <div className="subscription-banner subscription-banner--warning" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">
          schedule
        </span>
        <span>
          Tu plan{sub.planName && <strong> {sub.planName}</strong>} vence el {fmtShortDate(sub.endsAt)}
          {when}. Contacta al administrador de la plataforma para renovarlo.
        </span>
        <button
          type="button"
          className="btn btn--icon subscription-banner-close"
          onClick={() => setDismissedFor(user.membershipId)}
          aria-label="Ocultar aviso"
          title="Ocultar aviso"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
    )
  }

  return null
}
