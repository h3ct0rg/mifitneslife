import { useCallback, useEffect, useState } from 'react'
import { measurementsApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { MeasurementDashboardDto, MeasurementDeltaDto } from '../api/types'
import TrendChart from './TrendChart'
import StateView from './ui/StateView'

/** Series de evolución con su color de token (texto AA). */
const SERIES = [
  { key: 'weightSeries', title: 'Peso (kg)', color: 'var(--chart-1)' },
  { key: 'imcSeries', title: 'IMC', color: 'var(--chart-2)' },
  { key: 'bodyFatSeries', title: 'Grasa corporal (%)', color: 'var(--chart-3)' },
  { key: 'waistSeries', title: 'Cintura (cm)', color: 'var(--chart-4)' },
] as const

const DELTA_LABEL = { up: 'subió', down: 'bajó', same: 'sin cambio' } as const

function DeltaRow({ d }: { d: MeasurementDeltaDto }) {
  const dir = (d.change ?? 0) > 0 ? 'up' : (d.change ?? 0) < 0 ? 'down' : 'same'
  return (
    <tr>
      <td data-label="Métrica" className="measure-delta-metric">
        {d.label}
      </td>
      <td data-label="Inicial">{d.first ?? '—'}</td>
      <td data-label="Actual">{d.last ?? '—'}</td>
      <td data-label="Cambio" className={`delta delta-${dir}`}>
        <span className="sr-only">{DELTA_LABEL[dir]} </span>
        {d.change != null && d.change > 0 ? '+' : ''}
        {d.change ?? '—'} {d.unit}
      </td>
    </tr>
  )
}

export default function MeasurementDashboard({ patientId }: { patientId: string }) {
  const [data, setData] = useState<MeasurementDashboardDto | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    measurementsApi
      .dashboard(patientId)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <StateView
        state="error"
        message={error}
        action={
          <button type="button" className="btn btn--ghost" onClick={load}>
            Reintentar
          </button>
        }
      />
    )
  }
  if (!data) return <StateView state="loading" title="Cargando evolución..." />

  const idx = data.latestIndexes
  const indexes = [
    { label: 'IMC', value: idx?.imc, range: idx?.imcRange },
    { label: 'Cintura-cadera', value: idx?.waistHipRatio, range: idx?.waistHipRange },
    { label: 'IAC', value: idx?.iac, range: idx?.iacRange },
  ]

  return (
    <>
      <dl className="measure-indexes">
        {indexes.map((i) => (
          <div key={i.label} className="measure-index">
            <dt>{i.label}</dt>
            <dd>
              <strong>{i.value ?? '—'}</strong>
              <span>{i.range || '—'}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="measure-charts">
        {SERIES.map((s) => (
          <div key={s.key} className="dash-panel">
            <h3>{s.title}</h3>
            <TrendChart data={data[s.key]} color={s.color} label={s.title} />
          </div>
        ))}
      </div>

      {data.deltas.length > 0 && (
        <div className="dash-panel measure-deltas">
          <h3>Variación desde la primera medición</h3>
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Métrica</th>
                <th scope="col">Inicial</th>
                <th scope="col">Actual</th>
                <th scope="col">Cambio</th>
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
