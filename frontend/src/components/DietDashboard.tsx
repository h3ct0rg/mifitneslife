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

const MACRO_COLORS: Record<string, { bg: string; text: string; gradient: string }> = {
  Calorías: { bg: 'rgba(234, 179, 8, 0.15)', text: '#D97706', gradient: 'linear-gradient(90deg, #F59E0B, #FBBF24)' },
  Proteína: { bg: 'rgba(37, 99, 235, 0.15)', text: '#2563EB', gradient: 'linear-gradient(90deg, #2563EB, #60A5FA)' },
  Carbohidratos: { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', gradient: 'linear-gradient(90deg, #10B981, #34D399)' },
  Grasa: { bg: 'rgba(225, 29, 72, 0.15)', text: '#E11D48', gradient: 'linear-gradient(90deg, #E11D48, #FB7185)' },
  Fibra: { bg: 'rgba(147, 51, 234, 0.15)', text: '#9333EA', gradient: 'linear-gradient(90deg, #9333EA, #C084FC)' },
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

  if (loading) return <p className="loading">Cargando dieta asignada...</p>
  if (!diet) return null

  const goals = [
    { label: 'Calorías', value: diet.calories, goal: diet.goalCalories, unit: 'kcal', icon: 'local_fire_department' },
    { label: 'Proteína', value: diet.protein, goal: diet.goalProtein, unit: 'g', icon: 'fitness_center' },
    { label: 'Carbohidratos', value: diet.carbohydrates, goal: diet.goalCarbs, unit: 'g', icon: 'grain' },
    { label: 'Grasa', value: diet.fat, goal: diet.goalFat, unit: 'g', icon: 'opacity' },
    { label: 'Fibra', value: diet.fiber, goal: diet.goalFiber, unit: 'g', icon: 'eco' },
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
    <div className="card" style={{ background: 'var(--glass-level-1)', backdropFilter: 'blur(var(--glass-blur))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '1.4rem' }}>
              restaurant_menu
            </span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Dieta asignada: {diet.name}</h3>
          </div>
          {diet.objective && (
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted)', fontSize: '0.875rem' }}>
              {diet.objective}
            </p>
          )}
        </div>
        <span className="badge" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
          {diet.status}
        </span>
      </div>

      {/* Macronutrientes en tarjetas modernas */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
          Metas de Macronutrientes y Calorías Diarias
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {goals.map((g) => {
            const percentage = pct(g.value, g.goal)
            const styleTheme = MACRO_COLORS[g.label] || { bg: 'var(--primary-light)', text: 'var(--primary)', gradient: 'var(--primary)' }

            return (
              <div
                key={g.label}
                style={{
                  background: 'var(--glass-level-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  boxShadow: 'var(--glass-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: styleTheme.bg, color: styleTheme.text, padding: '0.35rem', borderRadius: '8px', display: 'flex' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{g.icon}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{g.label}</span>
                  </div>
                  {g.goal ? (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: styleTheme.text, background: styleTheme.bg, padding: '0.15rem 0.45rem', borderRadius: '999px', marginLeft: 'auto' }}>
                      {percentage}%
                    </span>
                  ) : null}
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
                  {Math.round(g.value)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}>/ {g.goal ? Math.round(g.goal) : '—'} {g.unit}</span>
                </div>

                {/* Progress bar con gradiente */}
                <div style={{ height: '7px', width: '100%', background: 'rgba(15, 23, 42, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: styleTheme.gradient,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Micronutrientes */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>
          Micronutrientes Diarios
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
          {micros.map((m) => (
            <div
              key={m.label}
              style={{
                background: 'var(--glass-level-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.825rem', color: 'var(--muted)' }}>{m.label}</span>
              <strong style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{Math.round(m.value)} {m.unit}</strong>
            </div>
          ))}
        </div>
      </div>

      {diet.observations && (
        <div style={{ background: 'var(--primary-light)', borderLeft: '4px solid var(--primary)', padding: '0.85rem 1.1rem', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', marginTop: '1rem' }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>Observaciones clínicas:</strong>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)' }}>{diet.observations}</p>
        </div>
      )}
    </div>
  )
}