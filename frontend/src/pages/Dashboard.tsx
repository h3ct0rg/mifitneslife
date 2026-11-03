import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AppointmentStatus, DashboardKpisDto } from '../api/types'
import { roleLabel } from '../api/types'
import ManagementChart from '../components/ManagementChart'

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: 'Programada',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
  NoShow: 'No asistió',
}

const QUICK_LINKS = [
  { to: '/pacientes', icon: 'group', label: 'Pacientes' },
  { to: '/agenda', icon: 'calendar_month', label: 'Agenda' },
  { to: '/dieta/catalogo', icon: 'menu_book', label: 'Catálogo alimenticio' },
  { to: '/configuracion', icon: 'palette', label: 'Apariencia' },
]

/** Tasa 0..1 → "83%"; null/no finito → "—". */
function fmtRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return '—'
  return `${Math.round(rate * 100)}%`
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

type Delta = { text: string; dir: 'up' | 'down' | 'flat' | 'none' }

/** Variación % vs mes anterior. Nunca Infinity/NaN: prev 0 → "nuevo" o "—". */
function delta(current: number, prev: number): Delta {
  if (prev <= 0) return current > 0 ? { text: 'nuevo', dir: 'none' } : { text: '—', dir: 'none' }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { text: '0%', dir: 'flat' }
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, dir: pct > 0 ? 'up' : 'down' }
}

function DeltaBadge({ d }: { d: Delta }) {
  const icon = d.dir === 'up' ? 'arrow_upward' : d.dir === 'down' ? 'arrow_downward' : d.dir === 'flat' ? 'remove' : null
  const sr = d.dir === 'up' ? 'subió' : d.dir === 'down' ? 'bajó' : ''
  return (
    <span className={`mgmt-delta ${d.dir}`} title="Variación respecto al mes anterior">
      {icon && (
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="sr-only">{sr} </span>
      {d.text} <span className="mgmt-delta-sub">vs mes ant.</span>
    </span>
  )
}

function Kpi({
  icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: string
  label: string
  value: ReactNode
  sub?: ReactNode
  loading: boolean
}) {
  return (
    <div className="mgmt-kpi">
      <div className="mgmt-kpi-head">
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <strong className="mgmt-kpi-value">{loading ? '…' : value}</strong>
      {!loading && sub && <div className="mgmt-kpi-sub">{sub}</div>}
    </div>
  )
}

/** Bloque con estados carga / error / vacío. */
function Block({
  title,
  action,
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  title: string
  action?: ReactNode
  loading: boolean
  error: string | null
  empty: boolean
  emptyText: string
  onRetry: () => void
  children: ReactNode
}) {
  return (
    <section className="card mgmt-block">
      <div className="mgmt-block-head">
        <h2>{title}</h2>
        {action}
      </div>
      {loading ? (
        <p className="text-muted">Cargando...</p>
      ) : error ? (
        <div className="mgmt-block-error">
          <span>No se pudo cargar: {error}</span>
          <button type="button" className="btn-ghost" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : empty ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  )
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardKpisDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await dashboardApi.kpis())
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!user) return null

  const busy = loading && !data
  const p = data?.patients
  const a = data?.appointments
  const isProfessionalScope = data?.scope === 'professional'
  const showProfessionals = data ? data.scope === 'tenant' : user.role === 'Admin'
  const blockError = data ? null : error

  return (
    <div className="page mgmt-page">
      <section className="card mgmt-hero">
        <div>
          <h2>Hola, {user.fullName}</h2>
          <p className="text-muted">
            {isProfessionalScope
              ? 'Mostrando tus citas · los indicadores de pacientes son del centro completo.'
              : 'Indicadores de gestión del centro.'}
            {data && (
              <>
                {' '}
                Actualizado {new Date(data.generatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost mgmt-icon-btn"
          onClick={load}
          disabled={loading}
          aria-label="Actualizar indicadores"
          title="Actualizar"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            refresh
          </span>
        </button>
      </section>

      {error && data && <div className="alert err">No se pudo actualizar: {error}</div>}
      {error && !data && <div className="alert err">No se pudieron cargar los indicadores: {error}</div>}

      {(busy || p) && (
        <section className="mgmt-kpis" aria-label="Indicadores clave" aria-busy={busy}>
          <Kpi
            icon="group"
            label="Pacientes activos"
            loading={busy}
            value={p?.active ?? 0}
            sub={p && `de ${p.total} registrados`}
          />
          <Kpi
            icon="person_add"
            label="Nuevos este mes"
            loading={busy}
            value={p?.newThisMonth ?? 0}
            sub={p && <DeltaBadge d={delta(p.newThisMonth, p.newPrevMonth)} />}
          />
          <Kpi
            icon="event_available"
            label="Citas completadas (mes)"
            loading={busy}
            value={a?.thisMonth.completed ?? 0}
            sub={a && <DeltaBadge d={delta(a.thisMonth.completed, a.prevMonth.completed)} />}
          />
          <Kpi
            icon="how_to_reg"
            label="Tasa de asistencia"
            loading={busy}
            value={fmtRate(a?.attendanceRate)}
            sub={a && `Cancelación: ${fmtRate(a.cancellationRate)}`}
          />
          <Kpi
            icon="person_off"
            label="Tasa de no-show"
            loading={busy}
            value={fmtRate(a?.noShowRate)}
            sub={a && `${a.thisMonth.noShow} este mes`}
          />
          <Kpi
            icon="restaurant_menu"
            label="Cobertura de dieta"
            loading={busy}
            value={fmtRate(p ? ratio(p.withDiet, p.active) : null)}
            sub={p && `${p.withDiet} de ${p.active} activos`}
          />
          <Kpi
            icon="fitness_center"
            label="Cobertura de rutina"
            loading={busy}
            value={fmtRate(p ? ratio(p.withWorkout, p.active) : null)}
            sub={p && `${p.withWorkout} de ${p.active} activos`}
          />
        </section>
      )}

      <Block
        title="Citas y nuevos pacientes · últimos 6 meses"
        loading={busy}
        error={blockError}
        empty={!data || data.monthly.length === 0}
        emptyText="Sin datos para el periodo."
        onRetry={load}
      >
        {data && <ManagementChart data={data.monthly} />}
      </Block>

      <div className="mgmt-grid2">
        <Block
          title="Agenda de hoy"
          action={
            <Link to="/agenda" className="row-link">
              Ver agenda
            </Link>
          }
          loading={busy}
          error={blockError}
          empty={!data || data.todayAppointments.length === 0}
          emptyText={
            a ? `No hay citas hoy. Próximos 7 días: ${a.next7Days}.` : 'No hay citas hoy.'
          }
          onRetry={load}
        >
          {data && a && (
            <>
              <p className="text-muted mgmt-block-meta">
                {a.today} cita(s) hoy · {a.next7Days} en los próximos 7 días
              </p>
              <ul className="mgmt-list">
                {data.todayAppointments.map((ap) => (
                  <li key={ap.id}>
                    <span className="mgmt-time">{fmtTime(ap.startAt)}</span>
                    <span className="mgmt-list-main">
                      <Link to={`/pacientes/${ap.patientId}`} className="row-link">
                        {ap.patientName}
                      </Link>
                      <span className="text-muted">{ap.professionalName}</span>
                    </span>
                    <span className={`mgmt-status ${ap.status.toLowerCase()}`}>
                      {STATUS_LABEL[ap.status] ?? ap.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Block>

        <Block
          title="Pacientes sin seguimiento"
          action={p ? <span className="badge">{p.withoutFollowUp30d}</span> : undefined}
          loading={busy}
          error={blockError}
          empty={!data || data.atRiskPatients.length === 0}
          emptyText="Todos los pacientes activos tienen seguimiento en los últimos 30 días."
          onRetry={load}
        >
          {data && (
            <>
              <p className="text-muted mgmt-block-meta">Sin cita completada ni medición en 30 días.</p>
              <ul className="mgmt-list">
                {data.atRiskPatients.map((r) => (
                  <li key={r.id}>
                    <span className="mgmt-list-main">
                      <Link to={`/pacientes/${r.id}`} className="row-link">
                        {r.fullName}
                      </Link>
                      <span className="text-muted">
                        {r.lastActivityAt
                          ? `Última actividad: ${new Date(r.lastActivityAt).toLocaleDateString('es-ES')}`
                          : 'Sin actividad registrada'}
                      </span>
                    </span>
                    <span className="mgmt-days">
                      {r.daysSinceActivity === null ? 'Nunca' : `${r.daysSinceActivity} días`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Block>
      </div>

      {showProfessionals && (
        <Block
          title="Rendimiento por profesional (mes actual)"
          loading={busy}
          error={blockError}
          empty={!data || data.professionals.length === 0}
          emptyText="No hay profesionales con actividad."
          onRetry={load}
        >
          {data && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Profesional</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Completadas</th>
                    <th scope="col">Pacientes atendidos</th>
                    <th scope="col">Próximas</th>
                    <th scope="col">No-show</th>
                  </tr>
                </thead>
                <tbody>
                  {data.professionals.map((pr) => (
                    <tr key={pr.id}>
                      <th scope="row">{pr.fullName}</th>
                      <td>{roleLabel(pr.role)}</td>
                      <td>{pr.completedThisMonth}</td>
                      <td>{pr.patientsAttendedThisMonth}</td>
                      <td>{pr.upcoming}</td>
                      <td>{fmtRate(pr.noShowRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>
      )}

      <section className="card">
        <h2>Accesos rápidos</h2>
        <nav className="mgmt-quick" aria-label="Accesos rápidos">
          {QUICK_LINKS.map((q) => (
            <Link key={q.to} to={q.to} className="mgmt-quick-link">
              <span className="material-symbols-outlined" aria-hidden="true">
                {q.icon}
              </span>
              {q.label}
            </Link>
          ))}
        </nav>
      </section>
    </div>
  )
}
