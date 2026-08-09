import { useCallback, useEffect, useMemo, useState } from 'react'
import { appointmentsApi, patientsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AppointmentDto, AppointmentStatus, CreateAppointmentRequest, PatientDto, ProfessionalDto } from '../api/types'
import AppointmentForm from '../components/AppointmentForm'

type ViewMode = 'month' | 'week' | 'day'

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

function startOfWeek(d: Date) {
  const r = startOfDay(d)
  const offset = (r.getDay() + 6) % 7
  return addDays(r, -offset)
}

function monthGrid(viewYear: number, viewMonth: number) {
  const first = new Date(viewYear, viewMonth, 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(start, i))
  return days
}

function monthTitle(d: Date) {
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

function weekTitle(weekStart: Date) {
  const end = addDays(weekStart, 6)
  const fmt = (x: Date) => x.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const sameMonth = weekStart.getMonth() === end.getMonth()
  if (sameMonth) return `${fmt(weekStart)} – ${fmt(end)}`
  return `${fmt(weekStart)} – ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
}

const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i)

export default function Agenda() {
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modal, setModal] = useState<
    | { mode: 'create'; day: Date }
    | { mode: 'edit'; appointment: AppointmentDto }
    | null
  >(null)
  const [confirmDelete, setConfirmDelete] = useState<AppointmentDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const period = useMemo(() => {
    if (view === 'month')
      return { from: addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), -7), to: addDays(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), 7) }
    if (view === 'week')
      return { from: addDays(startOfWeek(cursor), -7), to: addDays(startOfWeek(cursor), 14) }
    return { from: addDays(cursor, -7), to: addDays(cursor, 8) }
  }, [view, cursor])

  useEffect(() => { setMessage(null) }, [view])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [apps, pats, profs] = await Promise.all([
        appointmentsApi.list({ from: period.from.toISOString(), to: period.to.toISOString() }),
        patientsApi.list({ page: 1, pageSize: 100 }),
        appointmentsApi.professionals(),
      ])
      setAppointments(apps)
      setPatients(pats.items)
      setProfessionals(profs)
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
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
    else setCursor(addDays(cursor, dir * (view === 'week' ? 7 : 1)))
  }

  const goToday = () => setCursor(startOfDay(new Date()))

  const title = view === 'month'
    ? monthTitle(cursor)
    : view === 'week'
      ? weekTitle(startOfWeek(cursor))
      : cursor.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const handleCreate = async (payload: CreateAppointmentRequest) => {
    try {
      await appointmentsApi.create(payload)
      setModal(null)
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
      setModal(null)
      setMessage({ type: 'ok', text: 'Cita actualizada correctamente.' })
      load()
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
      throw err
    }
  }

  const requestDelete = (appointment: AppointmentDto) => {
    setModal(null)
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

  return (
    <div className="page">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card-header agenda-toolbar">
        <h2>Agenda</h2>
        <div className="agenda-actions">
          <button type="button" className="btn-ghost" onClick={() => setModal({ mode: 'create', day: cursor })}>
            + Nueva cita
          </button>
        </div>
      </div>

      <div className="agenda-nav">
        <div className="agenda-nav-arrows">
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)} aria-label="Anterior">‹</button>
          <button type="button" className="btn-ghost" onClick={goToday}>Hoy</button>
          <button type="button" className="btn-ghost" onClick={() => navigate(1)} aria-label="Siguiente">›</button>
        </div>
        <h3 className="agenda-title">{title}</h3>
        <div className="agenda-view-switch" role="tablist">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'view-btn active' : 'view-btn'}
              onClick={() => setView(v)}
            >
              {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="loading">Cargando...</p>
      ) : view === 'month' ? (
        <MonthView
          grid={monthGrid(cursor.getFullYear(), cursor.getMonth())}
          appointments={byKey}
          onDayClick={(d) => setModal({ mode: 'create', day: d })}
          onAppointmentClick={(a) => setModal({ mode: 'edit', appointment: a })}
          todayKey={toKey(new Date())}
        />
      ) : (
        <TimeGridView
          view={view}
          days={view === 'day'
            ? [cursor]
            : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          appointments={byKey}
          onDayClick={(d) => setModal({ mode: 'create', day: d })}
          onAppointmentClick={(a) => setModal({ mode: 'edit', appointment: a })}
          todayKey={toKey(new Date())}
        />
      )}

      <div className="legend">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <span key={status} className="legend-item">
            <i className={`status-dot ${status.toLowerCase()}`} /> {label}
          </span>
        ))}
        {appointments.length > 0 && (
          <span className="legend-summary">Citas cargadas: {appointments.length}</span>
        )}
      </div>

      {modal && (
        <AppointmentForm
          title={modal.mode === 'create' ? 'Registrar cita' : 'Editar cita'}
          day={modal.mode === 'create' ? modal.day : undefined}
          initial={modal.mode === 'edit' ? modal.appointment : undefined}
          patients={patients}
          professionals={professionals}
          onSubmit={modal.mode === 'create'
            ? handleCreate
            : (payload) => handleUpdate(modal.appointment.id, payload)}
          onDelete={modal.mode === 'edit' ? () => requestDelete(modal.appointment) : undefined}
          onCancel={() => setModal(null)}
        />
      )}

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

interface MonthViewProps {
  grid: Date[]
  appointments: Map<string, AppointmentDto[]>
  onDayClick: (day: Date) => void
  onAppointmentClick: (appointment: AppointmentDto) => void
  todayKey: string
}

function MonthView({ grid, appointments, onDayClick, onAppointmentClick, todayKey }: MonthViewProps) {
  const currentMonth = grid[10]?.getMonth()

  return (
    <div className="cal-grid cal-month-grid">
      {DAY_NAMES.map((name) => (
        <div key={name} className="cal-day-name">{name}</div>
      ))}
      {grid.map((d) => {
        const key = toKey(d)
        const dayApps = appointments.get(key) ?? []
        const isToday = key === todayKey
        const isOut = d.getMonth() !== currentMonth
        return (
          <button
            key={key}
            type="button"
            className={`cal-cell cal-day${isOut ? ' out' : ''}${isToday ? ' today' : ''}`}
            onClick={() => onDayClick(d)}
          >
            <span className="cal-cell-date">{d.getDate()}</span>
            <div className="cal-cell-apps">
              {dayApps.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="cal-chip"
                  onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
                >
                  <span className="chip-time">{new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="chip-name">{a.patientFullName}</span>
                </button>
              ))}
              {dayApps.length > 3 && <span className="cal-cell-more">+{dayApps.length - 3} más</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface TimeGridViewProps {
  view: ViewMode
  days: Date[]
  appointments: Map<string, AppointmentDto[]>
  onDayClick: (day: Date) => void
  onAppointmentClick: (appointment: AppointmentDto) => void
  todayKey: string
}

function TimeGridView({ view, days, appointments, onDayClick, onAppointmentClick, todayKey }: TimeGridViewProps) {
  return (
    <div className="cal-time-scroll">
      <div className={`cal-grid cal-time-grid${view === 'day' ? ' single-day' : ''}`}>
        {days.map((d) => {
          const key = toKey(d)
          const isToday = key === todayKey
          return (
            <div key={key} className="cal-time-day">
              <button
                type="button"
                className={`cal-col-head${isToday ? ' today' : ''}`}
                onClick={() => onDayClick(d)}
              >
                {view === 'day'
                  ? d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })
                  : DAY_NAMES[(d.getDay() + 6) % 7]}
                <strong>{d.getDate()}</strong>
              </button>
              <div className="cal-time-slots">
                {HOURS.map((h) => {
                  const hourApps = (appointments.get(key) ?? []).filter((a) => new Date(a.startAt).getHours() === h)
                  return (
                    <div key={h} className="cal-slot">
                      <span className="slot-hours">{String(h).padStart(2, '0')}:00</span>
                      <div className="slot-body" onClick={() => onDayClick(d)}>
                        {hourApps.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={`cal-chip slot-chip ${a.status.toLowerCase()}`}
                            onClick={(e) => { e.stopPropagation(); onAppointmentClick(a) }}
                          >
                            <span className="chip-time">{new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="chip-name">{a.patientFullName} · {a.professionalFullName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}