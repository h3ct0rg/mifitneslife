import { useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { getErrorMessage } from '../api/client'
import type { CreateFoodRequest, FoodDto } from '../api/types'
import PageHeader from './ui/PageHeader'

interface Props {
  title: string
  initial?: FoodDto
  onSubmit: (payload: CreateFoodRequest) => Promise<void>
  onCancel: () => void
}

const UNITS = ['g', 'ml', 'kg', 'L', 'unidad', 'taza', 'cucharada', 'cucharadita', 'porción']

const CATEGORIES = [
  'Carnes', 'Pescados y mariscos', 'Huevos y lácteos', 'Legumbres',
  'Cereales y granos', 'Frutas', 'Verduras y hortalizas', 'Frutos secos',
  'Aceites y grasas', 'Azúcares y dulces', 'Bebidas', 'Suplementos', 'Otro',
]

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

type NumericField =
  | 'calories' | 'protein' | 'carbohydrates' | 'fat' | 'fiber' | 'sugar'
  | 'sodium' | 'potassium' | 'calcium' | 'iron' | 'cholesterol'

const MACROS: { label: string; field: NumericField; unit: string }[] = [
  { label: 'Calorías', field: 'calories', unit: 'kcal' },
  { label: 'Proteína', field: 'protein', unit: 'g' },
  { label: 'Carbohidratos', field: 'carbohydrates', unit: 'g' },
  { label: 'Grasa total', field: 'fat', unit: 'g' },
  { label: 'Fibra', field: 'fiber', unit: 'g' },
  { label: 'Azúcares', field: 'sugar', unit: 'g' },
]

const MICROS: { label: string; field: NumericField; unit: string }[] = [
  { label: 'Sodio', field: 'sodium', unit: 'mg' },
  { label: 'Potasio', field: 'potassium', unit: 'mg' },
  { label: 'Calcio', field: 'calcium', unit: 'mg' },
  { label: 'Hierro', field: 'iron', unit: 'mg' },
  { label: 'Colesterol', field: 'cholesterol', unit: 'mg' },
]

function num(v?: number) {
  return v == null ? '' : String(v)
}

function macroPct(cal: number, grams: number, factor: number) {
  if (!cal || cal <= 0) return 0
  return Math.min(100, Math.round(((grams * factor) / cal) * 100))
}

/**
 * Editor de alimento a pantalla completa (`.editor-page`): 1 columna en móvil,
 * formulario + vista previa en desktop y barra de acciones fija abajo.
 */
export default function FoodForm({ title, initial, onSubmit, onCancel }: Props) {
  const { pathname } = useLocation()
  const [values, setValues] = useState<CreateFoodRequest>(() => {
    if (!initial) return EMPTY
    return {
      name: initial.name ?? '',
      category: initial.category ?? '',
      subcategory: initial.subcategory ?? '',
      description: initial.description ?? '',
      unit: initial.unit ?? 'g',
      defaultQuantity: initial.defaultQuantity ?? 100,
      brand: initial.brand ?? '',
      code: initial.code ?? '',
      calories: initial.calories ?? 0,
      protein: initial.protein ?? 0,
      carbohydrates: initial.carbohydrates ?? 0,
      fat: initial.fat ?? 0,
      fiber: initial.fiber ?? 0,
      sugar: initial.sugar ?? 0,
      sodium: initial.sodium ?? 0,
      potassium: initial.potassium ?? 0,
      calcium: initial.calcium ?? 0,
      iron: initial.iron ?? 0,
      cholesterol: initial.cholesterol ?? 0,
    }
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; category?: string }>({})

  const setText = (field: keyof CreateFoodRequest) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      if (field === 'name' || field === 'category') setFieldErrors((fe) => ({ ...fe, [field]: undefined }))
    }

  const setNum = (field: keyof CreateFoodRequest) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setValues((v) => ({ ...v, [field]: raw === '' ? 0 : Number(raw) }))
  }

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
    const errors: { name?: string; category?: string } = {}
    if (!values.name.trim()) errors.name = 'Escribe el nombre del alimento.'
    if (!values.category.trim()) errors.category = 'Selecciona una categoría.'
    setFieldErrors(errors)
    if (errors.name || errors.category) {
      document.getElementById(errors.name ? 'ff-name' : 'ff-category')?.focus()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(getErrorMessage(err) || 'No se pudo guardar el alimento.')
      setSubmitting(false)
    }
  }

  const protPct = macroPct(values.calories, values.protein, 4)
  const carbPct = macroPct(values.calories, values.carbohydrates, 4)
  const fatPct = macroPct(values.calories, values.fat, 9)

  const numField = ({ label, field, unit }: { label: string; field: NumericField; unit: string }) => (
    <div className="field" key={field}>
      <label htmlFor={`ff-${field}`}>{label}</label>
      <div className="pl-input-unit">
        <input
          id={`ff-${field}`}
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="0"
          value={num(values[field])}
          onChange={setNum(field)}
        />
        <span className="pl-unit" aria-hidden="true">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="editor-page" onClickCapture={interceptBack}>
      <PageHeader
        title={title}
        subtitle="Información nutricional del alimento"
        back={{ to: pathname, label: 'Catálogo de alimentos' }}
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="editor-page-body">
        <div className="editor-page-main pl-stack">
          <section className="card pl-section" aria-labelledby="ff-basic">
            <h2 id="ff-basic" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">info</span>
              </span>
              Información básica
            </h2>
            <div className="field">
              <label htmlFor="ff-name">Nombre del alimento *</label>
              <input
                id="ff-name"
                type="text"
                placeholder="Ej. Pechuga de pollo cocida"
                value={values.name}
                onChange={setText('name')}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? 'ff-name-error' : undefined}
              />
              {fieldErrors.name && <p id="ff-name-error" className="field-error">{fieldErrors.name}</p>}
            </div>

            <div className="pl-form-grid">
              <div className="field">
                <label htmlFor="ff-category">Categoría *</label>
                <select
                  id="ff-category"
                  value={values.category}
                  onChange={setText('category')}
                  aria-invalid={fieldErrors.category ? true : undefined}
                  aria-describedby={fieldErrors.category ? 'ff-category-error' : undefined}
                >
                  <option value="">Seleccionar...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {values.category && !CATEGORIES.includes(values.category) && (
                    <option value={values.category}>{values.category}</option>
                  )}
                </select>
                {fieldErrors.category && <p id="ff-category-error" className="field-error">{fieldErrors.category}</p>}
              </div>

              <div className="field">
                <label htmlFor="ff-subcategory">Subcategoría</label>
                <input
                  id="ff-subcategory"
                  type="text"
                  placeholder="Ej. Magras"
                  value={values.subcategory ?? ''}
                  onChange={setText('subcategory')}
                />
              </div>

              <div className="field">
                <label htmlFor="ff-unit">Unidad de medida</label>
                <select id="ff-unit" value={values.unit} onChange={setText('unit')}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="ff-qty">Cantidad base</label>
                <div className="pl-input-unit">
                  <input
                    id="ff-qty"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="1"
                    value={num(values.defaultQuantity)}
                    onChange={setNum('defaultQuantity')}
                  />
                  <span className="pl-unit" aria-hidden="true">{values.unit}</span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="ff-brand">Marca</label>
                <input id="ff-brand" type="text" placeholder="Opcional" value={values.brand ?? ''} onChange={setText('brand')} />
              </div>

              <div className="field">
                <label htmlFor="ff-code">Código interno</label>
                <input id="ff-code" type="text" placeholder="Opcional" value={values.code ?? ''} onChange={setText('code')} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ff-description">Descripción</label>
              <textarea
                id="ff-description"
                rows={2}
                placeholder="Descripción opcional del alimento..."
                value={values.description ?? ''}
                onChange={setText('description')}
              />
            </div>
          </section>

          <section className="card pl-section" aria-labelledby="ff-macros">
            <h2 id="ff-macros" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">bolt</span>
              </span>
              Macronutrientes · por {values.defaultQuantity}{values.unit}
            </h2>
            <div className="pl-form-grid pl-form-grid--3">{MACROS.map(numField)}</div>
          </section>

          <section className="card pl-section" aria-labelledby="ff-micros">
            <h2 id="ff-micros" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">science</span>
              </span>
              Micronutrientes
            </h2>
            <div className="pl-form-grid pl-form-grid--3">{MICROS.map(numField)}</div>
          </section>

          {error && (
            <div className="error-box" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">error</span>
              {error}
            </div>
          )}
        </div>

        <aside className="editor-page-aside pl-summary" aria-label="Vista previa nutricional">
            <p className="pl-subtitle">Vista previa nutricional</p>
            <p className="ff-preview-name">{values.name || 'Nombre del alimento'}</p>
            {values.category && <span className="badge badge--info">{values.category}</span>}
            <p className="pl-muted">Valores por {values.defaultQuantity}{values.unit}</p>

            <p className="pl-kcal-hero">
              <strong>{Math.round(values.calories ?? 0)}</strong> <span>kcal</span>
            </p>

            {[
              { label: 'Proteína', val: values.protein ?? 0, pct: protPct, tone: 'protein' },
              { label: 'Carbohidratos', val: values.carbohydrates ?? 0, pct: carbPct, tone: 'carbs' },
              { label: 'Grasa', val: values.fat ?? 0, pct: fatPct, tone: 'fat' },
            ].map((m) => (
              <div key={m.label} className={`pl-macro-row pl-tone-${m.tone}`}>
                <div className="pl-macro-label">
                  <span>{m.label}</span>
                  <strong>{m.val.toFixed(1)} g <em>{m.pct}%</em></strong>
                </div>
                <div className="pl-macro-track" aria-hidden="true">
                  <div className="pl-macro-fill" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}

            <dl className="pl-kv">
              {[
                { label: 'Fibra', val: values.fiber ?? 0, unit: 'g' },
                { label: 'Azúcares', val: values.sugar ?? 0, unit: 'g' },
                { label: 'Sodio', val: values.sodium ?? 0, unit: 'mg' },
                { label: 'Potasio', val: values.potassium ?? 0, unit: 'mg' },
                { label: 'Colesterol', val: values.cholesterol ?? 0, unit: 'mg' },
              ].map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.val.toFixed(1)} {m.unit}</dd>
                </div>
              ))}
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
              <><span className="material-symbols-outlined" aria-hidden="true">save</span> Guardar alimento</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
