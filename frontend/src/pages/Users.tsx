import { useEffect, useId, useState } from 'react'
import { usersApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { InvitationDto, UserListItem } from '../api/types'
import { roleLabel } from '../api/types'
import { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

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

const STATUS_BADGE: Record<string, string> = {
  Pending: 'badge--info',
  Accepted: 'badge--success',
  Declined: 'badge--danger',
  Expired: 'badge--warning',
  Revoked: 'badge--neutral',
}

/** Avatar con gradiente (MV-1 §8): índice 1..6 estable por id, iniciales del nombre. */
function Avatar({ id, name }: { id: string; name: string }) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
  return (
    <span className={`avatar av-${(Math.abs(h) % 6) + 1}`} aria-hidden="true">
      {initials}
    </span>
  )
}

const fmtDate =(iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export default function Users() {
  const ids = useId()
  const toast = useToast()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [invitations, setInvitations] = useState<InvitationDto[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState(4)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<InvitationDto | null>(null)
  const [revokeBusy, setRevokeBusy] = useState(false)

  const loadUsers = async () => {
    try {
      setUsers(await usersApi.list())
      setLoadError(null)
    } catch (err) {
      setLoadError(getErrorMessage(err))
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

  const retry = () => {
    setLoading(true)
    loadUsers().finally(() => setLoading(false))
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)
    try {
      await usersApi.invite({ email: inviteEmail, role: inviteRole })
      toast.success('Invitación creada y en cola de envío.')
      setInviteEmail('')
      await loadUsers()
      await loadInvitations()
    } catch (err) {
      setInviteError(getErrorMessage(err))
    } finally {
      setInviting(false)
    }
  }

  const handleAssignRole = async (userId: string, role: number) => {
    try {
      await usersApi.updateRole(userId, role)
      toast.success('Rol actualizado.')
      await loadUsers()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleResend = async (inv: InvitationDto) => {
    try {
      await usersApi.resendInvitation(inv.id)
      toast.success(`Invitación reenviada a ${inv.email}.`)
      await loadInvitations()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const confirmRevoke = async () => {
    if (!revoking) return
    setRevokeBusy(true)
    try {
      await usersApi.revokeInvitation(revoking.id)
      toast.success('Invitación revocada.')
      await loadInvitations()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRevoking(null)
      setRevokeBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Usuarios" subtitle="Invita a tu equipo y a tus pacientes, y gestiona sus roles." />

      <section className="card">
        <h2>Invitar usuario</h2>
        {inviteError && (
          <div className="alert err" role="alert">
            {inviteError}
          </div>
        )}
        <form onSubmit={handleInvite} className="invite-form">
          <div className="field">
            <label htmlFor={`${ids}-email`}>Email</label>
            <input
              id={`${ids}-email`}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="nombre@correo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-role`}>Rol</label>
            <select id={`${ids}-role`} value={inviteRole} onChange={(e) => setInviteRole(Number(e.target.value))}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn--primary" disabled={inviting} aria-busy={inviting || undefined}>
            <span className="material-symbols-outlined" aria-hidden="true">
              send
            </span>
            {inviting ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Invitaciones ({invitations.length})</h2>
        {invitations.length === 0 ? (
          <StateView state="empty" compact icon="mail" title="Aún no hay invitaciones" />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Enviada</th>
                  <th>Expira</th>
                  <th>Intentos</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="admin-cell-title">
                      <strong>{inv.email}</strong>
                    </td>
                    <td data-label="Rol">{roleLabel(inv.role)}</td>
                    <td data-label="Estado">
                      <span>
                        <span className={`badge ${STATUS_BADGE[inv.status] ?? 'badge--neutral'}`}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                        {inv.lastError && (
                          <span
                            className="material-symbols-outlined admin-warn-icon"
                            title={inv.lastError}
                            role="img"
                            aria-label={`Error de envío: ${inv.lastError}`}
                          >
                            warning
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Enviada" className="admin-nowrap">
                      {fmtDate(inv.sentAt)}
                    </td>
                    <td data-label="Expira" className="admin-nowrap">
                      {fmtDate(inv.expiresAt)}
                    </td>
                    <td data-label="Intentos">{inv.attempts}</td>
                    <td className="admin-cell-actions">
                      {inv.status === 'Pending' && (
                        <div className="admin-actions">
                          <button type="button" className="btn btn--ghost btn-sm" onClick={() => handleResend(inv)}>
                            Reenviar
                          </button>
                          <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => setRevoking(inv)}>
                            Revocar
                          </button>
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
          <StateView state="loading" compact title="Cargando usuarios..." />
        ) : loadError ? (
          <StateView
            state="error"
            compact
            message={loadError}
            action={
              <button type="button" className="btn btn--ghost" onClick={retry}>
                Reintentar
              </button>
            }
          />
        ) : users.length === 0 ? (
          <StateView state="empty" compact icon="group" title="Aún no hay usuarios" />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Asignar rol</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-cell-title">
                      <span className="admin-person">
                        <Avatar id={u.id} name={`${u.firstName} ${u.lastName}`} />
                        <span className="admin-person-text">
                          <strong>
                            {u.firstName} {u.lastName}
                          </strong>
                          <span className="admin-sub">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td data-label="Rol">
                      <span className="badge badge--info">{roleLabel(u.role)}</span>
                    </td>
                    <td data-label="Estado">{u.status}</td>
                    <td data-label="Asignar rol">
                      {u.role !== 'SuperAdmin' ? (
                        <select
                          value={ROLE_VALUE[u.role] ?? 4}
                          onChange={(e) => handleAssignRole(u.id, Number(e.target.value))}
                          aria-label={`Rol de ${u.firstName} ${u.lastName}`}
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

      {revoking && (
        <ConfirmModal
          title="Revocar invitación"
          message={`¿Revocar la invitación de ${revoking.email}? El enlace dejará de funcionar.`}
          confirmLabel="Revocar"
          danger
          busy={revokeBusy}
          onConfirm={confirmRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  )
}
