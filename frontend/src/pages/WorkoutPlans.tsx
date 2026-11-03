import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { exercisesApi, workoutPlansApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateWorkoutPlanRequest, ExerciseDto, WorkoutPlanDto } from '../api/types'
import { ConfirmModal } from '../components/Modal'
import WorkoutPlanBuilder from '../components/WorkoutPlanBuilder'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

/** Parámetro de URL del editor: `?editar=nuevo` o `?editar=<id>` (el "atrás" del navegador lo cierra). */
const EDIT_PARAM = 'editar'
const NEW = 'nuevo'

export default function WorkoutPlans() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [plans, setPlans] = useState<WorkoutPlanDto[]>([])
  const [exercises, setExercises] = useState<ExerciseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<WorkoutPlanDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [fetchedPlan, setFetchedPlan] = useState<WorkoutPlanDto | null>(null)

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
      const [planData, exerciseData] = await Promise.all([
        workoutPlansApi.list(),
        exercisesApi.list({ page: 1, pageSize: 200 }),
      ])
      setPlans(planData)
      setExercises(exerciseData.items)
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
  const localPlan = editId ? plans.find((p) => p.id === editId) ?? null : null
  useEffect(() => {
    if (!editId || loading || localPlan || fetchedPlan?.id === editId) return
    let cancelled = false
    workoutPlansApi
      .getById(editId)
      .then((p) => { if (!cancelled) setFetchedPlan(p) })
      .catch((err) => {
        if (cancelled) return
        toast.error(getErrorMessage(err))
        closeEditor()
      })
    return () => { cancelled = true }
  }, [editId, loading, localPlan, fetchedPlan, toast, closeEditor])

  const handleSubmit = async (payload: CreateWorkoutPlanRequest, editing?: WorkoutPlanDto) => {
    if (editing) {
      await workoutPlansApi.update(editing.id, { ...payload, status: 'Active' })
    } else {
      await workoutPlansApi.create(payload)
    }
    closeEditor()
    toast.success(editing ? 'Plan de entrenamiento actualizado.' : 'Plan de entrenamiento creado.')
    await load()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await workoutPlansApi.remove(toDelete.id)
      setToDelete(null)
      toast.success('Plan de entrenamiento eliminado.')
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  // ── Editor a pantalla completa (sincronizado con la URL) ─────────────
  if (editParam) {
    const editing = editId ? localPlan ?? (fetchedPlan?.id === editId ? fetchedPlan : null) : undefined
    if (loading || editing === null) return <StateView state="loading" title="Cargando plan..." />
    return (
      <WorkoutPlanBuilder
        key={editParam}
        title={editing ? `Editar: ${editing.name}` : 'Nuevo plan de entrenamiento'}
        initial={editing}
        exercises={exercises}
        onSubmit={(payload) => handleSubmit(payload, editing)}
        onCancel={closeEditor}
      />
    )
  }

  return (
    <div className="pl-page">
      <PageHeader
        title="Planes de entrenamiento"
        subtitle="Agrupa ejercicios por día y asígnalos a tus pacientes"
        actions={
          <button type="button" className="btn btn--primary pl-hide-mobile" onClick={() => openEditor(NEW)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Nuevo plan
          </button>
        }
      />

      {loading ? (
        <StateView state="loading" title="Cargando planes..." />
      ) : loadError ? (
        <StateView
          state="error"
          message={loadError}
          action={<button type="button" className="btn btn--ghost" onClick={load}>Reintentar</button>}
        />
      ) : plans.length === 0 ? (
        <StateView
          state="empty"
          icon="exercise"
          title="Aún no hay planes de entrenamiento"
          message="Crea el primero agrupando ejercicios por día."
          action={
            <button type="button" className="btn btn--secondary" onClick={() => openEditor(NEW)}>
              Crear plan
            </button>
          }
        />
      ) : (
        <ul className="pl-card-grid">
          {plans.map((plan) => (
            <li key={plan.id} className="card card--link pl-plan-card">
              <div className="pl-plan-head">
                <span className="icon-chip icon-chip--soft" aria-hidden="true">
                  <span className="material-symbols-outlined">fitness_center</span>
                </span>
                <h2 className="pl-plan-title">
                  <button type="button" className="pl-stretched" onClick={() => openEditor(plan.id)}>
                    {plan.name}
                  </button>
                </h2>
                <span className={`badge ${plan.status === 'Active' ? 'badge--success' : 'badge--neutral'}`}>
                  {plan.status === 'Active' ? 'Activo' : plan.status}
                </span>
              </div>

              {(plan.objective || plan.patientName) && (
                <div className="pl-plan-meta">
                  {plan.objective && (
                    <span className="pl-meta-item">
                      <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                      {plan.objective}
                    </span>
                  )}
                  {plan.patientName && (
                    <span className="pl-meta-item">
                      <span className="material-symbols-outlined" aria-hidden="true">person</span>
                      {plan.patientName}
                    </span>
                  )}
                </div>
              )}

              <dl className="pl-macro-chips pl-macro-chips--2">
                <div className="pl-tone-info"><dt>Días</dt><dd>{plan.days.length}</dd></div>
                <div className="pl-tone-success"><dt>Ejercicios</dt><dd>{plan.totalExercises}</dd></div>
              </dl>

              {plan.days.length > 0 && (
                <ul className="wp-day-list">
                  {plan.days.map((d) => (
                    <li key={d.id} className="wp-day">
                      <strong>{d.dayName}</strong>
                      {d.exercises.length === 0 ? (
                        <span className="pl-muted">Sin ejercicios</span>
                      ) : (
                        <ul className="pl-tag-list">
                          {d.exercises.map((e) => (
                            <li key={e.id} className="pl-tag">
                              {e.exerciseName}{e.sets ? ` · ${e.sets}x${e.reps ?? ''}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="pl-card-actions">
                <button type="button" className="btn btn--secondary" onClick={() => openEditor(plan.id)}>
                  <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn--icon pl-btn-danger-icon"
                  onClick={() => setToDelete(plan)}
                  aria-label={`Eliminar ${plan.name}`}
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
          title="Eliminar plan de entrenamiento"
          message={`¿Eliminar el plan "${toDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <button type="button" className="pl-fab" onClick={() => openEditor(NEW)} aria-label="Nuevo plan de entrenamiento">
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  )
}
