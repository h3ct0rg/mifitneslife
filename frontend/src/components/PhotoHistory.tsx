import { useCallback, useEffect, useState } from 'react'
import { patientPhotosApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { PatientPhotoDto } from '../api/types'
import AuthImage from './AuthImage'

interface Props {
  patientId: string
  version: number
}

type Side = 'before' | 'after'

export default function PhotoHistory({ patientId, version }: Props) {
  const [photos, setPhotos] = useState<PatientPhotoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pickerFor, setPickerFor] = useState<Side | null>(null)
  const [before, setBefore] = useState<PatientPhotoDto | null>(null)
  const [after, setAfter] = useState<PatientPhotoDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const list = await patientPhotosApi.list(patientId)
      setPhotos(list)
      // La más reciente = "después", la anterior = "antes"
      setAfter(list[0] ?? null)
      setBefore(list[1] ?? null)
    } catch (err) {
      setMessage({ type: 'err', text: getErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, version])

  const pick = (side: Side, photo: PatientPhotoDto) => {
    if (side === 'before') setBefore(photo)
    else setAfter(photo)
    setPickerFor(null)
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  if (loading) return <p className="loading">Cargando fotos...</p>

  return (
    <div className="card">
      <div className="photo-history-head">
        <h2>Historial de fotos</h2>
        {photos.length > 0 && <span className="photo-count">{photos.length} fotos</span>}
      </div>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      {photos.length === 0 ? (
        <p className="empty-state">
          Aún no hay fotos registradas. Usa el botón "Foto" para tomar o subir la primera.
        </p>
      ) : (
        <>
          <div className="photo-compare">
            <div className="photo-compare-item">
              <span className="photo-compare-label before">Antes</span>
              {before ? (
                <AuthImage fileName={before.fileName} className="photo-compare-img" fallbackText="Foto" />
              ) : (
                <div className="photo-compare-empty">Sin foto anterior</div>
              )}
              {before && <span className="photo-compare-date">{fmtDate(before.takenAt)}</span>}
              <button type="button" className="btn-ghost btn-sm" onClick={() => setPickerFor('before')}>
                Cambiar foto
              </button>
            </div>

            <div className="photo-compare-arrow">→</div>

            <div className="photo-compare-item">
              <span className="photo-compare-label after">Después</span>
              {after ? (
                <AuthImage fileName={after.fileName} className="photo-compare-img" fallbackText="Foto" />
              ) : (
                <div className="photo-compare-empty">Sin foto reciente</div>
              )}
              {after && <span className="photo-compare-date">{fmtDate(after.takenAt)}</span>}
              <button type="button" className="btn-ghost btn-sm" onClick={() => setPickerFor('after')}>
                Cambiar foto
              </button>
            </div>
          </div>

          {pickerFor && (
            <div className="modal-overlay" onClick={() => setPickerFor(null)}>
              <div className="modal modal-photo-gallery" onClick={(e) => e.stopPropagation()}>
                <div className="photo-history-head">
                  <h2>{pickerFor === 'before' ? 'Elegir foto "Antes"' : 'Elegir foto "Después"'}</h2>
                  <button type="button" className="btn-ghost" onClick={() => setPickerFor(null)}>Cerrar</button>
                </div>
                <div className="photo-gallery">
                  {photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`photo-gallery-item ${before?.id === p.id && pickerFor === 'before' ? 'selected' : ''} ${after?.id === p.id && pickerFor === 'after' ? 'selected' : ''}`}
                      onClick={() => pick(pickerFor, p)}
                    >
                      <AuthImage fileName={p.fileName} className="photo-gallery-img" fallbackText="Foto" />
                      <span className="photo-gallery-date">{fmtDate(p.takenAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}