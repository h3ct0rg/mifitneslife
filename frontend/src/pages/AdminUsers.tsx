import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AdminUserDto, TenantDto } from '../api/types'
import { ROLE_KEYS, roleLabel } from '../api/types'
import { useAuth } from '../context/AuthContext'
import Modal, { ConfirmModal, DeleteConfirmModal } from '../components/Modal'
import { useToast } from '../context/toastContext'

type Msg = { type: 'ok' | 'err'; text: string } | null

const PAGE_SIZE = 20

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

function RoleTenantFields({
  role,
  tenantId,
  tenants,
  onRole,
  onTenant,
}: {
  role: string
  tenantId: string
  tenants: TenantDto[]
  onRole: (r: string) => void
  onTenant: (t: string) => void
}) {
  const isSuper = role === 'SuperAdmin'
  return (
    <>
      <label>
        Rol *
        <select
          value={role}
          onChange={(e) => {
            onRole(e.target.value)
            if (e.target.value === 'SuperAdmin') onTenant('')
          }}
          required
        >
          {ROLE_KEYS.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tenant {isSuper ? '(no aplica)' : '*'}
        <select
          value={isSuper ? '' : tenantId}
          onChange={(e) => onTenant(e.target.value)}
          disabled={isSuper}
          required={!isSuper}
        >
          <option value="">{isSuper ? 'Sin tenant (plataforma)' : 'Selecciona un tenant'}</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id} disabled={!t.isActive}>
              {t.name}
              {t.isActive ? '' : ' (inactivo)'}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

function CreateUserModal({
  tenants,
  onSaved,
  onCancel,
}: {
  tenants: TenantDto[]
  onSaved: (u: AdminUserDto) => void
  onCancel: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Admin')
  const [tenantId, setTenantId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const u = await adminApi.createUser({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        role,
        tenantId: role === 'SuperAdmin' ? null : tenantId || null,
      })
      onSaved(u)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Crear usuario" onClose={onCancel}>
      {error && <div className="alert err">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-full">
            Nombre completo *
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </label>
          <label>
            Email *
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Contraseña *
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <RoleTenantFields
            role={role}
            tenantId={tenantId}
            tenants={tenants}
            onRole={setRole}
            onTenant={setTenantId}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({
  user,
  onSaved,
  onCancel,
}: {
  user: AdminUserDto
  onSaved: (u: AdminUserDto) => void
  onCancel: () => void
}) {
  const [fullName, setFullName] = useState(user.fullName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await adminApi.updateUser(user.id, { fullName: fullName.trim(), isActive: user.isActive }))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Editar usuario — ${user.email}`} onClose={onCancel}>
      {error && <div className="alert err">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-full">
            Nombre completo *
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AssignModal({
  user,
  tenants,
  onSaved,
  onCancel,
}: {
  user: AdminUserDto
  tenants: TenantDto[]
  onSaved: (u: AdminUserDto) => void
  onCancel: () => void
}) {
  const [role, setRole] = useState(user.role)
  const [tenantId, setTenantId] = useState(user.tenantId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(
        await adminApi.assignUser(user.id, {
          role,
          tenantId: role === 'SuperAdmin' ? null : tenantId || null,
        }),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Asignar rol y tenant — ${user.fullName}`} onClose={onCancel}>
      {error && <div className="alert err">{error}</div>}
      <p className="text-muted">
        Los cambios se aplican en el próximo inicio de sesión o renovación de token del usuario.
        {role === 'Patient' && ' Al asignar Paciente se creará su ficha de paciente en el tenant.'}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <RoleTenantFields
            role={role}
            tenantId={tenantId}
            tenants={tenants}
            onRole={setRole}
            onTenant={setTenantId}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar asignación'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [tenants, setTenants] = useState<TenantDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<Msg>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AdminUserDto | null>(null)
  const [assigning, setAssigning] = useState<AdminUserDto | null>(null)
  const [toggling, setToggling] = useState<AdminUserDto | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [deleting, setDeleting] = useState<AdminUserDto | null>(null)
  const toast = useToast()

  const loadDeleteImpact = async (u: AdminUserDto) => {
    const i = await adminApi.userDeleteImpact(u.id)
    const lines = [`Rol: ${roleLabel(i.role)}${i.tenantName ? ` · Tenant: ${i.tenantName}` : ''}`]
    if (i.patientProfile) lines.push('Se eliminará su ficha de paciente y sus datos asociados')
    lines.push(`${i.appointments} cita(s)`)
    lines.push(`${i.otherRecords} registro(s) adicionales (datos clínicos, invitaciones, auditoría, etc.)`)
    return lines
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await adminApi.users({
        search: appliedSearch || undefined,
        tenantId: tenantFilter || undefined,
        role: roleFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setUsers(data.items)
      setTotal(data.total)
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, tenantFilter, roleFilter, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    adminApi
      .tenants()
      .then(setTenants)
      .catch((err) => setMessage({ type: 'err', text: `No se pudieron cargar los tenants: ${getErrorMessage(err)}` }))
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setAppliedSearch(search.trim())
  }

  const afterSave = (text: string) => {
    setMessage({ type: 'ok', text })
    load()
  }

  const confirmToggle = async () => {
    if (!toggling) return
    setToggleBusy(true)
    setMessage(null)
    try {
      await adminApi.updateUser(toggling.id, { fullName: toggling.fullName, isActive: !toggling.isActive })
      afterSave(toggling.isActive ? `Usuario ${toggling.email} desactivado.` : `Usuario ${toggling.email} activado.`)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setToggling(null)
      setToggleBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteUser(deleting.id)
      toast.success('Usuario eliminado')
      setDeleting(null)
      setMessage(null)
      // Si se borró el último elemento de la página, retrocede una página.
      if (users.length === 1 && page > 1) setPage((p) => p - 1)
      else load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setDeleting(null)
    }
  }

  return (
    <div className="page admin-page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <section className="card">
        <div className="admin-head">
          <h2>Usuarios ({total})</h2>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => setCreating(true)}
          >
            + Crear usuario
          </button>
        </div>

        <form onSubmit={handleSearch} className="search-bar admin-filters">
          <input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar usuarios"
          />
          <select
            value={tenantFilter}
            onChange={(e) => {
              setPage(1)
              setTenantFilter(e.target.value)
            }}
            aria-label="Filtrar por tenant"
          >
            <option value="">Todos los tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setPage(1)
              setRoleFilter(e.target.value)
            }}
            aria-label="Filtrar por rol"
          >
            <option value="">Todos los roles</option>
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Buscar
          </button>
        </form>

        {loading ? (
          <p>Cargando...</p>
        ) : loadError ? (
          <>
            <div className="alert err">{loadError}</div>
            <button type="button" className="btn-ghost" onClick={load}>
              Reintentar
            </button>
          </>
        ) : users.length === 0 ? (
          <p className="empty-state">No se encontraron usuarios.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Tenant</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = me?.id === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.fullName}
                        {isMe && <span className="text-muted"> (tú)</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge">{roleLabel(u.role)}</span>
                      </td>
                      <td>{u.tenantName || '—'}</td>
                      <td>
                        <span className={`badge ${u.isActive ? '' : 'badge-inactive'}`}>
                          {u.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{fmtDate(u.lastLoginAt)}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setEditing(u)}
                            aria-label={`Editar ${u.fullName}`}
                            title="Editar"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setAssigning(u)}
                            aria-label={`Asignar rol y tenant a ${u.fullName}`}
                            title="Asignar rol y tenant"
                          >
                            <span className="material-symbols-outlined">badge</span>
                          </button>
                          <button
                            type="button"
                            className={u.isActive ? 'btn-danger-soft' : 'btn-ghost'}
                            onClick={() => setToggling(u)}
                            disabled={isMe && u.isActive}
                            title={isMe && u.isActive ? 'No puedes desactivarte a ti mismo' : undefined}
                          >
                            {u.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          {!isMe && (
                            <button
                              type="button"
                              className="btn-danger-soft btn-icon-danger"
                              onClick={() => setDeleting(u)}
                              aria-label={`Eliminar ${u.fullName}`}
                              title="Eliminar"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {creating && (
        <CreateUserModal
          tenants={tenants}
          onCancel={() => setCreating(false)}
          onSaved={(u) => {
            setCreating(false)
            afterSave(`Usuario ${u.email} creado.`)
          }}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onCancel={() => setEditing(null)}
          onSaved={(u) => {
            setEditing(null)
            afterSave(`Usuario ${u.email} actualizado.`)
          }}
        />
      )}

      {assigning && (
        <AssignModal
          user={assigning}
          tenants={tenants}
          onCancel={() => setAssigning(null)}
          onSaved={(u) => {
            setAssigning(null)
            afterSave(
              `Asignación de ${u.email} actualizada: ${roleLabel(u.role)}${u.tenantName ? ` en ${u.tenantName}` : ''}.`,
            )
          }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          key={deleting.id}
          title="Eliminar usuario"
          question="¿Estás seguro de que deseas eliminar este usuario?"
          subject={`${deleting.fullName} (${deleting.email})`}
          loadImpact={() => loadDeleteImpact(deleting)}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toggling && (
        <ConfirmModal
          title={toggling.isActive ? 'Desactivar usuario' : 'Activar usuario'}
          message={
            toggling.isActive
              ? `¿Desactivar a ${toggling.fullName} (${toggling.email})? No podrá iniciar sesión.`
              : `¿Activar nuevamente a ${toggling.fullName} (${toggling.email})?`
          }
          confirmLabel={toggling.isActive ? 'Desactivar' : 'Activar'}
          danger={toggling.isActive}
          busy={toggleBusy}
          onConfirm={confirmToggle}
          onCancel={() => setToggling(null)}
        />
      )}
    </div>
  )
}
