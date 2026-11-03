import { useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { MembershipSelectionResponse } from '../api/types'
import { useAuth } from '../context/AuthContext'
import MembershipPicker from '../components/MembershipPicker'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { GOOGLE_CLIENT_ID } from '../config/auth'

// Aviso solo para desarrollo: nunca se muestra en la interfaz.
if (import.meta.env.DEV && !GOOGLE_CLIENT_ID) {
  console.info('[auth] Google login no configurado: define VITE_GOOGLE_CLIENT_ID para mostrar el botón de Google.')
}

/** Solo rutas internas ("/x"), nunca "//host" ni URLs absolutas. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function Login() {
  const { login, handleLoginResult, selectMembership } = useAuth()
  const navigate = useNavigate()
  const ids = useId()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selection, setSelection] = useState<MembershipSelectionResponse | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const afterLogin = (pending: MembershipSelectionResponse | null) => {
    if (pending) {
      setSelection(pending)
    } else {
      navigate(next)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      afterLogin(await login(email, password))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async (credential: string) => {
    setError('')
    try {
      afterLogin(handleLoginResult(await authApi.googleLogin(credential)))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const handleSelect = async (membershipId: string) => {
    if (!selection) return
    setSelectingId(membershipId)
    try {
      await selectMembership(selection.selectionToken, membershipId)
      navigate(next)
    } catch (err) {
      // selectionToken de un solo uso / 5 min: si falla, se vuelve a pedir credenciales.
      setSelection(null)
      setPassword('')
      setError(`${getErrorMessage(err)} Vuelve a iniciar sesión.`)
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <header className="auth-brand">
          <span className="brand-mark auth-logo" aria-hidden="true">
            <span className="material-symbols-outlined is-filled">favorite</span>
          </span>
          <h1>MyFitnessLife</h1>
          {!selection && <p className="auth-subtitle">¡Qué bueno verte de nuevo!</p>}
        </header>

        {selection ? (
          <MembershipPicker
            memberships={selection.memberships}
            busyId={selectingId}
            onSelect={handleSelect}
            onBack={() => {
              setSelection(null)
              setPassword('')
            }}
          />
        ) : (
          <>
            {GOOGLE_CLIENT_ID && (
              <>
                <GoogleAuthButton
                  text="signin_with"
                  onCredential={handleGoogle}
                  onError={() => setError('No se pudo iniciar sesión con Google.')}
                />
                <div className="divider">
                  <span>o con tu correo</span>
                </div>
              </>
            )}
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field">
                <label htmlFor={`${ids}-email`}>Correo</label>
                <input
                  id={`${ids}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="nombre@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`${ids}-password`}>Contraseña</label>
                <input
                  id={`${ids}-password`}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="error-box" role="alert">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    error
                  </span>
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={loading}
                aria-busy={loading || undefined}
              >
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="auth-links">
              ¿No tienes cuenta? <Link to="/crear-cuenta">Crea una gratis</Link>
            </p>
            <p className="hint">¿Te invitó tu centro? Usa el enlace del correo de invitación para activar tu cuenta.</p>
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
