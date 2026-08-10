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

  /** Campo numérico con unidad badge */
  const field = (
    label: string,
    fieldKey: keyof CreateMeasurementRequest,
    unit: string,
    icon: string
  ) => (
    <div className="mf-field">
      <div className="mf-field-icon">{icon}</div>
      <div className="mf-field-body">
        <span className="mf-field-label">{label}</span>
        <div className="mf-field-input-wrap">
          <input
            type="number"
            step="0.1"
            placeholder="—"
            value={num(values[fieldKey] as number | undefined)}
            onChange={setN(fieldKey)}
            className="mf-input"
          />
          {unit && <span className="mf-unit">{unit}</span>}
        </div>
      </div>
    </div>
  )

  return (
    <div className="mf-overlay">
      <div className="mf-modal">

        {/* Header */}
        <div className="mf-header">
          <div className="mf-header-icon">📋</div>
          <div className="mf-header-text">
            <h2 className="mf-title">{title}</h2>
            <p className="mf-subtitle">Registra las métricas y observaciones de la consulta</p>
          </div>
          <button className="mf-close" type="button" onClick={onCancel} aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mf-form">

          {/* Información de la visita */}
          <div className="mf-section">
            <div className="mf-section-header">
              <span className="mf-section-badge mf-badge-blue">📅</span>
              <span className="mf-section-title">Información de la visita</span>
            </div>
            <div className="mf-meta-grid">
              <div className="mf-field">
                <div className="mf-field-icon">📅</div>
                <div className="mf-field-body">
                  <span className="mf-field-label">Fecha de la visita *</span>
                  <div className="mf-field-input-wrap">
                    <input type="date" value={values.visitDate} onChange={date} required className="mf-input" />
                  </div>
                </div>
              </div>

              {diets && onDietChange && (
                <div className="mf-field">
                  <div className="mf-field-icon">🥗</div>
                  <div className="mf-field-body">
                    <span className="mf-field-label">Dieta asignada</span>
                    <div className="mf-field-input-wrap">
                      <select value={dietId} onChange={(e) => setDietId(e.target.value)} className="mf-input">
                        <option value="">Sin dieta asignada</option>
                        {diets.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.objective ? ` · ${d.objective}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="mf-hint">Se asignará al guardar la visita</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composición corporal */}
          <div className="mf-section">
            <div className="mf-section-header">
              <span className="mf-section-badge mf-badge-green">⚖️</span>
              <span className="mf-section-title">Composición corporal</span>
            </div>
            <div className="mf-fields-grid">
              {field('Peso', 'weightKg', 'kg', '⚖️')}
              {field('Altura', 'heightCm', 'cm', '📏')}
              {field('Grasa corporal', 'bodyFatPct', '%', '🔥')}
              {field('Masa muscular', 'muscleMassKg', 'kg', '💪')}
              {field('Masa ósea', 'boneMassKg', 'kg', '🦴')}
              {field('Agua corporal', 'bodyWaterPct', '%', '💧')}
              {field('Metabolismo basal', 'basalMetabolism', 'kcal', '⚡')}
            </div>
          </div>

          {/* Circunferencias */}
          <div className="mf-section">
            <div className="mf-section-header">
              <span className="mf-section-badge mf-badge-purple">📐</span>
              <span className="mf-section-title">Circunferencias</span>
            </div>
            <div className="mf-fields-grid">
              {field('Pecho', 'chestCm', 'cm', '👕')}
              {field('Cintura', 'waistCm', 'cm', '📐')}
              {field('Cadera', 'hipCm', 'cm', '📐')}
              {field('Brazo', 'armCm', 'cm', '💪')}
              {field('Antebrazo', 'forearmCm', 'cm', '🦾')}
              {field('Muslo', 'thighCm', 'cm', '🦵')}
              {field('Pantorrilla', 'calfCm', 'cm', '🦵')}
              {field('Cuello', 'neckCm', 'cm', '🪢')}
            </div>
          </div>

          {/* Signos vitales */}
          <div className="mf-section">
            <div className="mf-section-header">
              <span className="mf-section-badge mf-badge-red">❤️</span>
              <span className="mf-section-title">Signos vitales</span>
            </div>
            <div className="mf-fields-grid">
              {field('Frec. cardíaca', 'heartRateBpm', 'lpm', '❤️')}
              {field('Presión sistólica', 'systolicMmHg', 'mmHg', '🩺')}
              {field('Presión diastólica', 'diastolicMmHg', 'mmHg', '🩺')}
              {field('Saturación O₂', 'oxygenSaturationPct', '%', '🫁')}
              {field('Frec. respiratoria', 'respiratoryRate', 'rpm', '🌬️')}
              {field('Temperatura', 'temperatureC', '°C', '🌡️')}
            </div>
          </div>

          {/* Notas */}
          <div className="mf-section">
            <div className="mf-section-header">
              <span className="mf-section-badge mf-badge-amber">📝</span>
              <span className="mf-section-title">Notas y observaciones</span>
            </div>
            <div className="mf-notes-wrap">
              <RichTextEditor value={values.notes ?? ''} onChange={setNotes} />
            </div>
          </div>

          {/* Acciones */}
          <div className="mf-actions">
            <button type="button" className="mf-btn-cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="mf-btn-save" disabled={submitting}>
              {submitting ? (
                <><span className="mf-spinner" /> Guardando…</>
              ) : (
                <><span>💾</span> Guardar visita</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}