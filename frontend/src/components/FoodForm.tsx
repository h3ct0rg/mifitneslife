import { useState } from 'react'
import type { CreateFoodRequest, FoodDto } from '../api/types'

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

function num(v?: number) {
  return v == null ? '' : String(v)
}

// Derived macro ring percentages (for visual preview)
function macroPct(cal: number, grams: number, factor: number) {
  if (!cal || cal <= 0) return 0
  return Math.min(100, Math.round(((grams * factor) / cal) * 100))
}

export default function FoodForm({ title, initial, onSubmit, onCancel }: Props) {
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

  const setText = (field: keyof CreateFoodRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }))

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
      setSubmitting(false)
    }
  }

  /** Macro percentages for the live preview */
  const protPct = macroPct(values.calories, values.protein, 4)
  const carbPct = macroPct(values.calories, values.carbohydrates, 4)
  const fatPct  = macroPct(values.calories, values.fat, 9)

  /** Reusable numeric field with unit badge */
  const numField = (
    label: string,
    field: keyof CreateFoodRequest,
    unit: string,
    icon: string
  ) => (
    <div className="ff-field">
      <div className="ff-field-icon">{icon}</div>
      <div className="ff-field-body">
        <span className="ff-field-label">{label}</span>
        <div className="ff-field-input-wrap">
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="0"
            value={num(values[field] as number)}
            onChange={setNum(field)}
            className="ff-input"
          />
          <span className="ff-unit">{unit}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="ff-page">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="ff-page-header">
        <button type="button" className="ff-back-btn" onClick={onCancel}>
          ← Volver al catálogo
        </button>
        <div className="ff-page-title-wrap">
          <div className="ff-page-icon">🥦</div>
          <div>
            <h1 className="ff-page-title">{title}</h1>
            <p className="ff-page-subtitle">Completa la información nutricional del alimento</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ff-layout">

        {/* ── Left: Main form ─────────────────────────────────── */}
        <div className="ff-main-col">

          {/* Información básica */}
          <div className="ff-section">
            <div className="ff-section-header">
              <span className="ff-section-badge ff-badge-blue">📋</span>
              <span className="ff-section-title">Información básica</span>
            </div>
            <div className="ff-section-body">
              <div className="ff-field ff-field-full">
                <div className="ff-field-icon">🏷️</div>
                <div className="ff-field-body">
                  <span className="ff-field-label">Nombre del alimento *</span>
                  <input
                    type="text"
                    placeholder="Ej. Pechuga de pollo cocida"
                    value={values.name}
                    onChange={setText('name')}
                    className="ff-input"
                    required
                  />
                </div>
              </div>

              <div className="ff-fields-row">
                <div className="ff-field">
                  <div className="ff-field-icon">🗂️</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Categoría *</span>
                    <div className="ff-field-input-wrap">
                      <select value={values.category} onChange={setText('category')} className="ff-input">
                        <option value="">Seleccionar...</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {values.category && !CATEGORIES.includes(values.category) && (
                          <option value={values.category}>{values.category}</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="ff-field">
                  <div className="ff-field-icon">🔖</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Subcategoría</span>
                    <div className="ff-field-input-wrap">
                      <input
                        type="text"
                        placeholder="Ej. Magras"
                        value={values.subcategory ?? ''}
                        onChange={setText('subcategory')}
                        className="ff-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="ff-field">
                  <div className="ff-field-icon">📏</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Unidad de medida</span>
                    <div className="ff-field-input-wrap">
                      <select value={values.unit} onChange={setText('unit')} className="ff-input">
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="ff-field">
                  <div className="ff-field-icon">⚖️</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Cantidad base</span>
                    <div className="ff-field-input-wrap">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={num(values.defaultQuantity)}
                        onChange={setNum('defaultQuantity')}
                        className="ff-input"
                      />
                      <span className="ff-unit">{values.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="ff-field">
                  <div className="ff-field-icon">🏭</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Marca</span>
                    <div className="ff-field-input-wrap">
                      <input type="text" placeholder="Opcional" value={values.brand ?? ''} onChange={setText('brand')} className="ff-input" />
                    </div>
                  </div>
                </div>

                <div className="ff-field">
                  <div className="ff-field-icon">🔢</div>
                  <div className="ff-field-body">
                    <span className="ff-field-label">Código interno</span>
                    <div className="ff-field-input-wrap">
                      <input type="text" placeholder="Opcional" value={values.code ?? ''} onChange={setText('code')} className="ff-input" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="ff-field ff-field-full">
                <div className="ff-field-icon">📝</div>
                <div className="ff-field-body">
                  <span className="ff-field-label">Descripción</span>
                  <textarea
                    rows={2}
                    placeholder="Descripción opcional del alimento..."
                    value={values.description ?? ''}
                    onChange={setText('description')}
                    className="ff-input ff-textarea"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Macronutrientes */}
          <div className="ff-section">
            <div className="ff-section-header">
              <span className="ff-section-badge ff-badge-green">⚡</span>
              <span className="ff-section-title">
                Macronutrientes — por {values.defaultQuantity}{values.unit}
              </span>
            </div>
            <div className="ff-macro-grid">
              {numField('Calorías', 'calories', 'kcal', '🔥')}
              {numField('Proteína', 'protein', 'g', '💪')}
              {numField('Carbohidratos', 'carbohydrates', 'g', '🌾')}
              {numField('Grasa total', 'fat', 'g', '🫒')}
              {numField('Fibra', 'fiber', 'g', '🌿')}
              {numField('Azúcares', 'sugar', 'g', '🍬')}
            </div>
          </div>

          {/* Micronutrientes */}
          <div className="ff-section">
            <div className="ff-section-header">
              <span className="ff-section-badge ff-badge-purple">🔬</span>
              <span className="ff-section-title">Micronutrientes</span>
            </div>
            <div className="ff-micro-grid">
              {numField('Sodio', 'sodium', 'mg', '🧂')}
              {numField('Potasio', 'potassium', 'mg', '🍌')}
              {numField('Calcio', 'calcium', 'mg', '🦴')}
              {numField('Hierro', 'iron', 'mg', '⚙️')}
              {numField('Colesterol', 'cholesterol', 'mg', '💊')}
            </div>
          </div>

          {error && (
            <div className="error-box">⚠️ {error}</div>
          )}

          {/* Actions */}
          <div className="ff-actions">
            <button type="button" className="ff-btn-cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="ff-btn-save" disabled={submitting}>
              {submitting ? (
                <><span className="mf-spinner" /> Guardando…</>
              ) : (
                <><span>💾</span> Guardar alimento</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Live preview card ─────────────────────────── */}
        <aside className="ff-preview-col">
          <div className="ff-preview-card">
            <div className="ff-preview-header">
              <span className="ff-preview-label">Vista previa nutricional</span>
            </div>
            <div className="ff-preview-name">{values.name || 'Nombre del alimento'}</div>
            {values.category && (
              <span className="ff-preview-cat">{values.category}</span>
            )}
            <p className="ff-preview-serving">
              Valores por {values.defaultQuantity}{values.unit}
            </p>

            <div className="ff-preview-kcal">
              <strong>{Math.round(values.calories ?? 0)}</strong>
              <span>kcal</span>
            </div>

            <div className="ff-preview-macros">
              {[
                { label: 'Proteína', val: values.protein ?? 0, unit: 'g', pct: protPct, color: '#2170e4' },
                { label: 'Carbohid.', val: values.carbohydrates ?? 0, unit: 'g', pct: carbPct, color: '#e29100' },
                { label: 'Grasa', val: values.fat ?? 0, unit: 'g', pct: fatPct, color: '#ef4444' },
              ].map((m) => (
                <div key={m.label} className="ff-macro-row">
                  <div className="ff-macro-label">
                    <span>{m.label}</span>
                    <strong>{(m.val ?? 0).toFixed(1)}{m.unit}</strong>
                  </div>
                  <div className="ff-macro-bar-track">
                    <div
                      className="ff-macro-bar-fill"
                      style={{ width: `${m.pct}%`, background: m.color }}
                    />
                  </div>
                  <span className="ff-macro-pct">{m.pct}%</span>
                </div>
              ))}
            </div>

            <div className="ff-preview-micro">
              {[
                { label: 'Fibra', val: values.fiber ?? 0, unit: 'g' },
                { label: 'Azúcares', val: values.sugar ?? 0, unit: 'g' },
                { label: 'Sodio', val: values.sodium ?? 0, unit: 'mg' },
                { label: 'Potasio', val: values.potassium ?? 0, unit: 'mg' },
                { label: 'Colesterol', val: values.cholesterol ?? 0, unit: 'mg' },
              ].map((m) => (
                <div key={m.label} className="ff-micro-row">
                  <span>{m.label}</span>
                  <strong>{(m.val ?? 0).toFixed(1)}{m.unit}</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>

      </form>
    </div>
  )
}
