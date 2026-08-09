import { useState } from 'react'
import type { CreateExerciseRequest, ExerciseDto } from '../api/types'

interface Props {
  title: string
  initial?: ExerciseDto
  categories: string[]
  equipment: string[]
  onSubmit: (payload: CreateExerciseRequest) => Promise<void>
  onCancel: () => void
}

export default function ExerciseForm({ title, initial, categories, equipment, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<CreateExerciseRequest>(() => ({
    name: initial?.name ?? '',
    category: initial?.category ?? '',
    bodyPart: initial?.bodyPart ?? '',
    equipment: initial?.equipment ?? '',
    target: initial?.target ?? '',
    muscleGroup: initial?.muscleGroup ?? '',
    secondaryMuscles: initial?.secondaryMuscles ?? '',
    instructions: initial?.instructions ?? '',
    imageUrl: initial?.imageUrl ?? '',
    gifUrl: initial?.gifUrl ?? '',
    mediaId: initial?.mediaId ?? '',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof CreateExerciseRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.name.trim() || !values.category.trim() || !values.equipment.trim()) {
      setError('Nombre, categoría y equipo son obligatorios.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ejercicio.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-grid-item form-full">
              Nombre *
              <input type="text" value={values.name} onChange={set('name')} placeholder="Ej. Press de banca" required />
            </label>
            <label className="form-grid-item">
              Categoría *
              <input list="exercise-categories" value={values.category} onChange={set('category')} placeholder="Ej. Pecho" required />
              <datalist id="exercise-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label className="form-grid-item">
              Equipamiento *
              <input list="exercise-equipment" value={values.equipment} onChange={set('equipment')} placeholder="Ej. Mancuerna" required />
              <datalist id="exercise-equipment">
                {equipment.map((e) => <option key={e} value={e} />)}
              </datalist>
            </label>
            <label className="form-grid-item">
              Músculo objetivo
              <input type="text" value={values.target ?? ''} onChange={set('target')} />
            </label>
            <label className="form-grid-item">
              Grupo muscular
              <input type="text" value={values.muscleGroup ?? ''} onChange={set('muscleGroup')} />
            </label>
            <label className="form-grid-item form-full">
              Músculos secundarios
              <input type="text" value={values.secondaryMuscles ?? ''} onChange={set('secondaryMuscles')} placeholder="Separados por coma" />
            </label>
            <label className="form-grid-item form-full">
              GIF (URL)
              <input type="url" value={values.gifUrl ?? ''} onChange={set('gifUrl')} placeholder="https://..." />
            </label>
            <label className="form-grid-item form-full">
              Imagen (URL)
              <input type="url" value={values.imageUrl ?? ''} onChange={set('imageUrl')} placeholder="https://..." />
            </label>
            <label className="form-grid-item form-full">
              Instrucciones
              <textarea rows={4} value={values.instructions ?? ''} onChange={set('instructions')} />
            </label>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}