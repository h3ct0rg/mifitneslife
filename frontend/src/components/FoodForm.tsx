import { useState } from 'react'
import type { CreateFoodRequest, FoodDto } from '../api/types'

interface Props {
  title: string
  initial?: FoodDto
  onSubmit: (payload: CreateFoodRequest) => Promise<void>
  onCancel: () => void
}

const UNITS = ['g', 'ml', 'kg', 'L', 'unidad', 'taza', 'cucharada', 'cucharadita', 'porción']

const EMPTY: CreateFoodRequest = {
  name: '',
  category: '',
  subcategory: '',
  description: '',
  unit: 'g',
  defaultQuantity: 100,
  brand: '',
  code: '',
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  potassium: 0,
  calcium: 0,
  iron: 0,
  cholesterol: 0,
}

function num(v?: number) {
  return v == null ? '' : String(v)
}

export default function FoodForm({ title, initial, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<CreateFoodRequest>(() => {
    if (!initial) return EMPTY
    return {
      name: initial.name,
      category: initial.category,
      subcategory: initial.subcategory ?? '',
      description: initial.description ?? '',
      unit: initial.unit,
      defaultQuantity: initial.defaultQuantity,
      brand: initial.brand ?? '',
      code: initial.code ?? '',
      calories: initial.calories,
      protein: initial.protein,
      carbohydrates: initial.carbohydrates,
      fat: initial.fat,
      fiber: initial.fiber,
      sugar: initial.sugar,
      sodium: initial.sodium,
      potassium: initial.potassium,
      calcium: initial.calcium,
      iron: initial.iron,
      cholesterol: initial.cholesterol,
    }
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setText = (field: keyof CreateFoodRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
  }

  const setNum = (field: keyof CreateFoodRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setValues((v) => ({ ...v, [field]: raw === '' ? 0 : Number(raw) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.name.trim() || !values.category.trim()) {
      setError('El nombre y la categoría son obligatorios.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el alimento.')
    } finally {
      setSubmitting(false)
    }
  }

  const numInput = (label: string, field: keyof CreateFoodRequest) => (
    <label className="form-grid-item">
      {label}
      <input type="number" step="0.1" min="0" value={num(values[field] as number)} onChange={setNum(field)} />
    </label>
  )

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <h3 className="fieldset-title">Información básica</h3>
          <div className="form-grid">
            <label className="form-grid-item form-full">
              Nombre *
              <input type="text" value={values.name} onChange={setText('name')} placeholder="Ej. Pechuga de pollo" required />
            </label>
            <label className="form-grid-item">
              Categoría *
              <input type="text" value={values.category} onChange={setText('category')} placeholder="Ej. Carnes" required />
            </label>
            <label className="form-grid-item">
              Subcategoría
              <input type="text" value={values.subcategory ?? ''} onChange={setText('subcategory')} placeholder="Ej. Magras" />
            </label>
            <label className="form-grid-item">
              Unidad
              <select value={values.unit} onChange={setText('unit')}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="form-grid-item">
              Cantidad base
              <input type="number" step="1" min="1" value={num(values.defaultQuantity)} onChange={setNum('defaultQuantity')} />
            </label>
            <label className="form-grid-item">
              Marca
              <input type="text" value={values.brand ?? ''} onChange={setText('brand')} />
            </label>
            <label className="form-grid-item">
              Código interno
              <input type="text" value={values.code ?? ''} onChange={setText('code')} />
            </label>
            <label className="form-grid-item form-full">
              Descripción
              <textarea rows={2} value={values.description ?? ''} onChange={setText('description')} />
            </label>
          </div>

          <h3 className="fieldset-title">Valores por {values.defaultQuantity}{values.unit}</h3>
          <div className="form-grid form-grid-4">
            {numInput('Calorías (kcal)', 'calories')}
            {numInput('Proteína (g)', 'protein')}
            {numInput('Carbohidratos (g)', 'carbohydrates')}
            {numInput('Grasa (g)', 'fat')}
            {numInput('Fibra (g)', 'fiber')}
            {numInput('Azúcares (g)', 'sugar')}
            {numInput('Sodio (mg)', 'sodium')}
            {numInput('Potasio (mg)', 'potassium')}
            {numInput('Calcio (mg)', 'calcium')}
            {numInput('Hierro (mg)', 'iron')}
            {numInput('Colesterol (mg)', 'cholesterol')}
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