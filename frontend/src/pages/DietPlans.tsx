import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { dietsApi, foodsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateDietRequest, DietDto, FoodDto } from '../api/types'
import DietBuilder from '../components/DietBuilder'
import { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

/** Parámetro de URL del editor: `?editar=nuevo` o `?editar=<id>` (el "atrás" del navegador lo cierra). */
const EDIT_PARAM = 'editar'
const NEW = 'nuevo'

export default function DietPlans() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [diets, setDiets] = useState<DietDto[]>([])
  const [foods, setFoods] = useState<FoodDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<DietDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [fetchedDiet, setFetchedDiet] = useState<DietDto | null>(null)

  const editParam = searchParams.get(EDIT_PARAM)
  const editId = editParam && editParam !== NEW ? editParam : null

  const openEditor = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, value)
        return next
      },
      { state: { fromList: true } },
    )

  const closeEditor = useCallback(() => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1)
      return
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(EDIT_PARAM)
        return next
      },
      { replace: true },
    )
  }, [location.state, navigate, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [dietData, foodData] = await Promise.all([
        dietsApi.list(),
        foodsApi.list({ page: 1, pageSize: 200 }),
      ])
      setDiets(dietData)
      setFoods(foodData.items)
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Editor abierto por URL con un id que no está en la lista : se consulta.
  const localDiet = editId ? diets.find((d) => d.id === editId) ?? null : null
  useEffect(() => {
    if (!editId || loading || localDiet || fetchedDiet?.id === editId) return
    let cancelled = false
    dietsApi
      .getById(editId)
      .then((d) => { if (!cancelled) setFetchedDiet(d) })
      .catch((err) => {
        if (cancelled) return
        toast.error(getErrorMessage(err))
        closeEditor()
      })
    return () => { cancelled = true }
  }, [editId, loading, localDiet, fetchedDiet, toast, closeEditor])

  const handleSubmit = async (payload: CreateDietRequest, editing?: DietDto) => {
    if (editing) {
      await dietsApi.update(editing.id, { ...payload, status: 'Active' })
    } else {
      await dietsApi.create(payload)
    }
    closeEditor()
    toast.success(editing ? 'Plan de dieta actualizado.' : 'Plan de dieta creado.')
    await load()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await dietsApi.remove(toDelete.id)
      setToDelete(null)
      toast.success('Plan de dieta eliminado.')
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  // ── Editor a pantalla completa (sincronizado con la URL) ─────────────
  if (editParam) {
    const editing = editId ? localDiet ?? (fetchedDiet?.id === editId ? fetchedDiet : null) : undefined
    if (loading || editing === null) return <StateView state="loading" title="Cargando plan..." />
    return (
      <DietBuilder
        key={editParam}
        title={editing ? `Editar: ${editing.name}` : 'Nuevo plan de dieta'}
        initial={editing}
        foods={foods}
        onSubmit={(payload) => handleSubmit(payload, editing)}
        onCancel={closeEditor}
      />
    )
  }

  return (
    <div className="pl-page">
      <PageHeader
        title="Planes de dieta"
        subtitle={diets.length > 0 ? `${diets.length} planes creados` : 'Crea y gestiona planes dietéticos'}
        actions={
          <button type="button" className="btn btn--primary pl-hide-mobile" onClick={() => openEditor(NEW)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Nuevo plan de dieta
          </button>
        }
      />

      {loading ? (
        <StateView state="loading" title="Cargando planes de dieta..." />
      ) : loadError ? (
        <StateView
          state="error"
          message={loadError}
          action={<button type="button" className="btn btn--ghost" onClick={load}>Reintentar</button>}
        />
      ) : diets.length === 0 ? (
        <StateView
          state="empty"
          icon="restaurant_menu"
          title="Aún no hay planes de dieta"
          message="Crea un plan con sus tiempos de comida y objetivos para asignarlo a tus pacientes."
          action={
            <button type="button" className="btn btn--secondary" onClick={() => openEditor(NEW)}>
              Crear plan de dieta
            </button>
          }
        />
      ) : (
        <ul className="pl-card-grid">
          {diets.map((d) => (
            <li key={d.id} className="card card--link pl-plan-card">
              <div className="pl-plan-head">
                <span className="icon-chip icon-chip--soft" aria-hidden="true">
                  <span className="material-symbols-outlined">restaurant_menu</span>
                </span>
                <h2 className="pl-plan-title">
                  <button type="button" className="pl-stretched" onClick={() => openEditor(d.id)}>
                    {d.name}
                  </button>
                </h2>
                <span className={`badge ${d.status === 'Active' ? 'badge--success' : 'badge--neutral'}`}>
                  {d.status === 'Active' ? 'Activo' : d.status}
                </span>
              </div>

              {(d.objective || d.patientName) && (
                <div className="pl-plan-meta">
                  {d.objective && (
                    <span className="pl-meta-item">
                      <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                      {d.objective}
                    </span>
                  )}
                  {d.patientName && (
                    <span className="pl-meta-item">
                      <span className="material-symbols-outlined" aria-hidden="true">person</span>
                      {d.patientName}
                    </span>
                  )}
                </div>
              )}

              <dl className="pl-macro-chips">
                <div className="pl-tone-kcal"><dt>Calorías</dt><dd>{d.calories ?? 0} kcal</dd></div>
                <div className="pl-tone-protein"><dt>Proteína</dt><dd>{d.protein ?? 0} g</dd></div>
                <div className="pl-tone-carbs"><dt>Carbos</dt><dd>{d.carbohydrates ?? 0} g</dd></div>
                <div className="pl-tone-fat"><dt>Grasa</dt><dd>{d.fat ?? 0} g</dd></div>
              </dl>

              {d.meals && d.meals.length > 0 && (
                <div>
                  <p className="pl-subtitle">Tiempos de comida ({d.meals.length})</p>
                  <ul className="pl-tag-list">
                    {d.meals.map((m) => (
                      <li key={m.id} className="pl-tag">
                        {m.scheduledTime && <span className="pl-tag-time">{m.scheduledTime}</span>}
                        {m.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pl-card-actions">
                <button type="button" className="btn btn--secondary" onClick={() => openEditor(d.id)}>
                  <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--icon pl-btn-danger-icon"
                  onClick={() => setToDelete(d)}
                  aria-label={`Eliminar ${d.name}`}
                  title="Eliminar"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar plan de dieta"
          message={`¿Eliminar el plan "${toDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <button type="button" className="pl-fab" onClick={() => openEditor(NEW)} aria-label="Nuevo plan de dieta">
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  )
}
