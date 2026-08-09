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
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; diet: DietDto } | null>(null)

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
    try {
      await dietsApi.create(payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Plan de dieta creado correctamente.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleUpdate = async (id: string, payload: CreateDietRequest) => {
    try {
      await dietsApi.update(id, { ...payload, status: 'Active' })
      setModal(null)
      setMessage({ type: 'ok', text: 'Plan de dieta actualizado correctamente.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async (diet: DietDto) => {
    if (!window.confirm(`¿Eliminar el plan "${diet.name}"?`)) return
    try {
      await dietsApi.remove(diet.id)
      setMessage({ type: 'ok', text: 'Plan de dieta eliminado.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  return (
    <div className="page page-wide">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header catalog-toolbar">
        <div>
          <h2>Planes de dieta</h2>
          <p className="catalog-subtitle">Crea y gestiona planes dietéticos personalizados.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'create' })}>
            + Nuevo plan
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Cargando...</p>
      ) : diets.length === 0 ? (
        <div className="empty-state">Aún no hay planes de dieta. Crea el primero.</div>
      ) : (
        <div className="diet-plans-grid">
          {diets.map((d) => (
            <article key={d.id} className="diet-plan-card">
              <div className="diet-plan-head">
                <h3>{d.name}</h3>
                <span className="badge">{d.status}</span>
              </div>
              {d.objective && <p className="diet-plan-objective">{d.objective}</p>}
              {d.patientName && <p className="diet-plan-patient">Paciente: {d.patientName}</p>}
              <div className="diet-plan-totals">
                <div><span>Kcal</span><strong>{d.calories}</strong></div>
                <div><span>Prot</span><strong>{d.protein}g</strong></div>
                <div><span>Carb</span><strong>{d.carbohydrates}g</strong></div>
                <div><span>Grasa</span><strong>{d.fat}g</strong></div>
              </div>
              <div className="diet-plan-meals">
                {d.meals.map((m) => (
                  <span key={m.id} className="diet-plan-meal-chip">
                    {m.scheduledTime ? `${m.scheduledTime} ` : ''}{m.name}
                  </span>
                ))}
              </div>
              <div className="diet-plan-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'edit', diet: d })}>Editar</button>
                <button type="button" className="btn-danger-soft" onClick={() => handleDelete(d)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <DietBuilder
          title={modal.mode === 'create' ? 'Nuevo plan de dieta' : `Editar: ${modal.diet.name}`}
          initial={modal.mode === 'edit' ? modal.diet : undefined}
          foods={foods}
          onSubmit={modal.mode === 'create'
            ? handleCreate
            : (payload) => handleUpdate(modal.diet.id, payload)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}