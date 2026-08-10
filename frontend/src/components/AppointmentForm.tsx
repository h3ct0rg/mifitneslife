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

    // Nuevo: pre-seleccionar el día clicado (siguiente hora en punto)
    const base = day ? new Date(day) : new Date()
    base.setHours(new Date().getHours() + 1, 0, 0, 0)
    setStartAt(toLocalInput(base))

    // Auto-selección: si solo existe un profesional, asignarlo directamente
    if (professionals.length === 1) setProfessionalId(professionals[0].id)

    if (patients.length === 1) setPatientId(patients[0].id)
  }, [initial, day, professionals, patients])

  const quickBase = useMemo(() => parseLocalInput(startAt), [startAt])

  const applyQuick = (minutes: number) => {
    if (!quickBase) return
    const end = new Date(quickBase.getTime() + minutes * 60 * 1000)
    setEndAt(toLocalInput(end))
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

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Título (opcional)
            <input
              type="text"
              placeholder="Ej. Control mensual"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
            />
          </label>

          <label>
            Paciente *
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">Seleccionar paciente...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
          </label>

          <label>
            Profesional *
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              required
              disabled={professionals.length === 1}
            >
              {professionals.length === 0 && <option value="">No hay profesionales disponibles</option>}
              {professionals.length === 1 && (
                <option value={professionals[0].id}>
                  {professionals[0].fullName} ({roleLabel(professionals[0].role)}) — asignado
                </option>
              )}
              {professionals.length > 1 &&
                professionals.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} ({roleLabel(p.role)})</option>
                ))}
            </select>
            {professionals.length === 1 && (
              <span className="hint">Solo hay un profesional en el sistema; se asignó automáticamente.</span>
            )}
          </label>

          <label>
            Dieta asignada (opcional)
            <select value={dietId} onChange={(e) => setDietId(e.target.value)}>
              <option value="">Sin dieta asignada</option>
              {diets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.objective ? ` · ${d.objective}` : ''}
                </option>
              ))}
            </select>
            <span className="hint">Puedes asignar o cambiar la dieta del paciente desde aquí.</span>
          </label>

          <label>
            Fecha y hora de inicio *
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>

          <label>
            Hora de fin (opcional)
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>

          <div className="quick-chip-row">
            <span>Duración:</span>
            <button type="button" className="chip" onClick={() => applyQuick(30)}>30 min</button>
            <button type="button" className="chip" onClick={() => applyQuick(60)}>1 h</button>
            <button type="button" className="chip" onClick={() => applyQuick(90)}>1 h 30</button>
          </div>

          <label>
            Notas (opcional)
            <textarea
              rows={3}
              placeholder="Motivo de la consulta, recordatorios..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <div className="modal-actions modal-actions-between">
            {onDelete && (
              <button type="button" className="btn-danger-soft" onClick={() => onDelete()}>
                Eliminar
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-ghost" onClick={onCancel}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar cita'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}