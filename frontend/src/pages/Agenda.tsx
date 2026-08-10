import { useCallback, useEffect, useMemo, useState } from 'react'
import { appointmentsApi, dietsApi, patientsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AppointmentDto, AppointmentStatus, CreateAppointmentRequest, DietDto, PatientDto, ProfessionalDto } from '../api/types'
import AppointmentForm from '../components/AppointmentForm'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: 'Programada',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
  NoShow: 'Inasistencia',
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(d: Date) {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function monthGrid(viewYear: number, viewMonth: number) {
  const first = new Date(viewYear, viewMonth, 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(start, i))
  return days
}

type FormState =
  | { mode: 'create'; day: Date }
  | { mode: 'edit'; appointment: AppointmentDto }
  | null

export default function Agenda() {
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([])
  const [diets, setDiets] = useState<DietDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [formState, setFormState] = useState<FormState>(null)
  const [confirmDelete, setConfirmDelete] = useState<AppointmentDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()))

  const period = useMemo(() => {
    return {
      from: addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), -7),
      to: addDays(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), 7),
    }
  }, [cursor])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [apps, pats, profs, dietData] = await Promise.all([
        appointmentsApi.list({ from: period.from.toISOString(), to: period.to.toISOString() }),
        patientsApi.list({ page: 1, pageSize: 100 }),
        appointmentsApi.professionals(),
        dietsApi.getPaged({ page: 1, pageSize: 100 }),
      ])
      setAppointments(apps)
      setPatients(pats.items)
      setProfessionals(profs)
      setDiets(dietData.items)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => { load() }, [load])

  const byKey = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>()
    for (const a of appointments) {
      const k = toKey(new Date(a.startAt))
      const arr = map.get(k) ?? []
      arr.push(a)
      map.set(k, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    return map
  }, [appointments])

  const navigate = (dir: -1 | 1) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
  }

  const goToday = () => setCursor(startOfDay(new Date()))

  const handleCreate = async (payload: CreateAppointmentRequest) => {
    try {
      await appointmentsApi.create(payload)
      setFormState(null)
      setMessage({ type: 'ok', text: 'Cita registrada correctamente.' })
      load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      throw err
    }
  }

  const handleUpdate = async (id: string, payload: CreateAppointmentRequest) => {
    try {
      await appointmentsApi.update(id, payload)
      setFormState(null)
      setMessage({ type: 'ok', text: 'Cita actualizada correctamente.' })
      load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      throw err
    }
  }

  const requestDelete = (appointment: AppointmentDto) => {
    setFormState(null)
    setConfirmDelete(appointment)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    setMessage(null)
    try {
      await appointmentsApi.remove(confirmDelete.id)
      setConfirmDelete(null)
      setMessage({ type: 'ok', text: 'Cita eliminada.' })
      await load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleAppointmentClick = (a: AppointmentDto) => {
    setFormState({ mode: 'edit', appointment: a })
  }

  if (formState) {
    return (
      <AppointmentForm
        title={formState.mode === 'create' ? 'Registrar nueva cita' : 'Editar cita'}
        day={formState.mode === 'create' ? formState.day : undefined}
        initial={formState.mode === 'edit' ? formState.appointment : undefined}
        patients={patients}
        professionals={professionals}
        diets={diets}
        onSubmit={formState.mode === 'create'
          ? handleCreate
          : (payload) => handleUpdate(formState.appointment.id, payload)}
        onDelete={formState.mode === 'edit' ? () => requestDelete(formState.appointment) : undefined}
        onCancel={() => setFormState(null)}
      />
    )
  }

  const selectedDayKey = toKey(selectedDay)
  const selectedDayApps = byKey.get(selectedDayKey) ?? []

  return (
    <div className="clean-agenda-container">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="purple-agenda-card">
        <div className="purple-card-header">
          <div className="purple-header-left">
            <span className="purple-year">{cursor.getFullYear()}</span>
            <h1 className="purple-month-name">
              {cursor.toLocaleDateString('es-ES', { month: 'long' })}
            </h1>
          </div>

          <div className="purple-header-controls">
            <button type="button" className="purple-nav-arrow" onClick={() => navigate(-1)} aria-label="Anterior">
              ‹
            </button>
            <button type="button" className="purple-today-chip" onClick={goToday}>
              Hoy
            </button>
            <button type="button" className="purple-nav-arrow" onClick={() => navigate(1)} aria-label="Siguiente">
              ›
            </button>
          </div>
        </div>

        <div className="purple-cal-wrapper">
          <div className="purple-day-names">
            {DAY_NAMES.map((name) => (
              <span key={name} className="purple-day-name">{name}</span>
            ))}
          </div>

          <div className="purple-dates-grid">
            {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((d) => {
              const key = toKey(d)
              const dayApps = byKey.get(key) ?? []
              const isToday = key === toKey(new Date())
              const isOut = d.getMonth() !== cursor.getMonth()
              const isSelected = key === selectedDayKey
              const hasApps = dayApps.length > 0

              return (
                <button
                  key={key}
                  type="button"
                  className={`purple-date-cell${isOut ? ' out' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${hasApps ? ' has-events' : ''}`}
                  onClick={() => setSelectedDay(d)}
                >
                  <span className="purple-date-number">{d.getDate()}</span>
                  {hasApps && (
                    <span className="purple-event-dots">
                      {dayApps.slice(0, 3).map((a) => (
                        <span key={a.id} className={`purple-dot ${a.status.toLowerCase()}`} />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="clean-agenda-section">
        <div className="agenda-section-header">
          <div>
            <span className="agenda-section-subtitle">
              {selectedDay.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase()}
            </span>
            <h2 className="agenda-section-title">
              {selectedDay.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <button
            type="button"
            className="purple-add-btn"
            id="btn-nueva-cita"
            onClick={() => setFormState({ mode: 'create', day: selectedDay })}
          >
            + Nueva cita
          </button>
        </div>

        {loading ? (
          <p className="loading">Cargando citas...</p>
        ) : selectedDayApps.length === 0 ? (
          <div className="clean-empty-state">
            <span className="clean-empty-icon">☕</span>
            <p>No tienes citas agendadas para este día.</p>
            <button
              type="button"
              className="clean-empty-btn"
              onClick={() => setFormState({ mode: 'create', day: selectedDay })}
            >
              Agendar consulta
            </button>
          </div>
        ) : (
          <div className="clean-apps-list">
            {selectedDayApps.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                className={`clean-app-card ${a.status.toLowerCase()}`}
                onClick={() => handleAppointmentClick(a)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAppointmentClick(a) }}
              >
                <div className={`clean-app-indicator ${a.status.toLowerCase()}`} />
                <div className="clean-app-main">
                  <div className="clean-app-top">
                    <strong className="clean-app-patient">{a.patientFullName}</strong>
                    <span className={`clean-app-badge ${a.status.toLowerCase()}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="clean-app-sub">
                    <span className="clean-app-time">
                      🕒 {new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {a.endAt && ` – ${new Date(a.endAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                    <span className="clean-app-prof">👨‍⚕️ {a.professionalFullName}</span>
                  </div>
                  {a.notes && <p className="clean-app-notes">📝 {a.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="clean-legend">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <span key={status} className="clean-legend-item">
            <i className={`clean-dot-icon ${status.toLowerCase()}`} /> {label}
          </span>
        ))}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🗑</div>
            <h2>Eliminar cita</h2>
            <p>
              ¿Estás seguro que deseas eliminar la cita de{' '}
              <strong>{confirmDelete.patientFullName}</strong> del{' '}
              {new Date(confirmDelete.startAt).toLocaleString('es-ES', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' '}con <strong>{confirmDelete.professionalFullName}</strong>? Esta acción no se puede
              deshacer.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}