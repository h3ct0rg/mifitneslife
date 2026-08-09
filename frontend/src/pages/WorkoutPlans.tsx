import { useCallback, useEffect, useState } from 'react'
import { exercisesApi, workoutPlansApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateWorkoutPlanRequest, ExerciseDto, WorkoutPlanDto } from '../api/types'
import WorkoutPlanBuilder from '../components/WorkoutPlanBuilder'

export default function WorkoutPlans() {
  const [plans, setPlans] = useState<WorkoutPlanDto[]>([])
  const [exercises, setExercises] = useState<ExerciseDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; plan: WorkoutPlanDto } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [planData, exerciseData] = await Promise.all([
        workoutPlansApi.list(),
        exercisesApi.list({ page: 1, pageSize: 200 }),
      ])
      setPlans(planData)
      setExercises(exerciseData.items)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (payload: CreateWorkoutPlanRequest) => {
    try {
      await workoutPlansApi.create(payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Plan de entrenamiento creado correctamente.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleUpdate = async (id: string, payload: CreateWorkoutPlanRequest) => {
    try {
      await workoutPlansApi.update(id, { ...payload, status: 'Active' })
      setModal(null)
      setMessage({ type: 'ok', text: 'Plan de entrenamiento actualizado correctamente.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async (plan: WorkoutPlanDto) => {
    if (!window.confirm(`¿Eliminar el plan "${plan.name}"?`)) return
    try {
      await workoutPlansApi.remove(plan.id)
      setMessage({ type: 'ok', text: 'Plan de entrenamiento eliminado.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  return (
    <div className="page page-wide">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header catalog-toolbar">
        <div>
          <h2>Planes de entrenamiento</h2>
          <p className="catalog-subtitle">Agrupa ejercicios por día y asígnalos a tus pacientes.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'create' })}>
            + Nuevo plan
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Cargando...</p>
      ) : plans.length === 0 ? (
        <div className="empty-state">Aún no hay planes de entrenamiento. Crea el primero.</div>
      ) : (
        <div className="workout-plans-grid">
          {plans.map((plan) => (
            <article key={plan.id} className="diet-plan-card">
              <div className="diet-plan-head">
                <h3>{plan.name}</h3>
                <span className="badge">{plan.status}</span>
              </div>
              {plan.objective && <p className="diet-plan-objective">{plan.objective}</p>}
              {plan.patientName && <p className="diet-plan-patient">Paciente: {plan.patientName}</p>}
              <div className="workout-plan-stats">
                <div><span>Días</span><strong>{plan.days.length}</strong></div>
                <div><span>Ejercicios</span><strong>{plan.totalExercises}</strong></div>
              </div>
              <div className="workout-plan-days">
                {plan.days.map((d) => (
                  <div key={d.id} className="workout-plan-day">
                    <strong>{d.dayName}</strong>
                    <div className="workout-plan-day-ex">
                      {d.exercises.map((e) => (
                        <span key={e.id} className="diet-plan-meal-chip">
                          {e.exerciseName}{e.sets ? ` · ${e.sets}x${e.reps ?? ''}` : ''}
                        </span>
                      ))}
                      {d.exercises.length === 0 && <span className="meal-empty">Sin ejercicios</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="diet-plan-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'edit', plan })}>Editar</button>
                <button type="button" className="btn-danger-soft" onClick={() => handleDelete(plan)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <WorkoutPlanBuilder
          title={modal.mode === 'create' ? 'Nuevo plan de entrenamiento' : `Editar: ${modal.plan.name}`}
          initial={modal.mode === 'edit' ? modal.plan : undefined}
          exercises={exercises}
          onSubmit={modal.mode === 'create'
            ? handleCreate
            : (payload) => handleUpdate(modal.plan.id, payload)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}