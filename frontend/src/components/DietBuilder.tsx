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
          { key: nextKey(), name: 'Desayuno', scheduledTime: '07:30', instructions: '', items: [] },
          { key: nextKey(), name: 'Almuerzo', scheduledTime: '13:30', instructions: '', items: [] },
          { key: nextKey(), name: 'Cena', scheduledTime: '20:00', instructions: '', items: [] },
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
  }, [meals])

  const filteredFoods = useMemo(() => {
    const s = foodSearch.trim().toLowerCase()
    if (!s) return foods.slice(0, 12)
    return foods.filter((f) => f.name.toLowerCase().includes(s) || f.category.toLowerCase().includes(s)).slice(0, 12)
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
        t.calories += item.calories
        t.protein += item.protein
        t.carbohydrates += item.carbohydrates
        t.fat += item.fat
        t.fiber += item.fiber
      }
    }
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, foods])

  const updateMeal = (key: string, patch: Partial<DraftMeal>) => {
    setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)))
  }

  const addMeal = () => {
    const key = nextKey()
    setMeals((ms) => [...ms, { key, name: 'Nueva comida', scheduledTime: '', instructions: '', items: [] }])
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
    setDraftQty(String(food.defaultQuantity))
  }

  const confirmAddFood = () => {
    if (!addingFood || !activeMealKey) return
    const qty = Number(draftQty)
    if (!qty || qty <= 0) return
    setMeals((ms) =>
      ms.map((m) =>
        m.key === activeMealKey
          ? { ...m, items: [...m.items, { foodId: addingFood.id, foodName: addingFood.name, quantity: qty, unit: addingFood.unit }] }
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
      setError('El nombre de la dieta es obligatorio.')
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
    } finally {
      setSubmitting(false)
    }
  }

  const activeMeal = meals.find((m) => m.key === activeMealKey)

  return (
    <div className="modal-overlay">
      <div className="modal modal-diet">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="diet-form-grid">
            <div className="diet-form-fields">
              <label className="form-grid-item">
                Nombre de la dieta *
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Plan de ganancia muscular" required />
              </label>
              <div className="form-grid">
                <label className="form-grid-item">
                  Objetivo
                  <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                    <option value="">Seleccionar objetivo...</option>
                    {['Pérdida de peso', 'Ganancia muscular', 'Mantenimiento', 'Control de peso', 'Alimentación saludable', 'Recuperación', 'Personalizado'].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="form-grid-item">
                  Observaciones
                  <input type="text" value={observations} onChange={(e) => setObservations(e.target.value)} />
                </label>
              </div>
            </div>
          </div>

          <div className="diet-builder">
            <div className="diet-meals-col">
              <h3 className="fieldset-title">Tiempos de comida</h3>
              <div className="diet-meal-list">
                {meals.map((meal, idx) => (
                  <div key={meal.key} className={`diet-meal-card ${activeMealKey === meal.key ? 'active' : ''}`} onClick={() => setActiveMealKey(meal.key)}>
                    <div className="diet-meal-head">
                      <input
                        type="text"
                        value={meal.name}
                        onChange={(e) => updateMeal(meal.key, { name: e.target.value })}
                        className="diet-meal-name"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="time"
                        value={meal.scheduledTime}
                        onChange={(e) => updateMeal(meal.key, { scheduledTime: e.target.value })}
                        className="diet-meal-time"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="diet-meal-actions">
                        <button type="button" className="btn-ghost btn-sm" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveMeal(meal.key, -1) }}>↑</button>
                        <button type="button" className="btn-ghost btn-sm" disabled={idx === meals.length - 1} onClick={(e) => { e.stopPropagation(); moveMeal(meal.key, 1) }}>↓</button>
                        <button type="button" className="btn-danger-soft btn-sm" onClick={(e) => { e.stopPropagation(); removeMeal(meal.key) }}>×</button>
                      </div>
                    </div>

                    {activeMealKey === meal.key && (
                      <div className="diet-meal-body">
                        <div className="meal-items">
                          {mealFoods(meal.key).map((item, i) => (
                            <div key={i} className="meal-item-row">
                              <span className="meal-item-name">{item.foodName}</span>
                              <span className="meal-item-qty">{item.quantity}{item.unit}</span>
                              <span className="meal-item-kcal">{item.calories} kcal</span>
                              <button type="button" className="btn-ghost btn-sm" onClick={() => removeFoodFromMeal(meal.key, i)}>×</button>
                            </div>
                          ))}
                          {mealFoods(meal.key).length === 0 && (
                            <p className="meal-empty">Sin alimentos aún.</p>
                          )}
                        </div>
                        <button type="button" className="btn-primary btn-sm" onClick={() => openPicker(meal.key)}>
                          + Agregar alimento
                        </button>
                        <textarea
                          rows={2}
                          placeholder="Instrucciones para la preparación..."
                          value={meal.instructions}
                          onChange={(e) => updateMeal(meal.key, { instructions: e.target.value })}
                          className="meal-instructions"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost btn-block" onClick={addMeal}>
                + Agregar tiempo de comida
              </button>
            </div>

            <aside className="diet-summary">
              <h3 className="fieldset-title">Objetivo diario</h3>
              <div className="goal-field">
                <span>Calorías</span>
                <input type="number" value={num(goalCalories)} onChange={(e) => setGoalCalories(e.target.value)} placeholder="kcal" />
              </div>
              <div className="goal-field">
                <span>Proteína</span>
                <input type="number" value={num(goalProtein)} onChange={(e) => setGoalProtein(e.target.value)} placeholder="g" />
              </div>
              <div className="goal-field">
                <span>Carbohidratos</span>
                <input type="number" value={num(goalCarbs)} onChange={(e) => setGoalCarbs(e.target.value)} placeholder="g" />
              </div>
              <div className="goal-field">
                <span>Grasa</span>
                <input type="number" value={num(goalFat)} onChange={(e) => setGoalFat(e.target.value)} placeholder="g" />
              </div>

              <div className="diet-totals">
                <div className="diet-total-main">
                  <span>Calorías</span>
                  <strong>{totals.calories} <em>/ {goalCalories || '—'} kcal</em></strong>
                </div>
                <div className="goal-progress"><div style={{ width: `${goalCalories ? Math.min(100, (totals.calories / Number(goalCalories)) * 100) : 0}%` }} /></div>
                <div className="diet-total-grid">
                  <div><span>Proteína</span><strong>{totals.protein}g{goalProtein ? ` / ${goalProtein}g` : ''}</strong></div>
                  <div><span>Carbos</span><strong>{totals.carbohydrates}g{goalCarbs ? ` / ${goalCarbs}g` : ''}</strong></div>
                  <div><span>Grasa</span><strong>{totals.fat}g{goalFat ? ` / ${goalFat}g` : ''}</strong></div>
                  <div><span>Fibra</span><strong>{totals.fiber}g</strong></div>
                </div>
              </div>
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

        {picking && !addingFood && activeMeal && (
          <div className="food-search-drawer">
            <div className="food-search-head">
              <strong>Agregar a {activeMeal.name}</strong>
              <button type="button" className="btn-ghost" onClick={closePicker}>Cerrar</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Buscar alimento del catálogo..."
              value={foodSearch}
              onChange={(e) => setFoodSearch(e.target.value)}
            />
            <div className="food-search-results">
              {filteredFoods.map((f) => (
                <button key={f.id} type="button" className="food-search-result" onClick={() => addFoodToMeal(f)}>
                  <div>
                    <strong>{f.name}</strong>
                    <span className="food-search-cat">{f.category}</span>
                  </div>
                  <span className="food-search-kcal">{f.calories} kcal / {f.defaultQuantity}{f.unit}</span>
                </button>
              ))}
              {filteredFoods.length === 0 && <p className="meal-empty">Sin resultados.</p>}
            </div>
          </div>
        )}

        {addingFood && activeMeal && (
          <div className="food-picker-popover">
            <div className="food-picker-head">
              <strong>{addingFood.name}</strong>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setAddingFood(null)}>×</button>
            </div>
            <p className="food-picker-nutri">
              {addingFood.calories} kcal · P {addingFood.protein}g · C {addingFood.carbohydrates}g · G {addingFood.fat}g por {addingFood.defaultQuantity}{addingFood.unit}
            </p>
            <div className="food-picker-qty">
              <input type="number" step="1" min="1" value={draftQty} onChange={(e) => setDraftQty(e.target.value)} />
              <span>{addingFood.unit}</span>
            </div>
            <button type="button" className="btn-primary" onClick={confirmAddFood}>Agregar</button>
          </div>
        )}
      </div>
    </div>
  )
}