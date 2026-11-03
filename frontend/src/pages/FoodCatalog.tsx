import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { foodsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateFoodRequest, FoodDto } from '../api/types'
import FoodForm from '../components/FoodForm'
import Modal, { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

const PAGE_SIZE = 15
/** Parámetro de URL del editor: `?editar=nuevo` o `?editar=<id>` (el "atrás" del navegador lo cierra). */
const EDIT_PARAM = 'editar'
const NEW = 'nuevo'
const NARROW_QUERY = '(max-width: 900px)'

function kcalPct(calories: number, macro: number, factor: number) {
  if (!calories || calories <= 0 || macro <= 0) return 0
  return Math.round(((macro * factor) / calories) * 100)
}

/** Tono (clase `pl-tone-*` con tokens) por categoría. */
const CAT_TONES: Record<string, string> = {
  'Carnes': 'danger',
  'Pescados y mariscos': 'info',
  'Huevos y lácteos': 'kcal',
  'Legumbres': 'carbs',
  'Cereales y granos': 'warning',
  'Frutas': 'fat',
  'Verduras y hortalizas': 'success',
  'Frutos secos': 'kcal',
  'Aceites y grasas': 'warning',
  'Azúcares y dulces': 'fiber',
  'Bebidas': 'protein',
  'Suplementos': 'fiber',
  'Otro': 'neutral',
}
const toneClass = (cat: string) => `pl-tone-${CAT_TONES[cat] ?? 'neutral'}`

function subscribeNarrow(cb: () => void) {
  const mql = window.matchMedia(NARROW_QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}
const getNarrow = () => window.matchMedia(NARROW_QUERY).matches

const fmt = (v: number) => (v ? v.toFixed(1) : '0.0')

export default function FoodCatalog() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isNarrow = useSyncExternalStore(subscribeNarrow, getNarrow)

  const [items, setItems] = useState<FoodDto[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FoodDto | null>(null)
  const [toDelete, setToDelete] = useState<FoodDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [fetchedFood, setFetchedFood] = useState<FoodDto | null>(null)

  const editParam = searchParams.get(EDIT_PARAM)
  const editId = editParam && editParam !== NEW ? editParam : null

  const openEditor = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(EDIT_PARAM, value)
        return next
      },
      { state: { fromList: true } },
    )

  const closeEditor = useCallback(() => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1)
      return
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(EDIT_PARAM)
        return next
      },
      { replace: true },
    )
  }, [location.state, navigate, setSearchParams])

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await foodsApi.list({
        search: appliedSearch || undefined,
        category: category || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      })
      setItems(data.items)
      setTotal(data.total)
      setSelected((s) => (s ? data.items.find((i) => i.id === s.id) ?? null : null))
    } catch (err) {
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, category])

  const loadCategories = useCallback(() => {
    foodsApi.categories().then(setCategories).catch(() => undefined)
  }, [])

  useEffect(() => { load(page) }, [load, page])
  useEffect(() => { loadCategories() }, [loadCategories])

  // Filtro inmediato con debounce (sin botón "Buscar").
  useEffect(() => {
    const value = search.trim()
    if (value === appliedSearch) return
    const t = setTimeout(() => {
      setAppliedSearch(value)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search, appliedSearch])

  // Editor abierto por URL con un id que no está en la página actual : se consulta.
  const localFood = editId ? items.find((f) => f.id === editId) ?? null : null
  useEffect(() => {
    if (!editId || localFood || fetchedFood?.id === editId) return
    let cancelled = false
    foodsApi
      .getById(editId)
      .then((f) => { if (!cancelled) setFetchedFood(f) })
      .catch((err) => {
        if (cancelled) return
        toast.error(getErrorMessage(err))
        closeEditor()
      })
    return () => { cancelled = true }
  }, [editId, localFood, fetchedFood, toast, closeEditor])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selectCategory = (c: string) => {
    setCategory(c)
    setPage(1)
  }

  const handleSubmit = async (payload: CreateFoodRequest, editing?: FoodDto) => {
    if (editing) {
      await foodsApi.update(editing.id, { ...payload, status: 'Active' })
    } else {
      await foodsApi.create(payload)
    }
    closeEditor()
    toast.success(editing ? 'Alimento actualizado.' : 'Alimento creado.')
    if (editing) {
      await load(page)
    } else if (page !== 1) {
      setPage(1)
    } else {
      await load(1)
    }
    loadCategories()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await foodsApi.remove(toDelete.id)
      setSelected(null)
      setToDelete(null)
      toast.success('Alimento eliminado.')
      await load(page)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  // ── Editor a pantalla completa (sincronizado con la URL) ─────────────
  if (editParam) {
    const editing = editId ? localFood ?? (fetchedFood?.id === editId ? fetchedFood : null) : undefined
    if (editing === null) return <StateView state="loading" title="Cargando alimento..." />
    return (
      <FoodForm
        key={editParam}
        title={editing ? 'Editar alimento' : 'Nuevo alimento'}
        initial={editing}
        onSubmit={(payload) => handleSubmit(payload, editing)}
        onCancel={closeEditor}
      />
    )
  }

  const detailBody = (food: FoodDto) => (
    <div className={`fc-detail-content ${toneClass(food.category)}`}>
      <div className="fc-detail-header">
        <div className="fc-detail-badges">
          <span className="pl-cat-badge">{food.category}</span>
          {food.subcategory && <span className="badge badge--neutral">{food.subcategory}</span>}
        </div>
        {!isNarrow && <h2 className="fc-detail-name">{food.name}</h2>}
        {food.brand && (
          <p className="fc-detail-meta">
            <span className="material-symbols-outlined" aria-hidden="true">factory</span>
            {food.brand}
          </p>
        )}
        <p className="fc-detail-meta">Valores por {food.defaultQuantity}{food.unit}</p>
      </div>

      <div className="fc-detail-kcal">
        <p className="fc-kcal-main">
          <strong>{Math.round(food.calories)}</strong> <span>kcal</span>
        </p>
        <div className="fc-detail-macros">
          {[
            { label: 'Proteína', val: food.protein, tone: 'protein', pct: kcalPct(food.calories, food.protein, 4) },
            { label: 'Carbohidratos', val: food.carbohydrates, tone: 'carbs', pct: kcalPct(food.calories, food.carbohydrates, 4) },
            { label: 'Grasa total', val: food.fat, tone: 'fat', pct: kcalPct(food.calories, food.fat, 9) },
          ].map((m) => (
            <div key={m.label} className={`pl-macro-row pl-tone-${m.tone}`}>
              <div className="pl-macro-label">
                <span>{m.label}</span>
                <strong>{m.val.toFixed(1)} g <em>{m.pct}%</em></strong>
              </div>
              <div className="pl-macro-track" aria-hidden="true">
                <div className="pl-macro-fill" style={{ width: `${Math.min(100, m.pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fc-detail-micros">
        <h3 className="pl-subtitle">Micronutrientes</h3>
        <dl className="fc-micros-grid">
          {[
            { l: 'Fibra', v: `${(food.fiber ?? 0).toFixed(1)} g` },
            { l: 'Azúcares', v: `${(food.sugar ?? 0).toFixed(1)} g` },
            { l: 'Sodio', v: `${food.sodium ?? 0} mg` },
            { l: 'Potasio', v: `${food.potassium ?? 0} mg` },
            { l: 'Colesterol', v: `${food.cholesterol ?? 0} mg` },
            { l: 'Hierro', v: `${food.iron ?? 0} mg` },
            { l: 'Calcio', v: `${food.calcium ?? 0} mg` },
            { l: 'Código', v: food.code || '—' },
          ].map(({ l, v }) => (
            <div key={l} className="fc-micro-item">
              <dt>{l}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {food.description && <p className="fc-detail-desc">{food.description}</p>}
    </div>
  )

  const detailActions = (food: FoodDto) => (
    <>
      <button type="button" className="btn btn-danger-soft" onClick={() => setToDelete(food)}>
        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
        Eliminar
      </button>
      <button type="button" className="btn btn--primary" onClick={() => openEditor(food.id)}>
        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
        Editar
      </button>
    </>
  )

  return (
    <div className="pl-page">
      <PageHeader
        title="Catálogo de alimentos"
        subtitle={total > 0 ? `${total} alimentos en la base nutricional` : 'Base de datos nutricional'}
        actions={
          <button type="button" className="btn btn--primary pl-hide-mobile" onClick={() => openEditor(NEW)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Nuevo alimento
          </button>
        }
      />

      <div className="pl-filters">
        <div className="pl-search" role="search">
          <span className="material-symbols-outlined pl-search-icon" aria-hidden="true">search</span>
          <label htmlFor="fc-search" className="sr-only">Buscar alimento</label>
          <input
            id="fc-search"
            type="search"
            placeholder="Buscar alimento por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="fc-search-input"
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="pl-chips" role="group" aria-label="Filtrar por categoría">
          <button
            type="button"
            className="pl-chip"
            aria-pressed={category === ''}
            onClick={() => selectCategory('')}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`pl-chip ${toneClass(c)}`}
              aria-pressed={category === c}
              onClick={() => selectCategory(c)}
            >
              <span className="pl-chip-dot" aria-hidden="true" />
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="fc-layout">
        <div className="fc-table-card">
          <div className="fc-table-header" aria-hidden="true">
            <span>Alimento</span>
            <span>Categoría</span>
            <span className="fc-num">Porción</span>
            <span className="fc-num">Kcal</span>
            <span className="fc-num">Prot</span>
            <span className="fc-num">Carb</span>
            <span className="fc-num">Grasa</span>
          </div>

          {loading ? (
            <StateView state="loading" title="Cargando alimentos..." />
          ) : loadError ? (
            <StateView
              state="error"
              message={loadError}
              action={<button type="button" className="btn btn--ghost" onClick={() => load(page)}>Reintentar</button>}
            />
          ) : items.length === 0 ? (
            <StateView
              state="empty"
              icon="nutrition"
              title="Sin alimentos"
              message={appliedSearch || category ? 'No hay alimentos que coincidan con los filtros.' : 'Aún no hay alimentos en el catálogo.'}
              action={
                <button type="button" className="btn btn--secondary" onClick={() => openEditor(NEW)}>
                  Agregar alimento
                </button>
              }
            />
          ) : (
            <ul className="fc-table-body">
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`fc-row ${toneClass(f.category)} ${selected?.id === f.id ? 'active' : ''}`}
                    aria-pressed={selected?.id === f.id}
                    onClick={() => setSelected(selected?.id === f.id ? null : f)}
                  >
                    <span className="fc-td-name">
                      <span className="fc-cat-stripe" aria-hidden="true" />
                      <span className="fc-name-text">
                        <span className="fc-food-name">{f.name}</span>
                        {f.brand && <span className="fc-brand">{f.brand}</span>}
                      </span>
                    </span>
                    <span className="fc-td-cat">
                      <span className="pl-cat-badge">{f.category}</span>
                    </span>
                    <span className="fc-num fc-td-muted">{f.defaultQuantity}{f.unit}</span>
                    <span className="fc-num fc-td-cal">{Math.round(f.calories)}<span className="fc-unit-mobile"> kcal</span></span>
                    <span className="fc-num fc-td-prot"><span className="fc-unit-mobile">P </span>{fmt(f.protein)}g</span>
                    <span className="fc-num fc-td-carb"><span className="fc-unit-mobile">C </span>{fmt(f.carbohydrates)}g</span>
                    <span className="fc-num fc-td-fat"><span className="fc-unit-mobile">G </span>{fmt(f.fat)}g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="pagination pl-pagination">
              <button type="button" className="btn btn--ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button type="button" className="btn btn--ghost" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
                Siguiente
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {selected && !isNarrow && (
          <aside className="fc-detail" aria-label={`Detalle de ${selected.name}`}>
            {detailBody(selected)}
            <div className="fc-detail-actions">{detailActions(selected)}</div>
          </aside>
        )}
      </div>

      {selected && isNarrow && !toDelete && (
        <Modal title={selected.name} onClose={() => setSelected(null)} closeOnBackdrop footer={detailActions(selected)}>
          {detailBody(selected)}
        </Modal>
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar alimento"
          message={`¿Eliminar "${toDelete.name}" del catálogo? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <button type="button" className="pl-fab" onClick={() => openEditor(NEW)} aria-label="Nuevo alimento">
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  )
}
