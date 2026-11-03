import type { DashboardMonthDto } from '../api/types'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function monthShort(ym: string): string {
  const [y, m] = ym.split('-')
  const name = MONTHS[Number(m) - 1]
  return name ? `${name} ${y?.slice(2) ?? ''}`.trim() : ym
}

/** Paleta categórica validada (CVD) — orden fijo; colores en index.css (--mgmt-*). */
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
