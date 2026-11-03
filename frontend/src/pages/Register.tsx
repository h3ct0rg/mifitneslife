import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { authApi, usersApi } from '../api'
import { getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { roleLabel } from '../api/types'
import type { InvitationInfoDto, MembershipSelectionResponse } from '../api/types'
import MembershipPicker from '../components/MembershipPicker'
import StateView from '../components/ui/StateView'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/** Contenedor común de las pantallas de registro: tarjeta centrada + marca. */
function AuthShell({ subtitle, children }: { subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <header className="auth-brand">
          <span className="brand-mark auth-logo" aria-hidden="true">
            <span className="material-symbols-outlined is-filled">favorite</span>
          </span>
          <h1>MyFitnessLife</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </header>
        {children}
      </div>
    </main>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">
        error
      </span>
      {message}
    </div>
  )
}

export default function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const ids = useId()
  const { user, loading: authLoading, setAuth, handleLoginResult, selectMembership, switchMembership, logout } = useAuth()
  const toast = useToast()

  const [info, setInfo] = useState<InvitationInfoDto | null>(null)
  const [selection, setSelection] = useState<MembershipSelectionResponse | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
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
      const pending = handleLoginResult(await authApi.googleLogin(credential))
      if (pending) setSelection(pending)
      else navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelect = async (membershipId: string) => {
    if (!selection) return
    setSelectingId(membershipId)
    try {
      await selectMembership(selection.selectionToken, membershipId)
      setSelection(null)
      navigate('/')
    } catch (err) {
      setSelection(null)
      setError(getErrorMessage(err))
    } finally {
      setSelectingId(null)
    }
  }

  /** Cuenta existente: agrega la membresía de la invitación y entra con ella. */
  const handleAccept = async () => {
    setAccepting(true)
    setError('')
    try {
      const membership = await usersApi.acceptInvitation(token)
      // switch-membership devuelve el user con la lista de membresías ya actualizada.
      await switchMembership(membership.id)
      toast.success(`Invitación aceptada: ahora eres ${roleLabel(membership.role)} en ${membership.tenantName ?? info?.tenantName ?? 'el centro'}.`)
      navigate('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setAccepting(false)
    }
  }

  const loginForInvite = () =>
    navigate(`/login?next=${encodeURIComponent(`/registro?token=${encodeURIComponent(token)}`)}`)

  if (loading || authLoading) {
    return (
      <AuthShell>
        <StateView state="loading" compact title="Cargando invitación..." />
      </AuthShell>
    )
  }

  if (!info?.valid) {
    return (
      <AuthShell subtitle="Invitación no válida o expirada">
        <p className="hint">
          El enlace de invitación no es válido, ya fue utilizado o expiró (las invitaciones duran 24 horas).
          Solicita un nuevo enlace al administrador.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/login')}>
          Ir a iniciar sesión
        </button>
      </AuthShell>
    )
  }

  if (selection) {
    return (
      <AuthShell>
        <MembershipPicker
          memberships={selection.memberships}
          busyId={selectingId}
          onSelect={handleSelect}
          onBack={() => setSelection(null)}
        />
      </AuthShell>
    )
  }

  if (info.existingAccount) {
    const invitedEmail = info.email ?? ''
    const sameAccount = !!user && user.email.toLowerCase() === invitedEmail.toLowerCase()
    return (
      <AuthShell
        subtitle={
          <>
            Invitación a <strong>{info.tenantName}</strong> como <strong>{roleLabel(info.role)}</strong>
          </>
        }
      >
        <p className="hint">
          Ya existe una cuenta con <strong>{invitedEmail}</strong>. Al aceptar se agregará este perfil a tu cuenta;
          tus perfiles actuales se mantienen.
        </p>
        {error && <ErrorBox message={error} />}
        {!user ? (
          <button type="button" className="btn btn--primary btn--block" onClick={loginForInvite}>
            Iniciar sesión para aceptar
          </button>
        ) : sameAccount ? (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={handleAccept}
            disabled={accepting}
            aria-busy={accepting || undefined}
          >
            {accepting ? 'Aceptando...' : 'Aceptar invitación'}
          </button>
        ) : (
          <>
            <p className="hint">
              Has iniciado sesión como <strong>{user.email}</strong>. Cierra sesión e inicia con{' '}
              <strong>{invitedEmail}</strong> para aceptar.
            </p>
            <button type="button" className="btn btn--primary btn--block" onClick={() => logout()}>
              Cerrar sesión
            </button>
          </>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell
      subtitle={
        <>
          Te has unido a <strong>{info.tenantName}</strong> como <strong>{roleLabel(info.role)}</strong>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-name-grid">
          <div className="field">
            <label htmlFor={`${ids}-first`}>Nombre</label>
            <input
              id={`${ids}-first`}
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-last`}>Apellido</label>
            <input
              id={`${ids}-last`}
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${ids}-email`}>Email</label>
          <input id={`${ids}-email`} type="email" autoComplete="email" value={email} readOnly required />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-password`}>Contraseña</label>
          <input
            id={`${ids}-password`}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            aria-describedby={`${ids}-password-hint`}
          />
          <p className="field-hint" id={`${ids}-password-hint`}>
            Mínimo 6 caracteres.
          </p>
        </div>
        {error && <ErrorBox message={error} />}
        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={submitting}
          aria-busy={submitting || undefined}
        >
          {submitting ? 'Registrando...' : 'Crear cuenta'}
        </button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <>
          <div className="divider">
            <span>o</span>
          </div>
          <div className="auth-google">
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <GoogleLogin
                onSuccess={(res) => handleGoogle(res.credential)}
                onError={() => setError('No se pudo continuar con Google.')}
              />
            </GoogleOAuthProvider>
          </div>
        </>
      )}
    </AuthShell>
  )
}
