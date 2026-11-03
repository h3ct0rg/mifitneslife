import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { MembershipSelectionResponse } from '../api/types'
import { useAuth } from '../context/AuthContext'
import MembershipPicker from '../components/MembershipPicker'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { GOOGLE_CLIENT_ID } from '../config/auth'
import { usePublicPlans } from '../components/landing/usePublicPlans'

/**
 * /crear-cuenta: alta solo con Google. Sin invitación, el backend crea el centro propio (Admin + plan de prueba);
 * si el usuario ya existe, simplemente entra (mismo flujo que Login: googleLogin + selección de membresía).
 */
export default function CreateAccount() {
  const { user, loading: authLoading, handleLoginResult, selectMembership } = useAuth()
  const navigate = useNavigate()
  const { trialDays } = usePublicPlans()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState<MembershipSelectionResponse | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const handleGoogle = async (credential: string) => {
    setError('')
    setBusy(true)
    try {
      const pending = handleLoginResult(await authApi.googleLogin(credential))
      if (pending) setSelection(pending)
      else navigate('/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSelect = async (membershipId: string) => {
    if (!selection) return
    setSelectingId(membershipId)
    try {
      await selectMembership(selection.selectionToken, membershipId)
      navigate('/', { replace: true })
    } catch (err) {
      // selectionToken de un solo uso / 5 min: se vuelve a pedir Google.
      setSelection(null)
      setError(`${getErrorMessage(err)} Inténtalo de nuevo.`)
    } finally {
      setSelectingId(null)
    }
  }

  // Con sesión activa no hay nada que crear (UX-12).
  if (!authLoading && user && !selection) return <Navigate to="/" replace />

  return (
    <main className="auth-page">
      <div className="auth-card auth-card--wide">
        <header className="auth-brand">
          <span className="brand-mark auth-logo" aria-hidden="true">
            <span className="material-symbols-outlined is-filled">favorite</span>
          </span>
          <h1>Crea tu cuenta gratis</h1>
          {!selection && <p className="auth-subtitle">Solo necesitas tu cuenta de Google.</p>}
        </header>

        {selection ? (
          <MembershipPicker
            memberships={selection.memberships}
            busyId={selectingId}
            onSelect={handleSelect}
            onBack={() => setSelection(null)}
          />
        ) : (
          <>
            <ol className="auth-steps">
              <li>
                <span className="icon-chip" aria-hidden="true">1</span>
                <span>Presiona el botón y elige tu cuenta de Google.</span>
              </li>
              <li>
                <span className="icon-chip" aria-hidden="true">2</span>
                <span>Entras directo a tu propio centro, sin formularios.</span>
              </li>
              <li>
                <span className="icon-chip" aria-hidden="true">3</span>
                <span>Tienes {trialDays} días gratis, sin tarjeta.</span>
              </li>
            </ol>

            {GOOGLE_CLIENT_ID ? (
              <>
                <GoogleAuthButton
                  text="continue_with"
                  busy={busy}
                  onCredential={handleGoogle}
                  onError={() => setError('No se pudo continuar con Google. Inténtalo de nuevo.')}
                />
                <p className="auth-status" role="status">
                  {busy ? 'Preparando tu centro…' : ''}
                </p>
              </>
            ) : (
              <p className="hint">El registro con Google no está disponible en este momento.</p>
            )}

            {error && (
              <div className="error-box" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">
                  error
                </span>
                {error}
              </div>
            )}

            <div className="auth-info">
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
              <p>
                <strong>¿Eres paciente?</strong> No necesitas crear una cuenta: tu centro te envía una invitación por
                correo. Si ya la activaste, <Link to="/login">inicia sesión</Link>.
              </p>
            </div>

            <p className="auth-links">
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
            </p>
            <p className="auth-back">
              <Link to="/">
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_back
                </span>
                Volver al inicio
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
