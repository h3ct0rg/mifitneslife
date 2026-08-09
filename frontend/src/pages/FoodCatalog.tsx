import { useCallback, useEffect, useState } from 'react'
import { foodsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateFoodRequest, FoodDto } from '../api/types'
import FoodForm from '../components/FoodForm'

const PAGE_SIZE = 15

function kcalPct(calories: number, macro: number, factor: number) {
  if (!calories || calories <= 0 || macro <= 0) return 0
  return Math.round(((macro * factor) / calories) * 100)
}

export default function FoodCatalog() {
  const [items, setItems] = useState<FoodDto[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selected, setSelected] = useState<FoodDto | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; food: FoodDto } | null>(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await foodsApi.list({
        search: appliedSearch || undefined,
        category: category || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      })
      setItems(data.items)
      setTotal(data.total)
      setSelected(null)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, category])

  useEffect(() => {
    load(page)
  }, [load])

  useEffect(() => {
    foodsApi.categories().then(setCategories).catch(() => undefined)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  const selectFood = async (food: FoodDto) => {
    setSelected(food)
  }

  const handleCreate = async (payload: CreateFoodRequest) => {
    try {
      await foodsApi.create(payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Alimento creado correctamente.' })
      await load(1)
      foodsApi.categories().then(setCategories).catch(() => undefined)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleUpdate = async (id: string, payload: CreateFoodRequest) => {
    try {
      await foodsApi.update(id, { ...payload, status: 'Active' })
      setModal(null)
      setMessage({ type: 'ok', text: 'Alimento actualizado correctamente.' })
      await load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async (food: FoodDto) => {
    if (!window.confirm(`¿Eliminar "${food.name}"?`)) return
    try {
      await foodsApi.remove(food.id)
      setModal(null)
      setMessage({ type: 'ok', text: 'Alimento eliminado.' })
      await load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const fmt = (v: number) => (v ? v.toFixed(1) : '0.0')

  return (
    <div className="page page-wide">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header catalog-toolbar">
        <div>
          <h2>Catálogo de Alimentos</h2>
          <p className="catalog-subtitle">Gestiona y consulta la base de datos nutricional de tus pacientes.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'create' })}>
            + Nuevo Alimento
          </button>
        </div>
      </div>

      <div className="catalog-filters">
        <form className="catalog-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Buscar alimento por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-ghost">Buscar</button>
        </form>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="catalog-layout">
        <div className="catalog-table-card">
          <div className="food-table-header">
            <span className="ft-col-name">Nombre del Alimento</span>
            <span className="ft-col-cat">Categoría</span>
            <span className="ft-col-num">Porción</span>
            <span className="ft-col-num">Cal (kcal)</span>
            <span className="ft-col-num">Prot (g)</span>
            <span className="ft-col-num">Carb (g)</span>
            <span className="ft-col-num">Grasa (g)</span>
          </div>
          <div className="food-table-body">
            {loading ? (
              <p className="loading">Cargando...</p>
            ) : items.length === 0 ? (
              <div className="empty-state">No hay alimentos registrados.</div>
            ) : (
              items.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`food-row ${selected?.id === f.id ? 'active' : ''}`}
                  onClick={() => selectFood(f)}
                >
                  <span className="ft-col-name food-name">{f.name}</span>
                  <span className="ft-col-cat">
                    <i className="food-cat-dot" />
                    {f.category}
                  </span>
                  <span className="ft-col-num">{f.defaultQuantity}{f.unit}</span>
                  <span className="ft-col-num ft-cal">{Math.round(f.calories)}</span>
                  <span className="ft-col-num">{fmt(f.protein)}</span>
                  <span className="ft-col-num">{fmt(f.carbohydrates)}</span>
                  <span className="ft-col-num">{fmt(f.fat)}</span>
                </button>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1) }}>
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button type="button" className="btn-ghost" disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1) }}>
                Siguiente
              </button>
            </div>
          )}
        </div>

        {selected && (
          <aside className="food-detail-panel">
            <div className="food-detail-head">
              <div className="food-detail-badges">
                <span className="badge">{selected.category}</span>
                {selected.subcategory && <span className="badge badge-outline">{selected.subcategory}</span>}
              </div>
              <h3>{selected.name}</h3>
              <p className="food-detail-unit">
                Valores por {selected.defaultQuantity}{selected.unit}
              </p>
            </div>

            <div className="food-detail-kcal">
              <strong>{Math.round(selected.calories)}</strong>
              <span>kcal</span>
            </div>

            <div className="food-detail-section">
              <h4>Macros</h4>
              {[
                { label: 'Proteína', value: selected.protein, color: 'macro-protein', pct: kcalPct(selected.calories, selected.protein, 4) },
                { label: 'Grasa total', value: selected.fat, color: 'macro-fat', pct: kcalPct(selected.calories, selected.fat, 9) },
                { label: 'Carbohidratos', value: selected.carbohydrates, color: 'macro-carb', pct: kcalPct(selected.calories, selected.carbohydrates, 4) },
              ].map((m) => (
                <div key={m.label} className="macro-row">
                  <div className="macro-label">
                    <span>{m.label}</span>
                    <strong>{m.value.toFixed(1)}g</strong>
                  </div>
                  <div className="macro-bar">
                    <div className={`macro-fill ${m.color}`} style={{ width: `${Math.min(100, m.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="food-detail-section">
              <h4>Micronutrientes</h4>
              <div className="micro-grid">
                <div className="micro-item"><span>Fibra</span><strong>{selected.fiber.toFixed(1)}g</strong></div>
                <div className="micro-item"><span>Azúcares</span><strong>{selected.sugar.toFixed(1)}g</strong></div>
                <div className="micro-item"><span>Sodio</span><strong>{selected.sodium}mg</strong></div>
                <div className="micro-item"><span>Potasio</span><strong>{selected.potassium}mg</strong></div>
                <div className="micro-item"><span>Colesterol</span><strong>{selected.cholesterol}mg</strong></div>
                <div className="micro-item"><span>Hierro</span><strong>{selected.iron}mg</strong></div>
                <div className="micro-item"><span>Calcio</span><strong>{selected.calcium}mg</strong></div>
                <div className="micro-item"><span>Código</span><strong>{selected.code ?? '—'}</strong></div>
              </div>
            </div>

            <div className="food-detail-actions">
              <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'edit', food: selected })}>
                Editar
              </button>
              <button type="button" className="btn-danger-soft" onClick={() => handleDelete(selected)}>
                Eliminar
              </button>
            </div>
          </aside>
        )}
      </div>

      {modal && (
        <FoodForm
          title={modal.mode === 'create' ? 'Nuevo alimento' : 'Editar alimento'}
          initial={modal.mode === 'edit' ? modal.food : undefined}
          onSubmit={modal.mode === 'create'
            ? handleCreate
            : (payload) => handleUpdate(modal.food.id, payload)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}