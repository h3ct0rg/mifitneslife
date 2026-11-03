import { useEffect, useId, useMemo, useState } from 'react'
import type { AppointmentDto, CreateAppointmentRequest, DietDto, PatientDto, ProfessionalDto } from '../api/types'
import { roleLabel } from '../api/types'
import PageHeader from './ui/PageHeader'
import { normalizeLocalInput, toLocalIso } from '../utils/localDate'

interface Props {
  title: string
  /** Destino del enlace "volver" (la Agenda en el día seleccionado). */
  backTo: string
  day?: Date
  initial?: AppointmentDto
  patients: PatientDto[]
  professionals: ProfessionalDto[]
  diets: DietDto[]
  /** Debe lanzar Error con mensaje legible si falla (se muestra inline). */
  onSubmit: (payload: CreateAppointmentRequest) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}

/** Valor para `<input type="datetime-local">` en hora local (la API devuelve las citas sin `Z` → local). */
function toLocalInput(d: Date) {
  return toLocalIso(d).slice(0, 16)
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

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h} h${m > 0 ? ` ${m} min` : ''}`
}

/** Editor de cita a página completa: 1 columna en móvil con acciones fijas abajo; resumen lateral en desktop. */
export default function AppointmentForm({
  title,
  backTo,
  day,
  initial,
  patients,
  professionals,
  diets,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const uid = useId()
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
        // Hora elegida tal cual, sin pasar por Date ni UTC (D5): `YYYY-MM-DDTHH:mm:ss` local.
        startAt: normalizeLocalInput(startAt),
        endAt: end && normalizeLocalInput(end),
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
  const durationMin =
    startDate && endDate ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : null

  const completeness = [patientId, professionalId, startAt].filter(Boolean).length
  const errorId = `${uid}-error`

  return (
    <div className="page af-page">
      {/* "Volver" cierra el editor como Cancelar (navigate(-1) o replace), para que el atrás del navegador no lo reabra. */}
      <div
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('.page-header-back')) {
            e.preventDefault()
            onCancel()
          }
        }}
      >
        <PageHeader
          title={title}
          subtitle={initial ? `Cita de ${initial.patientFullName}` : 'Completa los datos para registrar la cita'}
          back={{ to: backTo, label: 'Agenda' }}
        />
      </div>

      <form onSubmit={handleSubmit} className="af-layout" aria-describedby={error ? errorId : undefined} noValidate>
        <div className="af-main-col">
          <fieldset className="card af-section">
            <legend className="af-section-title">
              <span className="material-symbols-outlined" aria-hidden="true">
                group
              </span>
              Participantes
            </legend>

            <div className="field">
              <label htmlFor={`${uid}-patient`}>Paciente *</label>
              <select
                id={`${uid}-patient`}
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                aria-invalid={!!error && !patientId}
              >
                <option value="">Seleccionar paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor={`${uid}-prof`}>Profesional *</label>
              <select
                id={`${uid}-prof`}
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                required
                disabled={professionals.length === 1}
                aria-invalid={!!error && !professionalId}
                aria-describedby={professionals.length === 1 ? `${uid}-prof-hint` : undefined}
              >
                {professionals.length === 0 && <option value="">No hay profesionales disponibles</option>}
                {professionals.length === 1 && (
                  <option value={professionals[0].id}>
                    {professionals[0].fullName} ({roleLabel(professionals[0].role)})
                  </option>
                )}
                {professionals.length > 1 && (
                  <>
                    <option value="">Seleccionar profesional...</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({roleLabel(p.role)})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {professionals.length === 1 && (
                <p className="field-hint" id={`${uid}-prof-hint`}>
                  Único profesional disponible: asignado automáticamente.
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor={`${uid}-diet`}>Dieta asignada (opcional)</label>
              <select
                id={`${uid}-diet`}
                value={dietId}
                onChange={(e) => setDietId(e.target.value)}
                aria-describedby={`${uid}-diet-hint`}
              >
                <option value="">Sin dieta asignada</option>
                {diets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.objective ? ` · ${d.objective}` : ''}
                  </option>
                ))}
              </select>
              <p className="field-hint" id={`${uid}-diet-hint`}>
                Puedes asignar o cambiar la dieta del paciente desde aquí.
              </p>
            </div>
          </fieldset>

          <fieldset className="card af-section">
            <legend className="af-section-title">
              <span className="material-symbols-outlined" aria-hidden="true">
                schedule
              </span>
              Fecha y horario
            </legend>

            <div className="field">
              <label htmlFor={`${uid}-title`}>Título (opcional)</label>
              <input
                id={`${uid}-title`}
                type="text"
                placeholder="Ej. Control mensual, consulta inicial..."
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
              />
            </div>

            <div className="af-fields-row">
              <div className="field">
                <label htmlFor={`${uid}-start`}>Inicio *</label>
                <input
                  id={`${uid}-start`}
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => {
                    setStartAt(e.target.value)
                    setActivePreset(null)
                    setEndAt('')
                  }}
                  required
                  aria-invalid={!!error && !startAt}
                />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-end`}>Fin (opcional)</label>
                <input
                  id={`${uid}-end`}
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => {
                    setEndAt(e.target.value)
                    setActivePreset(null)
                  }}
                />
              </div>
            </div>

            <div className="af-duration" role="group" aria-labelledby={`${uid}-dur`}>
              <span className="field-label" id={`${uid}-dur`}>
                Duración rápida
              </span>
              <div className="af-presets">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.minutes}
                    type="button"
                    className={`af-preset${activePreset === p.minutes ? ' active' : ''}`}
                    aria-pressed={activePreset === p.minutes}
                    onClick={() => applyQuick(p.minutes)}
                    disabled={!quickBase}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor={`${uid}-notes`}>Notas (opcional)</label>
              <textarea
                id={`${uid}-notes`}
                rows={3}
                placeholder="Motivo de la consulta, recordatorios, indicaciones..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </fieldset>

          {error && (
            <div className="error-box" id={errorId} role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">
                error
              </span>
              {error}
            </div>
          )}

          {/* Barra de acciones: fija abajo en móvil (por encima de la bottom-nav). */}
          <div className="af-actions">
            {onDelete && (
              <button type="button" className="btn btn--ghost af-delete" onClick={onDelete} disabled={submitting}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  delete
                </span>
                Eliminar
              </button>
            )}
            <div className="af-actions-right">
              <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting} aria-busy={submitting || undefined}>
                {submitting ? (
                  <>
                    <span className="mf-spinner" aria-hidden="true" /> Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      save
                    </span>
                    Guardar cita
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="af-summary-col" aria-label="Resumen de la cita">
          <div className="card af-summary">
            <h2 className="af-summary-title">Resumen</h2>
            <dl className="af-summary-list">
              <div>
                <dt>Paciente</dt>
                <dd>{selectedPatient ? selectedPatient.fullName : <em>Sin seleccionar</em>}</dd>
              </div>
              <div>
                <dt>Profesional</dt>
                <dd>
                  {selectedProfessional ? (
                    `${selectedProfessional.fullName} (${roleLabel(selectedProfessional.role)})`
                  ) : (
                    <em>Sin seleccionar</em>
                  )}
                </dd>
              </div>
              {selectedDiet && (
                <div>
                  <dt>Dieta</dt>
                  <dd>{selectedDiet.name}</dd>
                </div>
              )}
              {startDate && (
                <div>
                  <dt>Fecha</dt>
                  <dd>
                    {startDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    <br />
                    {startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    {endDate &&
                      ` – ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                    {durationMin !== null && durationMin > 0 && ` (${fmtDuration(durationMin)})`}
                  </dd>
                </div>
              )}
              {titleValue && (
                <div>
                  <dt>Título</dt>
                  <dd>{titleValue}</dd>
                </div>
              )}
            </dl>
            <div className="af-completeness">
              <div
                className="af-completeness-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={3}
                aria-valuenow={completeness}
                aria-label="Campos obligatorios completados"
              >
                <div className="af-completeness-fill" style={{ width: `${Math.round((completeness / 3) * 100)}%` }} />
              </div>
              <span className="text-muted">{completeness}/3 campos obligatorios</span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
