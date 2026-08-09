import { useRef, useState } from 'react'
import { uploadImage } from '../api'
import AuthImage from './AuthImage'

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

export default function PatientForm({
  title,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<PatientFormValues>(
    initial ?? { firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', notes: '' },
  )
  const [photo, setPhoto] = useState(initial?.profilePhotoUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    } catch (err) {
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

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-photo">
            {photo ? (
              <AuthImage fileName={photo} alt="Foto de perfil" className="form-avatar" fallbackText="Sin foto" />
            ) : (
              <div className="form-avatar empty">Sin foto</div>
            )}
            <div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : initial ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {uploadError && <p className="error-text">{uploadError}</p>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          <div className="form-grid">
            <label>
              Nombre *
              <input value={values.firstName} onChange={set('firstName')} required />
            </label>
            <label>
              Apellido *
              <input value={values.lastName} onChange={set('lastName')} required />
            </label>
            <label>
              Email *
              <input type="email" value={values.email} onChange={set('email')} required />
            </label>
            <label>
              Teléfono
              <input type="tel" value={values.phone} onChange={set('phone')} />
            </label>
            <label>
              Fecha de nacimiento
              <input type="date" value={values.dateOfBirth} onChange={set('dateOfBirth')} />
            </label>
            <label className="form-full">
              Notas
              <textarea value={values.notes} onChange={set('notes')} rows={3} />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}