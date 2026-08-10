import { useEffect, useState } from 'react'
import { usersApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { InvitationDto, UserListItem } from '../api/types'
import { roleLabel } from '../api/types'

const ROLE_OPTIONS = [
  { value: 1, label: 'Administrador' },
  { value: 2, label: 'Nutricionista' },
  { value: 3, label: 'Entrenador' },
  { value: 4, label: 'Paciente' },
]

const ROLE_VALUE: Record<string, number> = {
  Admin: 1,
  Nutritionist: 2,
  Trainer: 3,
  Patient: 4,
}

const STATUS_LABEL: Record<string, string> = {
  Pending: 'Pendiente',
  Accepted: 'Aceptada',
  Declined: 'Rechazada',
  Expired: 'Expirada',
  Revoked: 'Revocada',
}

export default function Users() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [invitations, setInvitations] = useState<InvitationDto[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(4)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      const data = await usersApi.list()
      setUsers(data)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const loadInvitations = async () => {
    try {
      setInvitations(await usersApi.invitations())
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false))
    loadInvitations()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await usersApi.invite({ email: inviteEmail, role: inviteRole })
      setMessage({ type: 'ok', text: 'Invitación creada y en cola de envío.' })
      setInviteEmail('')
      await loadUsers()
      await loadInvitations()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleAssignRole = async (userId: string, role: number) => {
    setMessage(null)
    try {
      await usersApi.updateRole(userId, role)
      setMessage({ type: 'ok', text: 'Rol actualizado.' })
      await loadUsers()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleResend = async (inv: InvitationDto) => {
    setMessage(null)
    try {
      await usersApi.resendInvitation(inv.id)
      setMessage({ type: 'ok', text: `Invitación reenviada a ${inv.email}.` })
      await loadInvitations()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleRevoke = async (inv: InvitationDto) => {
    if (!window.confirm(`¿Revocar la invitación de ${inv.email}?`)) return
    setMessage(null)
    try {
      await usersApi.revokeInvitation(inv.id)
      setMessage({ type: 'ok', text: 'Invitación revocada.' })
      await loadInvitations()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <section className="card">
        <h2>Invitar usuario</h2>
        <form onSubmit={handleInvite} className="invite-form">
          <input
            type="email"
            placeholder="Email del usuario"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(Number(e.target.value))}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Enviar invitación
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Invitaciones ({invitations.length})</h2>
        {invitations.length === 0 ? (
          <p className="empty-state">Aún no hay invitaciones.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Enviada</th>
                  <th>Expira</th>
                  <th>Intentos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>{roleLabel(inv.role)}</td>
                    <td>
                      <span className={`badge invite-status ${inv.status.toLowerCase()}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                      {inv.lastError && <span className="invite-error" title={inv.lastError}>⚠</span>}
                    </td>
                    <td>{fmtDate(inv.sentAt)}</td>
                    <td>{fmtDate(inv.expiresAt)}</td>
                    <td>{inv.attempts}</td>
                    <td>
                      {inv.status === 'Pending' && (
                        <div className="invite-actions">
                          <button type="button" className="btn-ghost" onClick={() => handleResend(inv)}>Reenviar</button>
                          <button type="button" className="btn-danger-soft" onClick={() => handleRevoke(inv)}>Revocar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Usuarios ({users.length})</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Asignar rol</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.firstName} {u.lastName}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge">{roleLabel(u.role)}</span>
                    </td>
                    <td>{u.status}</td>
                    <td>
                      {u.role !== 'SuperAdmin' ? (
                        <select
                          value={ROLE_VALUE[u.role] ?? 4}
                          onChange={(e) => handleAssignRole(u.id, Number(e.target.value))}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}