import { useId } from 'react'
import type { DashboardMonthDto } from '../api/types'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function monthShort(ym: string): string {
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1]
  return name ? `${name} ${y?.slice(2) ?? ''}`.trim() : ym
}

/** Series en orden fijo; colores por tema (--chart-1..4, MV-2) en clinical.css. */
const STACK = [
  { key: 'completed', label: 'Completadas', cls: 'mgmt-completed' },
  { key: 'cancelled', label: 'Canceladas', cls: 'mgmt-cancelled' },
  { key: 'noShow', label: 'No asistió', cls: 'mgmt-noshow' },
] as const

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

/**
 * Barras apiladas (completadas/canceladas/no-show) + marcador de nuevos pacientes,
 * en HTML/CSS para que los textos de ejes sigan legibles en móvil. Un solo eje Y (conteos).
 */
export default function ManagementChart({ data }: { data: DashboardMonthDto[] }) {
  const max = niceMax(
    Math.max(0, ...data.map((d) => Math.max(d.completed + d.cancelled + d.noShow, d.newPatients))),
  )
  const ticks = [max, max / 2, 0]
  // useId puede contener «» o ':'; se limpia para usarlo en url(#…).
  const gradId = `mgmt-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  // Línea + área de "nuevos pacientes" (MV-1: trazo de 3px, relleno degradado .32→0).
  // Coordenadas 0..100 sobre el área; x = centro de cada columna.
  const pts = data.map((d, i) => ({
    x: ((i + 0.5) / Math.max(1, data.length)) * 100,
    y: 100 - (d.newPatients / max) * 100,
  }))
  const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ')
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x.toFixed(2)},100 L${pts[0].x.toFixed(2)},100 Z`
    : ''

  return (
    <figure className="mgmt-chart">
      <div className="mgmt-legend" aria-hidden="true">
        {STACK.map((s) => (
          <span key={s.key}>
            <i className={`mgmt-swatch ${s.cls}`} /> {s.label}
          </span>
        ))}
        <span>
          <i className="mgmt-swatch-dot" /> Nuevos pacientes
        </span>
      </div>

      <div className="mgmt-plot">
        <div className="mgmt-yaxis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>
          ))}
        </div>
        <div className="mgmt-area">
          <div className="mgmt-grid" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} />
            ))}
          </div>
          {pts.length > 1 && (
            <svg className="mgmt-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" className="mgmt-grad-start" />
                  <stop offset="100%" className="mgmt-grad-end" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradId})`} />
              <path d={line} className="mgmt-line-path" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <ul className="mgmt-cols">
            {data.map((d) => {
              const label = `${monthShort(d.month)}: ${d.completed} completadas, ${d.cancelled} canceladas, ${d.noShow} no asistió, ${d.newPatients} nuevos pacientes`
              return (
                <li key={d.month} className="mgmt-col" title={label} aria-label={label} tabIndex={0}>
                  <div className="mgmt-bar">
                    {STACK.map((s) => {
                      const v = d[s.key]
                      if (v <= 0) return null
                      return (
                        <span
                          key={s.key}
                          className={`mgmt-seg ${s.cls}`}
                          style={{ height: `${(v / max) * 100}%` }}
                        />
                      )
                    })}
                  </div>
                  <span
                    className="mgmt-dot"
                    style={{ bottom: `${(d.newPatients / max) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="mgmt-xlabel" aria-hidden="true">
                    {monthShort(d.month)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <details className="mgmt-table">
        <summary>Ver datos en tabla</summary>
        <div className="table-scroll">
          <table className="table">
            <caption className="text-muted">Citas por estado y nuevos pacientes, últimos 6 meses</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Completadas</th>
                <th scope="col">Canceladas</th>
                <th scope="col">No asistió</th>
                <th scope="col">Nuevos pacientes</th>
                <th scope="col">Mediciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month}>
                  <th scope="row">{monthShort(d.month)}</th>
                  <td>{d.completed}</td>
                  <td>{d.cancelled}</td>
                  <td>{d.noShow}</td>
                  <td>{d.newPatients}</td>
                  <td>{d.measurements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
