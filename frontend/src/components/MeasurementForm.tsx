import { useId, useState } from 'react'
import type { CreateMeasurementRequest, DietDto, MeasurementDto } from '../api/types'
import Modal from './Modal'
import RichTextEditor from './RichTextEditor'
import { toLocalDateKey } from '../utils/localDate'

interface Props {
  title: string
  initial?: MeasurementDto
  diets?: DietDto[]
  assignedDietId?: string
  onDietChange?: (dietId: string) => void
  onSubmit: (payload: CreateMeasurementRequest) => Promise<void>
  onCancel: () => void
  /** Fecha `YYYY-MM-DD` por defecto en altas (p. ej. el día de la cita); si falta, hoy en hora local. */
  defaultVisitDate?: string
}

type NumericKey = Exclude<keyof CreateMeasurementRequest, 'visitDate' | 'notes'>

interface NumericField {
  key: NumericKey
  label: string
  unit: string
}

const SECTIONS: { title: string; icon: string; fields: NumericField[] }[] = [
  {
    title: 'Composición corporal',
    icon: 'monitor_weight',
    fields: [
      { key: 'weightKg', label: 'Peso', unit: 'kg' },
      { key: 'heightCm', label: 'Altura', unit: 'cm' },
      { key: 'bodyFatPct', label: 'Grasa corporal', unit: '%' },
      { key: 'muscleMassKg', label: 'Masa muscular', unit: 'kg' },
      { key: 'boneMassKg', label: 'Masa ósea', unit: 'kg' },
      { key: 'bodyWaterPct', label: 'Agua corporal', unit: '%' },
      { key: 'basalMetabolism', label: 'Metabolismo basal', unit: 'kcal' },
    ],
  },
  {
    title: 'Circunferencias',
    icon: 'straighten',
    fields: [
      { key: 'chestCm', label: 'Pecho', unit: 'cm' },
      { key: 'waistCm', label: 'Cintura', unit: 'cm' },
      { key: 'hipCm', label: 'Cadera', unit: 'cm' },
      { key: 'armCm', label: 'Brazo', unit: 'cm' },
      { key: 'forearmCm', label: 'Antebrazo', unit: 'cm' },
      { key: 'thighCm', label: 'Muslo', unit: 'cm' },
      { key: 'calfCm', label: 'Pantorrilla', unit: 'cm' },
      { key: 'neckCm', label: 'Cuello', unit: 'cm' },
    ],
  },
  {
    title: 'Signos vitales',
    icon: 'favorite',
    fields: [
      { key: 'heartRateBpm', label: 'Frec. cardíaca', unit: 'lpm' },
      { key: 'systolicMmHg', label: 'Presión sistólica', unit: 'mmHg' },
      { key: 'diastolicMmHg', label: 'Presión diastólica', unit: 'mmHg' },
      { key: 'oxygenSaturationPct', label: 'Saturación O₂', unit: '%' },
      { key: 'respiratoryRate', label: 'Frec. respiratoria', unit: 'rpm' },
      { key: 'temperatureC', label: 'Temperatura', unit: '°C' },
    ],
  },
]

const ALL_NUMERIC: NumericKey[] = SECTIONS.flatMap((s) => s.fields.map((f) => f.key))

function num(v?: number) {
  return v == null ? '' : String(v)
}

function initialValues(initial?: MeasurementDto, defaultVisitDate?: string): CreateMeasurementRequest {
  const values: CreateMeasurementRequest = {
    // Fecha local (no UTC): de noche en UTC-4 toISOString() ya daba el día siguiente.
    visitDate: initial ? initial.visitDate.slice(0, 10) : (defaultVisitDate ?? toLocalDateKey(new Date())),
    notes: initial?.notes ?? '',
  }
  for (const key of ALL_NUMERIC) values[key] = initial?.[key]
  return values
}

/** Registro/edición de una visita (mediciones) en Modal: hoja en móvil con "Guardar" fijo al pie. */
export default function MeasurementForm({
  title,
  initial,
  diets,
  assignedDietId,
  onDietChange,
  onSubmit,
  onCancel,
  defaultVisitDate,
}: Props) {
  const [values, setValues] = useState<CreateMeasurementRequest>(() => initialValues(initial, defaultVisitDate))
  const [submitting, setSubmitting] = useState(false)
  const [dietId, setDietId] = useState(assignedDietId ?? '')
  const formId = useId()
  const uid = useId()

  const setN = (field: NumericKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setValues((v) => ({ ...v, [field]: raw === '' ? undefined : Number(raw) }))
  }

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

  const close = () => {
    if (!submitting) onCancel()
  }

  return (
    <Modal
      title={title}
      onClose={close}
      className="modal-wide"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn--primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
          >
            {submitting ? (
              <>
                <span className="mf-spinner" aria-hidden="true" /> Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" aria-hidden="true">
                  save
                </span>
                Guardar visita
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="clin-form">
        <fieldset className="mf-section">
          <legend className="mf-section-title">
            <span className="material-symbols-outlined" aria-hidden="true">
              event
            </span>
            Información de la visita
          </legend>
          <div className="mf-fields-grid">
            <div className="field">
              <label htmlFor={`${uid}-date`}>Fecha de la visita *</label>
              <input
                id={`${uid}-date`}
                type="date"
                value={values.visitDate}
                onChange={(e) => setValues((v) => ({ ...v, visitDate: e.target.value }))}
                required
              />
            </div>
            {diets && onDietChange && (
              <div className="field">
                <label htmlFor={`${uid}-diet`}>Dieta asignada</label>
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
                  Se asignará al guardar la visita.
                </p>
              </div>
            )}
          </div>
        </fieldset>

        {SECTIONS.map((section) => (
          <fieldset key={section.title} className="mf-section">
            <legend className="mf-section-title">
              <span className="material-symbols-outlined" aria-hidden="true">
                {section.icon}
              </span>
              {section.title}
            </legend>
            <div className="mf-fields-grid">
              {section.fields.map((f) => (
                <div key={f.key} className="field">
                  <label htmlFor={`${uid}-${f.key}`}>{f.label}</label>
                  <div className="mf-input-wrap">
                    <input
                      id={`${uid}-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      placeholder="—"
                      value={num(values[f.key])}
                      onChange={setN(f.key)}
                      aria-describedby={`${uid}-${f.key}-unit`}
                    />
                    <span className="mf-unit" id={`${uid}-${f.key}-unit`}>
                      {f.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        <fieldset className="mf-section">
          <legend className="mf-section-title" id={`${uid}-notes`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              notes
            </span>
            Notas y observaciones
          </legend>
          <RichTextEditor value={values.notes ?? ''} onChange={setNotes} labelledBy={`${uid}-notes`} />
        </fieldset>
      </form>
    </Modal>
  )
}
