import { useCallback, useEffect, useState } from 'react'
import { dietsApi } from '../api'
import type { PatientDietDto } from '../api/types'

interface Props {
  patientId: string
  version: number
}

export default function DietHistory({ patientId, version }: Props) {
  const [history, setHistory] = useState<PatientDietDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setHistory(await dietsApi.getHistoryByPatient(patientId))
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, version])

  if (loading) return <p className="loading">Cargando historial de dietas...</p>
  if (history.length === 0) return null

  return (
    <div className="card">
      <h2>Historial de dietas</h2>
      <div className="diet-history-list">
        {history.map((entry) => (
          <div key={entry.id} className={`diet-history-item ${entry.isActive ? 'active' : ''}`}>
            <div className="diet-history-info">
              <strong>{entry.dietName}</strong>
              {entry.objective && <span className="diet-history-objective">{entry.objective}</span>}
              <span className="diet-history-date">
                Asignada el {new Date(entry.assignedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <span className={`badge ${entry.isActive ? '' : 'badge-outline'}`}>
              {entry.isActive ? 'Activa' : 'Anterior'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}