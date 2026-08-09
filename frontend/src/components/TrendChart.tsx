import type { MeasurementSeriesPointDto } from '../api/types'

interface Props {
  data: MeasurementSeriesPointDto[]
  color?: string
  height?: number
}

export default function TrendChart({ data, color = '#22c55e', height = 120 }: Props) {
  const points = data.filter((p) => p.value != null) as (MeasurementSeriesPointDto & {
    value: number
  })[]

  if (points.length === 0) {
    return <p className="text-muted" style={{ textAlign: 'center' }}>Sin datos suficientes</p>
  }

  const width = 600
  const padding = 8
  const min = Math.min(...points.map((p) => p.value))
  const max = Math.max(...points.map((p) => p.value))
  const span = max - min || 1
  const padY = (max - min) === 0 ? 1 : span * 0.12

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - padding * 2)
    const y = height - padding - ((p.value - (min - padY)) / (span + padY * 2)) * (height - padding * 2)
    return { x, y, date: new Date(p.date), value: p.value }
  })

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${height} L${coords[0].x.toFixed(1)},${height} Z`

  const fmtValue = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  const fmtDate = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }} role="img">
      <defs>
        <linearGradient id={`grad-${color.startsWith('#') ? color.slice(1) : 'g'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.startsWith('#') ? color.slice(1) : 'g'})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="3.5" fill={color} />
          <title>{`${fmtDate(c.date)}: ${fmtValue(c.value)}`}</title>
        </g>
      ))}
    </svg>
  )
}