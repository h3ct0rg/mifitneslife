import { useEffect, useMemo, useState } from 'react'
import type { AppointmentDto, CreateAppointmentRequest, DietDto, PatientDto, ProfessionalDto } from '../api/types'
import { roleLabel } from '../api/types'

interface Props {
  title: string
  day?: Date
  initial?: AppointmentDto
  patients: PatientDto[]
  professionals: ProfessionalDto[]
  diets: DietDto[]
  onSubmit: (payload: CreateAppointmentRequest) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseLocalInput(value: string) {
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hora', minutes: 60 },
  { label: '1h 30', minutes: 90 },
  { label: '2 horas', minutes: 120 },
]

export default function AppointmentForm({
  title,
  day,
  initial,
  patients,
  professionals,
  diets,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [dietId, setDietId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [titleValue, setTitleValue] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<number | null>(null)

  useEffect(() => {
    if (initial) {
      setPatientId(initial.patientId)
      setProfessionalId(initial.professionalId)
      setDietId(initial.dietId ?? '')
      setStartAt(toLocalInput(new Date(initial.startAt)))
      setEndAt(initial.endAt ? toLocalInput(new Date(initial.endAt)) : '')
      setTitleValue(initial.title ?? '')
      setNotes(initial.notes ?? '')
      return
    }

    const base = day ? new Date(day) : new Date()
    base.setHours(new Date().getHours() + 1, 0, 0, 0)
    setStartAt(toLocalInput(base))

    if (professionals.length === 1) setProfessionalId(professionals[0].id)
    if (patients.length === 1) setPatientId(patients[0].id)
  }, [initial, day, professionals, patients])

  const quickBase = useMemo(() => parseLocalInput(startAt), [startAt])

  const applyQuick = (minutes: number) => {
    if (!quickBase) return
    const end = new Date(quickBase.getTime() + minutes * 60 * 1000)
    setEndAt(toLocalInput(end))
    setActivePreset(minutes)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId || !professionalId || !startAt) {
      setError('Selecciona hora, paciente y profesional.')
      return
    }
    const start = parseLocalInput(startAt)
    if (!start) {
      setError('Fecha y hora inválidas.')
      return
    }
    let end: string | undefined
    if (endAt) {
      const endParsed = parseLocalInput(endAt)
      if (endParsed && endParsed <= start) {
        setError('La hora de fin debe ser posterior a la de inicio.')
        return
      }
      end = endAt
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        patientId,
        professionalId,
        dietId: dietId || undefined,
        startAt,
        endAt: end,
        title: titleValue.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cita.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPatient = patients.find((p) => p.id === patientId)
  const selectedProfessional = professionals.find((p) => p.id === professionalId)
  const selectedDiet = diets.find((d) => d.id === dietId)

  const startDate = parseLocalInput(startAt)
  const endDate = parseLocalInput(endAt)
  const durationMin = startDate && endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    : null

  const completeness = [patientId, professionalId, startAt].filter(Boolean).length

  return (
    <div className="af-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="af-page-header">
        <button type="button" className="af-back-btn" onClick={onCancel}>
          ← Volver a Agenda
        </button>
        <div className="af-page-title-wrap">
          <div className="af-page-icon">{initial ? '📋' : '📅'}</div>
          <div>
            <h1 className="af-page-title">{title}</h1>
            <p className="af-page-subtitle">
              {initial
                ? `Editando cita de ${initial.patientFullName}`
                : 'Completa los datos para registrar la nueva cita'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="af-layout">

        {/* ── Main Column ──────────────────────────────────────── */}
        <div className="af-main-col">

          {/* Sección: Participantes */}
          <div className="af-section">
            <div className="af-section-header">
              <span className="af-section-badge af-badge-blue">👥</span>
              <span className="af-section-title">Participantes</span>
            </div>
            <div className="af-section-body">

              <div className="af-field">
                <div className="af-field-icon">🏥</div>
                <div className="af-field-body">
                  <span className="af-field-label">Paciente *</span>
                  <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="af-input" required>
                    <option value="">Seleccionar paciente...</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="af-field">
                <div className="af-field-icon">👨‍⚕️</div>
                <div className="af-field-body">
                  <span className="af-field-label">Profesional *</span>
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className="af-input"
                    required
                    disabled={professionals.length === 1}
                  >
                    {professionals.length === 0 && <option value="">No hay profesionales disponibles</option>}
                    {professionals.length === 1 && (
                      <option value={professionals[0].id}>
                        {professionals[0].fullName} ({roleLabel(professionals[0].role)}) — asignado
                      </option>
                    )}
                    {professionals.length > 1 && (
                      <>
                        <option value="">Seleccionar profesional...</option>
                        {professionals.map((p) => (
                          <option key={p.id} value={p.id}>{p.fullName} ({roleLabel(p.role)})</option>
                        ))}
                      </>
                    )}
                  </select>
                  {professionals.length === 1 && (
                    <span className="af-hint">Solo un profesional disponible — asignado automáticamente.</span>
                  )}
                </div>
              </div>

              <div className="af-field">
                <div className="af-field-icon">🥗</div>
                <div className="af-field-body">
                  <span className="af-field-label">Dieta asignada <em className="af-optional">(opcional)</em></span>
                  <select value={dietId} onChange={(e) => setDietId(e.target.value)} className="af-input">
                    <option value="">Sin dieta asignada</option>
                    {diets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.objective ? ` · ${d.objective}` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="af-hint">Puedes asignar o cambiar la dieta del paciente desde aquí.</span>
                </div>
              </div>

            </div>
          </div>

          {/* Sección: Fecha & Hora */}
          <div className="af-section">
            <div className="af-section-header">
              <span className="af-section-badge af-badge-green">🕐</span>
              <span className="af-section-title">Fecha y Horario</span>
            </div>
            <div className="af-section-body">

              <div className="af-field">
                <div className="af-field-icon">📌</div>
                <div className="af-field-body">
                  <span className="af-field-label">Título de la cita <em className="af-optional">(opcional)</em></span>
                  <input
                    type="text"
                    className="af-input"
                    placeholder="Ej. Control mensual, Consulta inicial..."
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="af-fields-row">
                <div className="af-field">
                  <div className="af-field-icon">▶️</div>
                  <div className="af-field-body">
                    <span className="af-field-label">Inicio *</span>
                    <input
                      type="datetime-local"
                      className="af-input"
                      value={startAt}
                      onChange={(e) => {
                        setStartAt(e.target.value)
                        setActivePreset(null)
                        setEndAt('')
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="af-field">
                  <div className="af-field-icon">⏹️</div>
                  <div className="af-field-body">
                    <span className="af-field-label">Fin <em className="af-optional">(opcional)</em></span>
                    <input
                      type="datetime-local"
                      className="af-input"
                      value={endAt}
                      onChange={(e) => { setEndAt(e.target.value); setActivePreset(null) }}
                    />
                  </div>
                </div>
              </div>

              {/* Presets duración */}
              <div className="af-duration-row">
                <span className="af-duration-label">⚡ Duración rápida:</span>
                <div className="af-presets">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p.minutes}
                      type="button"
                      className={`af-preset-btn${activePreset === p.minutes ? ' active' : ''}`}
                      onClick={() => applyQuick(p.minutes)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div className="af-field">
                <div className="af-field-icon">📝</div>
                <div className="af-field-body">
                  <span className="af-field-label">Notas <em className="af-optional">(opcional)</em></span>
                  <textarea
                    rows={3}
                    className="af-textarea"
                    placeholder="Motivo de la consulta, recordatorios, indicaciones especiales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}

          <div className="af-form-actions">
            {onDelete && (
              <button type="button" className="af-btn-delete" onClick={onDelete}>
                🗑️ Eliminar cita
              </button>
            )}
            <div className="af-actions-right">
              <button type="button" className="af-btn-cancel" onClick={onCancel}>Cancelar</button>
              <button type="submit" className="af-btn-save" disabled={submitting}>
                {submitting ? <><span className="mf-spinner" /> Guardando…</> : <><span>💾</span> Guardar cita</>}
              </button>
            </div>
          </div>

        </div>

        {/* ── Right Summary Panel ──────────────────────────────── */}
        <aside className="af-summary-col">
          <div className="af-summary-card">
            <div className="af-summary-header">📋 Resumen de la cita</div>
            <div className="af-summary-body">

              <div className="af-summary-row">
                <span className="af-summary-label">🏥 Paciente</span>
                <span className="af-summary-val">
                  {selectedPatient ? selectedPatient.fullName : <em>No seleccionado</em>}
                </span>
              </div>

              <div className="af-summary-row">
                <span className="af-summary-label">👨‍⚕️ Profesional</span>
                <span className="af-summary-val">
                  {selectedProfessional
                    ? `${selectedProfessional.fullName} (${roleLabel(selectedProfessional.role)})`
                    : <em>No seleccionado</em>}
                </span>
              </div>

              {selectedDiet && (
                <div className="af-summary-row">
                  <span className="af-summary-label">🥗 Dieta</span>
                  <span className="af-summary-val">{selectedDiet.name}</span>
                </div>
              )}

              {startDate && (
                <div className="af-summary-date-hero">
                  <div className="af-date-badge">
                    <span className="af-date-day">
                      {startDate.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase()}
                    </span>
                    <strong className="af-date-num">{startDate.getDate()}</strong>
                    <span className="af-date-month">
                      {startDate.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}
                    </span>
                  </div>
                  <div className="af-time-block">
                    <span className="af-time-val">
                      {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {endDate && (
                      <>
                        <span className="af-time-sep">→</span>
                        <span className="af-time-val">
                          {endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                  {durationMin !== null && durationMin > 0 && (
                    <div className="af-duration-badge">
                      ⏱ {durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ''}`
                        : `${durationMin} min`}
                    </div>
                  )}
                </div>
              )}

              {titleValue && (
                <div className="af-summary-row">
                  <span className="af-summary-label">📌 Título</span>
                  <span className="af-summary-val">{titleValue}</span>
                </div>
              )}

              {notes && (
                <div className="af-summary-notes">
                  <span className="af-summary-label">📝 Notas</span>
                  <p className="af-summary-notes-text">{notes}</p>
                </div>
              )}

              <div className="af-completeness">
                <div className="af-completeness-bar">
                  <div
                    className="af-completeness-fill"
                    style={{ width: `${Math.round((completeness / 3) * 100)}%` }}
                  />
                </div>
                <span className="af-completeness-label">{completeness}/3 campos requeridos</span>
              </div>

            </div>
          </div>
        </aside>

      </form>
    </div>
  )
}
