import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { authApi } from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function Login() {
  const { login, setAuth } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
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
      const res = await authApi.googleLogin(credential)
      setAuth(res.accessToken, res.refreshToken, res.user)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>MyFitnessLife</h1>
        <p className="auth-subtitle">Plataforma de Fitness & Nutrición</p>

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

        <div className="demo-creds">          
        </div>
      </div>
    </div>
  )
}