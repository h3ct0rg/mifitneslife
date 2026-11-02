import { useCallback, useEffect, useState } from 'react'
import { workoutPlansApi } from '../api'
import type { WorkoutPlanDto } from '../api/types'
import ExerciseMedia from './ExerciseMedia'

interface Props {
  patientId: string
  version: number
}

export default function WorkoutDashboard({ patientId, version }: Props) {
  const [plan, setPlan] = useState<WorkoutPlanDto | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await workoutPlansApi.getByPatient(patientId)
      setPlan(res.assigned ? res.plan : null)
    } catch {
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, version])

  if (loading) return <p className="loading">Cargando rutina...</p>
  if (!plan) return null

  const totalExercises = plan.days.reduce((a, d) => a + d.exercises.length, 0)

  return (
    <div className="card workout-dashboard">
      <div className="diet-dashboard-head">
        <div>
          <h2>Rutina asignada: {plan.name}</h2>
          {plan.objective && <p className="diet-dashboard-objective">{plan.objective}</p>}
        </div>
        <div className="workout-dash-stats">
          <div><span>Días</span><strong>{plan.days.length}</strong></div>
          <div><span>Ejercicios</span><strong>{totalExercises}</strong></div>
        </div>
      </div>

      <div className="workout-dash-days">
        {plan.days.map((day) => (
          <div key={day.id} className="workout-dash-day">
            <div className="workout-dash-day-head">
              <h3>{day.dayName}</h3>
              {day.notes && <span className="workout-dash-day-notes">{day.notes}</span>}
            </div>
            <div className="workout-dash-exercises">
              {day.exercises.map((ex) => (
                <div key={ex.id} className="workout-dash-exercise">
                  <div className="workout-dash-ex-media">
                    <ExerciseMedia gifUrl={ex.exerciseGifUrl} alt={ex.exerciseName} />
                    {!ex.exerciseGifUrl && <span>🎯</span>}
                  </div>
                  <div className="workout-dash-ex-info">
                    <strong>{ex.exerciseName}</strong>
                    <span className="workout-dash-ex-meta">
                      {ex.exerciseCategory}
                      {ex.exerciseEquipment ? ` · ${ex.exerciseEquipment}` : ''}
                    </span>
                  </div>
                  <div className="workout-dash-ex-params">
                    {ex.sets && <span className="workout-dash-chip"><b>{ex.sets}</b> series</span>}
                    {ex.reps && <span className="workout-dash-chip"><b>{ex.reps}</b> reps</span>}
                    {ex.restSeconds ? <span className="workout-dash-chip"><b>{ex.restSeconds}s</b> desc</span> : null}
                  </div>
                </div>
              ))}
              {day.exercises.length === 0 && (
                <p className="meal-empty">Sin ejercicios en este día.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}