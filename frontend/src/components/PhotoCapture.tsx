import { useEffect, useRef, useState } from 'react'

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

  return (
    <div className="modal-overlay" onClick={() => !submitting && onCancel()}>
      <div className="modal modal-photo" onClick={(e) => e.stopPropagation()}>
        <h2>Foto del paciente</h2>
        <p className="modal-subtitle">Toma una foto o elige una de la galería. Se guardará con la fecha de hoy.</p>

        {preview ? (
          <div className="photo-preview">
            <img src={preview} alt="Vista previa" />
          </div>
        ) : (
          <div className="photo-placeholder">📷</div>
        )}

        {error && <div className="error-box">{error}</div>}

        {/* Cámara (móvil) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        {/* Galería */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        <div className="photo-actions">
          <button type="button" className="btn-ghost" onClick={() => cameraInputRef.current?.click()} disabled={submitting}>
            📷 Tomar foto
          </button>
          <button type="button" className="btn-ghost" onClick={() => galleryInputRef.current?.click()} disabled={submitting}>
            🖼 Elegir de galería
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting ? 'Guardando...' : 'Guardar foto'}
          </button>
        </div>
      </div>
    </div>
  )
}