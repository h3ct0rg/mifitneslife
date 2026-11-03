import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AdminDashboardDto, RegistrationMonthDto } from '../api/types'
import { ROLE_KEYS, roleLabel } from '../api/types'

const SERIES = [
  { key: 'users', label: 'Usuarios', color: 'var(--primary)' },
  { key: 'tenants', label: 'Tenants', color: 'var(--warning)' },
  { key: 'patients', label: 'Pacientes', color: 'var(--success)' },
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
        <line x1={0} y1={height} x2={width} y2={height} stroke="var(--border-strong)" />
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
                fill="var(--muted)"
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
            <i style={{ background: s.color }} /> {s.label}
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

  if (loading && !data) return <div className="loading">Cargando dashboard...</div>

  if (error && !data) {
    return (
      <div className="page">
        <div className="alert err">{error}</div>
        <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={load}>
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) return null

  const kpis = [
    { value: data.totalTenants, label: 'Tenants totales' },
    { value: data.activeTenants, label: 'Tenants activos' },
    { value: data.totalUsers, label: 'Usuarios totales' },
    { value: data.activeUsers, label: 'Usuarios activos' },
    { value: data.totalPatients, label: 'Pacientes totales' },
    { value: data.newTenantsLast30Days, label: 'Tenants nuevos (30 días)' },
    { value: data.newUsersLast30Days, label: 'Usuarios nuevos (30 días)' },
    { value: data.newPatientsLast30Days, label: 'Pacientes nuevos (30 días)' },
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
      <section className="card admin-head">
        <h2>Dashboard de plataforma</h2>
        <button
          type="button"
          className="btn-ghost"
          onClick={load}
          disabled={loading}
          aria-label="Actualizar dashboard"
          title="Actualizar"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </section>

      {error && <div className="alert err">{error}</div>}

      <section className="stats admin-stats">
        {kpis.map((k) => (
          <div className="stat-card" key={k.label}>
            <strong>{k.value ?? 0}</strong>
            <span>{k.label}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Registros por mes (últimos 6 meses)</h2>
        {months.length === 0 ? (
          <p className="empty-state">Sin datos de registros.</p>
        ) : (
          <>
            {hasRegistrations ? (
              <RegistrationsChart data={months} />
            ) : (
              <p className="empty-state">No hubo registros en los últimos 6 meses.</p>
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
            <p className="empty-state">Sin usuarios registrados.</p>
          ) : (
            <ul className="admin-hbars">
              {roleKeys.map((r) => {
                const v = byRole[r] ?? 0
                return (
                  <li key={r}>
                    <span className="admin-hbar-label">{roleLabel(r)}</span>
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
            <p className="empty-state">Aún no hay tenants.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
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
                      <td>{t.isActive ? 'Activo' : 'Inactivo'}</td>
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
          <p className="empty-state">Sin actividad reciente.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
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
                    <td>{fmtDate(a.timestamp)}</td>
                    <td>{a.tenantName || '—'}</td>
                    <td>{a.action}</td>
                    <td>{a.entity}</td>
                    <td>{a.userEmail || '—'}</td>
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
