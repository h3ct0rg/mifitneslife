import { useMemo, useState } from 'react'
import type {
  CreateWorkoutPlanRequest,
  ExerciseDto,
  WorkoutDayRequest,
  WorkoutPlanDto,
} from '../api/types'
import { getErrorMessage } from '../api/client'
import ExerciseMedia from './ExerciseMedia'

interface Props {
  title: string
  initial?: WorkoutPlanDto
  exercises: ExerciseDto[]
  onSubmit: (payload: CreateWorkoutPlanRequest) => Promise<void>
  onCancel: () => void
}

interface DraftDay {
  key: string
  dayName: string
  notes: string
  exercises: DraftExercise[]
}

interface DraftExercise {
  exerciseId: string
  exerciseName: string
  exerciseGifUrl?: string
  sets: string
  reps: string
  rest: string
  notes: string
}

const DAY_OPTIONS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

let keyCounter = 0
const nextKey = () => `day-${++keyCounter}-${Date.now()}`

export default function WorkoutPlanBuilder({ title, initial, exercises, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [observations, setObservations] = useState(initial?.observations ?? '')
  const [days, setDays] = useState<DraftDay[]>(() =>
    initial && initial.days.length > 0
      ? initial.days.map((d) => ({
          key: nextKey(),
          dayName: d.dayName,
          notes: d.notes ?? '',
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            exerciseGifUrl: e.exerciseGifUrl,
            sets: e.sets ? String(e.sets) : '',
            reps: e.reps ?? '',
            rest: e.restSeconds ? String(e.restSeconds) : '',
            notes: e.notes ?? '',
          })),
        }))
      : [{ key: nextKey(), dayName: 'Lunes', notes: '', exercises: [] }],
  )
  const [pickerDayKey, setPickerDayKey] = useState<string | null>(null)
  const [foodSearch, setFoodSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredExercises = useMemo(() => {
    const s = foodSearch.trim().toLowerCase()
    if (!s) return exercises.slice(0, 12)
    return exercises
      .filter((e) => e.name.toLowerCase().includes(s) || e.category.toLowerCase().includes(s) || e.equipment.toLowerCase().includes(s))
      .slice(0, 12)
  }, [exercises, foodSearch])

  const updateDay = (key: string, patch: Partial<DraftDay>) =>
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const addDay = () => {
    const used = days.map((d) => d.dayName)
    const available = DAY_OPTIONS.find((o) => !used.includes(o)) ?? 'Día de entrenamiento'
    const key = nextKey()
    setDays((ds) => [...ds, { key, dayName: available, notes: '', exercises: [] }])
    setPickerDayKey(key)
  }

  const removeDay = (key: string) => setDays((ds) => ds.filter((d) => d.key !== key))

  const addExerciseToDay = (dayKey: string, exercise: ExerciseDto) => {
    setDays((ds) =>
      ds.map((d) =>
        d.key === dayKey
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                {
                  exerciseId: exercise.id,
                  exerciseName: exercise.name,
                  exerciseGifUrl: exercise.gifUrl,
                  sets: '',
                  reps: '',
                  rest: '',
                  notes: '',
                },
              ],
            }
          : d,
      ),
    )
    setPickerDayKey(null)
    setFoodSearch('')
  }

  const removeExerciseFromDay = (dayKey: string, index: number) =>
    setDays((ds) =>
      ds.map((d) => (d.key === dayKey ? { ...d, exercises: d.exercises.filter((_, i) => i !== index) } : d)),
    )

  const updateExercise = (dayKey: string, index: number, patch: Partial<DraftExercise>) =>
    setDays((ds) =>
      ds.map((d) =>
        d.key === dayKey
          ? { ...d, exercises: d.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)) }
          : d,
      ),
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre del plan es obligatorio.')
      return
    }
    const payload: CreateWorkoutPlanRequest = {
      name: name.trim(),
      objective: objective.trim() || undefined,
      observations: observations.trim() || undefined,
      days: days
        .filter((d) => d.dayName.trim())
        .map((d): WorkoutDayRequest => ({
          dayName: d.dayName.trim(),
          notes: d.notes.trim() || undefined,
          exercises: d.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets === '' ? undefined : Number(ex.sets),
            reps: ex.reps.trim() || undefined,
            restSeconds: ex.rest === '' ? undefined : Number(ex.rest),
            notes: ex.notes.trim() || undefined,
          })),
        })),
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-diet">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-grid-item">
              Nombre del plan *
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Rutina fuerza 4 días" required />
            </label>
            <label className="form-grid-item">
              Objetivo
              <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                <option value="">Seleccionar...</option>
                {['Fuerza', 'Hipertrofia', 'Resistencia', 'Pérdida de peso', 'Acondicionamiento', 'Personalizado'].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="diet-builder">
            <div className="diet-meals-col">
              <h3 className="fieldset-title">Días de entrenamiento</h3>
              <div className="diet-meal-list">
                {days.map((day) => (
                  <div key={day.key} className="diet-meal-card">
                    <div className="diet-meal-head">
                      <input
                        type="text"
                        list="day-options"
                        value={day.dayName}
                        onChange={(e) => updateDay(day.key, { dayName: e.target.value })}
                        className="diet-meal-name"
                      />
                      <datalist id="day-options">
                        {DAY_OPTIONS.map((o) => <option key={o} value={o} />)}
                      </datalist>
                      <div className="diet-meal-actions">
                        <button type="button" className="btn-danger-soft btn-sm" onClick={() => removeDay(day.key)}>×</button>
                      </div>
                    </div>

                    <div className="diet-meal-body">
                      <div className="meal-items">
                        {day.exercises.map((ex, i) => (
                          <div key={i} className="meal-item-row workout-ex-row">
                            <div className="workout-ex-media">
                              <ExerciseMedia gifUrl={ex.exerciseGifUrl} alt={ex.exerciseName} />
                              {!ex.exerciseGifUrl && <span>🎯</span>}
                            </div>
                            <div className="workout-ex-fields">
                              <strong className="workout-ex-name">{ex.exerciseName}</strong>
                              <div className="workout-ex-inputs">
                                <input type="number" min="1" placeholder="Series" value={ex.sets} onChange={(e) => updateExercise(day.key, i, { sets: e.target.value })} />
                                <input type="text" placeholder="Reps" value={ex.reps} onChange={(e) => updateExercise(day.key, i, { reps: e.target.value })} />
                                <input type="number" min="0" placeholder="Desc(seg)" value={ex.rest} onChange={(e) => updateExercise(day.key, i, { rest: e.target.value })} />
                              </div>
                            </div>
                            <button type="button" className="btn-ghost btn-sm" onClick={() => removeExerciseFromDay(day.key, i)}>×</button>
                          </div>
                        ))}
                        {day.exercises.length === 0 && <p className="meal-empty">Sin ejercicios aún.</p>}
                      </div>
                      <button type="button" className="btn-primary btn-sm" onClick={() => { setPickerDayKey(day.key); setFoodSearch('') }}>
                        + Agregar ejercicio
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost btn-block" onClick={addDay}>+ Agregar día</button>
            </div>

            <aside className="diet-summary">
              <h3 className="fieldset-title">Resumen</h3>
              <div className="diet-totals">
                <div className="diet-total-main">
                  <span>Días</span>
                  <strong>{days.length}</strong>
                </div>
                <div className="diet-total-grid">
                  <div><span>Ejercicios</span><strong>{days.reduce((a, d) => a + d.exercises.length, 0)}</strong></div>
                </div>
              </div>
              <label className="form-grid-item" style={{ marginTop: '1rem' }}>
                Observaciones
                <textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} />
              </label>
            </aside>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar plan'}
            </button>
          </div>
        </form>

        {pickerDayKey && (
          <div className="food-search-drawer">
            <div className="food-search-head">
              <strong>Agregar ejercicio</strong>
              <button type="button" className="btn-ghost" onClick={() => setPickerDayKey(null)}>Cerrar</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Buscar ejercicio..."
              value={foodSearch}
              onChange={(e) => setFoodSearch(e.target.value)}
            />
            <div className="food-search-results">
              {filteredExercises.map((ex) => (
                <button key={ex.id} type="button" className="food-search-result" onClick={() => addExerciseToDay(pickerDayKey, ex)}>
                  <div className="workout-search-item">
                    <div className="workout-ex-media">
                      <ExerciseMedia gifUrl={ex.gifUrl} imageUrl={ex.imageUrl} alt={ex.name} />
                      {!ex.gifUrl && !ex.imageUrl && <span>🎯</span>}
                    </div>
                    <div>
                      <strong>{ex.name}</strong>
                      <span className="food-search-cat">{ex.category} · {ex.equipment}</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredExercises.length === 0 && <p className="meal-empty">Sin resultados.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}