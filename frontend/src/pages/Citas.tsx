import { useCallback, useEffect, useState } from 'react'
import { appointmentsApi, measurementsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AppointmentDto, AppointmentStatus, CreateMeasurementRequest } from '../api/types'
import MeasurementForm from '../components/MeasurementForm'

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: 'Pendiente',
  Completed: 'Atendido',
  Cancelled: 'Cancelada',
  NoShow: 'No se presentó',
}

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  Scheduled: 'pending',
  Completed: 'completed',
  Cancelled: 'cancelled',
  NoShow: 'noshow',
}

function startOfDay(d: Date) {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Citas() {
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modal, setModal] = useState<{ appointment: AppointmentDto } | null>(null)

  const todayKey = toKey(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const from = startOfDay(new Date())
      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      const items = await appointmentsApi.list({ from: from.toISOString(), to: to.toISOString() })
      const todayItems = items
        .filter((a) => toKey(new Date(a.startAt)) === todayKey)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      setAppointments(todayItems)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [todayKey])

  useEffect(() => {
    load()
  }, [load])

  const handleSaveVisit = async (payload: CreateMeasurementRequest) => {
    if (!modal) return
    const appointment = modal.appointment
    try {
      await measurementsApi.create(appointment.patientId, payload)
      await appointmentsApi.update(appointment.id, {
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        title: appointment.title,
        notes: appointment.notes,
        status: 'Completed',
      })
      setModal(null)
      setMessage({ type: 'ok', text: `Visita de ${appointment.patientFullName} registrada y cita marcada como atendida.` })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    }
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const todayLabel = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const counts = appointments.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      return acc
    },
    { Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0 },
  )

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header citas-toolbar">
        <h2>Citas de hoy</h2>
        <span className="citas-today">{todayLabel}</span>
      </div>

      <div className="citas-summary">
        <span className="summary-item">
          <i className="status-dot scheduled" /> Pendientes: {counts.Scheduled}
        </span>
        <span className="summary-item">
          <i className="status-dot completed" /> Atendidos: {counts.Completed}
        </span>
        <span className="summary-item">
          <i className="status-dot noshow" /> No se presentaron: {counts.NoShow}
        </span>
        <span className="summary-item">
          <i className="status-dot cancelled" /> Canceladas: {counts.Cancelled}
        </span>
      </div>

      {loading ? (
        <p className="loading">Cargando...</p>
      ) : appointments.length === 0 ? (
        <div className="empty-state">No hay citas registradas para hoy.</div>
      ) : (
        <div className="citas-list">
          {appointments.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`cita-row ${STATUS_CLASS[a.status]}`}
              onClick={() => setModal({ appointment: a })}
            >
              <span className="cita-time">{fmtTime(a.startAt)}</span>
              <span className="cita-name">{a.patientFullName}</span>
              <span className="cita-title">{a.title}</span>
              <span className={`cita-status ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
            </button>
          ))}
        </div>
      )}

      {modal && (
        <MeasurementForm
          title={`Nueva visita · ${modal.appointment.patientFullName}`}
          onSubmit={handleSaveVisit}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}