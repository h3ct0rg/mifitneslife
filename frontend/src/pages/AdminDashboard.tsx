import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AdminDashboardDto, RegistrationMonthDto } from '../api/types'
import { ROLE_KEYS, roleLabel } from '../api/types'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'

const SERIES = [
  { key: 'users', label: 'Usuarios', color: 'var(--chart-1)' },
  { key: 'tenants', label: 'Tenants', color: 'var(--chart-2)' },
  { key: 'patients', label: 'Pacientes', color: 'var(--chart-3)' },
] as const

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const idx = Number(m) - 1
  return MONTHS[idx] ? `${MONTHS[idx]} ${y.slice(2)}` : ym
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

function RegistrationsChart({ data }: { data: RegistrationMonthDto[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.users, d.tenants, d.patients]))
  const height = 160
  const groupW = 60
  const barW = 14
  const width = data.length * groupW
  return (
    <div className="admin-chart">
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        role="img"
        aria-label="Registros por mes"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={0} y1={height} x2={width} y2={height} stroke="var(--color-border-strong)" />
        {data.map((d, i) => {
          const x0 = i * groupW + (groupW - barW * SERIES.length - 4) / 2
          return (
            <g key={d.month}>
              {SERIES.map((s, j) => {
                const v = d[s.key]
                const h = (v / max) * (height - 16)
                return (
                  <rect
                    key={s.key}
                    x={x0 + j * (barW + 2)}
                    y={height - h}
                    width={barW}
                    height={h}
                    rx={2}
                    fill={s.color}
                  >
                    <title>{`${s.label} ${monthLabel(d.month)}: ${v}`}</title>
                  </rect>
                )
              })}
              <text
                x={i * groupW + groupW / 2}
                y={height + 16}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-muted)"
              >
                {monthLabel(d.month)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="admin-legend">
        {SERIES.map((s) => (
          <span key={s.key}>
            <i className={`admin-swatch admin-swatch--${s.key}`} aria-hidden="true" /> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.dashboard())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refreshButton = (
    <button
      type="button"
      className="btn btn--secondary"
      onClick={load}
      disabled={loading}
      aria-busy={loading || undefined}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        refresh
      </span>
      {loading ? 'Actualizando...' : 'Actualizar'}
    </button>
  )

  if (!data) {
    return (
      <div className="page admin-page">
        <PageHeader title="Dashboard de plataforma" />
        {loading ? (
          <StateView state="loading" title="Cargando dashboard..." />
        ) : (
          <StateView
            state="error"
            message={error ?? undefined}
            action={
              <button type="button" className="btn btn--primary" onClick={load}>
                Reintentar
              </button>
            }
          />
        )}
      </div>
    )
  }

  const totalUsers = data.totalUsers ?? 0
  const activePct = totalUsers > 0 ? Math.round(((data.activeUsers ?? 0) / totalUsers) * 100) : 0
  // KPIs con icon-chip (MV-1): el delta muestra las altas de los últimos 30 días.
  const kpis = [
    {
      value: `${data.totalTenants ?? 0}`,
      label: `Tenants · ${data.activeTenants ?? 0} activos`,
      icon: 'domain',
      chip: 'icon-chip',
      added: data.newTenantsLast30Days ?? 0,
    },
    {
      value: `${totalUsers}`,
      label: `Usuarios · ${data.activeUsers ?? 0} activos`,
      icon: 'group',
      chip: 'icon-chip icon-chip--accent',
      added: data.newUsersLast30Days ?? 0,
    },
    {
      value: `${data.totalPatients ?? 0}`,
      label: 'Pacientes',
      icon: 'favorite',
      chip: 'icon-chip icon-chip--soft',
      added: data.newPatientsLast30Days ?? 0,
    },
    {
      value: `${activePct}%`,
      label: 'Usuarios activos',
      icon: 'how_to_reg',
      chip: 'icon-chip icon-chip--soft',
      added: null,
    },
  ]

  const byRole = data.usersByRole ?? {}
  const roleKeys = [
    ...ROLE_KEYS.filter((r) => r in byRole),
    ...Object.keys(byRole).filter((r) => !(ROLE_KEYS as readonly string[]).includes(r)),
  ]
  const roleMax = Math.max(1, ...roleKeys.map((r) => byRole[r] ?? 0))
  const months = data.registrationsByMonth ?? []
  const hasRegistrations = months.some((m) => m.users + m.tenants + m.patients > 0)
  const activity = data.recentActivity ?? []

  return (
    <div className="page admin-page">
      <PageHeader
        variant="hero"
        title="Dashboard de plataforma"
        subtitle="Resumen de tenants, usuarios y pacientes"
        actions={refreshButton}
      />

      {error && (
        <div className="alert err" role="alert">
          {error}
        </div>
      )}

      <section className="admin-kpis" aria-label="Indicadores">
        {kpis.map((k) => (
          <div className="card kpi" key={k.icon}>
            <div className="kpi-top">
              <span className={k.chip} aria-hidden="true">
                <span className="material-symbols-outlined">{k.icon}</span>
              </span>
              {k.added !== null && k.added > 0 && (
                <span className="delta delta--up" title={`${k.added} nuevos en los últimos 30 días`}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    trending_up
                  </span>
                  +{k.added}
                  <span className="sr-only"> nuevos en los últimos 30 días</span>
                </span>
              )}
            </div>
            <div className="kpi-value num">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Registros por mes (últimos 6 meses)</h2>
        {months.length === 0 ? (
          <StateView state="empty" compact icon="bar_chart" title="Sin datos de registros" />
        ) : (
          <>
            {hasRegistrations ? (
              <RegistrationsChart data={months} />
            ) : (
              <StateView state="empty" compact icon="bar_chart" title="No hubo registros en los últimos 6 meses" />
            )}
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Usuarios</th>
                    <th>Tenants</th>
                    <th>Pacientes</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month)}</td>
                      <td>{m.users}</td>
                      <td>{m.tenants}</td>
                      <td>{m.patients}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="dash-grid admin-grid">
        <section className="card">
          <h2>Usuarios por rol</h2>
          {roleKeys.length === 0 ? (
            <StateView state="empty" compact icon="group" title="Sin usuarios registrados" />
          ) : (
            <ul className="admin-hbars">
              {roleKeys.map((r) => {
                const v = byRole[r] ?? 0
                return (
                  <li key={r}>
                    <span className="admin-hbar-label" title={roleLabel(r)}>
                      {roleLabel(r)}
                    </span>
                    <span className="admin-hbar-track">
                      <span className="admin-hbar-fill" style={{ width: `${(v / roleMax) * 100}%` }} />
                    </span>
                    <strong>{v}</strong>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="admin-head">
            <h2>Tenants</h2>
            <Link to="/admin/tenants" className="row-link">
              Gestionar
            </Link>
          </div>
          {data.tenants.length === 0 ? (
            <StateView state="empty" compact icon="domain" title="Aún no hay tenants" />
          ) : (
            <div className="table-scroll table-scroll--sticky-first">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th>Usuarios</th>
                    <th>Pacientes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>
                        <span className={`badge ${t.isActive ? 'badge--success' : 'badge--neutral'}`}>
                          {t.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{t.userCount}</td>
                      <td>{t.patientCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Actividad reciente</h2>
        {activity.length === 0 ? (
          <StateView state="empty" compact icon="history" title="Sin actividad reciente" />
        ) : (
          <div className="table-scroll">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tenant</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={`${a.timestamp}-${i}`}>
                    <td className="admin-cell-title">{fmtDate(a.timestamp)}</td>
                    <td data-label="Tenant">{a.tenantName || '—'}</td>
                    <td data-label="Acción">{a.action}</td>
                    <td data-label="Entidad">{a.entity}</td>
                    <td data-label="Usuario">{a.userEmail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
