import { useEffect, useState } from 'react'
import { usersApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { UserListItem } from '../api/types'
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

export default function Users() {
  const [users, setUsers] = useState<UserListItem[]>([])
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await usersApi.invite({ email: inviteEmail, role: inviteRole })
      setMessage({ type: 'ok', text: 'Invitación creada correctamente.' })
      setInviteEmail('')
      loadUsers()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleAssignRole = async (userId: string, role: number) => {
    setMessage(null)
    try {
      await usersApi.updateRole(userId, role)
      setMessage({ type: 'ok', text: 'Rol actualizado.' })
      loadUsers()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

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
        <h2>Usuarios ({users.length})</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
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
        )}
      </section>
    </div>
  )
}