import { useCallback, useEffect, useState } from 'react'
import { dietsApi } from '../api'
import type { DietDto } from '../api/types'

interface Props {
  patientId: string
}

function pct(value: number, goal?: number) {
  if (!goal || goal <= 0) return 0
  return Math.min(100, Math.round((value / goal) * 100))
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

  if (loading) return <p className="loading">Cargando dieta...</p>
  if (!diet) return null

  const goals = [
    { label: 'Calorías', value: diet.calories, goal: diet.goalCalories, unit: 'kcal', color: 'kcal' },
    { label: 'Proteína', value: diet.protein, goal: diet.goalProtein, unit: 'g', color: 'protein' },
    { label: 'Carbohidratos', value: diet.carbohydrates, goal: diet.goalCarbs, unit: 'g', color: 'carbs' },
    { label: 'Grasa', value: diet.fat, goal: diet.goalFat, unit: 'g', color: 'fat' },
    { label: 'Fibra', value: diet.fiber, goal: diet.goalFiber, unit: 'g', color: 'fiber' },
  ]

  const micros = [
    { label: 'Azúcares', value: diet.sugar, unit: 'g' },
    { label: 'Sodio', value: diet.sodium, unit: 'mg' },
    { label: 'Potasio', value: diet.potassium, unit: 'mg' },
    { label: 'Colesterol', value: diet.cholesterol, unit: 'mg' },
    { label: 'Hierro', value: diet.iron, unit: 'mg' },
    { label: 'Calcio', value: diet.calcium, unit: 'mg' },
  ]

  return (
    <div className="diet-dashboard">
      <div className="diet-dashboard-head">
        <div>
          <h3>Dieta asignada: {diet.name}</h3>
          {diet.objective && <p className="diet-dashboard-objective">{diet.objective}</p>}
        </div>
        <span className="badge">{diet.status}</span>
      </div>

      <div className="diet-dashboard-section">
        <h4>Macronutrientes y calorías diarias</h4>
        <div className="diet-dashboard-goals">
          {goals.map((g) => (
            <div key={g.label} className="diet-dash-goal">
              <div className="diet-dash-goal-label">
                <span>{g.label}</span>
                <strong>
                  {Math.round(g.value)}
                  {g.goal ? ` / ${Math.round(g.goal)} ${g.unit}` : ` ${g.unit}`}
                </strong>
              </div>
              <div className="diet-dash-goal-bar">
                <div className={`diet-dash-fill ${g.color}`} style={{ width: `${pct(g.value, g.goal)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="diet-dashboard-section">
        <h4>Micronutrientes diarios</h4>
        <div className="diet-dashboard-micros">
          {micros.map((m) => (
            <div key={m.label} className="diet-dash-micro">
              <span>{m.label}</span>
              <strong>{Math.round(m.value)} {m.unit}</strong>
            </div>
          ))}
        </div>
      </div>

      {diet.observations && (
        <div className="diet-dashboard-notes">
          <h4>Observaciones</h4>
          <p>{diet.observations}</p>
        </div>
      )}
    </div>
  )
}