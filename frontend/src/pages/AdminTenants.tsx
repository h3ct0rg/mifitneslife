import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type {
  PlanDto,
  SubscriptionSummaryDto,
  TenantActivityDto,
  TenantDto,
  TenantSubscriptionDto,
} from '../api/types'
import {
  SUBSCRIPTION_STATUS_BADGE,
  SUBSCRIPTION_STATUS_LABELS,
  fmtShortDate,
  fmtUsd,
} from '../utils/subscription'
import Modal, { ConfirmModal, DeleteConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

interface TenantFormValues {
  name: string
  slug: string
  description: string
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

const fmtDate =(iso?: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'

/** Badge de estado de suscripción (AC-5). */
function SubscriptionBadge({ sub }: { sub?: SubscriptionSummaryDto | null }) {
  const status = sub?.status ?? 'None'
  return <span className={`badge ${SUBSCRIPTION_STATUS_BADGE[status]}`}>{SUBSCRIPTION_STATUS_LABELS[status]}</span>
}

function daysLeftText(sub: SubscriptionSummaryDto): string {
  if (sub.status === 'Expired') return `venció el ${fmtShortDate(sub.endsAt)}`
  const d = sub.daysLeft
  return `vence el ${fmtShortDate(sub.endsAt)}${d <= 0 ? ' (hoy)' : d === 1 ? ' (mañana)' : ` (en ${d} días)`}`
}

const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

type PendingAction = { kind: 'renew' | 'change'; plan: PlanDto }

/**
 * AC-6: sección Suscripción del editor de tenant: plan vigente, historial y acciones
 * Reiniciar (mismo plan desde ahora) y Cambiar plan (otro plan activo desde ahora), con confirmación.
 */
function TenantSubscriptionSection({ tenant, onChanged }: { tenant: TenantDto; onChanged: () => void }) {
  const ids = useId()
  const toast = useToast()
  const [summary, setSummary] = useState<SubscriptionSummaryDto | null>(tenant.subscription ?? null)
  const [history, setHistory] = useState<TenantSubscriptionDto[] | null>(null)
  const [plans, setPlans] = useState<PlanDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newPlanId, setNewPlanId] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await adminApi.tenantSubscriptions(tenant.id))
    } catch (err) {
      setError(getErrorMessage(err))
      setHistory([])
    }
  }, [tenant.id])

  useEffect(() => {
    loadHistory()
    adminApi
      .plans()
      .then((p) => setPlans([...p].sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setError(getErrorMessage(err)))
  }, [loadHistory])

  const currentPlan = summary ? plans.find((p) => p.id === summary.planId) : undefined
  const changeOptions = plans.filter((p) => p.isActive && p.id !== summary?.planId)
  const canRenew = !!currentPlan && currentPlan.isActive

  const apply = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const res = await adminApi.assignSubscription(tenant.id, {
        planId: pending.plan.id,
        note: note.trim() || undefined,
      })
      setSummary(res)
      toast.success(
        pending.kind === 'renew'
          ? `Plan "${res.planName}" reiniciado: vence el ${fmtShortDate(res.endsAt)}.`
          : `Plan cambiado a "${res.planName}": vence el ${fmtShortDate(res.endsAt)}.`,
      )
      setPending(null)
      setNewPlanId('')
      setNote('')
      loadHistory()
      onChanged()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmMessage = pending
    ? `${pending.kind === 'renew' ? `¿Reiniciar el plan "${pending.plan.name}"` : `¿Cambiar el plan a "${pending.plan.name}"`} para "${tenant.name}"? ` +
      `Inicia ahora y vence el ${fmtShortDate(addDays(pending.plan.durationDays))} (${pending.plan.durationDays} días, ${fmtUsd(pending.plan.priceUsd)}). ` +
      'Se agregará una fila al historial.'
    : ''

  return (
    <div className="admin-subscription">
      <h3 className="admin-section-title">Suscripción</h3>
      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}
      <div className="admin-subscription-current">
        <div className="admin-person-text">
          <strong>{summary?.planName ?? 'Sin plan asignado'}</strong>
          <span className="admin-sub">{summary ? daysLeftText(summary) : 'El centro no tiene una suscripción vigente.'}</span>
        </div>
        <SubscriptionBadge sub={summary} />
      </div>

      <div className="field">
        <label htmlFor={`${ids}-note`}>Nota (opcional)</label>
        <input
          id={`${ids}-note`}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          // Enter no debe enviar el formulario del tenant que envuelve esta sección.
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder="Ej.: pago recibido por transferencia"
        />
      </div>

      <div className="admin-subscription-actions">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={!canRenew || busy}
          onClick={() => currentPlan && setPending({ kind: 'renew', plan: currentPlan })}
          title={
            canRenew
              ? 'Inicia de nuevo el mismo plan desde ahora'
              : summary
                ? 'El plan actual está inactivo: usa Cambiar plan'
                : 'No hay plan que reiniciar'
          }
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            restart_alt
          </span>
          Reiniciar
        </button>
        <div className="admin-subscription-change">
          <select
            value={newPlanId}
            onChange={(e) => setNewPlanId(e.target.value)}
            aria-label="Nuevo plan"
            disabled={busy || changeOptions.length === 0}
          >
            <option value="">{changeOptions.length === 0 ? 'No hay otros planes activos' : 'Elegir otro plan…'}</option>
            {changeOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.durationDays} días · {fmtUsd(p.priceUsd)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!newPlanId || busy}
            onClick={() => {
              const plan = changeOptions.find((p) => p.id === newPlanId)
              if (plan) setPending({ kind: 'change', plan })
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              swap_horiz
            </span>
            Cambiar plan
          </button>
        </div>
      </div>

      <h4 className="admin-subscription-history-title">Historial</h4>
      {history === null ? (
        <StateView state="loading" compact title="Cargando historial..." />
      ) : history.length === 0 ? (
        <StateView state="empty" compact icon="history" title="Sin suscripciones registradas" />
      ) : (
        <div className="table-scroll">
          <table className="table table--stack admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Precio</th>
                <th>Asignado por</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="admin-cell-title">
                    <span className="admin-person-text">
                      <strong>{h.planName}</strong>
                      {h.note && <span className="admin-sub">{h.note}</span>}
                    </span>
                  </td>
                  <td data-label="Desde" className="admin-nowrap">
                    {fmtShortDate(h.startsAt)}
                  </td>
                  <td data-label="Hasta" className="admin-nowrap">
                    {fmtShortDate(h.endsAt)}
                  </td>
                  <td data-label="Precio" className="admin-nowrap">
                    {fmtUsd(h.priceUsd)}
                  </td>
                  <td data-label="Asignado por" title={fmtDate(h.createdAt, true)}>
                    {h.createdByName || 'Sistema'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Portal: la confirmación no queda anidada dentro del <form> ni del diálogo del editor. */}
      {pending &&
        createPortal(
        <ConfirmModal
          title={pending.kind === 'renew' ? 'Reiniciar plan' : 'Cambiar plan'}
          message={confirmMessage}
          confirmLabel={pending.kind === 'renew' ? 'Reiniciar' : 'Cambiar plan'}
          busy={busy}
          onConfirm={apply}
          onCancel={() => setPending(null)}
        />,
          document.body,
        )}
    </div>
  )
}

/** Hoja de crear/editar tenant. En edición incluye suscripción, activar/desactivar y eliminar. */
function TenantForm({
  tenant,
  onSaved,
  onCancel,
  onToggle,
  onDelete,
  onSubscriptionChanged,
}: {
  tenant: TenantDto | null
  onSaved: (t: TenantDto) => void
  onCancel: () => void
  onToggle: (t: TenantDto) => void
  onDelete: (t: TenantDto) => void
  onSubscriptionChanged: () => void
}) {
  const ids = useId()
  const [values, setValues] = useState<TenantFormValues>({
    name: tenant?.name ?? '',
    slug: tenant?.slug ?? '',
    description: tenant?.description ?? '',
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
            isActive: tenant.isActive,
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
    <Modal title={tenant ? 'Editar tenant' : 'Crear tenant'} onClose={onCancel} className={tenant ? 'modal-wide' : undefined}>
      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="field">
          <label htmlFor={`${ids}-name`}>Nombre *</label>
          <input
            id={`${ids}-name`}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-slug`}>Slug</label>
          <input
            id={`${ids}-slug`}
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            disabled={!!tenant}
            placeholder="mi-clinica"
            aria-describedby={tenant ? undefined : `${ids}-slug-hint`}
            autoCapitalize="none"
          />
          {!tenant && (
            <p className="field-hint" id={`${ids}-slug-hint`}>
              Opcional: se genera a partir del nombre si lo dejas vacío.
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${ids}-desc`}>Descripción</label>
          <textarea
            id={`${ids}-desc`}
            rows={3}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>

        {tenant && <TenantSubscriptionSection tenant={tenant} onChanged={onSubscriptionChanged} />}

        {tenant && (
          <div className="admin-danger-zone">
            <h3>Estado y eliminación</h3>
            <p>
              El tenant está <strong>{tenant.isActive ? 'activo' : 'inactivo'}</strong>.
            </p>
            <div className="admin-danger-actions">
              <button
                type="button"
                className={tenant.isActive ? 'btn btn-danger-soft' : 'btn btn--secondary'}
                onClick={() => onToggle(tenant)}
                disabled={saving}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {tenant.isActive ? 'block' : 'check_circle'}
                </span>
                {tenant.isActive ? 'Desactivar tenant' : 'Activar tenant'}
              </button>
              <button type="button" className="btn btn-danger-soft" onClick={() => onDelete(tenant)} disabled={saving}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  delete
                </span>
                Eliminar tenant
              </button>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving || undefined}>
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

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await adminApi.deleteTenant(deleting.id)
      toast.success('Tenant eliminado')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setDeleting(null)
    }
  }

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
    toast.success(isEdit ? `Tenant "${saved.name}" actualizado.` : `Tenant "${saved.name}" creado (slug: ${saved.slug}).`)
    load()
  }

  // Las acciones de estado/borrado se abren desde la hoja de edición: se cierra la hoja y se pide confirmación.
  const requestToggle = (t: TenantDto) => {
    setEditing(undefined)
    setToggling(t)
  }

  const requestDelete = (t: TenantDto) => {
    setEditing(undefined)
    setDeleting(t)
  }

  const confirmToggle = async () => {
    if (!toggling) return
    setToggleBusy(true)
    try {
      await adminApi.updateTenant(toggling.id, {
        name: toggling.name,
        description: toggling.description ?? undefined,
        isActive: !toggling.isActive,
      })
      toast.success(toggling.isActive ? `Tenant "${toggling.name}" desactivado.` : `Tenant "${toggling.name}" activado.`)
      setToggling(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
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
      <PageHeader
        title="Tenants"
        subtitle={loading ? 'Centros de la plataforma' : `${tenants.length} centro(s) en la plataforma`}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Crear tenant
          </button>
        }
      />

      <section className="card">
        <div className="admin-filters">
          <div className="admin-search">
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              placeholder="Buscar por nombre, slug o descripción"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar tenants"
            />
          </div>
        </div>

        {loading ? (
          <StateView state="loading" compact title="Cargando tenants..." />
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
        ) : filtered.length === 0 ? (
          <StateView
            state="empty"
            compact
            icon="domain"
            title={tenants.length === 0 ? 'Aún no hay tenants' : 'Ningún tenant coincide con la búsqueda'}
          />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Estado</th>
                  <th>Plan</th>
                  <th>Usuarios</th>
                  <th>Pacientes</th>
                  <th>Creado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="admin-cell-title">
                      <span className="admin-person">
                        <Avatar id={t.id} name={t.name} />
                        <span className="admin-person-text">
                          <strong>{t.name}</strong>
                          {t.description && <span className="admin-sub">{t.description}</span>}
                        </span>
                      </span>
                    </td>
                    <td data-label="Slug">{t.slug}</td>
                    <td data-label="Estado">
                      <span className={`badge ${t.isActive ? 'badge--success' : 'badge--neutral'}`}>
                        {t.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Plan">
                      <span className="admin-plan-cell">
                        <span className="admin-person-text">
                          <strong>{t.subscription?.planName ?? 'Sin plan'}</strong>
                          {t.subscription && (
                            <span className="admin-sub admin-nowrap">
                              {t.subscription.status === 'Expired' ? 'Venció' : 'Vence'}{' '}
                              {fmtShortDate(t.subscription.endsAt)}
                            </span>
                          )}
                        </span>
                        <SubscriptionBadge sub={t.subscription} />
                      </span>
                    </td>
                    <td data-label="Usuarios">{t.userCount}</td>
                    <td data-label="Pacientes">{t.patientCount ?? 0}</td>
                    <td data-label="Creado" className="admin-nowrap">
                      {fmtDate(t.createdAt)}
                    </td>
                    <td className="admin-cell-actions">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--icon"
                          onClick={() => openActivity(t)}
                          aria-label={`Ver actividad de ${t.name}`}
                          title="Ver actividad"
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            history
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--icon"
                          onClick={() => setEditing(t)}
                          aria-label={`Editar ${t.name}`}
                          title="Editar, suscripción, activar/desactivar o eliminar"
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            edit
                          </span>
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
        <TenantForm
          tenant={editing}
          onSaved={handleSaved}
          onCancel={() => setEditing(undefined)}
          onToggle={requestToggle}
          onDelete={requestDelete}
          onSubscriptionChanged={load}
        />
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
          footer={
            <button type="button" className="btn btn--ghost" onClick={() => setActivityFor(null)}>
              Cerrar
            </button>
          }
        >
          <p className="admin-hint">
            {activityFor.userCount} usuario(s) · {activityFor.patientCount ?? 0} paciente(s) · última actividad{' '}
            {fmtDate(activityFor.lastActivityAt, true)}
          </p>
          {activityLoading ? (
            <StateView state="loading" compact title="Cargando actividad..." />
          ) : activityError ? (
            <StateView state="error" compact message={activityError} />
          ) : activity.length === 0 ? (
            <StateView state="empty" compact icon="history" title="Sin actividad registrada" />
          ) : (
            <div className="table-scroll">
              <table className="table table--stack admin-table">
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
                      <td className="admin-cell-title">{fmtDate(a.timestamp, true)}</td>
                      <td data-label="Acción">{a.action}</td>
                      <td data-label="Entidad">{a.entity}</td>
                      <td data-label="Usuario">{a.userEmail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
