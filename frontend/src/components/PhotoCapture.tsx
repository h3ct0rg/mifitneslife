import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

interface Props {
  onCapture: (file: File) => Promise<void>
  onCancel: () => void
}

export default function PhotoCapture({ onCapture, onCancel }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Pista para el navegador: si estamos en móvil, mostrar la cámara frontal/trasera.
    cameraInputRef.current?.click()
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelected(file)
    setError(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const handleSubmit = async () => {
    if (!selected) {
      setError('Selecciona o toma una foto primero.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCapture(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la foto.')
      setSubmitting(false)
    }
  }

  const close = () => {
    if (!submitting) onCancel()
  }

  return (
    <Modal
      title="Foto del paciente"
      onClose={close}
      className="modal-photo"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting || !selected}
            aria-busy={submitting || undefined}
          >
            {submitting && <span className="mf-spinner" aria-hidden="true" />}
            {submitting ? 'Guardando...' : 'Guardar foto'}
          </button>
        </>
      }
    >
      <p className="modal-subtitle">Toma una foto o elige una de la galería. Se guardará con la fecha de hoy.</p>

      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt="Vista previa de la foto seleccionada" />
        </div>
      ) : (
        <div className="photo-placeholder">
          <span className="material-symbols-outlined" aria-hidden="true">
            add_a_photo
          </span>
          <span>Aún no hay foto seleccionada</span>
        </div>
      )}

      {error && <div className="error-box" role="alert">{error}</div>}

      {/* Cámara (móvil) y galería: inputs ocultos que se abren con los botones */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={handleFile} />

      <div className="photo-actions">
        <button type="button" className="btn btn--secondary" onClick={() => cameraInputRef.current?.click()} disabled={submitting}>
          <span className="material-symbols-outlined" aria-hidden="true">
            photo_camera
          </span>
          Tomar foto
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => galleryInputRef.current?.click()} disabled={submitting}>
          <span className="material-symbols-outlined" aria-hidden="true">
            photo_library
          </span>
          Elegir de galería
        </button>
      </div>
    </Modal>
  )
}