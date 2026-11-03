import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AdminUserDto, MembershipDto, TenantDto } from '../api/types'
import { ROLE_KEYS, roleLabel } from '../api/types'
import { membershipLabel, membershipTenant, roleIcon, sortMemberships } from '../components/membershipUtils'
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
      {isSuper ? (
        <p className="text-muted admin-sub" style={{ alignSelf: 'center' }}>
          Super Administrador no pertenece a ningún tenant (plataforma).
        </p>
      ) : (
        <label>
          Tenant *
          <select value={tenantId} onChange={(e) => onTenant(e.target.value)} required>
            <option value="">Selecciona un tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.isActive}>
                {t.name}
                {t.isActive ? '' : ' (inactivo)'}
              </option>
            ))}
          </select>
        </label>
      )}
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

const MAX_CHIPS = 2

/** Indicador compacto de membresías en la tabla. */
function MembershipChips({ user, onOpen }: { user: AdminUserDto; onOpen: () => void }) {
  const list = user.memberships?.length
    ? sortMemberships(user.memberships)
    : // Compatibilidad: si el backend no envía memberships, se muestra la por defecto.
      [{ id: 'default', tenantId: user.tenantId, tenantName: user.tenantName, role: user.role, status: 'Active', lastUsedAt: null }]
  const extra = list.length - MAX_CHIPS
  return (
    <div className="membership-chips" title={list.map(membershipLabel).join('\n')}>
      {list.slice(0, MAX_CHIPS).map((m) => (
        <span key={m.id} className={`membership-chip${m.status !== 'Active' ? ' inactive' : ''}`}>
          <span className="material-symbols-outlined" aria-hidden="true">
            {roleIcon(m.role)}
          </span>
          {membershipTenant(m)} · {roleLabel(m.role)}
        </span>
      ))}
      {extra > 0 && (
        <button type="button" className="membership-chip more" onClick={onOpen} aria-label={`Ver ${extra} perfil(es) más`}>
          +{extra}
        </button>
      )}
    </div>
  )
}

/** Gestión de membresías (tenant + rol) de un usuario: listar, agregar y quitar. */
function MembershipsModal({
  user,
  tenants,
  isMe,
  onChanged,
  onClose,
}: {
  user: AdminUserDto
  tenants: TenantDto[]
  isMe: boolean
  onChanged: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const [memberships, setMemberships] = useState<MembershipDto[]>(user.memberships ?? [])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [role, setRole] = useState('Admin')
  const [tenantId, setTenantId] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setMemberships(await adminApi.userMemberships(user.id))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const m = await adminApi.addMembership(user.id, {
        role,
        tenantId: role === 'SuperAdmin' ? null : tenantId || null,
      })
      toast.success(`Perfil agregado: ${membershipLabel(m)}`)
      setTenantId('')
      onChanged()
      await load()
    } catch (err) {
      setAddError(getErrorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (m: MembershipDto) => {
    setRemovingId(m.id)
    try {
      await adminApi.removeMembership(user.id, m.id)
      toast.success(`Perfil quitado: ${membershipLabel(m)}`)
      setConfirmId(null)
      onChanged()
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirmId(null)
    } finally {
      setRemovingId(null)
    }
  }

  const isLast = memberships.length <= 1

  return (
    <Modal title={`Perfiles de ${user.fullName}`} onClose={onClose} className="modal-wide">
      <p className="text-muted">
        {user.email} · Los cambios se aplican en el próximo inicio de sesión o renovación de token del usuario.
      </p>

      <h3 className="fieldset-title">Membresías actuales</h3>
      {loading && memberships.length === 0 ? (
        <p>Cargando...</p>
      ) : loadError ? (
        <div className="alert err">
          {loadError}{' '}
          <button type="button" className="btn-ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      ) : memberships.length === 0 ? (
        <p className="empty-state">Sin membresías.</p>
      ) : (
        <ul className="membership-admin-list">
          {sortMemberships(memberships).map((m) => {
            const ownSuper = isMe && m.role === 'SuperAdmin'
            const blockReason = isLast
              ? 'Es su única membresía: usa "Eliminar usuario".'
              : ownSuper
                ? 'No puedes quitarte tu propio perfil de Super Administrador.'
                : null
            return (
              <li key={m.id}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {roleIcon(m.role)}
                </span>
                <span className="membership-admin-body">
                  <strong>{membershipTenant(m)}</strong>
                  <span className="text-muted">
                    {roleLabel(m.role)}
                    {m.status !== 'Active' ? ` · ${m.status}` : ''}
                    {m.lastUsedAt ? ` · último uso ${fmtDate(m.lastUsedAt)}` : ''}
                  </span>
                </span>
                {confirmId === m.id ? (
                  <span className="membership-admin-confirm" role="group" aria-label="Confirmar quitar perfil">
                    <span>¿Quitar este perfil?</span>
                    <button type="button" className="btn-ghost" onClick={() => setConfirmId(null)} disabled={removingId !== null}>
                      Cancelar
                    </button>
                    <button type="button" className="btn-danger" onClick={() => handleRemove(m)} disabled={removingId !== null}>
                      {removingId === m.id ? 'Quitando...' : 'Quitar'}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-danger-soft btn-icon-danger"
                    onClick={() => setConfirmId(m.id)}
                    disabled={!!blockReason}
                    title={blockReason ?? 'Quitar perfil'}
                    aria-label={`Quitar perfil ${membershipLabel(m)}`}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      remove_circle
                    </span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="fieldset-title">Agregar perfil</h3>
      {addError && <div className="alert err">{addError}</div>}
      <form onSubmit={handleAdd}>
        <div className="form-grid">
          <RoleTenantFields
            role={role}
            tenantId={tenantId}
            tenants={tenants}
            onRole={setRole}
            onTenant={setTenantId}
          />
        </div>
        {role === 'Patient' && (
          <p className="text-muted admin-sub">Se creará su ficha de paciente en el tenant si no existe.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="btn-primary" disabled={adding}>
            {adding ? 'Agregando...' : 'Agregar perfil'}
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
  const [managing, setManaging] = useState<AdminUserDto | null>(null)
  const [membershipsChanged, setMembershipsChanged] = useState(false)
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
                  <th>Perfiles (tenant · rol)</th>
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
                        <MembershipChips user={u} onOpen={() => setManaging(u)} />
                      </td>
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
                            onClick={() => setManaging(u)}
                            aria-label={`Gestionar perfiles de ${u.fullName}`}
                            title="Gestionar perfiles (membresías)"
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

      {managing && (
        <MembershipsModal
          user={managing}
          tenants={tenants}
          isMe={me?.id === managing.id}
          onChanged={() => setMembershipsChanged(true)}
          onClose={() => {
            setManaging(null)
            if (membershipsChanged) {
              setMembershipsChanged(false)
              load()
            }
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
