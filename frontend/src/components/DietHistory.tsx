import { useCallback, useEffect, useState } from 'react'
import { dietsApi } from '../api'
import type { PatientDietDto } from '../api/types'
import StateView from './ui/StateView'

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

  if (loading) return <StateView state="loading" compact title="Cargando historial de dietas..." />
  if (history.length === 0) return null

  return (
    <section className="card" aria-labelledby="diet-history-title">
      <h2 id="diet-history-title">Historial de dietas</h2>
      <ul className="diet-history-list">
        {history.map((entry) => (
          <li key={entry.id} className={`diet-history-item ${entry.isActive ? 'active' : ''}`}>
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
            <span className={`badge ${entry.isActive ? 'badge--success' : 'badge--neutral'}`}>
              {entry.isActive ? 'Activa' : 'Anterior'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}