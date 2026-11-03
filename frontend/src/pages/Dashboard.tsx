import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardApi } from '../api'
import { getErrorMessage } from '../api/client'
import type { AppointmentStatus, DashboardKpisDto } from '../api/types'
import { roleLabel } from '../api/types'
import ManagementChart from '../components/ManagementChart'
import { avatarClass, initialsOf } from '../components/avatarIndex'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  Scheduled: 'Programada',
  Completed: 'Completada',
  Cancelled: 'Cancelada',
  NoShow: 'No asistió',
}

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  Scheduled: 'badge--info',
  Completed: 'badge--success',
  Cancelled: 'badge--neutral',
  NoShow: 'badge--warning',
}

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

/** Variación en píldora (.delta--up/--down/--same, MV-4). */
function DeltaBadge({ d }: { d: Delta }) {
  const cls = d.dir === 'up' ? 'delta--up' : d.dir === 'down' ? 'delta--down' : 'delta--same'
  const icon = d.dir === 'up' ? 'trending_up' : d.dir === 'down' ? 'trending_down' : d.dir === 'flat' ? 'remove' : null
  const sr = d.dir === 'up' ? 'subió ' : d.dir === 'down' ? 'bajó ' : ''
  return (
    <span className={`delta ${cls}`} title="Variación respecto al mes anterior">
      {icon && (
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="sr-only">{sr}</span>
      {d.text}
      <span className="sr-only"> respecto al mes anterior</span>
    </span>
  )
}

type Chip = 'solid' | 'soft' | 'accent' | 'success'

/** KPI con chip de icono (MV-4: .card.kpi + .icon-chip). */
function Kpi({
  icon,
  chip = 'soft',
  label,
  value,
  delta: d,
  sub,
  loading,
}: {
  icon: string
  chip?: Chip
  label: string
  value: ReactNode
  delta?: Delta
  sub?: ReactNode
  loading: boolean
}) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className={`icon-chip${chip === 'solid' ? '' : ` icon-chip--${chip}`}`} aria-hidden="true">
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        {!loading && d && <DeltaBadge d={d} />}
      </div>
      <div className="kpi-value num">{loading ? '…' : value}</div>
      <div className="kpi-label">{label}</div>
      {!loading && sub && <div className="kpi-sub">{sub}</div>}
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
        <StateView state="loading" compact />
      ) : error ? (
        <StateView
          state="error"
          compact
          message={error}
          action={
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              Reintentar
            </button>
          }
        />
      ) : empty ? (
        <StateView state="empty" compact title={emptyText} />
      ) : (
        children
      )}
    </section>
  )
}

/** Saludo según la hora local. */
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<DashboardKpisDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Si ya hay datos, un fallo al actualizar se avisa con toast y se conservan los anteriores.
  const hasData = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await dashboardApi.kpis())
      hasData.current = true
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
      if (hasData.current) toast.error(`No se pudo actualizar: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

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
      {/* Hero (MV-1): PageHeader variant="hero". Único h1. */}
      <PageHeader
        variant="hero"
        title={`${greeting()}, ${user.firstName || user.fullName}`}
        subtitle={
          <>
            {a && p
              ? `Tienes ${a.today} cita${a.today === 1 ? '' : 's'} hoy y ${p.withoutFollowUp30d} paciente${
                  p.withoutFollowUp30d === 1 ? '' : 's'
                } sin seguimiento.`
              : isProfessionalScope
                ? 'Mostrando tus citas · los indicadores de pacientes son del centro completo.'
                : 'Indicadores de gestión del centro.'}
            {data && (
              <>
                {' '}
                Actualizado {new Date(data.generatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}.
              </>
            )}
          </>
        }
        actions={
          <>
          <Link to="/agenda?cita=nueva" className="btn btn--light">
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            Nueva cita
          </Link>
          <button
            type="button"
            className="btn btn--light"
            onClick={load}
            disabled={loading}
            aria-busy={loading || undefined}
            aria-label={loading ? 'Actualizando indicadores' : 'Actualizar indicadores'}
            title="Actualizar"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              refresh
            </span>
          </button>
          </>
        }
      />

      {(busy || p) && (
        <section className="mgmt-kpis" aria-label="Indicadores clave" aria-busy={busy}>
          <Kpi
            icon="group"
            chip="solid"
            label="Pacientes activos"
            loading={busy}
            value={p?.active ?? 0}
            sub={p && `de ${p.total} registrados`}
          />
          <Kpi
            icon="person_add"
            chip="accent"
            label="Nuevos este mes"
            loading={busy}
            value={p?.newThisMonth ?? 0}
            delta={p && delta(p.newThisMonth, p.newPrevMonth)}
          />
          <Kpi
            icon="event_available"
            label="Citas completadas (mes)"
            loading={busy}
            value={a?.thisMonth.completed ?? 0}
            delta={a && delta(a.thisMonth.completed, a.prevMonth.completed)}
          />
          <Kpi
            icon="how_to_reg"
            chip="success"
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
            chip="accent"
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
                    <span className="mgmt-time num">{fmtTime(ap.startAt)}</span>
                    <span className={`avatar mgmt-avatar ${avatarClass(ap.patientId)}`} aria-hidden="true">
                      {initialsOf(ap.patientName)}
                    </span>
                    <span className="mgmt-list-main">
                      <Link to={`/pacientes/${ap.patientId}`} className="row-link">
                        {ap.patientName}
                      </Link>
                      <span className="text-muted">{ap.professionalName}</span>
                    </span>
                    <span className={`badge ${STATUS_BADGE[ap.status] ?? 'badge--neutral'}`}>
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
          action={p ? <span className="badge badge--warning">{p.withoutFollowUp30d}</span> : undefined}
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
                    <span className={`avatar mgmt-avatar ${avatarClass(r.id)}`} aria-hidden="true">
                      {initialsOf(r.fullName)}
                    </span>
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
            <div className="table-scroll table-scroll--sticky-first">
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

    </div>
  )
}
