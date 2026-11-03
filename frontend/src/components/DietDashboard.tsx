import { useCallback, useEffect, useId, useState } from 'react'
import { dietsApi } from '../api'
import type { DietDto, MealDto } from '../api/types'
import StateView from './ui/StateView'

interface Props {
  patientId: string
}

/** Normaliza "8:00", "08:00:00" o ISO a "HH:mm"; null si no hay hora válida. */
function formatTime(value?: string | null): string | null {
  if (!value) return null
  const m = /(\d{1,2}):(\d{2})/.exec(value)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function sortMeals(meals: MealDto[]): MealDto[] {
  return [...meals].sort((a, b) => {
    const bySort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySort !== 0) return bySort
    const ta = formatTime(a.scheduledTime) ?? '99:99'
    const tb = formatTime(b.scheduledTime) ?? '99:99'
    return ta.localeCompare(tb)
  })
}

const r0 = (n?: number) => Math.round(n ?? 0)

function pct(value: number, goal?: number) {
  if (!goal || goal <= 0) return 0
  return Math.min(100, Math.round((value / goal) * 100))
}

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  Active: { text: 'Activa', tone: 'badge--success' },
  Inactive: { text: 'Inactiva', tone: 'badge--neutral' },
  Draft: { text: 'Borrador', tone: 'badge--warning' },
}

function MacroLine({ kcal, p, c, g }: { kcal?: number; p?: number; c?: number; g?: number }) {
  return (
    <span className="diet-meal-macros">
      <strong>{r0(kcal)} kcal</strong>
      <span>P {r0(p)}g</span>
      <span>C {r0(c)}g</span>
      <span>G {r0(g)}g</span>
    </span>
  )
}

/** Icono y variante de chip por comida (solo presentación): colaciones en acento, el resto en soft. */
function mealVisual(name: string, time: string | null): { icon: string; chip: string } {
  const n = name.toLowerCase()
  const hour = time ? Number(time.slice(0, 2)) : null
  if (/merienda|colaci|snack|media/.test(n)) return { icon: 'nutrition', chip: 'icon-chip--accent' }
  if (/desayuno/.test(n) || (hour !== null && hour < 11)) return { icon: 'bakery_dining', chip: 'icon-chip--soft' }
  if (/almuerzo|comida/.test(n) || (hour !== null && hour < 16)) return { icon: 'lunch_dining', chip: 'icon-chip--soft' }
  if (/cena/.test(n) || (hour !== null && hour >= 19)) return { icon: 'dinner_dining', chip: 'icon-chip--soft' }
  return { icon: 'restaurant', chip: 'icon-chip--soft' }
}

const RING_R = 46
const RING_C = 2 * Math.PI * RING_R

/** Anillo de kcal con degradado --chart-1 → --chart-2 (MV-4). */
function KcalRing({ kcal, goal }: { kcal: number; goal?: number }) {
  const ratio = goal && goal > 0 ? Math.min(1, kcal / goal) : 1
  const gradId = `kcal-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <div className="kcal-ring">
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="kcal-ring-stop-1" />
            <stop offset="1" className="kcal-ring-stop-2" />
          </linearGradient>
        </defs>
        <circle className="kcal-ring-track" cx="56" cy="56" r={RING_R} fill="none" strokeWidth="12" />
        <circle
          className="kcal-ring-prog"
          cx="56"
          cy="56"
          r={RING_R}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          style={{ strokeDashoffset: RING_C * (1 - ratio) }}
        />
      </svg>
      <div className="kcal-ring-label">
        <b className="num">{r0(kcal).toLocaleString('es-ES')}</b>
        <span>{goal ? `de ${r0(goal).toLocaleString('es-ES')} kcal` : 'kcal al día'}</span>
      </div>
    </div>
  )
}

function MealPlan({ meals }: { meals: MealDto[] }) {
  return (
    <section className="diet-section" aria-labelledby="diet-meals-title">
      <h3 id="diet-meals-title" className="diet-section-title">
        Plan de comidas
      </h3>
      {meals.length === 0 ? (
        <p className="diet-meal-empty">Aún no se han definido las comidas de esta dieta.</p>
      ) : (
        <div className="diet-meals">
          {sortMeals(meals).map((meal) => {
            const time = formatTime(meal.scheduledTime)
            const items = meal.items ?? []
            const { icon, chip } = mealVisual(meal.name, time)
            return (
              <section key={meal.id} className="diet-meal" aria-label={meal.name}>
                <header className="diet-meal-head">
                  <span className={`icon-chip ${chip}`} aria-hidden="true">
                    <span className="material-symbols-outlined">{icon}</span>
                  </span>
                  <div className="diet-meal-title">
                    <strong>{meal.name}</strong>
                    {time && <span className="diet-meal-time num">{time}</span>}
                  </div>
                  <span className="diet-meal-kcal num">
                    {r0(meal.calories)}
                    <small>kcal</small>
                  </span>
                </header>
                <MacroLine kcal={meal.calories} p={meal.protein} c={meal.carbohydrates} g={meal.fat} />
                {meal.instructions && <p className="diet-meal-instructions">{meal.instructions}</p>}
                {items.length === 0 ? (
                  <p className="diet-meal-empty">Sin alimentos asignados</p>
                ) : (
                  <ul className="diet-meal-items">
                    {items.map((it) => (
                      <li key={it.id}>
                        <span className="diet-meal-food">
                          {it.foodName}
                          <span className="diet-meal-qty">
                            {' '}
                            · {it.quantity} {it.unit}
                          </span>
                        </span>
                        <MacroLine kcal={it.calories} p={it.protein} c={it.carbohydrates} g={it.fat} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function DietDashboard({ patientId }: Props) {
  const [diet, setDiet] = useState<DietDto | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dietsApi.getByPatient(patientId)
      setDiet(res.assigned ? res.diet : null)
    } catch {
      setDiet(null)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <StateView state="loading" title="Cargando dieta asignada..." />
  if (!diet) return null

  // `tone` = sufijo del token de macro (--color-kcal, --color-protein…), aplicado por clase.
  const goals = [
    { label: 'Calorías', value: diet.calories, goal: diet.goalCalories, unit: 'kcal', icon: 'local_fire_department', tone: 'kcal' },
    { label: 'Proteína', value: diet.protein, goal: diet.goalProtein, unit: 'g', icon: 'fitness_center', tone: 'protein' },
    { label: 'Carbohidratos', value: diet.carbohydrates, goal: diet.goalCarbs, unit: 'g', icon: 'grain', tone: 'carbs' },
    { label: 'Grasa', value: diet.fat, goal: diet.goalFat, unit: 'g', icon: 'opacity', tone: 'fat' },
    { label: 'Fibra', value: diet.fiber, goal: diet.goalFiber, unit: 'g', icon: 'eco', tone: 'fiber' },
  ]

  const micros = [
    { label: 'Azúcares', value: diet.sugar, unit: 'g' },
    { label: 'Sodio', value: diet.sodium, unit: 'mg' },
    { label: 'Potasio', value: diet.potassium, unit: 'mg' },
    { label: 'Colesterol', value: diet.cholesterol, unit: 'mg' },
    { label: 'Hierro', value: diet.iron, unit: 'mg' },
    { label: 'Calcio', value: diet.calcium, unit: 'mg' },
  ]

  const status = STATUS_LABEL[diet.status] ?? { text: diet.status, tone: 'badge--neutral' }
  const kcalPct = pct(diet.calories, diet.goalCalories)

  return (
    <section className="card diet-dashboard" aria-labelledby="diet-dashboard-title">
      {/* Resumen arriba: nombre, estado y calorías del día */}
      <header className="panel-head panel-head--top">
        <div>
          <p className="panel-eyebrow">Dieta asignada</p>
          <h2 id="diet-dashboard-title">{diet.name}</h2>
          {diet.objective && <p className="panel-subtitle">{diet.objective}</p>}
        </div>
        <span className={`badge ${status.tone}`}>{status.text}</span>
      </header>

      <div className="diet-kcal-summary">
        <KcalRing kcal={diet.calories} goal={diet.goalCalories} />
        <dl className="kcal-info">
          <div>
            <dt>Plan diario</dt>
            <dd className="num">{r0(diet.calories).toLocaleString('es-ES')} kcal</dd>
          </div>
          <div>
            <dt>Meta</dt>
            <dd className="num">{diet.goalCalories ? `${r0(diet.goalCalories).toLocaleString('es-ES')} kcal` : '—'}</dd>
          </div>
          {diet.goalCalories ? (
            <div>
              <dt>Cumplimiento</dt>
              <dd className="num">{kcalPct}%</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section className="diet-section" aria-labelledby="diet-goals-title">
        <h3 id="diet-goals-title" className="diet-section-title">
          Macronutrientes diarios
        </h3>
        <ul className="macro-goals">
          {goals.map((g) => {
            const percentage = pct(g.value, g.goal)
            return (
              <li key={g.label} className={`macro-goal macro-goal--${g.tone}`}>
                <div className="macro-goal-head">
                  <span className="macro-goal-icon material-symbols-outlined" aria-hidden="true">
                    {g.icon}
                  </span>
                  <span className="macro-goal-label">{g.label}</span>
                  {g.goal ? <span className="macro-goal-pct">{percentage}%</span> : null}
                </div>
                <p className="macro-goal-value">
                  {Math.round(g.value)}{' '}
                  <span>
                    / {g.goal ? Math.round(g.goal) : '—'} {g.unit}
                  </span>
                </p>
                <div
                  className="macro-goal-bar"
                  role="progressbar"
                  aria-label={`${g.label}: ${percentage}% de la meta`}
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span className="macro-goal-fill" style={{ width: `${percentage}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <MealPlan meals={diet.meals ?? []} />

      <section className="diet-section" aria-labelledby="diet-micros-title">
        <h3 id="diet-micros-title" className="diet-section-title">
          Micronutrientes diarios
        </h3>
        <dl className="micro-list">
          {micros.map((m) => (
            <div key={m.label} className="micro-list-item">
              <dt>{m.label}</dt>
              <dd>
                {Math.round(m.value)} {m.unit}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {diet.observations && (
        <aside className="diet-observations">
          <strong>Observaciones clínicas</strong>
          <p>{diet.observations}</p>
        </aside>
      )}
    </section>
  )
}
