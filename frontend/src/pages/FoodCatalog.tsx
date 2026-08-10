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

// Map categories to color accents
const CAT_COLORS: Record<string, string> = {
  'Carnes': '#ef4444',
  'Pescados y mariscos': '#06b6d4',
  'Huevos y lácteos': '#f59e0b',
  'Legumbres': '#84cc16',
  'Cereales y granos': '#d97706',
  'Frutas': '#ec4899',
  'Verduras y hortalizas': '#22c55e',
  'Frutos secos': '#a16207',
  'Aceites y grasas': '#eab308',
  'Azúcares y dulces': '#e879f9',
  'Bebidas': '#38bdf8',
  'Suplementos': '#6366f1',
  'Otro': '#94a3b8',
}
function catColor(cat: string) { return CAT_COLORS[cat] ?? '#0078D4' }

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
  const [showForm, setShowForm] = useState<{ mode: 'create' } | { mode: 'edit'; food: FoodDto } | null>(null)

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

  useEffect(() => { load(page) }, [load])
  useEffect(() => { foodsApi.categories().then(setCategories).catch(() => undefined) }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  const handleCreate = async (payload: CreateFoodRequest) => {
    await foodsApi.create(payload)
    setShowForm(null)
    setMessage({ type: 'ok', text: '✅ Alimento creado correctamente.' })
    await load(1)
    foodsApi.categories().then(setCategories).catch(() => undefined)
  }

  const handleUpdate = async (id: string, payload: CreateFoodRequest) => {
    await foodsApi.update(id, { ...payload, status: 'Active' })
    setShowForm(null)
    setMessage({ type: 'ok', text: '✅ Alimento actualizado correctamente.' })
    await load(page)
  }

  const handleDelete = async (food: FoodDto) => {
    if (!window.confirm(`¿Eliminar "${food.name}"?`)) return
    try {
      await foodsApi.remove(food.id)
      setSelected(null)
      setMessage({ type: 'ok', text: '🗑️ Alimento eliminado.' })
      await load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const fmt = (v: number) => (v ? v.toFixed(1) : '0.0')

  // If form view is active, render it inline as full page
  if (showForm) {
    const editingFood = showForm.mode === 'edit' ? showForm.food : undefined
    return (
      <FoodForm
        title={showForm.mode === 'create' ? 'Nuevo alimento' : 'Editar alimento'}
        initial={editingFood}
        onSubmit={async (payload) => {
          if (editingFood) {
            await handleUpdate(editingFood.id, payload)
          } else {
            await handleCreate(payload)
          }
        }}
        onCancel={() => setShowForm(null)}
      />
    )
  }

  return (
    <div className="fc-page">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="fc-page-header">
        <div className="fc-header-left">
          <div className="fc-header-icon">🥗</div>
          <div>
            <h1 className="fc-page-title">Catálogo de Alimentos</h1>
            <p className="fc-page-subtitle">
              {total > 0 ? `${total} alimentos en la base de datos nutricional` : 'Base de datos nutricional'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="fc-btn-new"
          onClick={() => setShowForm({ mode: 'create' })}
        >
          <span>+</span> Nuevo alimento
        </button>
      </div>

      {/* ── Alert ────────────────────────────────────────────────── */}
      {message && (
        <div className={`fc-alert ${message.type === 'ok' ? 'fc-alert-ok' : 'fc-alert-err'}`}>
          {message.text}
          <button type="button" className="fc-alert-close" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="fc-filters">
        <form className="fc-search-form" onSubmit={handleSearch}>
          <span className="fc-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar alimento por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="fc-search-input"
          />
          <button type="submit" className="fc-search-btn">Buscar</button>
        </form>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          className="fc-cat-select"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* ── Category pills ────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="fc-cat-pills">
          <button
            type="button"
            className={`fc-cat-pill ${category === '' ? 'active' : ''}`}
            onClick={() => { setCategory(''); setPage(1) }}
          >
            Todas
          </button>
          {categories.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              className={`fc-cat-pill ${category === c ? 'active' : ''}`}
              style={category === c ? { background: catColor(c), color: '#fff', borderColor: catColor(c) } : { '--cat-color': catColor(c) } as React.CSSProperties}
              onClick={() => { setCategory(c); setPage(1) }}
            >
              <span
                className="fc-cat-dot"
                style={{ background: catColor(c) }}
              />
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────────────── */}
      <div className="fc-layout">

        {/* Table */}
        <div className="fc-table-card">
          <div className="fc-table-header">
            <span className="fc-th-name">Alimento</span>
            <span className="fc-th-cat">Categoría</span>
            <span className="fc-th-num">Porción</span>
            <span className="fc-th-num">Kcal</span>
            <span className="fc-th-num">Prot</span>
            <span className="fc-th-num">Carb</span>
            <span className="fc-th-num">Grasa</span>
          </div>

          <div className="fc-table-body">
            {loading ? (
              <div className="fc-loading">
                <div className="fc-loading-spinner" />
                <span>Cargando alimentos...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="fc-empty">
                <div className="fc-empty-icon">🥗</div>
                <p>No hay alimentos que coincidan con los filtros.</p>
                <button type="button" className="fc-btn-new fc-empty-btn" onClick={() => setShowForm({ mode: 'create' })}>
                  + Agregar primer alimento
                </button>
              </div>
            ) : (
              items.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`fc-row ${selected?.id === f.id ? 'active' : ''}`}
                  onClick={() => setSelected(selected?.id === f.id ? null : f)}
                >
                  <span className="fc-td-name">
                    <span
                      className="fc-cat-stripe"
                      style={{ background: catColor(f.category) }}
                    />
                    <span className="fc-food-name">{f.name}</span>
                    {f.brand && <span className="fc-brand">{f.brand}</span>}
                  </span>
                  <span className="fc-td-cat">
                    <span className="fc-cat-badge" style={{ background: catColor(f.category) + '22', color: catColor(f.category) }}>
                      {f.category}
                    </span>
                  </span>
                  <span className="fc-td-num fc-td-muted">{f.defaultQuantity}{f.unit}</span>
                  <span className="fc-td-num fc-td-cal">{Math.round(f.calories)}</span>
                  <span className="fc-td-num fc-td-prot">{fmt(f.protein)}g</span>
                  <span className="fc-td-num fc-td-carb">{fmt(f.carbohydrates)}g</span>
                  <span className="fc-td-num fc-td-fat">{fmt(f.fat)}g</span>
                </button>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="fc-pagination">
              <button
                type="button"
                className="fc-page-btn"
                disabled={page <= 1}
                onClick={() => { setPage(page - 1); load(page - 1) }}
              >
                ← Anterior
              </button>
              <div className="fc-page-info">
                <span>Página</span>
                <strong>{page}</strong>
                <span>de {totalPages}</span>
              </div>
              <button
                type="button"
                className="fc-page-btn"
                disabled={page >= totalPages}
                onClick={() => { setPage(page + 1); load(page + 1) }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <aside className="fc-detail">
            <div className="fc-detail-header" style={{ borderTopColor: catColor(selected.category) }}>
              <div className="fc-detail-badges">
                <span className="fc-detail-cat-badge" style={{ background: catColor(selected.category) }}>
                  {selected.category}
                </span>
                {selected.subcategory && (
                  <span className="fc-detail-sub-badge">{selected.subcategory}</span>
                )}
              </div>
              <h3 className="fc-detail-name">{selected.name}</h3>
              {selected.brand && <p className="fc-detail-brand">🏭 {selected.brand}</p>}
              <p className="fc-detail-serving">por {selected.defaultQuantity}{selected.unit}</p>
            </div>

            {/* Kcal hero */}
            <div className="fc-detail-kcal">
              <div>
                <strong>{Math.round(selected.calories)}</strong>
                <span>kcal</span>
              </div>
              <div className="fc-kcal-sub">
                <div>
                  <span>💪 Prot</span>
                  <strong>{fmt(selected.protein)}g</strong>
                </div>
                <div>
                  <span>🌾 Carb</span>
                  <strong>{fmt(selected.carbohydrates)}g</strong>
                </div>
                <div>
                  <span>🫒 Grasa</span>
                  <strong>{fmt(selected.fat)}g</strong>
                </div>
              </div>
            </div>

            {/* Macro bars */}
            <div className="fc-detail-macros">
              {[
                { label: 'Proteína', val: selected.protein, color: '#2170e4', pct: kcalPct(selected.calories, selected.protein, 4) },
                { label: 'Carbohidratos', val: selected.carbohydrates, color: '#e29100', pct: kcalPct(selected.calories, selected.carbohydrates, 4) },
                { label: 'Grasa total', val: selected.fat, color: '#ef4444', pct: kcalPct(selected.calories, selected.fat, 9) },
              ].map((m) => (
                <div key={m.label} className="fc-macro-row">
                  <div className="fc-macro-label">
                    <span>{m.label}</span>
                    <strong>{m.val.toFixed(1)}g <em>{m.pct}%</em></strong>
                  </div>
                  <div className="fc-macro-track">
                    <div
                      className="fc-macro-fill"
                      style={{ width: `${Math.min(100, m.pct)}%`, background: m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Micros */}
            <div className="fc-detail-micros">
              <h4 className="fc-detail-micros-title">Micronutrientes</h4>
              <div className="fc-micros-grid">
                {[
                  { l: 'Fibra', v: `${(selected.fiber ?? 0).toFixed(1)}g` },
                  { l: 'Azúcares', v: `${(selected.sugar ?? 0).toFixed(1)}g` },
                  { l: 'Sodio', v: `${selected.sodium ?? 0}mg` },
                  { l: 'Potasio', v: `${selected.potassium ?? 0}mg` },
                  { l: 'Colesterol', v: `${selected.cholesterol ?? 0}mg` },
                  { l: 'Hierro', v: `${selected.iron ?? 0}mg` },
                  { l: 'Calcio', v: `${selected.calcium ?? 0}mg` },
                  { l: 'Código', v: selected.code ?? '—' },
                ].map(({ l, v }) => (
                  <div key={l} className="fc-micro-item">
                    <span>{l}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            </div>

            {selected.description && (
              <p className="fc-detail-desc">{selected.description}</p>
            )}

            <div className="fc-detail-actions">
              <button
                type="button"
                className="fc-detail-edit"
                onClick={() => setShowForm({ mode: 'edit', food: selected })}
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                className="fc-detail-delete"
                onClick={() => handleDelete(selected)}
              >
                🗑️ Eliminar
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
