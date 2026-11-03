import { useCallback, useEffect, useId, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { PlanDto, SavePlanRequest } from '../api/types'
import Modal from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'
import { fmtUsd } from '../utils/subscription'

interface PlanFormValues {
  name: string
  durationDays: string
  priceUsd: string
  sortOrder: string
  isActive: boolean
}

const MAX_DURATION_DAYS = 3650

function validate(v: PlanFormValues): string | null {
  if (!v.name.trim()) return 'El nombre es obligatorio.'
  const days = Number(v.durationDays)
  if (!Number.isInteger(days) || days < 1 || days > MAX_DURATION_DAYS)
    return `La duración debe ser un número entero de días entre 1 y ${MAX_DURATION_DAYS}.`
  if (!/^\d+([.,]\d{1,2})?$/.test(v.priceUsd.trim()))
    return 'El precio debe ser 0 o mayor, con 2 decimales como máximo.'
  const order = Number(v.sortOrder)
  if (!Number.isInteger(order) || order < 0) return 'El orden debe ser un número entero 0 o mayor.'
  return null
}

/** Hoja de crear/editar plan. El plan de prueba (trial) no se puede desactivar. */
function PlanForm({
  plan,
  nextSortOrder,
  onSaved,
  onCancel,
}: {
  plan: PlanDto | null
  nextSortOrder: number
  onSaved: (p: PlanDto) => void
  onCancel: () => void
}) {
  const ids = useId()
  const [values, setValues] = useState<PlanFormValues>({
    name: plan?.name ?? '',
    durationDays: plan ? String(plan.durationDays) : '30',
    priceUsd: plan ? String(plan.priceUsd) : '0',
    sortOrder: String(plan?.sortOrder ?? nextSortOrder),
    isActive: plan?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isTrial = !!plan?.isTrial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalid = validate(values)
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError(null)
    const payload: SavePlanRequest = {
      name: values.name.trim(),
      durationDays: Number(values.durationDays),
      priceUsd: Math.round(Number(values.priceUsd.trim().replace(',', '.')) * 100) / 100,
      sortOrder: Number(values.sortOrder),
      isActive: isTrial ? true : values.isActive,
    }
    try {
      onSaved(plan ? await adminApi.updatePlan(plan.id, payload) : await adminApi.createPlan(payload))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={plan ? 'Editar plan' : 'Crear plan'} onClose={onCancel}>
      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}
      {plan && plan.tenantsCount > 0 && (
        <p className="admin-note">
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
          <span>
            Los cambios de duración o precio aplican a las próximas asignaciones; las suscripciones ya creadas conservan
            su fecha de vencimiento y precio.
          </span>
        </p>
      )}
      <form onSubmit={handleSubmit} className="admin-form" noValidate>
        <div className="field">
          <label htmlFor={`${ids}-name`}>Nombre *</label>
          <input
            id={`${ids}-name`}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            maxLength={100}
            required
            autoFocus
          />
        </div>
        <div className="admin-form-grid admin-form-grid--2">
          <div className="field">
            <label htmlFor={`${ids}-days`}>Duración (días) *</label>
            <input
              id={`${ids}-days`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DURATION_DAYS}
              step={1}
              value={values.durationDays}
              onChange={(e) => setValues((v) => ({ ...v, durationDays: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-price`}>Precio (USD) *</label>
            <input
              id={`${ids}-price`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={values.priceUsd}
              onChange={(e) => setValues((v) => ({ ...v, priceUsd: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-order`}>Orden</label>
            <input
              id={`${ids}-order`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values.sortOrder}
              onChange={(e) => setValues((v) => ({ ...v, sortOrder: e.target.value }))}
              aria-describedby={`${ids}-order-hint`}
            />
            <p className="field-hint" id={`${ids}-order-hint`}>
              Posición en listas y selectores (menor primero).
            </p>
          </div>
          <div className="field">
            <span className="admin-check">
              <input
                id={`${ids}-active`}
                type="checkbox"
                checked={isTrial ? true : values.isActive}
                disabled={isTrial}
                onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
                aria-describedby={`${ids}-active-hint`}
              />
              <label htmlFor={`${ids}-active`}>Activo</label>
            </span>
            <p className="field-hint" id={`${ids}-active-hint`}>
              {isTrial
                ? 'El plan de prueba es del sistema: se asigna a cada centro nuevo y no se puede desactivar.'
                : 'Un plan inactivo no se puede asignar; los centros que ya lo tienen lo conservan.'}
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving || undefined}>
            {saving ? 'Guardando...' : plan ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<PlanDto | null | undefined>(undefined)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await adminApi.plans()
      setPlans([...data].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es')))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSaved = (saved: PlanDto) => {
    const isEdit = !!editing
    setEditing(undefined)
    toast.success(isEdit ? `Plan "${saved.name}" actualizado.` : `Plan "${saved.name}" creado.`)
    load()
  }

  const nextSortOrder = plans.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1

  return (
    <div className="page admin-page">
      <PageHeader
        title="Planes"
        subtitle="Planes de suscripción que se asignan a los centros (cobro manual)"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Crear plan
          </button>
        }
      />

      <section className="card">
        {loading ? (
          <StateView state="loading" compact title="Cargando planes..." />
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
        ) : plans.length === 0 ? (
          <StateView state="empty" compact icon="workspace_premium" title="Aún no hay planes" />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Duración</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Orden</th>
                  <th>Centros</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="admin-cell-title">
                      <span className="admin-person-text">
                        <strong>{p.name}</strong>
                        {p.isTrial && <span className="admin-sub">Prueba gratuita · plan del sistema</span>}
                      </span>
                    </td>
                    <td data-label="Duración" className="admin-nowrap">
                      {p.durationDays} días
                    </td>
                    <td data-label="Precio" className="admin-nowrap num">
                      {fmtUsd(p.priceUsd)}
                    </td>
                    <td data-label="Estado">
                      <span className={`badge ${p.isActive ? 'badge--success' : 'badge--neutral'}`}>
                        {p.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Orden">{p.sortOrder}</td>
                    <td data-label="Centros" title="Centros con este plan">
                      {p.tenantsCount}
                    </td>
                    <td className="admin-cell-actions">
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--icon"
                          onClick={() => setEditing(p)}
                          aria-label={`Editar ${p.name}`}
                          title="Editar plan"
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
        <PlanForm
          plan={editing}
          nextSortOrder={nextSortOrder}
          onSaved={handleSaved}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
