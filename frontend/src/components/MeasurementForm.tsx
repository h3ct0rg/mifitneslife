import { useState } from 'react'
import type { CreateMeasurementRequest, DietDto, MeasurementDto } from '../api/types'
import RichTextEditor from './RichTextEditor'

interface Props {
  title: string
  initial?: MeasurementDto
  diets?: DietDto[]
  assignedDietId?: string
  onDietChange?: (dietId: string) => void
  onSubmit: (payload: CreateMeasurementRequest) => Promise<void>
  onCancel: () => void
}

const EMPTY: CreateMeasurementRequest = {
  visitDate: new Date().toISOString().slice(0, 10),
  weightKg: undefined,
  heightCm: undefined,
  bodyFatPct: undefined,
  muscleMassKg: undefined,
  boneMassKg: undefined,
  bodyWaterPct: undefined,
  basalMetabolism: undefined,
  chestCm: undefined,
  waistCm: undefined,
  hipCm: undefined,
  armCm: undefined,
  forearmCm: undefined,
  thighCm: undefined,
  calfCm: undefined,
  neckCm: undefined,
  heartRateBpm: undefined,
  systolicMmHg: undefined,
  diastolicMmHg: undefined,
  oxygenSaturationPct: undefined,
  respiratoryRate: undefined,
  temperatureC: undefined,
  notes: '',
}

function num(v?: number) {
  return v == null ? '' : String(v)
}

export default function MeasurementForm({ title, initial, diets, assignedDietId, onDietChange, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<CreateMeasurementRequest>(() => {
    if (!initial) return EMPTY
    return {
      visitDate: initial.visitDate.slice(0, 10),
      weightKg: initial.weightKg,
      heightCm: initial.heightCm,
      bodyFatPct: initial.bodyFatPct,
      muscleMassKg: initial.muscleMassKg,
      boneMassKg: initial.boneMassKg,
      bodyWaterPct: initial.bodyWaterPct,
      basalMetabolism: initial.basalMetabolism,
      chestCm: initial.chestCm,
      waistCm: initial.waistCm,
      hipCm: initial.hipCm,
      armCm: initial.armCm,
      forearmCm: initial.forearmCm,
      thighCm: initial.thighCm,
      calfCm: initial.calfCm,
      neckCm: initial.neckCm,
      heartRateBpm: initial.heartRateBpm,
      systolicMmHg: initial.systolicMmHg,
      diastolicMmHg: initial.diastolicMmHg,
      oxygenSaturationPct: initial.oxygenSaturationPct,
      respiratoryRate: initial.respiratoryRate,
      temperatureC: initial.temperatureC,
      notes: initial.notes ?? '',
    }
  })

  const [submitting, setSubmitting] = useState(false)
  const [dietId, setDietId] = useState(assignedDietId ?? '')

  const setN = (field: keyof CreateMeasurementRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setValues((v) => ({
      ...v,
      [field]: field === 'notes' ? raw : raw === '' ? undefined : Number(raw),
    }))
  }

  const date = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, visitDate: e.target.value }))

  const setNotes = (html: string) => setValues((v) => ({ ...v, notes: html }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
      onDietChange?.(dietId)
    } finally {
      setSubmitting(false)
    }
  }

  const input = (label: string, field: keyof CreateMeasurementRequest, placeholder = '') => (
    <label>
      {label}
      <input
        type="number"
        step="0.1"
        placeholder={placeholder}
        value={num(values[field] as number | undefined)}
        onChange={setN(field)}
      />
    </label>
  )

  return (
    <div className="modal-overlay">
      <div className="modal modal-wide">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Fecha de la visita *
            <input type="date" value={values.visitDate} onChange={date} required />
          </label>

          {diets && onDietChange && (
            <label>
              Dieta asignada
              <select value={dietId} onChange={(e) => setDietId(e.target.value)}>
                <option value="">Sin dieta asignada</option>
                {diets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.objective ? ` · ${d.objective}` : ''}
                  </option>
                ))}
              </select>
              <span className="hint">Si cambias la dieta, se asignará al paciente al guardar la visita.</span>
            </label>
          )}

          <h3 className="fieldset-title">Composición corporal</h3>
          <div className="form-grid">
            {input('Peso (kg)', 'weightKg')}
            {input('Altura (cm)', 'heightCm')}
            {input('% grasa corporal', 'bodyFatPct')}
            {input('Masa muscular (kg)', 'muscleMassKg')}
            {input('Masa ósea (kg)', 'boneMassKg')}
            {input('% agua corporal', 'bodyWaterPct')}
            {input('Metabolismo basal', 'basalMetabolism')}
          </div>

          <h3 className="fieldset-title">Circunferencias (cm)</h3>
          <div className="form-grid">
            {input('Pecho (cm)', 'chestCm')}
            {input('Cintura (cm)', 'waistCm')}
            {input('Cadera (cm)', 'hipCm')}
            {input('Brazo (cm)', 'armCm')}
            {input('Antebrazo (cm)', 'forearmCm')}
            {input('Muslo (cm)', 'thighCm')}
            {input('Pantorrilla (cm)', 'calfCm')}
            {input('Cuello (cm)', 'neckCm')}
          </div>

          <h3 className="fieldset-title">Signos vitales</h3>
          <div className="form-grid">
            {input('FC (lpm)', 'heartRateBpm')}
            {input('Sistólica (mmHg)', 'systolicMmHg')}
            {input('Diastólica (mmHg)', 'diastolicMmHg')}
            {input('Saturación O₂ (%)', 'oxygenSaturationPct')}
            {input('Frec. respiratoria', 'respiratoryRate')}
            {input('Temperatura (°C)', 'temperatureC')}
          </div>

          <div className="notes-section">
            <label className="notes-label">Notas / observaciones</label>
            <RichTextEditor value={values.notes ?? ''} onChange={setNotes} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}