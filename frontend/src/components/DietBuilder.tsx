import { useEffect, useMemo, useState } from 'react'
import type { CreateDietRequest, DietDto, FoodDto, MealRequest } from '../api/types'
import { getErrorMessage } from '../api/client'

interface Props {
  title: string
  initial?: DietDto
  foods: FoodDto[]
  onSubmit: (payload: CreateDietRequest) => Promise<void>
  onCancel: () => void
}

interface DraftItem {
  foodId: string
  foodName: string
  quantity: number
  unit: string
}

interface DraftMeal {
  key: string
  name: string
  scheduledTime: string
  instructions: string
  items: DraftItem[]
}

let keyCounter = 0
const nextKey = () => `meal-${++keyCounter}-${Date.now()}`

const num = (v?: string | number) => (v == null || v === '' ? '' : String(v))

const OBJECTIVES = [
  'Pérdida de peso',
  'Ganancia muscular',
  'Mantenimiento',
  'Control de peso',
  'Alimentación saludable',
  'Recuperación',
  'Personalizado',
]

const MEAL_PRESETS = [
  { name: 'Desayuno', time: '08:00', icon: '🌅' },
  { name: 'Media Mañana', time: '11:00', icon: '🍏' },
  { name: 'Almuerzo', time: '14:00', icon: '☀️' },
  { name: 'Merienda', time: '17:00', icon: '☕' },
  { name: 'Cena', time: '21:00', icon: '🌙' },
]

export default function DietBuilder({ title, initial, foods, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [observations, setObservations] = useState(initial?.observations ?? '')
  const [goalCalories, setGoalCalories] = useState<string>(initial?.goalCalories ? String(initial.goalCalories) : '')
  const [goalProtein, setGoalProtein] = useState<string>(initial?.goalProtein ? String(initial.goalProtein) : '')
  const [goalCarbs, setGoalCarbs] = useState<string>(initial?.goalCarbs ? String(initial.goalCarbs) : '')
  const [goalFat, setGoalFat] = useState<string>(initial?.goalFat ? String(initial.goalFat) : '')

  const [meals, setMeals] = useState<DraftMeal[]>(() =>
    initial && initial.meals.length > 0
      ? initial.meals.map((m) => ({
          key: nextKey(),
          name: m.name,
          scheduledTime: m.scheduledTime ?? '',
          instructions: m.instructions ?? '',
          items: m.items.map((i) => ({
            foodId: i.foodId,
            foodName: i.foodName,
            quantity: i.quantity,
            unit: i.unit,
          })),
        }))
      : [
          { key: nextKey(), name: 'Desayuno', scheduledTime: '08:00', instructions: '', items: [] },
          { key: nextKey(), name: 'Almuerzo', scheduledTime: '14:00', instructions: '', items: [] },
          { key: nextKey(), name: 'Cena', scheduledTime: '21:00', instructions: '', items: [] },
        ],
  )

  const [activeMealKey, setActiveMealKey] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [foodSearch, setFoodSearch] = useState('')
  const [addingFood, setAddingFood] = useState<FoodDto | null>(null)
  const [draftQty, setDraftQty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeMealKey && meals.length > 0) setActiveMealKey(meals[0].key)
  }, [meals, activeMealKey])

  const filteredFoods = useMemo(() => {
    const s = foodSearch.trim().toLowerCase()
    if (!s) return foods.slice(0, 16)
    return foods.filter((f) => f.name.toLowerCase().includes(s) || f.category.toLowerCase().includes(s)).slice(0, 16)
  }, [foods, foodSearch])

  const mealFoods = (mealKey: string) => {
    const foodMap = new Map(foods.map((f) => [f.id, f]))
    return meals.find((m) => m.key === mealKey)?.items.map((item) => {
      const food = foodMap.get(item.foodId)
      const base = food?.defaultQuantity && food.defaultQuantity > 0 ? food.defaultQuantity : 100
      const factor = item.quantity / base
      return {
        ...item,
        calories: Math.round(((food?.calories ?? 0) * factor) * 10) / 10,
        protein: Math.round(((food?.protein ?? 0) * factor) * 10) / 10,
        carbohydrates: Math.round(((food?.carbohydrates ?? 0) * factor) * 10) / 10,
        fat: Math.round(((food?.fat ?? 0) * factor) * 10) / 10,
        fiber: Math.round(((food?.fiber ?? 0) * factor) * 10) / 10,
      }
    }) ?? []
  }

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 }
    for (const meal of meals) {
      for (const item of mealFoods(meal.key)) {
        t.calories += item.calories ?? 0
        t.protein += item.protein ?? 0
        t.carbohydrates += item.carbohydrates ?? 0
        t.fat += item.fat ?? 0
        t.fiber += item.fiber ?? 0
      }
    }
    return {
      calories: Math.round(t.calories),
      protein: Math.round(t.protein * 10) / 10,
      carbohydrates: Math.round(t.carbohydrates * 10) / 10,
      fat: Math.round(t.fat * 10) / 10,
      fiber: Math.round(t.fiber * 10) / 10,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, foods])

  const updateMeal = (key: string, patch: Partial<DraftMeal>) => {
    setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)))
  }

  const addMeal = (presetName = 'Nueva comida', presetTime = '') => {
    const key = nextKey()
    setMeals((ms) => [...ms, { key, name: presetName, scheduledTime: presetTime, instructions: '', items: [] }])
    setActiveMealKey(key)
  }

  const removeMeal = (key: string) => {
    setMeals((ms) => ms.filter((m) => m.key !== key))
    if (activeMealKey === key) setActiveMealKey(null)
  }

  const moveMeal = (key: string, dir: -1 | 1) => {
    setMeals((ms) => {
      const idx = ms.findIndex((m) => m.key === key)
      const target = idx + dir
      if (idx < 0 || target < 0 || target >= ms.length) return ms
      const next = [...ms]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const openPicker = (key: string) => {
    setActiveMealKey(key)
    setPicking(true)
    setFoodSearch('')
  }

  const closePicker = () => {
    setPicking(false)
    setAddingFood(null)
  }

  const addFoodToMeal = (food: FoodDto) => {
    setAddingFood(food)
    setDraftQty(String(food.defaultQuantity ?? 100))
  }

  const confirmAddFood = () => {
    if (!addingFood || !activeMealKey) return
    const qty = Number(draftQty)
    if (!qty || qty <= 0) return
    setMeals((ms) =>
      ms.map((m) =>
        m.key === activeMealKey
          ? {
              ...m,
              items: [
                ...m.items,
                {
                  foodId: addingFood.id,
                  foodName: addingFood.name,
                  quantity: qty,
                  unit: addingFood.unit ?? 'g',
                },
              ],
            }
          : m,
      ),
    )
    setAddingFood(null)
    setDraftQty('')
  }

  const removeFoodFromMeal = (mealKey: string, index: number) => {
    setMeals((ms) =>
      ms.map((m) => (m.key === mealKey ? { ...m, items: m.items.filter((_, i) => i !== index) } : m)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre del plan de dieta es obligatorio.')
      return
    }
    const payload: CreateDietRequest = {
      name: name.trim(),
      objective: objective.trim() || undefined,
      observations: observations.trim() || undefined,
      goalCalories: goalCalories === '' ? undefined : Number(goalCalories),
      goalProtein: goalProtein === '' ? undefined : Number(goalProtein),
      goalCarbs: goalCarbs === '' ? undefined : Number(goalCarbs),
      goalFat: goalFat === '' ? undefined : Number(goalFat),
      meals: meals
        .filter((m) => m.name.trim())
        .map((m): MealRequest => ({
          name: m.name.trim(),
          scheduledTime: m.scheduledTime || undefined,
          instructions: m.instructions || undefined,
          items: m.items.map((i) => ({ foodId: i.foodId, quantity: i.quantity, unit: i.unit })),
        })),
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : getErrorMessage(err))
      setSubmitting(false)
    }
  }

  const activeMeal = meals.find((m) => m.key === activeMealKey)

  // Calculate goal percentage
  const calGoalNum = Number(goalCalories) || 0
  const calPct = calGoalNum > 0 ? Math.min(100, Math.round((totals.calories / calGoalNum) * 100)) : 0

  return (
    <div className="db-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="db-page-header">
        <button type="button" className="db-back-btn" onClick={onCancel}>
          ← Volver a Planes de Dieta
        </button>
        <div className="db-page-title-wrap">
          <div className="db-page-icon">🥗</div>
          <div>
            <h1 className="db-page-title">{title}</h1>
            <p className="db-page-subtitle">Diseña la distribución de comidas y objetivos nutricionales diarios</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="db-layout">

        {/* ── Main Left Column ─────────────────────────────────── */}
        <div className="db-main-col">

          {/* Información General del Plan */}
          <div className="db-section">
            <div className="db-section-header">
              <span className="db-section-badge db-badge-blue">📌</span>
              <span className="db-section-title">Información del Plan</span>
            </div>
            <div className="db-section-body">
              <div className="db-field db-field-full">
                <div className="db-field-icon">📋</div>
                <div className="db-field-body">
                  <span className="db-field-label">Nombre del plan de dieta *</span>
                  <input
                    type="text"
                    placeholder="Ej. Plan Hipocalórico de Definición"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="db-input"
                    required
                  />
                </div>
              </div>

              <div className="db-fields-row">
                <div className="db-field">
                  <div className="db-field-icon">🎯</div>
                  <div className="db-field-body">
                    <span className="db-field-label">Objetivo</span>
                    <select
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="db-input"
                    >
                      <option value="">Seleccionar objetivo...</option>
                      {OBJECTIVES.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="db-field db-field-flex">
                  <div className="db-field-icon">💬</div>
                  <div className="db-field-body">
                    <span className="db-field-label">Observaciones / Recomendaciones</span>
                    <input
                      type="text"
                      placeholder="Ej. Beber 2L de agua al día, consumir fibra..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="db-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tiempos de Comida */}
          <div className="db-section">
            <div className="db-section-header db-flex-between">
              <div className="db-header-left">
                <span className="db-section-badge db-badge-green">🍽️</span>
                <span className="db-section-title">
                  Tiempos de Comida ({meals.length})
                </span>
              </div>
              <div className="db-presets-wrap">
                <span className="db-preset-label">Añadir rápido:</span>
                {MEAL_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="db-preset-btn"
                    onClick={() => addMeal(p.name, p.time)}
                  >
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="db-meals-list">
              {meals.map((meal, idx) => {
                const foodsInMeal = mealFoods(meal.key)
                const mealKcal = foodsInMeal.reduce((acc, i) => acc + (i.calories ?? 0), 0)
                const mealProt = foodsInMeal.reduce((acc, i) => acc + (i.protein ?? 0), 0)
                const isActive = activeMealKey === meal.key

                return (
                  <div
                    key={meal.key}
                    className={`db-meal-card ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveMealKey(meal.key)}
                  >
                    <div className="db-meal-head">
                      <div className="db-meal-drag">⋮⋮</div>
                      <div className="db-meal-inputs">
                        <input
                          type="text"
                          value={meal.name}
                          onChange={(e) => updateMeal(meal.key, { name: e.target.value })}
                          className="db-meal-name-input"
                          placeholder="Nombre de la comida"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="db-time-wrap">
                          <span className="db-time-icon">⏰</span>
                          <input
                            type="time"
                            value={meal.scheduledTime}
                            onChange={(e) => updateMeal(meal.key, { scheduledTime: e.target.value })}
                            className="db-meal-time-input"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="db-meal-head-meta">
                        {foodsInMeal.length > 0 && (
                          <span className="db-meal-kcal-badge">
                            🔥 {Math.round(mealKcal)} kcal · 💪 {mealProt.toFixed(1)}g P
                          </span>
                        )}
                        <div className="db-meal-actions">
                          <button
                            type="button"
                            className="db-action-btn"
                            disabled={idx === 0}
                            title="Subir"
                            onClick={(e) => { e.stopPropagation(); moveMeal(meal.key, -1) }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="db-action-btn"
                            disabled={idx === meals.length - 1}
                            title="Bajar"
                            onClick={(e) => { e.stopPropagation(); moveMeal(meal.key, 1) }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="db-action-btn db-action-danger"
                            title="Eliminar tiempo"
                            onClick={(e) => { e.stopPropagation(); removeMeal(meal.key) }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Meal Body */}
                    {isActive && (
                      <div className="db-meal-body">
                        {/* Food items list */}
                        <div className="db-food-items">
                          {foodsInMeal.map((item, i) => (
                            <div key={i} className="db-food-item-row">
                              <div className="db-food-item-main">
                                <span className="db-food-item-icon">🥗</span>
                                <span className="db-food-item-name">{item.foodName}</span>
                              </div>

                              <div className="db-food-item-macros">
                                <span className="db-macro-chip db-chip-qty">
                                  {item.quantity} {item.unit}
                                </span>
                                <span className="db-macro-chip db-chip-kcal">
                                  {item.calories} kcal
                                </span>
                                <span className="db-macro-chip db-chip-prot">
                                  P: {item.protein}g
                                </span>
                                <span className="db-macro-chip db-chip-carb">
                                  C: {item.carbohydrates}g
                                </span>
                                <span className="db-macro-chip db-chip-fat">
                                  G: {item.fat}g
                                </span>
                                <button
                                  type="button"
                                  className="db-item-del"
                                  onClick={() => removeFoodFromMeal(meal.key, i)}
                                  title="Quitar alimento"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}

                          {foodsInMeal.length === 0 && (
                            <div className="db-empty-meal">
                              <span>🍎 No hay alimentos añadidos a este tiempo de comida.</span>
                            </div>
                          )}
                        </div>

                        {/* Add food button */}
                        <div className="db-meal-footer">
                          <button
                            type="button"
                            className="db-btn-add-food"
                            onClick={() => openPicker(meal.key)}
                          >
                            <span>+</span> Añadir alimento del catálogo
                          </button>

                          <input
                            type="text"
                            placeholder="Notas o instrucciones para esta comida (ej. consumir con 200ml de agua)..."
                            value={meal.instructions}
                            onChange={(e) => updateMeal(meal.key, { instructions: e.target.value })}
                            className="db-input db-instructions-input"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="db-add-meal-row">
              <button type="button" className="db-btn-new-meal" onClick={() => addMeal()}>
                <span>+</span> Añadir otro tiempo de comida
              </button>
            </div>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}

          {/* Form Bottom Actions */}
          <div className="db-form-actions">
            <button type="button" className="db-btn-cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="db-btn-save" disabled={submitting}>
              {submitting ? (
                <><span className="mf-spinner" /> Guardando plan…</>
              ) : (
                <><span>💾</span> Guardar plan de dieta</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right Column: Summary & Daily Goals ──────────────── */}
        <aside className="db-summary-col">
          <div className="db-summary-card">
            <div className="db-summary-header">
              <span>📊 Resumen diario y objetivos</span>
            </div>

            {/* Editable Goals */}
            <div className="db-goals-section">
              <span className="db-goals-title">Metas Nutricionales (Objetivo)</span>
              
              <div className="db-goal-row">
                <span className="db-goal-label">🔥 Calorías</span>
                <div className="db-goal-input-wrap">
                  <input
                    type="number"
                    placeholder="2000"
                    value={num(goalCalories)}
                    onChange={(e) => setGoalCalories(e.target.value)}
                    className="db-goal-input"
                  />
                  <span className="db-goal-unit">kcal</span>
                </div>
              </div>

              <div className="db-goal-row">
                <span className="db-goal-label">💪 Proteína</span>
                <div className="db-goal-input-wrap">
                  <input
                    type="number"
                    placeholder="150"
                    value={num(goalProtein)}
                    onChange={(e) => setGoalProtein(e.target.value)}
                    className="db-goal-input"
                  />
                  <span className="db-goal-unit">g</span>
                </div>
              </div>

              <div className="db-goal-row">
                <span className="db-goal-label">🌾 Carbohidratos</span>
                <div className="db-goal-input-wrap">
                  <input
                    type="number"
                    placeholder="200"
                    value={num(goalCarbs)}
                    onChange={(e) => setGoalCarbs(e.target.value)}
                    className="db-goal-input"
                  />
                  <span className="db-goal-unit">g</span>
                </div>
              </div>

              <div className="db-goal-row">
                <span className="db-goal-label">🫒 Grasas</span>
                <div className="db-goal-input-wrap">
                  <input
                    type="number"
                    placeholder="65"
                    value={num(goalFat)}
                    onChange={(e) => setGoalFat(e.target.value)}
                    className="db-goal-input"
                  />
                  <span className="db-goal-unit">g</span>
                </div>
              </div>
            </div>

            {/* Real-time calculated totals */}
            <div className="db-totals-section">
              <span className="db-totals-title">Total Calculado en Plan</span>

              {/* Kcal Hero Counter */}
              <div className="db-kcal-hero">
                <div className="db-kcal-hero-top">
                  <span className="db-kcal-hero-label">Calorías Totales</span>
                  <span className="db-kcal-hero-pct">{calGoalNum > 0 ? `${calPct}% del objetivo` : 'Sin meta'}</span>
                </div>
                <div className="db-kcal-hero-val">
                  <strong>{totals.calories}</strong>
                  <span>/ {goalCalories || '—'} kcal</span>
                </div>
                <div className="db-progress-track">
                  <div className="db-progress-fill" style={{ width: `${calPct}%` }} />
                </div>
              </div>

              {/* Macro breakdown grid */}
              <div className="db-totals-grid">
                <div className="db-total-box db-box-prot">
                  <span className="db-box-label">💪 Proteína</span>
                  <strong className="db-box-val">{totals.protein}g</strong>
                  <span className="db-box-target">{goalProtein ? `/ ${goalProtein}g` : ''}</span>
                </div>

                <div className="db-total-box db-box-carb">
                  <span className="db-box-label">🌾 Carbos</span>
                  <strong className="db-box-val">{totals.carbohydrates}g</strong>
                  <span className="db-box-target">{goalCarbs ? `/ ${goalCarbs}g` : ''}</span>
                </div>

                <div className="db-total-box db-box-fat">
                  <span className="db-box-label">🫒 Grasas</span>
                  <strong className="db-box-val">{totals.fat}g</strong>
                  <span className="db-box-target">{goalFat ? `/ ${goalFat}g` : ''}</span>
                </div>

                <div className="db-total-box db-box-fiber">
                  <span className="db-box-label">🌿 Fibra</span>
                  <strong className="db-box-val">{totals.fiber}g</strong>
                  <span className="db-box-target">total</span>
                </div>
              </div>
            </div>

          </div>
        </aside>

      </form>

      {/* ── Food Picker Modal Drawer ───────────────────────────── */}
      {picking && !addingFood && activeMeal && (
        <div className="db-picker-backdrop">
          <div className="db-picker-drawer">
            <div className="db-picker-head">
              <div>
                <h3 className="db-picker-title">Añadir a: {activeMeal.name}</h3>
                <p className="db-picker-sub">Selecciona un alimento del catálogo nutricional</p>
              </div>
              <button type="button" className="db-picker-close" onClick={closePicker}>✕</button>
            </div>

            <div className="db-picker-search-bar">
              <span className="db-picker-search-icon">🔍</span>
              <input
                autoFocus
                type="text"
                placeholder="Buscar alimento por nombre o categoría..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                className="db-picker-search-input"
              />
            </div>

            <div className="db-picker-results">
              {filteredFoods.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="db-picker-item"
                  onClick={() => addFoodToMeal(f)}
                >
                  <div className="db-picker-item-left">
                    <span className="db-picker-item-name">{f.name}</span>
                    <span className="db-picker-item-cat">{f.category}</span>
                  </div>
                  <div className="db-picker-item-right">
                    <span className="db-picker-item-kcal">{f.calories ?? 0} kcal</span>
                    <span className="db-picker-item-unit">por {f.defaultQuantity ?? 100}{f.unit ?? 'g'}</span>
                  </div>
                </button>
              ))}

              {filteredFoods.length === 0 && (
                <div className="db-picker-empty">
                  <span>🥗 No se encontraron alimentos que coincidan.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Food Quantity Popover ───────────────────────────── */}
      {addingFood && activeMeal && (
        <div className="db-picker-backdrop">
          <div className="db-qty-popover">
            <div className="db-qty-head">
              <div>
                <h3 className="db-qty-title">{addingFood.name}</h3>
                <span className="db-qty-cat">{addingFood.category}</span>
              </div>
              <button type="button" className="db-picker-close" onClick={() => setAddingFood(null)}>✕</button>
            </div>

            <div className="db-qty-nutri-banner">
              <div><span>🔥 Kcal</span><strong>{addingFood.calories ?? 0}</strong></div>
              <div><span>💪 Prot</span><strong>{addingFood.protein ?? 0}g</strong></div>
              <div><span>🌾 Carb</span><strong>{addingFood.carbohydrates ?? 0}g</strong></div>
              <div><span>🫒 Grasa</span><strong>{addingFood.fat ?? 0}g</strong></div>
              <span className="db-qty-serving">por {addingFood.defaultQuantity ?? 100}{addingFood.unit ?? 'g'}</span>
            </div>

            <div className="db-qty-field-group">
              <label className="db-qty-label">Cantidad a añadir para {activeMeal.name}:</label>
              <div className="db-qty-input-wrap">
                <input
                  type="number"
                  step="1"
                  min="1"
                  autoFocus
                  value={draftQty}
                  onChange={(e) => setDraftQty(e.target.value)}
                  className="db-qty-input"
                />
                <span className="db-qty-unit-badge">{addingFood.unit ?? 'g'}</span>
              </div>
            </div>

            <div className="db-qty-actions">
              <button type="button" className="db-btn-cancel" onClick={() => setAddingFood(null)}>
                Cancelar
              </button>
              <button type="button" className="db-btn-save" onClick={confirmAddFood}>
                <span>+</span> Añadir a {activeMeal.name}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}