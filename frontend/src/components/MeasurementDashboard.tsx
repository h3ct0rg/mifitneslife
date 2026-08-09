import { useEffect, useState } from 'react'
import { measurementsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { MeasurementDashboardDto } from '../api/types'
import TrendChart from './TrendChart'

function DeltaRow({ d }: { d: { label: string; first?: number; last?: number; change?: number; unit: string } }) {
  const dir = (d.change ?? 0) > 0 ? 'up' : (d.change ?? 0) < 0 ? 'down' : 'same'
  return (
    <tr>
      <td>{d.label}</td>
      <td>{d.first ?? '—'}</td>
      <td>{d.last ?? '—'}</td>
      <td className={`delta delta-${dir}`}>
        {d.change != null && d.change > 0 ? '+' : ''}
        {d.change ?? '—'} {d.unit}
      </td>
    </tr>
  )
}

export default function MeasurementDashboard({ patientId }: { patientId: string }) {
  const [data, setData] = useState<MeasurementDashboardDto | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    measurementsApi
      .dashboard(patientId)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)))
  }, [patientId])

  if (error) return <p className="text-muted">Error: {error}</p>
  if (!data) return <p className="text-muted">Cargando evolución...</p>

  const idx = data.latestIndexes

  return (
    <>
      <div className="stats">
        <div className="stat-card">
          <strong>{idx?.imc ?? '—'}</strong>
          <span>IMC · {idx?.imcRange ?? '—'}</span>
        </div>
        <div className="stat-card">
          <strong>{idx?.waistHipRatio ?? '—'}</strong>
          <span>Cintura-cadera · {idx?.waistHipRange ?? '—'}</span>
        </div>
        <div className="stat-card">
          <strong>{idx?.iac ?? '—'}</strong>
          <span>IAC · {idx?.iacRange ?? '—'}</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-panel">
          <h3>Peso (kg)</h3>
          <TrendChart data={data.weightSeries} />
        </div>
        <div className="dash-panel">
          <h3>IMC</h3>
          <TrendChart data={data.imcSeries} color="#3b82f6" />
        </div>
        <div className="dash-panel">
          <h3>Grasa corporal (%)</h3>
          <TrendChart data={data.bodyFatSeries} color="#f59e0b" />
        </div>
        <div className="dash-panel">
          <h3>Cintura (cm)</h3>
          <TrendChart data={data.waistSeries} color="#8b5cf6" />
        </div>
      </div>

      {data.deltas.length > 0 && (
        <div className="dash-panel">
          <h3>Variación desde la primera medición</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Inicial</th>
                <th>Actual</th>
                <th>Cambio</th>
              </tr>
            </thead>
            <tbody>
              {data.deltas.map((d) => (
                <DeltaRow key={d.label} d={d} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}