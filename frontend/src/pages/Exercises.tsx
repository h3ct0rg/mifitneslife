import { useCallback, useEffect, useState } from 'react'
import { exercisesApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateExerciseRequest, ExerciseDto } from '../api/types'
import ExerciseForm from '../components/ExerciseForm'
import ExerciseMedia from '../components/ExerciseMedia'

const PAGE_SIZE = 18

export default function Exercises() {
  const [items, setItems] = useState<ExerciseDto[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [equipment, setEquipment] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [equip, setEquip] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; exercise: ExerciseDto } | null>(null)
  const [selected, setSelected] = useState<ExerciseDto | null>(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await exercisesApi.list({
        search: appliedSearch || undefined,
        category: category || undefined,
        equipment: equip || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, category, equip])

  useEffect(() => {
    load(page)
  }, [load])

  useEffect(() => {
    exercisesApi.categories().then(setCategories).catch(() => undefined)
    exercisesApi.equipment().then(setEquipment).catch(() => undefined)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedSearch(search.trim())
    setPage(1)
  }

  const handleCreate = async (payload: CreateExerciseRequest) => {
    try {
      await exercisesApi.create(payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Ejercicio creado correctamente.' })
      await load(1)
      exercisesApi.categories().then(setCategories).catch(() => undefined)
      exercisesApi.equipment().then(setEquipment).catch(() => undefined)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleUpdate = async (id: string, payload: CreateExerciseRequest) => {
    try {
      await exercisesApi.update(id, { ...payload, status: 'Active' })
      setModal(null)
      setMessage({ type: 'ok', text: 'Ejercicio actualizado correctamente.' })
      await load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async (exercise: ExerciseDto) => {
    if (!window.confirm(`¿Eliminar "${exercise.name}"?`)) return
    try {
      await exercisesApi.remove(exercise.id)
      setModal(null)
      setSelected(null)
      setMessage({ type: 'ok', text: 'Ejercicio eliminado.' })
      await load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  return (
    <div className="page page-wide">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header catalog-toolbar">
        <div>
          <h2>Ejercicios</h2>
          <p className="catalog-subtitle">Catálogo de ejercicios con animaciones y guía de ejecución.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'create' })}>
            + Nuevo ejercicio
          </button>
        </div>
      </div>

      <div className="catalog-filters">
        <form className="catalog-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Buscar ejercicio por nombre o músculo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-ghost">Buscar</button>
        </form>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={equip} onChange={(e) => { setEquip(e.target.value); setPage(1) }}>
          <option value="">Todo el equipamiento</option>
          {equipment.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="loading">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay ejercicios registrados.</div>
      ) : (
        <div className="exercise-grid">
          {items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="exercise-card"
              onClick={() => setSelected(ex)}
            >
              <div className="exercise-media">
                <ExerciseMedia gifUrl={ex.gifUrl} imageUrl={ex.imageUrl} alt={ex.name} className="exercise-img" />
                {!ex.gifUrl && !ex.imageUrl && <div className="exercise-media-empty">🎯</div>}
              </div>
              <div className="exercise-card-body">
                <h3>{ex.name}</h3>
                <div className="exercise-tags">
                  <span className="badge">{ex.category}</span>
                  <span className="badge badge-outline">{ex.equipment}</span>
                </div>
                {ex.target && <p className="exercise-target">Músculo: {ex.target}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1) }}>
            Anterior
          </button>
          <span>Página {page} de {totalPages} · {total} ejercicios</span>
          <button type="button" className="btn-ghost" disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1) }}>
            Siguiente
          </button>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-exercise" onClick={(e) => e.stopPropagation()}>
            <div className="modal-exercise-head">
              <h2>{selected.name}</h2>
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="exercise-detail-media">
              <ExerciseMedia gifUrl={selected.gifUrl} imageUrl={selected.imageUrl} alt={selected.name} className="exercise-img" />
              {!selected.gifUrl && !selected.imageUrl && <div className="exercise-media-empty">🎯</div>}
            </div>
            <div className="exercise-tags">
              <span className="badge">{selected.category}</span>
              <span className="badge badge-outline">{selected.equipment}</span>
              {selected.target && <span className="badge badge-outline">Músculo: {selected.target}</span>}
            </div>
            {selected.instructions && (
              <div className="exercise-instructions">
                <h3>Instrucciones</h3>
                <p>{selected.instructions}</p>
              </div>
            )}
            <div className="modal-actions modal-actions-between">
              <button type="button" className="btn-danger-soft" onClick={() => handleDelete(selected)}>
                Eliminar
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
                <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'edit', exercise: selected })}>
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <ExerciseForm
          title={modal.mode === 'create' ? 'Nuevo ejercicio' : 'Editar ejercicio'}
          initial={modal.mode === 'edit' ? modal.exercise : undefined}
          categories={categories}
          equipment={equipment}
          onSubmit={modal.mode === 'create'
            ? handleCreate
            : (payload) => handleUpdate(modal.exercise.id, payload)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}