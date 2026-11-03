import { useId, useRef, useState } from 'react'
import { uploadImage } from '../api'
import AuthImage from './AuthImage'
import Modal from './Modal'

export interface PatientFormValues {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  notes: string
  profilePhotoUrl?: string
}

interface Props {
  title: string
  initial?: PatientFormValues
  submitLabel: string
  onSubmit: (values: PatientFormValues) => Promise<void>
  onCancel: () => void
}

/** Alta/edición de paciente en Modal (hoja en móvil, acciones fijas al pie). */
export default function PatientForm({ title, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<PatientFormValues>(
    initial ?? { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', notes: '' },
  )
  const [photo, setPhoto] = useState(initial?.profilePhotoUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formId = useId()
  const uid = useId()

  const set = (field: keyof PatientFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setValues((v) => ({ ...v, [field]: e.target.value }))

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadImage(file)
      setPhoto(url)
      setValues((v) => ({ ...v, profilePhotoUrl: url }))
    } catch {
      setUploadError('No se pudo subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
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
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="btn btn--primary"
            disabled={submitting || uploading}
            aria-busy={submitting || undefined}
          >
            {submitting && <span className="mf-spinner" aria-hidden="true" />}
            {submitting ? 'Guardando...' : submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="clin-form">
        <div className="form-photo">
          {photo ? (
            <AuthImage fileName={photo} alt="Foto de perfil" className="form-avatar" fallbackText="Sin foto" />
          ) : (
            <div className="form-avatar empty">Sin foto</div>
          )}
          <div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-busy={uploading || undefined}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                photo_camera
              </span>
              {uploading ? 'Subiendo...' : photo ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {uploadError && (
              <p className="field-error" role="alert">
                {uploadError}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFile}
          />
        </div>

        <div className="clin-form-grid">
          <div className="field">
            <label htmlFor={`${uid}-first`}>Nombre *</label>
            <input id={`${uid}-first`} value={values.firstName} onChange={set('firstName')} required autoComplete="given-name" />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-last`}>Apellido *</label>
            <input id={`${uid}-last`} value={values.lastName} onChange={set('lastName')} required autoComplete="family-name" />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-email`}>Email *</label>
            <input
              id={`${uid}-email`}
              type="email"
              inputMode="email"
              value={values.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-phone`}>Teléfono</label>
            <input
              id={`${uid}-phone`}
              type="tel"
              inputMode="tel"
              value={values.phone}
              onChange={set('phone')}
              autoComplete="tel"
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-dob`}>Fecha de nacimiento</label>
            <input id={`${uid}-dob`} type="date" value={values.dateOfBirth} onChange={set('dateOfBirth')} />
          </div>
          <div className="field clin-form-full">
            <label htmlFor={`${uid}-notes`}>Notas</label>
            <textarea id={`${uid}-notes`} value={values.notes} onChange={set('notes')} rows={3} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
