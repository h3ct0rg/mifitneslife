import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { authApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { MembershipSelectionResponse } from '../api/types'
import { useAuth } from '../context/AuthContext'
import MembershipPicker from '../components/MembershipPicker'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/** Solo rutas internas ("/x"), nunca "//host" ni URLs absolutas. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function Login() {
  const { login, handleLoginResult, selectMembership } = useAuth()
  const navigate = useNavigate()
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

  const handleGoogle = async (credential?: string) => {
    if (!credential) return
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
    <div className="auth-page">
      <div className="auth-card">
        <h1>MyFitnessLife</h1>
        <p className="auth-subtitle">Plataforma de Fitness & Nutrición</p>

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
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <div className="error-box">{error}</div>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="divider">
              <span>o</span>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <GoogleLogin
                  onSuccess={(res) => handleGoogle(res.credential)}
                  onError={() => setError('Error con Google')}
                />
              </GoogleOAuthProvider>
            ) : (
              <p className="hint">
                Google login no configurado. Agrega VITE_GOOGLE_CLIENT_ID.
              </p>
            )}
          </>
        )}

        <div className="demo-creds">
        </div>
      </div>
    </div>
  )
}
