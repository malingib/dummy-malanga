import { useId } from 'react'

export type ChartPoint = { label: string; value: number }

const compact = new Intl.NumberFormat('en-KE', { notation: 'compact', maximumFractionDigits: 1 })

function niceCeiling(max: number) {
  if (!Number.isFinite(max) || max <= 0) return 1
  const exponent = Math.floor(Math.log10(max))
  const magnitude = Math.pow(10, exponent)
  const normalised = max / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

function axisTicks(max: number, count = 4) {
  const top = niceCeiling(max)
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i)
}

export function AreaChart({
  points,
  height = 236,
  format = (value: number) => compact.format(value),
  label,
}: {
  points: ChartPoint[]
  height?: number
  format?: (value: number) => string
  label: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const width = 720
  const padding = { top: 14, right: 14, bottom: 28, left: 52 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const top = niceCeiling(maxValue)
  const x = (index: number) =>
    padding.left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * innerWidth)
  const y = (value: number) => padding.top + innerHeight - (value / top) * innerHeight
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)},${(padding.top + innerHeight).toFixed(1)} L${x(0).toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`
    : ''
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const total = points.reduce((sum, point) => sum + point.value, 0)

  return (
    <div className="chart-shell">
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}. Total ${format(total)} across ${points.length} periods.`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {axisTicks(top).map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
            />
            <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="chart-tick">
              {format(tick)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={x(index)} cy={y(point.value)} r="8" fill="transparent">
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </circle>
            {index % labelEvery === 0 && (
              <text x={x(index)} y={height - 8} textAnchor="middle" className="chart-tick">
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <table className="visually-hidden">
        <caption>{label}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Sparkline({
  values,
  tone = 'var(--brand)',
  label,
}: {
  values: number[]
  tone?: string
  label: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const width = 132
  const height = 42
  const max = Math.max(...values)
  const min = Math.min(...values)
  const flat = max === min
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((value, index) => ({
    x: index * step,
    y: flat ? height / 2 : height - 4 - ((value - min) / span) * (height - 14),
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = points.length ? `${line} L${width},${height} L0,${height} Z` : ''

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${values.join(', ')}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.24" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradientId})`} />}
      {line && <path d={line} fill="none" stroke={tone} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />}
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.6" fill={tone} stroke="var(--surface)" strokeWidth="1.5" />
      )}
    </svg>
  )
}
