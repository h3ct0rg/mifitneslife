import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import type { CreateDietRequest, DietDto, FoodDto, MealRequest } from '../api/types'
import { getErrorMessage } from '../api/client'
import Modal, { ConfirmModal } from './Modal'
import PageHeader from './ui/PageHeader'

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
  { name: 'Desayuno', time: '08:00', icon: 'wb_twilight' },
  { name: 'Media Mañana', time: '11:00', icon: 'nutrition' },
  { name: 'Almuerzo', time: '14:00', icon: 'light_mode' },
  { name: 'Merienda', time: '17:00', icon: 'coffee' },
  { name: 'Cena', time: '21:00', icon: 'dark_mode' },
]

const GOALS = [
  { key: 'calories', label: 'Calorías', unit: 'kcal', placeholder: '2000', tone: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g', placeholder: '150', tone: 'protein' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g', placeholder: '200', tone: 'carbs' },
  { key: 'fat', label: 'Grasas', unit: 'g', placeholder: '65', tone: 'fat' },
] as const

type GoalKey = (typeof GOALS)[number]['key']

/**
 * Editor de plan de dieta a pantalla completa (`.editor-page`): comidas + resumen
 * (desktop en 2 columnas, móvil en 1) y barra de acciones fija abajo.
 */
export default function DietBuilder({ title, initial, foods, onSubmit, onCancel }: Props) {
  const { pathname } = useLocation()
  const [name, setName] = useState(initial?.name ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [observations, setObservations] = useState(initial?.observations ?? '')
  const [goals, setGoals] = useState<Record<GoalKey, string>>({
    calories: initial?.goalCalories ? String(initial.goalCalories) : '',
    protein: initial?.goalProtein ? String(initial.goalProtein) : '',
    carbs: initial?.goalCarbs ? String(initial.goalCarbs) : '',
    fat: initial?.goalFat ? String(initial.goalFat) : '',
  })

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
  const [qtyError, setQtyError] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [mealToRemove, setMealToRemove] = useState<DraftMeal | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeMealKey && meals.length > 0) setActiveMealKey(meals[0].key)
  }, [meals, activeMealKey])

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  const filteredFoods = useMemo(() => {
    const s = foodSearch.trim().toLowerCase()
    if (!s) return foods.slice(0, 16)
    return foods.filter((f) => f.name.toLowerCase().includes(s) || f.category.toLowerCase().includes(s)).slice(0, 16)
  }, [foods, foodSearch])

  const mealFoods = (meal: DraftMeal) =>
    meal.items.map((item) => {
      const food = foodMap.get(item.foodId)
      const base = food?.defaultQuantity && food.defaultQuantity > 0 ? food.defaultQuantity : 100
      const factor = item.quantity / base
      const r = (v?: number) => Math.round((v ?? 0) * factor * 10) / 10
      return {
        ...item,
        calories: r(food?.calories),
        protein: r(food?.protein),
        carbohydrates: r(food?.carbohydrates),
        fat: r(food?.fat),
        fiber: r(food?.fiber),
      }
    })

  const totals = useMemo(() => {
    const t = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 }
    for (const meal of meals) {
      for (const item of mealFoods(meal)) {
        t.calories += item.calories
        t.protein += item.protein
        t.carbohydrates += item.carbohydrates
        t.fat += item.fat
        t.fiber += item.fiber
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
  }, [meals, foodMap])

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

  const requestRemoveMeal = (meal: DraftMeal) => {
    if (meal.items.length > 0) setMealToRemove(meal)
    else removeMeal(meal.key)
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
    setLastAdded(null)
  }

  const closePicker = () => {
    setPicking(false)
    setAddingFood(null)
  }

  const chooseFood = (food: FoodDto) => {
    setAddingFood(food)
    setDraftQty(String(food.defaultQuantity ?? 100))
    setQtyError(null)
  }

  const confirmAddFood = (e: FormEvent) => {
    e.preventDefault()
    if (!addingFood || !activeMealKey) return
    const qty = Number(draftQty)
    if (!qty || qty <= 0) {
      setQtyError('Indica una cantidad mayor que 0.')
      return
    }
    setMeals((ms) =>
      ms.map((m) =>
        m.key === activeMealKey
          ? {
              ...m,
              items: [
                ...m.items,
                { foodId: addingFood.id, foodName: addingFood.name, quantity: qty, unit: addingFood.unit ?? 'g' },
              ],
            }
          : m,
      ),
    )
    setLastAdded(`${addingFood.name} (${qty} ${addingFood.unit ?? 'g'})`)
    setAddingFood(null)
    setDraftQty('')
  }

  const removeFoodFromMeal = (mealKey: string, index: number) => {
    setMeals((ms) =>
      ms.map((m) => (m.key === mealKey ? { ...m, items: m.items.filter((_, i) => i !== index) } : m)),
    )
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
    if (!name.trim()) {
      setNameError('Escribe el nombre del plan de dieta.')
      document.getElementById('db-name')?.focus()
      return
    }
    const toNum = (v: string) => (v === '' ? undefined : Number(v))
    const payload: CreateDietRequest = {
      name: name.trim(),
      objective: objective.trim() || undefined,
      observations: observations.trim() || undefined,
      goalCalories: toNum(goals.calories),
      goalProtein: toNum(goals.protein),
      goalCarbs: toNum(goals.carbs),
      goalFat: toNum(goals.fat),
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
      setError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  const activeMeal = meals.find((m) => m.key === activeMealKey)

  const calGoalNum = Number(goals.calories) || 0
  const calPct = calGoalNum > 0 ? Math.min(100, Math.round((totals.calories / calGoalNum) * 100)) : 0

  return (
    <div className="editor-page" onClickCapture={interceptBack}>
      <PageHeader
        title={title}
        subtitle="Distribución de comidas y objetivos nutricionales diarios"
        back={{ to: pathname, label: 'Planes de dieta' }}
      />

      <form onSubmit={handleSubmit} noValidate>
        <div className="editor-page-body">
        <div className="editor-page-main pl-stack">
          <section className="card pl-section" aria-labelledby="db-info">
            <h2 id="db-info" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">assignment</span>
              </span>
              Información del plan
            </h2>
            <div className="field">
              <label htmlFor="db-name">Nombre del plan *</label>
              <input
                id="db-name"
                type="text"
                placeholder="Ej. Plan hipocalórico de definición"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(null) }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? 'db-name-error' : undefined}
              />
              {nameError && <p id="db-name-error" className="field-error">{nameError}</p>}
            </div>
            <div className="pl-form-grid">
              <div className="field">
                <label htmlFor="db-objective">Objetivo</label>
                <select id="db-objective" value={objective} onChange={(e) => setObjective(e.target.value)}>
                  <option value="">Seleccionar objetivo...</option>
                  {OBJECTIVES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                  {objective && !OBJECTIVES.includes(objective) && <option value={objective}>{objective}</option>}
                </select>
              </div>
              <div className="field">
                <label htmlFor="db-observations">Observaciones / recomendaciones</label>
                <input
                  id="db-observations"
                  type="text"
                  placeholder="Ej. Beber 2 L de agua al día"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="card pl-section" aria-labelledby="db-meals">
            <h2 id="db-meals" className="pl-section-title">
              <span className="icon-chip icon-chip--soft" aria-hidden="true">
                <span className="material-symbols-outlined">restaurant</span>
              </span>
              Tiempos de comida ({meals.length})
            </h2>

            <div className="pl-chips pl-chips--wrap" role="group" aria-label="Añadir tiempo de comida rápido">
              {MEAL_PRESETS.map((p) => (
                <button key={p.name} type="button" className="pl-chip" onClick={() => addMeal(p.name, p.time)}>
                  <span className="material-symbols-outlined" aria-hidden="true">{p.icon}</span>
                  {p.name}
                </button>
              ))}
            </div>

            <ol className="db-meals-list">
              {meals.map((meal, idx) => {
                const foodsInMeal = mealFoods(meal)
                const mealKcal = foodsInMeal.reduce((acc, i) => acc + i.calories, 0)
                const mealProt = foodsInMeal.reduce((acc, i) => acc + i.protein, 0)
                const isActive = activeMealKey === meal.key
                const bodyId = `db-meal-body-${meal.key}`

                return (
                  <li key={meal.key} className={`db-meal-card ${isActive ? 'active' : ''}`}>
                    <div className="db-meal-head">
                      <div className="db-meal-inputs">
                        <label className="sr-only" htmlFor={`db-meal-name-${meal.key}`}>Nombre de la comida {idx + 1}</label>
                        <input
                          id={`db-meal-name-${meal.key}`}
                          type="text"
                          value={meal.name}
                          onChange={(e) => updateMeal(meal.key, { name: e.target.value })}
                          onFocus={() => setActiveMealKey(meal.key)}
                          className="db-meal-name-input"
                          placeholder="Nombre de la comida"
                        />
                        <label className="sr-only" htmlFor={`db-meal-time-${meal.key}`}>Hora de {meal.name || `la comida ${idx + 1}`}</label>
                        <input
                          id={`db-meal-time-${meal.key}`}
                          type="time"
                          value={meal.scheduledTime}
                          onChange={(e) => updateMeal(meal.key, { scheduledTime: e.target.value })}
                          className="db-meal-time-input"
                        />
                      </div>

                      <div className="db-meal-head-meta">
                        {foodsInMeal.length > 0 && (
                          <span className="badge badge--warning">
                            {Math.round(mealKcal)} kcal · {mealProt.toFixed(1)} g P
                          </span>
                        )}
                        <div className="db-meal-actions">
                          <button
                            type="button"
                            className="btn btn--icon"
                            disabled={idx === 0}
                            aria-label={`Subir ${meal.name}`}
                            title="Subir"
                            onClick={() => moveMeal(meal.key, -1)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--icon"
                            disabled={idx === meals.length - 1}
                            aria-label={`Bajar ${meal.name}`}
                            title="Bajar"
                            onClick={() => moveMeal(meal.key, 1)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">arrow_downward</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--icon pl-btn-danger-icon"
                            aria-label={`Eliminar ${meal.name}`}
                            title="Eliminar tiempo de comida"
                            onClick={() => requestRemoveMeal(meal)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--icon"
                            aria-expanded={isActive}
                            aria-controls={bodyId}
                            aria-label={isActive ? `Contraer ${meal.name}` : `Ver alimentos de ${meal.name}`}
                            onClick={() => setActiveMealKey(isActive ? null : meal.key)}
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {isActive ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="db-meal-body" id={bodyId}>
                        {foodsInMeal.length === 0 ? (
                          <p className="pl-muted">Aún no hay alimentos en este tiempo de comida.</p>
                        ) : (
                          <ul className="db-food-items">
                            {foodsInMeal.map((item, i) => (
                              <li key={`${item.foodId}-${i}`} className="db-food-item-row">
                                <span className="db-food-item-name">{item.foodName}</span>
                                <span className="db-food-item-macros">
                                  <span className="pl-mini-chip">{item.quantity} {item.unit}</span>
                                  <span className="pl-mini-chip pl-tone-kcal">{item.calories} kcal</span>
                                  <span className="pl-mini-chip pl-tone-protein">P {item.protein} g</span>
                                  <span className="pl-mini-chip pl-tone-carbs">C {item.carbohydrates} g</span>
                                  <span className="pl-mini-chip pl-tone-fat">G {item.fat} g</span>
                                </span>
                                <button
                                  type="button"
                                  className="btn btn--icon"
                                  onClick={() => removeFoodFromMeal(meal.key, i)}
                                  aria-label={`Quitar ${item.foodName}`}
                                  title="Quitar alimento"
                                >
                                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <button type="button" className="btn btn--secondary" onClick={() => openPicker(meal.key)}>
                          <span className="material-symbols-outlined" aria-hidden="true">add</span>
                          Añadir alimento
                        </button>

                        <div className="field pl-field-tight">
                          <label htmlFor={`db-meal-notes-${meal.key}`}>Notas para esta comida</label>
                          <input
                            id={`db-meal-notes-${meal.key}`}
                            type="text"
                            placeholder="Ej. consumir con 200 ml de agua"
                            value={meal.instructions}
                            onChange={(e) => updateMeal(meal.key, { instructions: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>

            <button type="button" className="btn btn--ghost btn--block" onClick={() => addMeal()}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              Añadir otro tiempo de comida
            </button>
          </section>

          {error && (
            <div className="error-box" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">error</span>
              {error}
            </div>
          )}
        </div>

        <aside className="editor-page-aside pl-summary" aria-label="Resumen diario y objetivos">
            <h2 className="pl-section-title">
              <span className="icon-chip" aria-hidden="true">
                <span className="material-symbols-outlined">monitoring</span>
              </span>
              Resumen diario
            </h2>

            <fieldset className="pl-fieldset">
              <legend className="pl-subtitle">Metas nutricionales</legend>
              {GOALS.map((g) => (
                <div key={g.key} className="db-goal-row">
                  <label htmlFor={`db-goal-${g.key}`} className={`db-goal-label pl-tone-${g.tone}`}>
                    <span className="pl-chip-dot" aria-hidden="true" />
                    {g.label}
                  </label>
                  <div className="pl-input-unit db-goal-input">
                    <input
                      id={`db-goal-${g.key}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder={g.placeholder}
                      value={num(goals[g.key])}
                      onChange={(e) => setGoals((gs) => ({ ...gs, [g.key]: e.target.value }))}
                    />
                    <span className="pl-unit" aria-hidden="true">{g.unit}</span>
                  </div>
                </div>
              ))}
            </fieldset>

            <div className="db-kcal-hero">
              <div className="db-kcal-hero-top">
                <span>Calorías totales</span>
                <span>{calGoalNum > 0 ? `${calPct}% del objetivo` : 'Sin meta'}</span>
              </div>
              <p className="pl-kcal-hero">
                <strong>{totals.calories}</strong> <span>/ {goals.calories || '—'} kcal</span>
              </p>
              <div
                className="pl-macro-track"
                role="progressbar"
                aria-label="Calorías respecto al objetivo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={calPct}
              >
                <div className="pl-macro-fill" style={{ width: `${calPct}%` }} />
              </div>
            </div>

            <dl className="pl-macro-chips pl-macro-chips--2">
              <div className="pl-tone-protein">
                <dt>Proteína</dt>
                <dd>{totals.protein} g{goals.protein && <small> / {goals.protein} g</small>}</dd>
              </div>
              <div className="pl-tone-carbs">
                <dt>Carbos</dt>
                <dd>{totals.carbohydrates} g{goals.carbs && <small> / {goals.carbs} g</small>}</dd>
              </div>
              <div className="pl-tone-fat">
                <dt>Grasas</dt>
                <dd>{totals.fat} g{goals.fat && <small> / {goals.fat} g</small>}</dd>
              </div>
              <div className="pl-tone-fiber">
                <dt>Fibra</dt>
                <dd>{totals.fiber} g</dd>
              </div>
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

      {/* Selector de alimento (hoja en móvil): lista : cantidad */}
      {picking && activeMeal && (
        <Modal
          title={addingFood ? addingFood.name : `Añadir a: ${activeMeal.name}`}
          onClose={addingFood ? () => setAddingFood(null) : closePicker}
          className="pl-picker"
        >
          {addingFood ? (
            <form onSubmit={confirmAddFood} noValidate>
              <p className="pl-muted">{addingFood.category} · valores por {addingFood.defaultQuantity ?? 100}{addingFood.unit ?? 'g'}</p>
              <dl className="pl-macro-chips">
                <div className="pl-tone-kcal"><dt>Kcal</dt><dd>{addingFood.calories ?? 0}</dd></div>
                <div className="pl-tone-protein"><dt>Prot</dt><dd>{addingFood.protein ?? 0} g</dd></div>
                <div className="pl-tone-carbs"><dt>Carb</dt><dd>{addingFood.carbohydrates ?? 0} g</dd></div>
                <div className="pl-tone-fat"><dt>Grasa</dt><dd>{addingFood.fat ?? 0} g</dd></div>
              </dl>
              <div className="field">
                <label htmlFor="db-qty">Cantidad para {activeMeal.name}</label>
                <div className="pl-input-unit">
                  <input
                    id="db-qty"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="1"
                    autoFocus
                    value={draftQty}
                    onChange={(e) => { setDraftQty(e.target.value); setQtyError(null) }}
                    aria-invalid={qtyError ? true : undefined}
                    aria-describedby={qtyError ? 'db-qty-error' : undefined}
                  />
                  <span className="pl-unit" aria-hidden="true">{addingFood.unit ?? 'g'}</span>
                </div>
                {qtyError && <p id="db-qty-error" className="field-error">{qtyError}</p>}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setAddingFood(null)}>
                  Volver
                </button>
                <button type="submit" className="btn btn--primary">
                  <span className="material-symbols-outlined" aria-hidden="true">add</span>
                  Añadir
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="pl-search">
                <span className="material-symbols-outlined pl-search-icon" aria-hidden="true">search</span>
                <label htmlFor="db-picker-search" className="sr-only">Buscar alimento</label>
                <input
                  id="db-picker-search"
                  autoFocus
                  type="search"
                  placeholder="Buscar por nombre o categoría..."
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="db-picker-search-input"
                />
              </div>
              {lastAdded && (
                <p className="pl-added" role="status">
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  Añadido: {lastAdded}
                </p>
              )}
              {filteredFoods.length === 0 ? (
                <p className="pl-muted pl-center">No se encontraron alimentos.</p>
              ) : (
                <ul className="pl-pick-list">
                  {filteredFoods.map((f) => (
                    <li key={f.id}>
                      <button type="button" className="pl-pick-item" onClick={() => chooseFood(f)}>
                        <span className="pl-pick-main">
                          <strong>{f.name}</strong>
                          <span>{f.category}</span>
                        </span>
                        <span className="pl-pick-side">
                          <strong>{f.calories ?? 0} kcal</strong>
                          <span>por {f.defaultQuantity ?? 100}{f.unit ?? 'g'}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn--primary" onClick={closePicker}>
                  Listo
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {mealToRemove && (
        <ConfirmModal
          title="Eliminar tiempo de comida"
          message={`"${mealToRemove.name}" tiene ${mealToRemove.items.length} alimento(s). ¿Eliminarlo del plan?`}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { removeMeal(mealToRemove.key); setMealToRemove(null) }}
          onCancel={() => setMealToRemove(null)}
        />
      )}
    </div>
  )
}
