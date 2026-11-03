import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { appointmentsApi, dietsApi, measurementsApi, patientsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type {
  AppointmentDto,
  AppointmentStatus,
  CreateAppointmentRequest,
  CreateMeasurementRequest,
  DietDto,
  PatientDto,
  ProfessionalDto,
} from '../api/types'
import AppointmentForm from '../components/AppointmentForm'
import { avatarClass, initialsOf } from '../components/avatarIndex'
import MeasurementForm from '../components/MeasurementForm'
import { ConfirmModal } from '../components/Modal'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'
import { toLocalDateKey, toLocalIso } from '../utils/localDate'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: 'Programada',
  Completed: 'Atendida',
  Cancelled: 'Cancelada',
  NoShow: 'No asistió',
}

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  Scheduled: 'badge--info',
  Completed: 'badge--success',
  Cancelled: 'badge--neutral',
  NoShow: 'badge--warning',
}

/** Valor de `?cita=` para crear una cita nueva. */
const NEW_APPOINTMENT = 'nueva'

/** Clave `YYYY-MM-DD` del día local (las citas son hora de reloj local, sin zona). */
const toKey = toLocalDateKey

function parseKey(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : date
}

function startOfDay(d: Date) {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
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

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/**
 * Agenda (incluye las antiguas "Citas de hoy", U3/E2): calendario mensual + citas del día.
 * Estado en la URL: `?dia=AAAA-MM-DD` (día seleccionado, por defecto hoy) y `?cita=nueva|<id>` (editor),
 * así el "atrás" del navegador cierra el editor sin salir de la Agenda.
 */
export default function Agenda() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const todayKey = toKey(new Date())
  const selectedDay = parseKey(searchParams.get('dia')) ?? startOfDay(new Date())
  const selectedKey = toKey(selectedDay)
  const editorParam = searchParams.get('cita')

  const [cursor, setCursor] = useState(() => startOfMonth(selectedDay))
  const [appointments, setAppointments] = useState<AppointmentDto[]>([])
  const [patients, setPatients] = useState<PatientDto[]>([])
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([])
  const [diets, setDiets] = useState<DietDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visitFor, setVisitFor] = useState<AppointmentDto | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AppointmentDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const period = useMemo(
    () => ({
      from: addDays(new Date(cursor.getFullYear(), cursor.getMonth(), 1), -7),
      to: addDays(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), 7),
    }),
    [cursor],
  )

  // Datos de referencia del formulario: una vez.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      patientsApi.list({ page: 1, pageSize: 100 }),
      appointmentsApi.professionals(),
      dietsApi.getPaged({ page: 1, pageSize: 100 }),
    ])
      .then(([pats, profs, dietData]) => {
        if (cancelled) return
        setPatients(pats.items)
        setProfessionals(profs)
        setDiets(dietData.items)
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  // Citas del periodo visible (mes ± 1 semana).
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAppointments(
        // Hora local de la clínica, sin convertir a UTC (D5): cubre exactamente los días visibles.
        await appointmentsApi.list({ from: toLocalIso(period.from), to: toLocalIso(period.to) }),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to])

  useEffect(() => {
    load()
  }, [load])

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

  // Enlace directo `?cita=<id>` sin `?dia=` y fuera del mes cargado: se busca la cita
  // (no hay getById de citas en la api; se usa list en ±12 meses) y se posiciona su día.
  const [lookupFailed, setLookupFailed] = useState<string | null>(null)
  const missingId =
    editorParam && editorParam !== NEW_APPOINTMENT && !loading && !error && !appointments.some((a) => a.id === editorParam)
      ? editorParam
      : null
  const needsLookup = !!missingId && !searchParams.has('dia') && lookupFailed !== missingId

  useEffect(() => {
    if (!needsLookup || !missingId) return
    let cancelled = false
    const now = new Date()
    appointmentsApi
      .list({ from: toLocalIso(startOfDay(addDays(now, -366))), to: toLocalIso(startOfDay(addDays(now, 367))) })
      .then((list) => {
        if (cancelled) return
        const found = list.find((a) => a.id === missingId)
        if (!found) {
          setLookupFailed(missingId)
          return
        }
        const d = startOfDay(new Date(found.startAt))
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set('dia', toKey(d))
            return next
          },
          { replace: true },
        )
        setCursor(startOfMonth(d))
      })
      .catch(() => {
        if (!cancelled) setLookupFailed(missingId)
      })
    return () => {
      cancelled = true
    }
  }, [needsLookup, missingId, setSearchParams])

  const selectDay = (d: Date) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (toKey(d) === todayKey) next.delete('dia')
        else next.set('dia', toKey(d))
        return next
      },
      { replace: true },
    )
    if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) setCursor(startOfMonth(d))
  }

  const goToday = () => selectDay(startOfDay(new Date()))

  const shiftMonth = (dir: -1 | 1) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))

  const openEditor = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('cita', value)
    navigate({ search: next.toString() }, { state: { agendaEditor: true } })
  }

  const closeEditor = () => {
    if ((location.state as { agendaEditor?: boolean } | null)?.agendaEditor) {
      navigate(-1)
      return
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('cita')
        return next
      },
      { replace: true },
    )
  }

  const handleCreate = async (payload: CreateAppointmentRequest) => {
    try {
      await appointmentsApi.create(payload)
      toast.success('Cita registrada correctamente.')
      closeEditor()
      load()
    } catch (err) {
      throw new Error(getErrorMessage(err))
    }
  }

  const handleUpdate = async (id: string, payload: CreateAppointmentRequest) => {
    try {
      await appointmentsApi.update(id, payload)
      toast.success('Cita actualizada correctamente.')
      closeEditor()
      load()
    } catch (err) {
      throw new Error(getErrorMessage(err))
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await appointmentsApi.remove(confirmDelete.id)
      setConfirmDelete(null)
      toast.success('Cita eliminada.')
      closeEditor()
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  // "Registrar visita": guarda la medición y marca la cita como atendida.
  const handleSaveVisit = async (payload: CreateMeasurementRequest) => {
    if (!visitFor) return
    const appointment = visitFor
    try {
      await measurementsApi.create(appointment.patientId, payload)
      await appointmentsApi.update(appointment.id, {
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        dietId: appointment.dietId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        title: appointment.title,
        notes: appointment.notes,
        status: 'Completed',
      })
      setVisitFor(null)
      toast.success(`Visita de ${appointment.patientFullName} registrada y cita marcada como atendida.`)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // ── Editor (página completa controlada por la URL) ──
  if (editorParam) {
    const backTo = `/agenda${searchParams.get('dia') ? `?dia=${searchParams.get('dia')}` : ''}`
    if (editorParam === NEW_APPOINTMENT) {
      return (
        <AppointmentForm
          title="Nueva cita"
          backTo={backTo}
          day={selectedDay}
          patients={patients}
          professionals={professionals}
          diets={diets}
          onSubmit={handleCreate}
          onCancel={closeEditor}
        />
      )
    }
    const editing = appointments.find((a) => a.id === editorParam)
    if (!editing) {
      return (
        <div className="page">
          <div
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest('.page-header-back')) {
                e.preventDefault()
                closeEditor()
              }
            }}
          >
            <PageHeader title="Editar cita" back={{ to: backTo, label: 'Agenda' }} />
          </div>
          {loading || needsLookup ? (
            <StateView state="loading" title="Buscando la cita..." />
          ) : (
            <StateView
              state="error"
              title="No se encontró la cita"
              message={
                error ??
                'La cita no existe, fue eliminada o no pertenece a tu agenda. Revisa el enlace o búscala en el calendario.'
              }
              action={
                <button type="button" className="btn btn--ghost" onClick={closeEditor}>
                  Volver a la Agenda
                </button>
              }
            />
          )}
        </div>
      )
    }
    return (
      <>
        <AppointmentForm
          title="Editar cita"
          backTo={backTo}
          initial={editing}
          patients={patients}
          professionals={professionals}
          diets={diets}
          onSubmit={(payload) => handleUpdate(editing.id, payload)}
          onDelete={() => setConfirmDelete(editing)}
          onCancel={closeEditor}
        />
        {confirmDelete && (
          <ConfirmModal
            title="Eliminar cita"
            message={`¿Eliminar la cita de ${confirmDelete.patientFullName} del ${new Date(
              confirmDelete.startAt,
            ).toLocaleString('es-ES', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })} con ${confirmDelete.professionalFullName}? Esta acción no se puede deshacer.`}
            confirmLabel="Eliminar"
            danger
            busy={deleting}
            onConfirm={handleDelete}
            onCancel={() => !deleting && setConfirmDelete(null)}
          />
        )}
      </>
    )
  }

  // ── Vista principal ──
  const dayApps = byKey.get(selectedKey) ?? []
  const isToday = selectedKey === todayKey
  const pending = dayApps.filter((a) => a.status === 'Scheduled').length
  const done = dayApps.filter((a) => a.status === 'Completed').length
  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const dayLabel = selectedDay.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page agenda-page">
      <PageHeader
        title="Agenda"
        actions={
          <button type="button" className="btn btn--primary clin-desktop-action" onClick={() => openEditor(NEW_APPOINTMENT)}>
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Nueva cita
          </button>
        }
      />

      <div className="agenda-layout">
        {/* Día seleccionado: en móvil va primero y abre en "Hoy". */}
        <section className="card agenda-day" aria-labelledby="agenda-day-title">
          <div className="agenda-day-head">
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => selectDay(addDays(selectedDay, -1))}
              aria-label="Día anterior"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_left
              </span>
            </button>
            <div className="agenda-day-heading">
              <h2 id="agenda-day-title">{isToday ? 'Hoy' : dayLabel}</h2>
              <p className="text-muted">
                {isToday && <span className="agenda-day-date">{dayLabel} · </span>}
                {loading
                  ? 'Cargando...'
                  : dayApps.length === 0
                    ? 'Sin citas'
                    : `${dayApps.length} cita${dayApps.length === 1 ? '' : 's'} · ${pending} pendiente${pending === 1 ? '' : 's'} · ${done} atendida${done === 1 ? '' : 's'}`}
              </p>
            </div>
            <button
              type="button"
              className="btn btn--icon"
              onClick={() => selectDay(addDays(selectedDay, 1))}
              aria-label="Día siguiente"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>

          {!isToday && (
            <button type="button" className="btn btn--ghost btn-sm agenda-today-btn" onClick={goToday}>
              Ir a hoy
            </button>
          )}

          {loading && appointments.length === 0 ? (
            <StateView state="loading" compact title="Cargando citas..." />
          ) : error ? (
            <StateView
              state="error"
              compact
              message={error}
              action={
                <button type="button" className="btn btn--ghost" onClick={load}>
                  Reintentar
                </button>
              }
            />
          ) : dayApps.length === 0 ? (
            <StateView
              state="empty"
              compact
              icon="event_available"
              title="No hay citas para este día"
              action={
                <button type="button" className="btn btn--primary" onClick={() => openEditor(NEW_APPOINTMENT)}>
                  Agendar cita
                </button>
              }
            />
          ) : (
            <ul className="agenda-list">
              {dayApps.map((a) => (
                <li key={a.id} className={`agenda-item status-${a.status.toLowerCase()}`}>
                  <div className="agenda-item-time">
                    <strong>{fmtTime(a.startAt)}</strong>
                    {a.endAt && <span>{fmtTime(a.endAt)}</span>}
                  </div>
                  <span className={`avatar agenda-avatar ${avatarClass(a.patientId)}`} aria-hidden="true">
                    {initialsOf(a.patientFullName)}
                  </span>
                  <div className="agenda-item-main">
                    <div className="agenda-item-top">
                      <Link to={`/pacientes/${a.patientId}`} className="agenda-item-patient">
                        {a.patientFullName}
                      </Link>
                      <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </div>
                    <p className="agenda-item-meta">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        stethoscope
                      </span>
                      {a.professionalFullName}
                      {a.title ? ` · ${a.title}` : ''}
                    </p>
                    {a.notes && <p className="agenda-item-notes">{a.notes}</p>}
                    <div className="agenda-item-actions">
                      {a.status === 'Scheduled' && (
                        <button type="button" className="btn btn--primary" onClick={() => setVisitFor(a)}>
                          <span className="material-symbols-outlined" aria-hidden="true">
                            assignment_turned_in
                          </span>
                          Registrar visita
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => openEditor(a.id)}
                        aria-label={`Editar cita de ${a.patientFullName} a las ${fmtTime(a.startAt)}`}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          edit
                        </span>
                        Editar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Calendario del mes */}
        <section className="card agenda-calendar" aria-labelledby="agenda-month-title">
          <div className="agenda-cal-head">
            <h2 id="agenda-month-title" className="agenda-month">
              {monthLabel}
            </h2>
            <div className="agenda-cal-controls">
              <button type="button" className="btn btn--icon" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
                <span className="material-symbols-outlined" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button type="button" className="btn btn--ghost btn-sm" onClick={goToday}>
                Hoy
              </button>
              <button type="button" className="btn btn--icon" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
                <span className="material-symbols-outlined" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
          </div>

          <div className="agenda-weekdays" aria-hidden="true">
            {DAY_NAMES.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>

          <div className="agenda-grid">
            {monthGrid(cursor.getFullYear(), cursor.getMonth()).map((d) => {
              const key = toKey(d)
              const cellApps = byKey.get(key) ?? []
              const count = cellApps.length
              const out = d.getMonth() !== cursor.getMonth()
              const label = `${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${
                count ? `, ${count} cita${count === 1 ? '' : 's'}` : ''
              }`
              return (
                <button
                  key={key}
                  type="button"
                  className={`agenda-cell${out ? ' out' : ''}${key === todayKey ? ' today' : ''}${
                    key === selectedKey ? ' selected' : ''
                  }`}
                  aria-label={label}
                  aria-pressed={key === selectedKey}
                  aria-current={key === todayKey ? 'date' : undefined}
                  onClick={() => selectDay(d)}
                >
                  <span className="agenda-cell-num">{d.getDate()}</span>
                  {count > 0 && (
                    <span className="agenda-cell-dots" aria-hidden="true">
                      {cellApps.slice(0, 3).map((a) => (
                        <span key={a.id} className={`agenda-dot status-${a.status.toLowerCase()}`} />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <button type="button" className="clin-fab" onClick={() => openEditor(NEW_APPOINTMENT)} aria-label="Nueva cita">
        <span className="material-symbols-outlined" aria-hidden="true">
          add
        </span>
      </button>

      {visitFor && (
        <MeasurementForm
          title={`Registrar visita · ${visitFor.patientFullName}`}
          defaultVisitDate={toKey(new Date(visitFor.startAt))}
          onSubmit={handleSaveVisit}
          onCancel={() => setVisitFor(null)}
        />
      )}
    </div>
  )
}
