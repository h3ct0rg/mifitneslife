import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { measurementsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateMeasurementRequest, MeasurementDto } from '../api/types'
import MeasurementForm from '../components/MeasurementForm'

const PAGE_SIZE = 10

export default function MeasurementHistory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [items, setItems] = useState<MeasurementDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; measurement: MeasurementDto } | null>(null)

  const load = useCallback(async (p = 1) => {
    if (!id) return
    setLoading(true)
    setMessage(null)
    try {
      const data = await measurementsApi.list(id, { page: p, pageSize: PAGE_SIZE })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleCreate = async (payload: CreateMeasurementRequest) => {
    if (!id) return
    try {
      await measurementsApi.create(id, payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Visita registrada correctamente.' })
      load(1)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleUpdate = async (payload: CreateMeasurementRequest) => {
    if (!id || !modal || modal.mode !== 'edit') return
    try {
      await measurementsApi.update(id, modal.measurement.id, payload)
      setModal(null)
      setMessage({ type: 'ok', text: 'Visita actualizada correctamente.' })
      load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const handleDelete = async (measurement: MeasurementDto) => {
    if (!id) return
    if (!window.confirm('¿Eliminar esta medición?')) return
    try {
      await measurementsApi.remove(id, measurement.id)
      setMessage({ type: 'ok', text: 'Medición eliminada.' })
      load(page)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Historial de visitas ({total})</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn-ghost" onClick={() => navigate(`/pacientes/${id}`)}>
            ← Perfil
          </button>
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => setModal({ mode: 'create' })}>
            + Nueva visita
          </button>
        </div>
      </div>

      <section className="card">
        {loading ? (
          <p>Cargando...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">Aún no hay visitas registradas.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Peso (kg)</th>
                <th>IMC</th>
                <th>Grasa (%)</th>
                <th>Cintura (cm)</th>
                <th>Cadera (cm)</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.visitDate)}</td>
                  <td>{m.weightKg ?? '—'}</td>
                  <td>
                    {m.imc ?? '—'}
                    {m.imc && <span className="text-muted small"> · {m.imcRange}</span>}
                  </td>
                  <td>{m.bodyFatPct ?? '—'}</td>
                  <td>{m.waistCm ?? '—'}</td>
                  <td>{m.hipCm ?? '—'}</td>
                  <td className="text-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.notes ?? '—'}
                  </td>
                  <td>
                    <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'edit', measurement: m })}>
                      Editar
                    </button>{' '}
                    <button type="button" className="btn-danger-soft" onClick={() => handleDelete(m)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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
      </section>

      {modal && (
        <MeasurementForm
          title={modal.mode === 'create' ? 'Nueva visita' : 'Editar visita'}
          initial={modal.mode === 'edit' ? modal.measurement : undefined}
          onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}