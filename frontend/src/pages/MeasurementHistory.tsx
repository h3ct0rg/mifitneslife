import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { dietsApi, measurementsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { CreateMeasurementRequest, DietDto, MeasurementDto } from '../api/types'
import MeasurementForm from '../components/MeasurementForm'
import { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

const PAGE_SIZE = 10

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

const rounded = (v?: number) => (v == null ? null : Number(v.toFixed(1)))

const hasText = (html?: string) => !!html && html.trim().replace(/<[^>]*>/g, '').trim() !== ''

export default function MeasurementHistory() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()

  const [items, setItems] = useState<MeasurementDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; measurement: MeasurementDto } | null>(null)
  const [toDelete, setToDelete] = useState<MeasurementDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [diets, setDiets] = useState<DietDto[]>([])
  const [assignedDietId, setAssignedDietId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [data, dietRes, dietList] = await Promise.all([
        measurementsApi.list(id, { page, pageSize: PAGE_SIZE }),
        dietsApi.getByPatient(id),
        dietsApi.list(),
      ])
      setItems(data.items)
      setTotal(data.total)
      setDiets(dietList)
      setAssignedDietId(dietRes.assigned && dietRes.diet ? dietRes.diet.id : '')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleDietChange = async (dietId: string) => {
    if (!id) return
    try {
      await dietsApi.assign(id, dietId || undefined)
      setAssignedDietId(dietId)
    } catch {
      // no bloquea la visita
    }
  }

  const handleCreate = async (payload: CreateMeasurementRequest) => {
    if (!id) return
    try {
      await measurementsApi.create(id, payload)
      setModal(null)
      toast.success('Visita registrada correctamente.')
      if (page === 1) load()
      else setPage(1)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleUpdate = async (payload: CreateMeasurementRequest) => {
    if (!id || !modal || modal.mode !== 'edit') return
    try {
      await measurementsApi.update(id, modal.measurement.id, payload)
      setModal(null)
      toast.success('Visita actualizada correctamente.')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!id || !toDelete) return
    setDeleting(true)
    try {
      await measurementsApi.remove(id, toDelete.id)
      setToDelete(null)
      toast.success('Visita eliminada.')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const openCreate = () => setModal({ mode: 'create' })

  return (
    <div className="page">
      <PageHeader
        title="Historial de visitas"
        subtitle={loading && total === 0 ? undefined : `${total} visita${total === 1 ? '' : 's'}`}
        back={{ to: `/pacientes/${id}`, label: 'Ficha del paciente' }}
        actions={
          <button type="button" className="btn btn--primary clin-desktop-action" onClick={openCreate}>
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Nueva visita
          </button>
        }
      />

      <section className="visit-cards" aria-busy={loading || undefined}>
        {loading && items.length === 0 ? (
          <StateView state="loading" title="Cargando visitas..." />
        ) : error ? (
          <StateView
            state="error"
            message={error}
            action={
              <button type="button" className="btn btn--ghost" onClick={load}>
                Reintentar
              </button>
            }
          />
        ) : items.length === 0 ? (
          <StateView
            state="empty"
            icon="event_note"
            title="Aún no hay visitas"
            message="Registra la primera visita con sus mediciones."
            action={
              <button type="button" className="btn btn--primary" onClick={openCreate}>
                Nueva visita
              </button>
            }
          />
        ) : (
          items.map((m) => (
            <article key={m.id} className="visit-card">
              <header className="visit-card-header">
                <div className="visit-card-date">
                  <strong>{fmtDate(m.visitDate)}</strong>
                  <span>{fmtTime(m.visitDate)} h</span>
                </div>
                <div className="visit-card-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setModal({ mode: 'edit', measurement: m })}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      edit
                    </span>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon"
                    onClick={() => setToDelete(m)}
                    aria-label={`Eliminar visita del ${fmtDate(m.visitDate)}`}
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              </header>

              <div className="visit-card-body">
                {hasText(m.notes) ? (
                  <div className="visit-notes" dangerouslySetInnerHTML={{ __html: m.notes ?? '' }} />
                ) : (
                  <p className="visit-notes-empty">Sin observaciones.</p>
                )}
              </div>

              <dl className="visit-card-footer">
                {[
                  { label: 'Peso', value: rounded(m.weightKg), unit: 'kg' },
                  { label: 'IMC', value: rounded(m.imc), unit: m.imc ? m.imcRange : '' },
                  { label: 'Grasa', value: rounded(m.bodyFatPct), unit: '%' },
                  { label: 'Cintura', value: rounded(m.waistCm), unit: 'cm' },
                  { label: 'Cadera', value: rounded(m.hipCm), unit: 'cm' },
                  { label: 'Pecho', value: rounded(m.chestCm), unit: 'cm' },
                ].map((metric) => (
                  <div key={metric.label} className="visit-metric">
                    <dt>{metric.label}</dt>
                    <dd>
                      <strong>{metric.value ?? '—'}</strong>
                      {metric.unit && <em>{metric.unit}</em>}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))
        )}

        {totalPages > 1 && !error && (
          <nav className="pagination" aria-label="Paginación">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>

      <button type="button" className="clin-fab" onClick={openCreate} aria-label="Nueva visita">
        <span className="material-symbols-outlined" aria-hidden="true">
          add
        </span>
      </button>

      {modal && (
        <MeasurementForm
          title={modal.mode === 'create' ? 'Nueva visita' : 'Editar visita'}
          initial={modal.mode === 'edit' ? modal.measurement : undefined}
          diets={diets}
          assignedDietId={assignedDietId}
          onDietChange={handleDietChange}
          onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
          onCancel={() => setModal(null)}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar visita"
          message={`¿Eliminar la visita del ${fmtDate(toDelete.visitDate)}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setToDelete(null)}
        />
      )}
    </div>
  )
}
