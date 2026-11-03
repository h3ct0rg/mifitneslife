import { useCallback, useEffect, useId, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AdminUserDto, MembershipDto, TenantDto } from '../api/types'
import { ROLE_KEYS, roleLabel } from '../api/types'
import { membershipLabel, membershipTenant, roleIcon, sortMemberships } from '../components/membershipUtils'
import { useAuth } from '../context/AuthContext'
import Modal, { ConfirmModal, DeleteConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

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

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

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

/** Rol + tenant (el tenant no aplica a Super Administrador). Campos a 1 columna en móvil. */
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
  const ids = useId()
  const isSuper = role === 'SuperAdmin'
  return (
    <>
      <div className="field">
        <label htmlFor={`${ids}-role`}>Rol *</label>
        <select
          id={`${ids}-role`}
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
      </div>
      {isSuper ? (
        <p className="admin-note">
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
          Super Administrador no pertenece a ningún tenant (plataforma).
        </p>
      ) : (
        <div className="field">
          <label htmlFor={`${ids}-tenant`}>Tenant *</label>
          <select id={`${ids}-tenant`} value={tenantId} onChange={(e) => onTenant(e.target.value)} required>
            <option value="">Selecciona un tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.isActive}>
                {t.name}
                {t.isActive ? '' : ' (inactivo)'}
              </option>
            ))}
          </select>
        </div>
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
  const ids = useId()
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
      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="field">
          <label htmlFor={`${ids}-name`}>Nombre completo *</label>
          <input
            id={`${ids}-name`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-email`}>Email *</label>
          <input
            id={`${ids}-email`}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-pass`}>Contraseña *</label>
          <input
            id={`${ids}-pass`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            aria-describedby={`${ids}-pass-hint`}
          />
          <p className="field-hint" id={`${ids}-pass-hint`}>
            Mínimo 6 caracteres.
          </p>
        </div>
        <RoleTenantFields role={role} tenantId={tenantId} tenants={tenants} onRole={setRole} onTenant={setTenantId} />
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving || undefined}>
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Hoja de edición: nombre + acciones de estado/borrado (antes eran 4 botones por fila). */
function EditUserModal({
  user,
  isMe,
  onSaved,
  onCancel,
  onManage,
  onToggle,
  onDelete,
}: {
  user: AdminUserDto
  isMe: boolean
  onSaved: (u: AdminUserDto) => void
  onCancel: () => void
  onManage: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const ids = useId()
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

  const cannotDeactivate = isMe && user.isActive

  return (
    <Modal title="Editar usuario" onClose={onCancel}>
      <p className="admin-hint">{user.email}</p>
      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="field">
          <label htmlFor={`${ids}-name`}>Nombre completo *</label>
          <input
            id={`${ids}-name`}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button type="button" className="btn btn--secondary btn--block" onClick={onManage} disabled={saving}>
          <span className="material-symbols-outlined" aria-hidden="true">
            badge
          </span>
          Gestionar perfiles (tenant · rol)
        </button>

        <div className="admin-danger-zone">
          <h3>Acceso</h3>
          <p>
            La cuenta está <strong>{user.isActive ? 'activa' : 'inactiva'}</strong>.
            {cannotDeactivate ? ' No puedes desactivar tu propia cuenta.' : ''}
          </p>
          <div className="admin-danger-actions">
            <button
              type="button"
              className={user.isActive ? 'btn btn-danger-soft' : 'btn btn--secondary'}
              onClick={onToggle}
              disabled={saving || cannotDeactivate}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {user.isActive ? 'block' : 'check_circle'}
              </span>
              {user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
            </button>
            {!isMe && (
              <button type="button" className="btn btn-danger-soft" onClick={onDelete} disabled={saving}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  delete
                </span>
                Eliminar usuario
              </button>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving || undefined}>
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
  const [confirming, setConfirming] = useState<MembershipDto | null>(null)
  const [removing, setRemoving] = useState(false)

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

  const handleRemove = async () => {
    if (!confirming) return
    const m = confirming
    setRemoving(true)
    try {
      await adminApi.removeMembership(user.id, m.id)
      toast.success(`Perfil quitado: ${membershipLabel(m)}`)
      setConfirming(null)
      onChanged()
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirming(null)
    } finally {
      setRemoving(false)
    }
  }

  const isLast = memberships.length <= 1

  return (
    <>
    <Modal title={`Perfiles de ${user.fullName}`} onClose={onClose} className="modal-wide">
      <p className="admin-hint">
        {user.email} · Los cambios se aplican en el próximo inicio de sesión o renovación de token del usuario.
      </p>

      <h3 className="admin-section-title">Membresías actuales</h3>
      {loading && memberships.length === 0 ? (
        <StateView state="loading" compact title="Cargando perfiles..." />
      ) : loadError ? (
        <StateView
          state="error"
          compact
          message={loadError}
          action={
            <button type="button" className="btn btn--ghost" onClick={load}>
              Reintentar
            </button>
          }
        />
      ) : memberships.length === 0 ? (
        <StateView state="empty" compact icon="badge" title="Sin membresías" />
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
                <button
                  type="button"
                  className="btn btn--icon admin-icon-danger"
                  onClick={() => setConfirming(m)}
                  disabled={!!blockReason || removing}
                  title={blockReason ?? 'Quitar perfil'}
                  aria-label={`Quitar perfil ${membershipLabel(m)}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    remove_circle
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="admin-section-title">Agregar perfil</h3>
      {addError && (
        <div className="alert err" role="alert">
          {addError}
        </div>
      )}
      <form onSubmit={handleAdd} className="admin-form">
        <div className="admin-form-grid admin-form-grid--2">
          <RoleTenantFields role={role} tenantId={tenantId} tenants={tenants} onRole={setRole} onTenant={setTenantId} />
        </div>
        {role === 'Patient' && <p className="field-hint">Se creará su ficha de paciente en el tenant si no existe.</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="submit" className="btn btn--primary" disabled={adding} aria-busy={adding || undefined}>
            {adding ? 'Agregando...' : 'Agregar perfil'}
          </button>
        </div>
      </form>
    </Modal>

    {/* Hermano (no hijo) del modal de perfiles: la pila de Modal gestiona Esc y foco. */}
    {confirming && (
      <ConfirmModal
        title="Quitar perfil"
        message={`¿Quitar el perfil ${membershipLabel(confirming)} de ${user.fullName}?`}
        confirmLabel="Quitar"
        danger
        busy={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirming(null)}
      />
    )}
    </>
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
      .catch((err) => toast.error(`No se pudieron cargar los tenants: ${getErrorMessage(err)}`))
  }, [toast])

  // Búsqueda inmediata (sin botón "Buscar"): se aplica tras una pausa al escribir.
  useEffect(() => {
    const q = search.trim()
    if (q === appliedSearch) return
    const timer = setTimeout(() => {
      setPage(1)
      setAppliedSearch(q)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, appliedSearch])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const afterSave = (text: string) => {
    toast.success(text)
    load()
  }

  const confirmToggle = async () => {
    if (!toggling) return
    setToggleBusy(true)
    try {
      await adminApi.updateUser(toggling.id, { fullName: toggling.fullName, isActive: !toggling.isActive })
      afterSave(toggling.isActive ? `Usuario ${toggling.email} desactivado.` : `Usuario ${toggling.email} activado.`)
    } catch (err) {
      toast.error(getErrorMessage(err))
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
      <PageHeader
        title="Usuarios"
        subtitle={loading && total === 0 ? 'Cuentas de la plataforma' : `${total} usuario(s) en la plataforma`}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
            <span className="material-symbols-outlined" aria-hidden="true">
              person_add
            </span>
            Crear usuario
          </button>
        }
      />

      <section className="card">
        <div className="admin-filters admin-filters--3" role="search">
          <div className="admin-search">
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              placeholder="Buscar por nombre o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>
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
        </div>

        {loading ? (
          <StateView state="loading" compact title="Cargando usuarios..." />
        ) : loadError ? (
          <StateView
            state="error"
            compact
            message={loadError}
            action={
              <button type="button" className="btn btn--ghost" onClick={load}>
                Reintentar
              </button>
            }
          />
        ) : users.length === 0 ? (
          <StateView state="empty" compact icon="person_search" title="No se encontraron usuarios" />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Perfiles (tenant · rol)</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = me?.id === u.id
                  return (
                    <tr key={u.id}>
                      <td className="admin-cell-title">
                        <span className="admin-person">
                          <Avatar id={u.id} name={u.fullName} />
                          <span className="admin-person-text">
                            <strong>{u.fullName}</strong>
                            {isMe && <span className="text-muted"> (tú)</span>}
                            <span className="admin-sub">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td data-label="Perfiles">
                        <MembershipChips user={u} onOpen={() => setManaging(u)} />
                      </td>
                      <td data-label="Estado">
                        <span className={`badge ${u.isActive ? 'badge--success' : 'badge--neutral'}`}>
                          {u.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td data-label="Último acceso" className="admin-nowrap">
                        {fmtDate(u.lastLoginAt)}
                      </td>
                      <td className="admin-cell-actions">
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="btn btn--icon"
                            onClick={() => setManaging(u)}
                            aria-label={`Gestionar perfiles de ${u.fullName}`}
                            title="Gestionar perfiles (membresías)"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              badge
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--icon"
                            onClick={() => setEditing(u)}
                            aria-label={`Editar ${u.fullName}`}
                            title="Editar, activar/desactivar o eliminar"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              edit
                            </span>
                          </button>
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
          <nav className="pagination" aria-label="Paginación de usuarios">
            <button
              type="button"
              className="btn btn--ghost"
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
              className="btn btn--ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
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
          isMe={me?.id === editing.id}
          onCancel={() => setEditing(null)}
          onSaved={(u) => {
            setEditing(null)
            afterSave(`Usuario ${u.email} actualizado.`)
          }}
          onManage={() => {
            setEditing(null)
            setManaging(editing)
          }}
          onToggle={() => {
            setEditing(null)
            setToggling(editing)
          }}
          onDelete={() => {
            setEditing(null)
            setDeleting(editing)
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
