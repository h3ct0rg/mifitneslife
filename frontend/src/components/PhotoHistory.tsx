import { useCallback, useEffect, useState } from 'react'
import { patientPhotosApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { PatientPhotoDto } from '../api/types'
import AuthImage from './AuthImage'
import Modal from './Modal'
import StateView from './ui/StateView'

interface Props {
  patientId: string
  version: number
}

type Side = 'before' | 'after'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

export default function PhotoHistory({ patientId, version }: Props) {
  const [photos, setPhotos] = useState<PatientPhotoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<Side | null>(null)
  const [before, setBefore] = useState<PatientPhotoDto | null>(null)
  const [after, setAfter] = useState<PatientPhotoDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await patientPhotosApi.list(patientId)
      setPhotos(list)
      // La más reciente = "después", la anterior = "antes"
      setAfter(list[0] ?? null)
      setBefore(list[1] ?? null)
    } catch (err) {
      setError(getErrorMessage(err))
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

  if (loading) return <StateView state="loading" title="Cargando fotos..." />

  const selectedId = pickerFor === 'before' ? before?.id : after?.id

  return (
    <section className="card" aria-labelledby="photo-history-title">
      <div className="panel-head">
        <h2 id="photo-history-title">Historial de fotos</h2>
        {photos.length > 0 && <span className="panel-head-meta">{photos.length} fotos</span>}
      </div>

      {error ? (
        <StateView
          state="error"
          message={error}
          action={
            <button type="button" className="btn btn--ghost" onClick={load}>
              Reintentar
            </button>
          }
        />
      ) : photos.length === 0 ? (
        <StateView state="empty" icon="photo_library" title="Aún no hay fotos registradas" />
      ) : (
        <div className="photo-compare">
          {(['before', 'after'] as const).map((side) => {
            const photo = side === 'before' ? before : after
            return (
              <figure key={side} className="photo-compare-item">
                <figcaption className={`photo-compare-label ${side}`}>{side === 'before' ? 'Antes' : 'Después'}</figcaption>
                {photo ? (
                  <AuthImage
                    fileName={photo.fileName}
                    alt={`Foto ${side === 'before' ? 'antes' : 'después'} del ${fmtDate(photo.takenAt)}`}
                    className="photo-compare-img"
                    fallbackText="Foto"
                  />
                ) : (
                  <div className="photo-compare-empty">{side === 'before' ? 'Sin foto anterior' : 'Sin foto reciente'}</div>
                )}
                {photo && <span className="photo-compare-date">{fmtDate(photo.takenAt)}</span>}
                <button type="button" className="btn btn--ghost btn-sm" onClick={() => setPickerFor(side)}>
                  Cambiar foto
                </button>
              </figure>
            )
          })}
        </div>
      )}

      {pickerFor && (
        <Modal
          title={pickerFor === 'before' ? 'Elegir foto "Antes"' : 'Elegir foto "Después"'}
          onClose={() => setPickerFor(null)}
          className="modal-photo-gallery"
          closeOnBackdrop
        >
          <div className="photo-gallery">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`photo-gallery-item${selectedId === p.id ? ' selected' : ''}`}
                aria-pressed={selectedId === p.id}
                onClick={() => pick(pickerFor, p)}
              >
                <AuthImage fileName={p.fileName} alt="" className="photo-gallery-img" fallbackText="Foto" />
                <span className="photo-gallery-date">{fmtDate(p.takenAt)}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
