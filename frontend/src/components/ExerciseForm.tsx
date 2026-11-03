import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { getErrorMessage } from '../api/client'
import type { CreateExerciseRequest, ExerciseDto } from '../api/types'
import Modal from './Modal'

interface Props {
  title: string
  initial?: ExerciseDto
  categories: string[]
  equipment: string[]
  onSubmit: (payload: CreateExerciseRequest) => Promise<void>
  onCancel: () => void
}

type RequiredField = 'name' | 'category' | 'equipment'

const REQUIRED_MSG: Record<RequiredField, string> = {
  name: 'Escribe el nombre del ejercicio.',
  category: 'Indica la categoría.',
  equipment: 'Indica el equipamiento.',
}

/** Formulario corto de ejercicio en hoja/modal (Modal.tsx: hoja inferior en móvil, acciones fijas). */
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequiredField, string>>>({})

  const set = (field: keyof CreateExerciseRequest) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      if (field in REQUIRED_MSG) setFieldErrors((fe) => ({ ...fe, [field]: undefined }))
    }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errors: Partial<Record<RequiredField, string>> = {}
    for (const f of Object.keys(REQUIRED_MSG) as RequiredField[]) {
      if (!String(values[f] ?? '').trim()) errors[f] = REQUIRED_MSG[f]
    }
    setFieldErrors(errors)
    const firstInvalid = (Object.keys(REQUIRED_MSG) as RequiredField[]).find((f) => errors[f])
    if (firstInvalid) {
      document.getElementById(`ef-${firstInvalid}`)?.focus()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo guardar el ejercicio.')
      setSubmitting(false)
    }
  }

  const errProps = (f: RequiredField) => ({
    'aria-invalid': fieldErrors[f] ? true : undefined,
    'aria-describedby': fieldErrors[f] ? `ef-${f}-error` : undefined,
  })
  const errMsg = (f: RequiredField) =>
    fieldErrors[f] ? <p id={`ef-${f}-error`} className="field-error">{fieldErrors[f]}</p> : null

  return (
    <Modal
      title={title}
      onClose={() => { if (!submitting) onCancel() }}
      className="modal-wide"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" form="ef-form" className="btn btn--primary" disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="ef-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="ef-name">Nombre *</label>
          <input id="ef-name" type="text" value={values.name} onChange={set('name')} placeholder="Ej. Press de banca" {...errProps('name')} />
          {errMsg('name')}
        </div>
        <div className="pl-form-grid">
          <div className="field">
            <label htmlFor="ef-category">Categoría *</label>
            <input id="ef-category" list="exercise-categories" value={values.category} onChange={set('category')} placeholder="Ej. Pecho" {...errProps('category')} />
            <datalist id="exercise-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            {errMsg('category')}
          </div>
          <div className="field">
            <label htmlFor="ef-equipment">Equipamiento *</label>
            <input id="ef-equipment" list="exercise-equipment" value={values.equipment} onChange={set('equipment')} placeholder="Ej. Mancuerna" {...errProps('equipment')} />
            <datalist id="exercise-equipment">
              {equipment.map((e) => <option key={e} value={e} />)}
            </datalist>
            {errMsg('equipment')}
          </div>
          <div className="field">
            <label htmlFor="ef-target">Músculo objetivo</label>
            <input id="ef-target" type="text" value={values.target ?? ''} onChange={set('target')} />
          </div>
          <div className="field">
            <label htmlFor="ef-group">Grupo muscular</label>
            <input id="ef-group" type="text" value={values.muscleGroup ?? ''} onChange={set('muscleGroup')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ef-secondary">Músculos secundarios</label>
          <input id="ef-secondary" type="text" value={values.secondaryMuscles ?? ''} onChange={set('secondaryMuscles')} placeholder="Separados por coma" />
        </div>
        <div className="field">
          <label htmlFor="ef-gif">GIF (URL)</label>
          <input id="ef-gif" type="url" inputMode="url" value={values.gifUrl ?? ''} onChange={set('gifUrl')} placeholder="https://..." />
        </div>
        <div className="field">
          <label htmlFor="ef-image">Imagen (URL)</label>
          <input id="ef-image" type="url" inputMode="url" value={values.imageUrl ?? ''} onChange={set('imageUrl')} placeholder="https://..." />
        </div>
        <div className="field">
          <label htmlFor="ef-instructions">Instrucciones</label>
          <textarea id="ef-instructions" rows={4} value={values.instructions ?? ''} onChange={set('instructions')} />
        </div>

        {error && (
          <div className="error-box" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
