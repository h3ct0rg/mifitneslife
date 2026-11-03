import { useId, useState } from 'react'
import type { MeasurementSeriesPointDto } from '../api/types'

interface Props {
  data: MeasurementSeriesPointDto[]
  /** Color CSS de la serie (idealmente un token: `var(--color-…)`). */
  color?: string
  height?: number
  /** Nombre de la serie para lectores de pantalla. */
  label?: string
}

function getCubicPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    const cp1x = current.x + (next.x - current.x) * 0.4
    const cp1y = current.y
    const cp2x = current.x + (next.x - current.x) * 0.6
    const cp2y = next.y
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  return path
}

const fmtValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

/**
 * Línea de tendencia en SVG. El color se hereda vía `currentColor` desde el contenedor,
 * así que acepta tokens CSS. Puntos accesibles con foco/tap; resumen para lectores en <title>.
 */
export default function TrendChart({ data, color = 'var(--color-primary)', height = 140, label = 'Tendencia' }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const gradId = `trend-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const points = data.filter((p) => p.value != null) as (MeasurementSeriesPointDto & { value: number })[]

  if (points.length === 0) {
    return <p className="trend-empty">Sin datos suficientes para graficar la tendencia</p>
  }

  const width = 600
  const paddingX = 24
  const paddingY = 24

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padY = max - min === 0 ? 1 : span * 0.15

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : paddingX + (i / (points.length - 1)) * (width - paddingX * 2)
    const y = height - paddingY - ((p.value - (min - padY)) / (span + padY * 2)) * (height - paddingY * 2)
    return { x, y, date: new Date(p.date), value: p.value }
  })

  const curvePath = getCubicPath(coords)
  const areaPath = `${curvePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - 4} L ${coords[0].x.toFixed(1)} ${height - 4} Z`
  const active = activeIdx !== null ? coords[activeIdx] : null
  const first = coords[0]
  const last = coords[coords.length - 1]
  const summary = `${label}: ${coords.length} mediciones, de ${fmtValue(first.value)} (${fmtDate(first.date)}) a ${fmtValue(last.value)} (${fmtDate(last.date)})`

  return (
    <div className="trend" style={{ color }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg" role="img" aria-label={summary}>
        <defs>
          {/* Relleno degradado del color de la serie: 32% → 0% (MV-1.10). */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[paddingY, height / 2, height - paddingY].map((y) => (
          <line key={y} x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="trend-grid" />
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" className="trend-area" />
        <path
          d={curvePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="trend-line"
        />

        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={activeIdx === i ? 7 : i === coords.length - 1 ? 6 : 4.5}
            className={`trend-point${i === coords.length - 1 ? ' trend-point--last' : ''}`}
            stroke="currentColor"
            strokeWidth={activeIdx === i ? 3.5 : 2.5}
            tabIndex={0}
            aria-label={`${fmtValue(c.value)} el ${fmtDate(c.date)}`}
            onPointerEnter={() => setActiveIdx(i)}
            onPointerLeave={() => setActiveIdx(null)}
            onFocus={() => setActiveIdx(i)}
            onBlur={() => setActiveIdx(null)}
            onClick={() => setActiveIdx(i)}
          />
        ))}
      </svg>

      {active && (
        <div
          className="trend-tooltip"
          aria-hidden="true"
          style={{ left: `${(active.x / width) * 100}%`, top: `${(active.y / height) * 100}%` }}
        >
          <strong>{fmtValue(active.value)}</strong>
          <span>{fmtDate(active.date)}</span>
        </div>
      )}
    </div>
  )
}
