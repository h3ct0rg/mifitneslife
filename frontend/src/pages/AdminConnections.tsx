import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../api'
import { getErrorMessage } from '../api/client'
import type {
  ConnectionDailyDto,
  ConnectionDto,
  ConnectionQuery,
  ConnectionRole,
  ConnectionSummaryDto,
  TenantDto,
} from '../api/types'
import { roleLabel } from '../api/types'
import PageHeader from '../components/ui/PageHeader'
import StateView from '../components/ui/StateView'
import { useToast } from '../context/toastContext'
import { toLocalDateKey } from '../utils/localDate'

type RangePreset = 'today' | '7d' | '30d' | 'custom'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350
const DAY_MS = 86_400_000

const ROLE_OPTIONS: { value: ConnectionRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'doctor', label: 'Doctor (nutricionista o entrenador)' },
  { value: 'patient', label: 'Paciente' },
]

const METHOD_LABELS: Record<string, string> = {
  Password: 'Contraseña',
  Google: 'Google',
  Register: 'Registro',
  Session: 'Sesión',
}

/** Inicio del día local de una clave `YYYY-MM-DD`. */
function localDayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Rango en hora local del navegador → `from`/`to` ISO UTC (contrato). `to` = inicio del día local
 * siguiente al último día incluido (o "ahora" en presets que terminan hoy).
 */
function resolveRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
  now: Date,
): { from: Date; to: Date } | null {
  const todayStart = localDayStart(toLocalDateKey(now))
  if (preset === 'custom') {
    if (!customFrom || !customTo || customFrom > customTo) return null
    return { from: localDayStart(customFrom), to: addLocalDays(localDayStart(customTo), 1) }
  }
  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : 30
  return { from: addLocalDays(todayStart, -(days - 1)), to: now }
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const fmtDayLabel = (key: string) =>
  localDayStart(key).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

/** Serie diaria con huecos rellenados a 0 entre el primer y el último día del rango. */
function fillDaily(daily: ConnectionDailyDto[], from: Date, to: Date): ConnectionDailyDto[] {
  const byKey = new Map(daily.map((d) => [d.date.slice(0, 10), d]))
  const out: ConnectionDailyDto[] = []
  const last = toLocalDateKey(new Date(to.getTime() - 1))
  for (let d = new Date(from), guard = 0; guard < 400; d = addLocalDays(d, 1), guard++) {
    const key = toLocalDateKey(d)
    out.push(byKey.get(key) ?? { date: key, uniqueUsers: 0, logins: 0 })
    if (key >= last) break
  }
  // Días que el backend devolvió fuera de las claves locales (p. ej. agrupación UTC) no se pierden.
  for (const d of daily) if (!out.some((o) => o.date.slice(0, 10) === d.date.slice(0, 10))) out.push(d)
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Etiqueta corta del eje X: "dd/MM". */
const fmtAxisDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`

const CHART_HEIGHT = 200
const AXIS_H = 24
const VALUE_GUTTER = 32
/** Ancho mínimo por etiqueta "dd/MM" para que no se solapen. */
const LABEL_MIN_PX = 48

/** Rectángulo con las esquinas superiores redondeadas (r ≤ 4) apoyado en la línea base. */
function barPath(x: number, w: number, base: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${base} V${base - h + r} q0,-${r} ${r},-${r} H${x + w - r} q${r},0 ${r},${r} V${base} Z`
}

/**
 * Q2: el SVG se dibuja en píxeles reales del contenedor (ResizeObserver) para ocupar el ancho completo
 * sin escalar el texto; las etiquetas "dd/MM" se muestran 1 de cada N según el espacio disponible.
 */
function DailyChart({ data }: { data: ConnectionDailyDto[] }) {
  const [width, setWidth] = useState(0)
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const max = Math.max(1, ...data.map((d) => d.uniqueUsers))
  const plotW = Math.max(0, width - VALUE_GUTTER)
  const slot = data.length > 0 ? plotW / data.length : 0
  const barW = Math.max(2, Math.min(32, slot - 2))
  const labelEvery = Math.max(1, Math.ceil(LABEL_MIN_PX / Math.max(1, slot)))
  const base = CHART_HEIGHT - AXIS_H
  const plotH = base - 12

  return (
    <div className="admin-chart admin-chart--daily">
      <div ref={containerRef}>
        {width > 0 && (
          <svg
            width={width}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Usuarios únicos conectados por día"
          >
            {/* Referencia de escala: máximo y línea base. */}
            <line x1={VALUE_GUTTER} y1={base - plotH} x2={width} y2={base - plotH} stroke="var(--color-border)" strokeDasharray="3 3" />
            <text x={VALUE_GUTTER - 6} y={base - plotH + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {max}
            </text>
            <text x={VALUE_GUTTER - 6} y={base + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              0
            </text>
            <line x1={VALUE_GUTTER} y1={base} x2={width} y2={base} stroke="var(--color-border-strong)" />
            {data.map((d, i) => {
              const key = d.date.slice(0, 10)
              const h = (d.uniqueUsers / max) * plotH
              const slotX = VALUE_GUTTER + i * slot
              const x = slotX + (slot - barW) / 2
              const showLabel = i % labelEvery === 0
              return (
                <g key={key} className="admin-chart-bar">
                  {/* Zona de hover = todo el slot (más grande que la barra). */}
                  <rect x={slotX} y={0} width={slot} height={base} fill="transparent">
                    <title>{`${fmtDayLabel(key)}: ${d.uniqueUsers} usuario(s) únicos · ${d.logins} conexión(es)`}</title>
                  </rect>
                  {h > 0 && <path d={barPath(x, barW, base, h)} fill="var(--chart-1)" pointerEvents="none" />}
                  {showLabel && (
                    <text
                      x={slotX + slot / 2}
                      y={base + 16}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-muted)"
                    >
                      {fmtAxisDay(key)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <details className="admin-chart-table">
        <summary>Ver datos por día</summary>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Usuarios únicos</th>
                <th>Conexiones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{fmtDayLabel(d.date.slice(0, 10))}</td>
                  <td>{d.uniqueUsers}</td>
                  <td>{d.logins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

export default function AdminConnections() {
  const toast = useToast()
  const [preset, setPreset] = useState<RangePreset>('7d')
  const todayKey = toLocalDateKey(new Date())
  const [customFrom, setCustomFrom] = useState(toLocalDateKey(new Date(Date.now() - 6 * DAY_MS)))
  const [customTo, setCustomTo] = useState(todayKey)
  const [tenantId, setTenantId] = useState('')
  const [role, setRole] = useState<ConnectionRole | ''>('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [tenants, setTenants] = useState<TenantDto[]>([])
  // "Ahora" de referencia para los presets; "Actualizar" lo renueva.
  const [now, setNow] = useState(() => new Date())

  const [summary, setSummary] = useState<ConnectionSummaryDto | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [rows, setRows] = useState<ConnectionDto[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo, now),
    [preset, customFrom, customTo, now],
  )

  const query = useMemo<ConnectionQuery | null>(
    () =>
      range && {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        tenantId: tenantId || undefined,
        role: role || undefined,
      },
    [range, tenantId, role],
  )

  useEffect(() => {
    adminApi
      .tenants()
      .then((t) => setTenants([...t].sort((a, b) => a.name.localeCompare(b.name, 'es'))))
      .catch((err) => toast.error(`No se pudieron cargar los tenants: ${getErrorMessage(err)}`))
  }, [toast])

  const loadSummary = useCallback(async () => {
    if (!query) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setSummary(await adminApi.connectionsSummary(query))
    } catch (err) {
      setSummaryError(getErrorMessage(err))
    } finally {
      setSummaryLoading(false)
    }
  }, [query])

  const loadList = useCallback(async () => {
    if (!query) return
    setListLoading(true)
    setListError(null)
    try {
      const data = await adminApi.connections({
        ...query,
        search: appliedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setRows(data.items)
      setTotal(data.total)
    } catch (err) {
      setListError(getErrorMessage(err))
    } finally {
      setListLoading(false)
    }
  }, [query, appliedSearch, page])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    const q = search.trim()
    if (q === appliedSearch) return
    const timer = setTimeout(() => {
      setPage(1)
      setAppliedSearch(q)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, appliedSearch])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const daily = useMemo(
    () => (summary && range ? fillDaily(summary.daily ?? [], range.from, range.to) : []),
    [summary, range],
  )
  const hasDaily = daily.some((d) => d.uniqueUsers > 0)

  const kpis = summary
    ? [
        { key: 'admin', value: summary.uniqueByRole?.admin ?? 0, label: 'Administradores conectados', icon: 'shield_person', chip: 'icon-chip' },
        { key: 'doctor', value: summary.uniqueByRole?.doctor ?? 0, label: 'Doctores conectados (nutri. + entren.)', icon: 'stethoscope', chip: 'icon-chip icon-chip--accent' },
        { key: 'patient', value: summary.uniqueByRole?.patient ?? 0, label: 'Pacientes conectados', icon: 'person', chip: 'icon-chip icon-chip--soft' },
        { key: 'logins', value: summary.totalLogins ?? 0, label: `Inicios de sesión · ${summary.uniqueUsers ?? 0} usuarios únicos`, icon: 'login', chip: 'icon-chip icon-chip--soft' },
      ]
    : []

  const resetPage = () => setPage(1)

  return (
    <div className="page admin-page">
      <PageHeader
        title="Conexiones"
        subtitle="Inicios de sesión de los usuarios de la plataforma"
        actions={
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setNow(new Date())}
            disabled={summaryLoading || listLoading}
            aria-busy={summaryLoading || listLoading || undefined}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              refresh
            </span>
            Actualizar
          </button>
        }
      />

      <section className="card" aria-label="Filtros">
        <div className="admin-filters admin-filters--connections" role="search">
          <select
            value={preset}
            onChange={(e) => {
              resetPage()
              setNow(new Date())
              setPreset(e.target.value as RangePreset)
            }}
            aria-label="Rango de fechas"
          >
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado</option>
          </select>
          {preset === 'custom' && (
            <div className="admin-date-range">
              <input
                type="date"
                value={customFrom}
                max={customTo || todayKey}
                onChange={(e) => {
                  resetPage()
                  setCustomFrom(e.target.value)
                }}
                aria-label="Desde"
              />
              <span aria-hidden="true">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayKey}
                onChange={(e) => {
                  resetPage()
                  setCustomTo(e.target.value)
                }}
                aria-label="Hasta"
              />
            </div>
          )}
          <select
            value={tenantId}
            onChange={(e) => {
              resetPage()
              setTenantId(e.target.value)
            }}
            aria-label="Filtrar por tenant"
          >
            <option value="">Todos los tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => {
              resetPage()
              setRole(e.target.value as ConnectionRole | '')
            }}
            aria-label="Filtrar por rol"
          >
            <option value="">Todos los roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {!range && (
          <div className="alert err" role="alert">
            Elige un rango válido: la fecha "Desde" debe ser anterior o igual a "Hasta".
          </div>
        )}
      </section>

      {summaryError ? (
        <section className="card">
          <StateView
            state="error"
            compact
            message={summaryError}
            action={
              <button type="button" className="btn btn--ghost" onClick={loadSummary}>
                Reintentar
              </button>
            }
          />
        </section>
      ) : !summary ? (
        summaryLoading && <StateView state="loading" title="Cargando resumen..." />
      ) : (
        <>
          <section className="admin-kpis" aria-label="Indicadores de conexión" aria-busy={summaryLoading || undefined}>
            {kpis.map((k) => (
              <div className="card kpi" key={k.key}>
                <div className="kpi-top">
                  <span className={k.chip} aria-hidden="true">
                    <span className="material-symbols-outlined">{k.icon}</span>
                  </span>
                </div>
                <div className="kpi-value num">{k.value}</div>
                <div className="kpi-label">{k.label}</div>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Usuarios únicos por día</h2>
            {hasDaily ? (
              <DailyChart data={daily} />
            ) : (
              <StateView state="empty" compact icon="bar_chart" title="Sin conexiones en el rango" />
            )}
          </section>
        </>
      )}

      <section className="card admin-connections-list">
        <div className="admin-head">
          <h2>Conexiones recientes</h2>
          {!listLoading && !listError && <span className="admin-count">{total} conexión(es)</span>}
        </div>
        <div className="admin-filters">
          <div className="admin-search">
            <span className="material-symbols-outlined" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              placeholder="Buscar por nombre o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar conexiones"
            />
          </div>
        </div>

        {listLoading ? (
          <StateView state="loading" compact title="Cargando conexiones..." />
        ) : listError ? (
          <StateView
            state="error"
            compact
            message={listError}
            action={
              <button type="button" className="btn btn--ghost" onClick={loadList}>
                Reintentar
              </button>
            }
          />
        ) : rows.length === 0 ? (
          <StateView state="empty" compact icon="travel_explore" title="No hay conexiones para estos filtros" />
        ) : (
          <div className="table-scroll table-scroll--sticky-first">
            <table className="table table--stack admin-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tenant</th>
                  <th>Rol</th>
                  <th>Fecha y hora</th>
                  <th>Método</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="admin-cell-title">
                      <span className="admin-person-text">
                        <strong>{c.userName || '—'}</strong>
                        {c.email && <span className="admin-sub">{c.email}</span>}
                      </span>
                    </td>
                    <td data-label="Tenant">{c.tenantName || '—'}</td>
                    <td data-label="Rol">{roleLabel(c.role)}</td>
                    <td data-label="Fecha y hora" className="admin-nowrap">
                      {fmtDateTime(c.occurredAt)}
                    </td>
                    <td data-label="Método">{METHOD_LABELS[c.method] ?? c.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="Paginación de conexiones">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1 || listLoading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}
