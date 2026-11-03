import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { exercisesApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateExerciseRequest, ExerciseDto } from '../api/types'
import ExerciseForm from '../components/ExerciseForm'
import ExerciseMedia from '../components/ExerciseMedia'
import Modal, { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

const PAGE_SIZE = 18
/** Parámetro de URL del formulario: `?editar=nuevo` o `?editar=<id>` (el "atrás" del navegador lo cierra). */
const EDIT_PARAM = 'editar'
const NEW = 'nuevo'

const mediaFallback = (
  <span className="material-symbols-outlined pl-media-empty" aria-hidden="true">fitness_center</span>
)

export default function Exercises() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExerciseDto | null>(null)
  const [toDelete, setToDelete] = useState<ExerciseDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [fetchedExercise, setFetchedExercise] = useState<ExerciseDto | null>(null)

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
      setLoadError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, category, equip])

  const loadFilters = useCallback(() => {
    exercisesApi.categories().then(setCategories).catch(() => undefined)
    exercisesApi.equipment().then(setEquipment).catch(() => undefined)
  }, [])

  useEffect(() => { load(page) }, [load, page])
  useEffect(() => { loadFilters() }, [loadFilters])

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

  // Formulario abierto por URL con un id que no está en la página actual : se consulta.
  const localExercise = editId ? items.find((x) => x.id === editId) ?? (selected?.id === editId ? selected : null) : null
  useEffect(() => {
    if (!editId || localExercise || fetchedExercise?.id === editId) return
    let cancelled = false
    exercisesApi
      .getById(editId)
      .then((x) => { if (!cancelled) setFetchedExercise(x) })
      .catch((err) => {
        if (cancelled) return
        toast.error(getErrorMessage(err))
        closeEditor()
      })
    return () => { cancelled = true }
  }, [editId, localExercise, fetchedExercise, toast, closeEditor])

  const editing = editId ? localExercise ?? (fetchedExercise?.id === editId ? fetchedExercise : null) : undefined

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSubmit = async (payload: CreateExerciseRequest) => {
    if (editing) {
      const updated = await exercisesApi.update(editing.id, { ...payload, status: 'Active' })
      if (selected?.id === editing.id) setSelected(updated ?? null)
    } else {
      await exercisesApi.create(payload)
    }
    closeEditor()
    toast.success(editing ? 'Ejercicio actualizado.' : 'Ejercicio creado.')
    if (editing || page === 1) await load(page)
    else setPage(1)
    loadFilters()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await exercisesApi.remove(toDelete.id)
      setToDelete(null)
      setSelected(null)
      toast.success('Ejercicio eliminado.')
      await load(page)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const editorOpen = !!editParam

  return (
    <div className="pl-page">
      <PageHeader
        title="Ejercicios"
        subtitle="Catálogo de ejercicios con animaciones y guía de ejecución"
        actions={
          <button type="button" className="btn btn--primary pl-hide-mobile" onClick={() => openEditor(NEW)}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            Nuevo ejercicio
          </button>
        }
      />

      <div className="pl-filters">
        <div className="pl-search" role="search">
          <span className="material-symbols-outlined pl-search-icon" aria-hidden="true">search</span>
          <label htmlFor="ex-search" className="sr-only">Buscar ejercicio</label>
          <input
            id="ex-search"
            type="search"
            placeholder="Buscar por nombre o músculo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="fc-search-input"
          />
        </div>
        <label htmlFor="ex-category" className="sr-only">Categoría</label>
        <select id="ex-category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label htmlFor="ex-equipment" className="sr-only">Equipamiento</label>
        <select id="ex-equipment" value={equip} onChange={(e) => { setEquip(e.target.value); setPage(1) }}>
          <option value="">Todo el equipamiento</option>
          {equipment.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {loading ? (
        <StateView state="loading" title="Cargando ejercicios..." />
      ) : loadError ? (
        <StateView
          state="error"
          message={loadError}
          action={<button type="button" className="btn btn--ghost" onClick={() => load(page)}>Reintentar</button>}
        />
      ) : items.length === 0 ? (
        <StateView
          state="empty"
          icon="fitness_center"
          title="Sin ejercicios"
          message={appliedSearch || category || equip ? 'No hay ejercicios que coincidan con los filtros.' : 'Aún no hay ejercicios registrados.'}
          action={
            <button type="button" className="btn btn--secondary" onClick={() => openEditor(NEW)}>
              Agregar ejercicio
            </button>
          }
        />
      ) : (
        <ul className="ex-grid">
          {items.map((ex) => (
            <li key={ex.id}>
              <button type="button" className="ex-card card--link" onClick={() => setSelected(ex)}>
                <span className="ex-media">
                  <ExerciseMedia gifUrl={ex.gifUrl} imageUrl={ex.imageUrl} alt="" className="ex-img" fallback={mediaFallback} />
                </span>
                <span className="ex-card-body">
                  <span className="ex-card-title">{ex.name}</span>
                  <span className="ex-tags">
                    <span className="badge badge--info">{ex.category}</span>
                    <span className="badge badge--neutral">{ex.equipment}</span>
                  </span>
                  {ex.target && <span className="pl-muted">Músculo: {ex.target}</span>}
                </span>
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
          <span>Página {page} de {totalPages} · {total} ejercicios</span>
          <button type="button" className="btn btn--ghost" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
            Siguiente
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      )}

      {selected && !editorOpen && !toDelete && (
        <Modal
          title={selected.name}
          onClose={() => setSelected(null)}
          className="ex-detail"
          closeOnBackdrop
          footer={
            <>
              <button type="button" className="btn btn-danger-soft" onClick={() => setToDelete(selected)}>
                <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                Eliminar
              </button>
              <button type="button" className="btn btn--primary" onClick={() => openEditor(selected.id)}>
                <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                Editar
              </button>
            </>
          }
        >
          <div className="ex-detail-media">
            <ExerciseMedia gifUrl={selected.gifUrl} imageUrl={selected.imageUrl} alt={selected.name} className="ex-img" fallback={mediaFallback} />
          </div>
          <div className="ex-tags">
            <span className="badge badge--info">{selected.category}</span>
            <span className="badge badge--neutral">{selected.equipment}</span>
            {selected.target && <span className="badge badge--neutral">Músculo: {selected.target}</span>}
          </div>
          {selected.instructions && (
            <div className="ex-instructions">
              <h3 className="pl-subtitle">Instrucciones</h3>
              <p>{selected.instructions}</p>
            </div>
          )}
        </Modal>
      )}

      {editorOpen && editing === null && (
        <Modal title="Cargando ejercicio" onClose={closeEditor}>
          <StateView state="loading" compact />
        </Modal>
      )}

      {editorOpen && editing !== null && (
        <ExerciseForm
          key={editParam}
          title={editing ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          initial={editing}
          categories={categories}
          equipment={equipment}
          onSubmit={handleSubmit}
          onCancel={closeEditor}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar ejercicio"
          message={`¿Eliminar "${toDelete.name}" del catálogo? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <button type="button" className="pl-fab" onClick={() => openEditor(NEW)} aria-label="Nuevo ejercicio">
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  )
}
