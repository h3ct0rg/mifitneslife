import { useCallback, useEffect, useState } from 'react'
import { dietsApi, foodsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateDietRequest, DietDto, FoodDto } from '../api/types'
import DietBuilder from '../components/DietBuilder'

export default function DietPlans() {
  const [diets, setDiets] = useState<DietDto[]>([])
  const [foods, setFoods] = useState<FoodDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showForm, setShowForm] = useState<{ mode: 'create' } | { mode: 'edit'; diet: DietDto } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [dietData, foodData] = await Promise.all([
        dietsApi.list(),
        foodsApi.list({ page: 1, pageSize: 200 }),
      ])
      setDiets(dietData)
      setFoods(foodData.items)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (payload: CreateDietRequest) => {
    await dietsApi.create(payload)
    setShowForm(null)
    setMessage({ type: 'ok', text: '✅ Plan de dieta creado correctamente.' })
    await load()
  }

  const handleUpdate = async (id: string, payload: CreateDietRequest) => {
    await dietsApi.update(id, { ...payload, status: 'Active' })
    setShowForm(null)
    setMessage({ type: 'ok', text: '✅ Plan de dieta actualizado correctamente.' })
    await load()
  }

  const handleDelete = async (diet: DietDto) => {
    if (!window.confirm(`¿Eliminar el plan "${diet.name}"?`)) return
    try {
      await dietsApi.remove(diet.id)
      setMessage({ type: 'ok', text: '🗑️ Plan de dieta eliminado.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  // If form view is active, render DietBuilder inline as a full page
  if (showForm) {
    const editingDiet = showForm.mode === 'edit' ? showForm.diet : undefined
    return (
      <DietBuilder
        title={showForm.mode === 'create' ? 'Nuevo plan de dieta' : `Editar: ${editingDiet?.name ?? ''}`}
        initial={editingDiet}
        foods={foods}
        onSubmit={async (payload) => {
          if (editingDiet) {
            await handleUpdate(editingDiet.id, payload)
          } else {
            await handleCreate(payload)
          }
        }}
        onCancel={() => setShowForm(null)}
      />
    )
  }

  return (
    <div className="dp-page">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="dp-page-header">
        <div className="dp-header-left">
          <div className="dp-header-icon">🥗</div>
          <div>
            <h1 className="dp-page-title">Planes de Dieta</h1>
            <p className="dp-page-subtitle">
              {diets.length > 0 ? `${diets.length} planes creados` : 'Crea y gestiona planes dietéticos personalizados'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="dp-btn-new"
          onClick={() => setShowForm({ mode: 'create' })}
        >
          <span>+</span> Nuevo plan de dieta
        </button>
      </div>

      {/* ── Alert ────────────────────────────────────────────────── */}
      {message && (
        <div className={`fc-alert ${message.type === 'ok' ? 'fc-alert-ok' : 'fc-alert-err'}`}>
          {message.text}
          <button type="button" className="fc-alert-close" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* ── Content Grid ─────────────────────────────────────────── */}
      {loading ? (
        <div className="fc-loading">
          <div className="fc-loading-spinner" />
          <span>Cargando planes de dieta...</span>
        </div>
      ) : diets.length === 0 ? (
        <div className="fc-empty">
          <div className="fc-empty-icon">🥗</div>
          <p>Aún no hay planes de dieta creados.</p>
          <button
            type="button"
            className="dp-btn-new fc-empty-btn"
            onClick={() => setShowForm({ mode: 'create' })}
          >
            + Crear primer plan de dieta
          </button>
        </div>
      ) : (
        <div className="dp-grid">
          {diets.map((d) => (
            <article key={d.id} className="dp-card">
              <div className="dp-card-head">
                <div className="dp-card-title-wrap">
                  <h3 className="dp-card-title">{d.name}</h3>
                  {d.objective && <span className="dp-card-obj-badge">🎯 {d.objective}</span>}
                </div>
                <span className={`dp-status-badge ${d.status === 'Active' ? 'active' : ''}`}>
                  {d.status === 'Active' ? 'Activo' : d.status}
                </span>
              </div>

              {d.patientName && (
                <p className="dp-card-patient">👤 Paciente: <strong>{d.patientName}</strong></p>
              )}

              {/* Total Macros Banner */}
              <div className="dp-card-totals">
                <div className="dp-total-chip">
                  <span>🔥 Calorías</span>
                  <strong>{d.calories ?? 0} kcal</strong>
                </div>
                <div className="dp-total-chip">
                  <span>💪 Prot</span>
                  <strong>{d.protein ?? 0}g</strong>
                </div>
                <div className="dp-total-chip">
                  <span>🌾 Carb</span>
                  <strong>{d.carbohydrates ?? 0}g</strong>
                </div>
                <div className="dp-total-chip">
                  <span>🫒 Grasa</span>
                  <strong>{d.fat ?? 0}g</strong>
                </div>
              </div>

              {/* Meals Chips List */}
              {d.meals && d.meals.length > 0 && (
                <div className="dp-card-meals">
                  <span className="dp-meals-label">Tiempos de comida ({d.meals.length}):</span>
                  <div className="dp-meals-chips">
                    {d.meals.map((m) => (
                      <span key={m.id} className="dp-meal-chip">
                        {m.scheduledTime ? `⏰ ${m.scheduledTime} ` : ''}{m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="dp-card-actions">
                <button
                  type="button"
                  className="dp-btn-edit"
                  onClick={() => setShowForm({ mode: 'edit', diet: d })}
                >
                  ✏️ Editar plan
                </button>
                <button
                  type="button"
                  className="dp-btn-delete"
                  onClick={() => handleDelete(d)}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}