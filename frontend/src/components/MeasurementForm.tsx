import { useState } from 'react'
import type { CreateMeasurementRequest, MeasurementDto } from '../api/types'

interface Props {
  title: string
  initial?: MeasurementDto
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

export default function MeasurementForm({ title, initial, onSubmit, onCancel }: Props) {
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

  const setN = (field: keyof CreateMeasurementRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setValues((v) => ({
      ...v,
      [field]: field === 'notes' ? raw : raw === '' ? undefined : Number(raw),
    }))
  }

  const date = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, visitDate: e.target.value }))

  const setText = (field: 'notes') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
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

          <label className="form-full">
            Notas / observaciones
            <textarea rows={3} value={values.notes ?? ''} onChange={setText('notes')} />
          </label>

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