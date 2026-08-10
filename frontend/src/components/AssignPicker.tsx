import { useCallback, useEffect, useRef, useState } from 'react'
import type { PagedResult } from '../api/types'

interface Item {
  id: string
  name: string
  meta?: string
}

interface Props {
  title: string
  subtitle: string
  emptyText: string
  load: (params: { search?: string; page: number; pageSize: number }) => Promise<PagedResult<Item>>
  onSelect: (id: string) => void
  onClear: () => void
  onCancel: () => void
  saving?: boolean
}

const PAGE_SIZE = 10

export default function AssignPicker({
  title,
  subtitle,
  emptyText,
  load,
  onSelect,
  onClear,
  onCancel,
  saving,
}: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'err'; text: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef(false)

  const doLoad = useCallback(async (p: number, s: string) => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await load({ search: s || undefined, page: p, pageSize: PAGE_SIZE })
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setMessage({ type: 'err', text: 'No se pudieron cargar los registros.' })
    } finally {
      setLoading(false)
    }
  }, [load])

  // Carga inicial (guard para StrictMode: solo una vez)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    doLoad(1, '')
  }, [doLoad])

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setAppliedSearch(value.trim())
      setPage(1)
    }, 350)
  }

  // Recarga al cambiar página o búsqueda aplicada
  useEffect(() => {
    if (initRef.current && (appliedSearch !== '' || page !== 1)) {
      doLoad(page, appliedSearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedSearch])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <div className="modal modal-diet-assign modal-picker" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>

        <div className="catalog-search">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {message && <div className={`alert ${message.type}`}>{message.text}</div>}

        <div className="assign-picker-list">
          <button type="button" className="diet-assign-option" onClick={onClear} disabled={saving}>
            <span className="diet-assign-name">Sin asignar</span>
            <span className="diet-assign-meta">Quitar el elemento actual</span>
          </button>

          {loading ? (
            <p className="loading">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="meal-empty">{emptyText}</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="diet-assign-option"
                onClick={() => onSelect(item.id)}
                disabled={saving}
              >
                <span className="diet-assign-name">{item.name}</span>
                {item.meta && <span className="diet-assign-meta">{item.meta}</span>}
              </button>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button type="button" className="btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button type="button" className="btn-ghost" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}