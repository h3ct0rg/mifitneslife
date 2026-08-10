import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { authApi } from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../api/types'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { setAuth } = useAuth()

  const [info, setInfo] = useState<{ valid: boolean; email?: string; role?: string; tenantName?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setInfo({ valid: false })
      setLoading(false)
      return
    }
    authApi
      .getInvitation(token)
      .then((data) => {
        setInfo(data)
        setEmail(data.email ?? '')
      })
      .catch(() => setInfo({ valid: false }))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ingresa tu nombre y apellido.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await authApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
        invitationToken: token,
      })
      setAuth(res.accessToken, res.refreshToken, res.user)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async (credential?: string) => {
    if (!credential) return
    setError('')
    setSubmitting(true)
    try {
      const res = await authApi.googleLogin(credential)
      setAuth(res.accessToken, res.refreshToken, res.user)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card"><p className="hint">Cargando invitación...</p></div>
      </div>
    )
  }

  if (!info?.valid) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>MyFitnessLife</h1>
          <p className="auth-subtitle">Invitación no válida o expirada</p>
          <p className="hint">
            El enlace de invitación no es válido, ya fue utilizado o expiró (las invitaciones duran 24 horas).
            Solicita un nuevo enlace al administrador.
          </p>
          <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>MyFitnessLife</h1>
        <p className="auth-subtitle">
          Te has unido a <strong>{info.tenantName}</strong> como{' '}
          <strong>{roleLabel(info.role)}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <input type="text" placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <input type="text" placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <input type="email" placeholder="Email" value={email} readOnly required />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          {error && <div className="error-box">{error}</div>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Crear cuenta'}
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
          <p className="hint">Google login no configurado.</p>
        )}
      </div>
    </div>
  )
}