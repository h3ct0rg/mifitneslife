import { useState } from 'react'
import type { MeasurementSeriesPointDto } from '../api/types'

interface Props {
  data: MeasurementSeriesPointDto[]
  color?: string
  height?: number
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

export default function TrendChart({ data, color = 'var(--primary)', height = 140 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const points = data.filter((p) => p.value != null) as (MeasurementSeriesPointDto & {
    value: number
  })[]

  if (points.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
        Sin datos suficientes para graficar la tendencia
      </div>
    )
  }

  const width = 600
  const paddingX = 24
  const paddingY = 24

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padY = (max - min) === 0 ? 1 : span * 0.15

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : paddingX + (i / (points.length - 1)) * (width - paddingX * 2)
    const y = height - paddingY - ((p.value - (min - padY)) / (span + padY * 2)) * (height - paddingY * 2)
    return { x, y, date: new Date(p.date), value: p.value }
  })

  const curvePath = getCubicPath(coords)
  const areaPath = `${curvePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - 4} L ${coords[0].x.toFixed(1)} ${height - 4} Z`

  const fmtValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '') || 'main'}`
  const glowId = `glow-${color.replace(/[^a-zA-Z0-9]/g, '') || 'main'}`

  const activeCoord = hoveredIdx !== null ? coords[hoveredIdx] : null

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        role="img"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.includes('var(') ? 'var(--primary)' : color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color.includes('var(') ? 'var(--primary)' : color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={color.includes('var(') ? 'var(--primary)' : color} floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Dashed background grid lines */}
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(15,23,42,0.06)" strokeDasharray="4 4" />
        <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="rgba(15,23,42,0.06)" strokeDasharray="4 4" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(15,23,42,0.06)" strokeDasharray="4 4" />

        {/* Gradient fill area */}
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />

        {/* Glowing smooth curve line */}
        <path
          d={curvePath}
          fill="none"
          stroke={color.includes('var(') ? 'var(--primary)' : color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {/* Data points & hover triggers */}
        {coords.map((c, i) => {
          const isHovered = hoveredIdx === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={c.x}
                cy={c.y}
                r={isHovered ? '7' : '4.5'}
                fill="#ffffff"
                stroke={color.includes('var(') ? 'var(--primary)' : color}
                strokeWidth={isHovered ? '3.5' : '2.5'}
                style={{ transition: 'all 0.15s ease' }}
              />
              {isHovered && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="12"
                  fill={color.includes('var(') ? 'var(--primary)' : color}
                  fillOpacity="0.2"
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip on hover */}
      {activeCoord && (
        <div
          style={{
            position: 'absolute',
            left: `${(activeCoord.x / width) * 100}%`,
            top: `${(activeCoord.y / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: 'var(--glass-level-2)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--glass-shadow-hover)',
            borderRadius: '8px',
            padding: '0.35rem 0.65rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <div style={{ color: 'var(--primary)' }}>{fmtValue(activeCoord.value)}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{fmtDate(activeCoord.date)}</div>
        </div>
      )}
    </div>
  )
}