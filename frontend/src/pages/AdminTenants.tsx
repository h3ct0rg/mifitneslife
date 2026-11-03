import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { TenantActivityDto, TenantDto } from '../api/types'
import Modal, { ConfirmModal, DeleteConfirmModal } from '../components/Modal'
import { useToast } from '../context/toastContext'

type Msg = { type: 'ok' | 'err'; text: string } | null

interface TenantFormValues {
  name: string
  slug: string
  description: string
  isActive: boolean
}

const fmtDate = (iso?: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'

function TenantForm({
  tenant,
  onSaved,
  onCancel,
}: {
  tenant: TenantDto | null
  onSaved: (t: TenantDto) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<TenantFormValues>({
    name: tenant?.name ?? '',
    slug: tenant?.slug ?? '',
    description: tenant?.description ?? '',
    isActive: tenant?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const description = values.description.trim() || undefined
      const saved = tenant
        ? await adminApi.updateTenant(tenant.id, {
            name: values.name.trim(),
            description,
            isActive: values.isActive,
          })
        : await adminApi.createTenant({
            name: values.name.trim(),
            description,
            slug: values.slug.trim() || undefined,
          })
      onSaved(saved)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={tenant ? 'Editar tenant' : 'Crear tenant'} onClose={onCancel}>
      {error && <div className="alert err">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-full">
            Nombre *
            <input
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
              autoFocus
            />
          </label>
          <label className="form-full">
            Slug {tenant ? '' : '(opcional, se genera si se deja vacío)'}
            <input
              value={values.slug}
              onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
              disabled={!!tenant}
              placeholder="mi-clinica"
            />
          </label>
          <label className="form-full">
            Descripción
            <textarea
              rows={3}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            />
          </label>
          {tenant && (
            <label className="form-full admin-check">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
              />
              Activo
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : tenant ? 'Guardar cambios' : 'Crear tenant'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<TenantDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<Msg>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<TenantDto | null | undefined>(undefined)
  const [toggling, setToggling] = useState<TenantDto | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [activityFor, setActivityFor] = useState<TenantDto | null>(null)
  const [activity, setActivity] = useState<TenantActivityDto[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TenantDto | null>(null)
  const toast = useToast()

  const loadDeleteImpact = async (t: TenantDto) => {
    const i = await adminApi.tenantDeleteImpact(t.id)
    return [
      `${i.users} usuario(s) del tenant`,
      `${i.patients} paciente(s)`,
      `${i.appointments} cita(s)`,
      `${i.otherRecords} registro(s) adicionales (dietas, planes, invitaciones, auditoría…)`,
    ]
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteTenant(deleting.id)
      toast.success('Tenant eliminado')
      setDeleting(null)
      setMessage(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setDeleting(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setTenants(await adminApi.tenants())
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    )
  }, [tenants, search])

  const handleSaved = (saved: TenantDto) => {
    const isEdit = !!editing
    setEditing(undefined)
    setMessage({
      type: 'ok',
      text: isEdit ? `Tenant "${saved.name}" actualizado.` : `Tenant "${saved.name}" creado (slug: ${saved.slug}).`,
    })
    load()
  }

  const confirmToggle = async () => {
    if (!toggling) return
    setToggleBusy(true)
    setMessage(null)
    try {
      await adminApi.updateTenant(toggling.id, {
        name: toggling.name,
        description: toggling.description ?? undefined,
        isActive: !toggling.isActive,
      })
      setMessage({
        type: 'ok',
        text: toggling.isActive ? `Tenant "${toggling.name}" desactivado.` : `Tenant "${toggling.name}" activado.`,
      })
      setToggling(null)
      load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      setToggling(null)
    } finally {
      setToggleBusy(false)
    }
  }

  const openActivity = async (t: TenantDto) => {
    setActivityFor(t)
    setActivity([])
    setActivityError(null)
    setActivityLoading(true)
    try {
      setActivity(await adminApi.tenantActivity(t.id))
    } catch (err) {
      setActivityError(getErrorMessage(err))
    } finally {
      setActivityLoading(false)
    }
  }

  return (
    <div className="page admin-page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <section className="card">
        <div className="admin-head">
          <h2>Tenants ({tenants.length})</h2>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => setEditing(null)}
          >
            + Crear tenant
          </button>
        </div>

        <div className="search-bar admin-filters">
          <input
            placeholder="Buscar por nombre, slug o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar tenants"
          />
        </div>

        {loading ? (
          <p>Cargando...</p>
        ) : loadError ? (
          <>
            <div className="alert err">{loadError}</div>
            <button type="button" className="btn-ghost" onClick={load}>
              Reintentar
            </button>
          </>
        ) : filtered.length === 0 ? (
          <p className="empty-state">
            {tenants.length === 0 ? 'Aún no hay tenants.' : 'Ningún tenant coincide con la búsqueda.'}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th>Pacientes</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      {t.description && <div className="text-muted admin-sub">{t.description}</div>}
                    </td>
                    <td>{t.slug}</td>
                    <td>
                      <span className={`badge ${t.isActive ? '' : 'badge-inactive'}`}>
                        {t.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{t.userCount}</td>
                    <td>{t.patientCount ?? 0}</td>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setEditing(t)}
                          aria-label={`Editar ${t.name}`}
                          title="Editar"
                        >
                          <span className="material-symbols-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => openActivity(t)}
                          aria-label={`Ver actividad de ${t.name}`}
                          title="Ver actividad"
                        >
                          <span className="material-symbols-outlined">history</span>
                        </button>
                        <button
                          type="button"
                          className={t.isActive ? 'btn-danger-soft' : 'btn-ghost'}
                          onClick={() => setToggling(t)}
                        >
                          {t.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="btn-danger-soft btn-icon-danger"
                          onClick={() => setDeleting(t)}
                          aria-label={`Eliminar ${t.name}`}
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing !== undefined && (
        <TenantForm tenant={editing} onSaved={handleSaved} onCancel={() => setEditing(undefined)} />
      )}

      {toggling && (
        <ConfirmModal
          title={toggling.isActive ? 'Desactivar tenant' : 'Activar tenant'}
          message={
            toggling.isActive
              ? `¿Desactivar "${toggling.name}"? Sus usuarios no podrán operar mientras esté inactivo.`
              : `¿Activar nuevamente "${toggling.name}"?`
          }
          confirmLabel={toggling.isActive ? 'Desactivar' : 'Activar'}
          danger={toggling.isActive}
          busy={toggleBusy}
          onConfirm={confirmToggle}
          onCancel={() => setToggling(null)}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          key={deleting.id}
          title="Eliminar tenant"
          question="¿Estás seguro de que deseas eliminar este tenant?"
          subject={`${deleting.name} (${deleting.slug})`}
          loadImpact={() => loadDeleteImpact(deleting)}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {activityFor && (
        <Modal
          title={`Actividad — ${activityFor.name}`}
          onClose={() => setActivityFor(null)}
          className="modal-wide"
        >
          <p className="text-muted">
            {activityFor.userCount} usuario(s) · {activityFor.patientCount ?? 0} paciente(s) · última actividad{' '}
            {fmtDate(activityFor.lastActivityAt, true)}
          </p>
          {activityLoading ? (
            <p>Cargando...</p>
          ) : activityError ? (
            <div className="alert err">{activityError}</div>
          ) : activity.length === 0 ? (
            <p className="empty-state">Sin actividad registrada.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={`${a.timestamp}-${i}`}>
                      <td>{fmtDate(a.timestamp, true)}</td>
                      <td>{a.action}</td>
                      <td>{a.entity}</td>
                      <td>{a.userEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setActivityFor(null)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
