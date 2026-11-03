import { useMemo, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import type {
  CreateWorkoutPlanRequest,
  ExerciseDto,
  WorkoutDayRequest,
  WorkoutPlanDto,
} from '../api/types'
import { getErrorMessage } from '../api/client'
import ExerciseMedia from './ExerciseMedia'
import Modal, { ConfirmModal } from './Modal'
import PageHeader from './ui/PageHeader'

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
const OBJECTIVES = ['Fuerza', 'Hipertrofia', 'Resistencia', 'Pérdida de peso', 'Acondicionamiento', 'Personalizado']

let keyCounter = 0
const nextKey = () => `day-${++keyCounter}-${Date.now()}`

const mediaFallback = (
  <span className="material-symbols-outlined pl-media-empty" aria-hidden="true">fitness_center</span>
)

/**
 * Editor de plan de entrenamiento a pantalla completa (`.editor-page`): días + resumen
 * (desktop en 2 columnas, móvil en 1) y barra de acciones fija abajo.
 */
export default function WorkoutPlanBuilder({ title, initial, exercises, onSubmit, onCancel }: Props) {
  const { pathname } = useLocation()
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
  const [search, setSearch] = useState('')
  const [dayToRemove, setDayToRemove] = useState<DraftDay | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const filteredExercises = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return exercises.slice(0, 12)
    return exercises
      .filter((e) => e.name.toLowerCase().includes(s) || e.category.toLowerCase().includes(s) || e.equipment.toLowerCase().includes(s))
      .slice(0, 12)
  }, [exercises, search])

  const pickerDay = days.find((d) => d.key === pickerDayKey)
  const totalExercises = days.reduce((a, d) => a + d.exercises.length, 0)

  const updateDay = (key: string, patch: Partial<DraftDay>) =>
    setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const addDay = () => {
    const used = days.map((d) => d.dayName)
    const available = DAY_OPTIONS.find((o) => !used.includes(o)) ?? 'Día de entrenamiento'
    setDays((ds) => [...ds, { key: nextKey(), dayName: available, notes: '', exercises: [] }])
  }

  const removeDay = (key: string) => setDays((ds) => ds.filter((d) => d.key !== key))

  const requestRemoveDay = (day: DraftDay) => {
    if (day.exercises.length > 0) setDayToRemove(day)
    else removeDay(day.key)
  }

  const openPicker = (dayKey: string) => {
    setPickerDayKey(dayKey)
    setSearch('')
  }

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
    setSearch('')
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

  // El enlace "volver" de PageHeader cierra el editor (history.back) en vez de apilar otra entrada.
  const interceptBack = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if ((e.target as Element).closest('.page-header-back')) {
      e.preventDefault()
      onCancel()
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('Escribe el nombre del plan.')
      document.getElementById('wp-name')?.focus()
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
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="editor-page" onClickCapture={interceptBack}>
      <PageHeader
        title={title}
        subtitle="Agrupa ejercicios por día de entrenamiento"
        back={{ to: pathname, label: 'Planes de entrenamiento' }}
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="editor-page-body">
        <div className="editor-page-main pl-stack">
          <section className="card pl-section" aria-labelledby="wp-info">
            <h2 id="wp-info" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">assignment</span>
              </span>
              Información del plan
            </h2>
            <div className="pl-form-grid">
              <div className="field">
                <label htmlFor="wp-name">Nombre del plan *</label>
                <input
                  id="wp-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(null) }}
                  placeholder="Ej. Rutina fuerza 4 días"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? 'wp-name-error' : undefined}
                />
                {nameError && <p id="wp-name-error" className="field-error">{nameError}</p>}
              </div>
              <div className="field">
                <label htmlFor="wp-objective">Objetivo</label>
                <select id="wp-objective" value={objective} onChange={(e) => setObjective(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {OBJECTIVES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  {objective && !OBJECTIVES.includes(objective) && <option value={objective}>{objective}</option>}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="wp-observations">Observaciones</label>
              <textarea id="wp-observations" rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
            </div>
          </section>

          <section className="card pl-section" aria-labelledby="wp-days">
            <h2 id="wp-days" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">calendar_month</span>
              </span>
              Días de entrenamiento ({days.length})
            </h2>
            <datalist id="wp-day-options">
              {DAY_OPTIONS.map((o) => <option key={o} value={o} />)}
            </datalist>

            <ol className="db-meals-list">
              {days.map((day, dayIdx) => (
                <li key={day.key} className="db-meal-card active">
                  <div className="db-meal-head">
                    <div className="db-meal-inputs">
                      <label className="sr-only" htmlFor={`wp-day-${day.key}`}>Nombre del día {dayIdx + 1}</label>
                      <input
                        id={`wp-day-${day.key}`}
                        type="text"
                        list="wp-day-options"
                        value={day.dayName}
                        onChange={(e) => updateDay(day.key, { dayName: e.target.value })}
                        className="db-meal-name-input"
                      />
                    </div>
                    <div className="db-meal-head-meta">
                      <span className="badge badge--neutral">{day.exercises.length} ejercicios</span>
                      <button
                        type="button"
                        className="btn btn--icon pl-btn-danger-icon"
                        onClick={() => requestRemoveDay(day)}
                        aria-label={`Eliminar ${day.dayName || 'día'}`}
                        title="Eliminar día"
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="db-meal-body">
                    {day.exercises.length === 0 ? (
                      <p className="pl-muted">Sin ejercicios aún.</p>
                    ) : (
                      <ul className="wp-ex-list">
                        {day.exercises.map((ex, i) => {
                          const idBase = `wp-${day.key}-${i}`
                          return (
                            <li key={`${ex.exerciseId}-${i}`} className="wp-ex-row">
                              <span className="wp-ex-media">
                                <ExerciseMedia gifUrl={ex.exerciseGifUrl} alt="" fallback={mediaFallback} />
                              </span>
                              <div className="wp-ex-fields">
                                <div className="wp-ex-title">
                                  <strong>{ex.exerciseName}</strong>
                                  <button
                                    type="button"
                                    className="btn btn--icon"
                                    onClick={() => removeExerciseFromDay(day.key, i)}
                                    aria-label={`Quitar ${ex.exerciseName}`}
                                    title="Quitar ejercicio"
                                  >
                                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                                  </button>
                                </div>
                                <div className="wp-ex-inputs">
                                  <div className="field pl-field-tight">
                                    <label htmlFor={`${idBase}-sets`}>Series</label>
                                    <input
                                      id={`${idBase}-sets`}
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      value={ex.sets}
                                      onChange={(e) => updateExercise(day.key, i, { sets: e.target.value })}
                                    />
                                  </div>
                                  <div className="field pl-field-tight">
                                    <label htmlFor={`${idBase}-reps`}>Reps</label>
                                    <input
                                      id={`${idBase}-reps`}
                                      type="text"
                                      placeholder="Ej. 8-12"
                                      value={ex.reps}
                                      onChange={(e) => updateExercise(day.key, i, { reps: e.target.value })}
                                    />
                                  </div>
                                  <div className="field pl-field-tight">
                                    <label htmlFor={`${idBase}-rest`}>Descanso (s)</label>
                                    <input
                                      id={`${idBase}-rest`}
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={ex.rest}
                                      onChange={(e) => updateExercise(day.key, i, { rest: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <button type="button" className="btn btn--secondary" onClick={() => openPicker(day.key)}>
                      <span className="material-symbols-outlined" aria-hidden="true">add</span>
                      Agregar ejercicio
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            <button type="button" className="btn btn--ghost btn--block" onClick={addDay}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Agregar día
            </button>
          </section>

          {error && (
            <div className="error-box" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">error</span>
              {error}
            </div>
          )}
        </div>

        <aside className="editor-page-aside pl-summary" aria-label="Resumen del plan">
            <h2 className="pl-section-title">
              <span className="icon-chip" aria-hidden="true">
                <span className="material-symbols-outlined">monitoring</span>
              </span>
              Resumen
            </h2>
            <dl className="pl-macro-chips pl-macro-chips--2">
              <div className="pl-tone-info"><dt>Días</dt><dd>{days.length}</dd></div>
              <div className="pl-tone-success"><dt>Ejercicios</dt><dd>{totalExercises}</dd></div>
            </dl>
        </aside>
        </div>

        <div className="editor-page-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? (
              <><span className="mf-spinner" aria-hidden="true" /> Guardando...</>
            ) : (
              <><span className="material-symbols-outlined" aria-hidden="true">save</span> Guardar plan</>
            )}
          </button>
        </div>
      </form>

      {pickerDay && (
        <Modal title={`Agregar ejercicio a: ${pickerDay.dayName}`} onClose={() => setPickerDayKey(null)} className="pl-picker">
          <div className="pl-search">
            <span className="material-symbols-outlined pl-search-icon" aria-hidden="true">search</span>
            <label htmlFor="wp-picker-search" className="sr-only">Buscar ejercicio</label>
            <input
              id="wp-picker-search"
              autoFocus
              type="search"
              placeholder="Buscar por nombre, categoría o equipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="db-picker-search-input"
            />
          </div>
          {filteredExercises.length === 0 ? (
            <p className="pl-muted pl-center">Sin resultados.</p>
          ) : (
            <ul className="pl-pick-list">
              {filteredExercises.map((ex) => (
                <li key={ex.id}>
                  <button type="button" className="pl-pick-item" onClick={() => addExerciseToDay(pickerDay.key, ex)}>
                    <span className="wp-ex-media wp-ex-media--sm">
                      <ExerciseMedia gifUrl={ex.gifUrl} imageUrl={ex.imageUrl} alt="" fallback={mediaFallback} />
                    </span>
                    <span className="pl-pick-main">
                      <strong>{ex.name}</strong>
                      <span>{ex.category} · {ex.equipment}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {dayToRemove && (
        <ConfirmModal
          title="Eliminar día"
          message={`"${dayToRemove.dayName}" tiene ${dayToRemove.exercises.length} ejercicio(s). ¿Eliminarlo del plan?`}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { removeDay(dayToRemove.key); setDayToRemove(null) }}
          onCancel={() => setDayToRemove(null)}
        />
      )}
    </div>
  )
}
