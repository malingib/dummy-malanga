import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkline } from './charts'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'brand'

const successWords = new Set([
  'success', 'successful', 'completed', 'live', 'ok', 'healthy', 'ready', 'verified',
  'registered', 'sent', 'delivered', 'active', 'connected', 'matched', 'resolved', 'enabled',
])
const dangerWords = new Set([
  'failed', 'failure', 'error', 'reversed', 'unmatched', 'attention', 'attention_required',
  'expired', 'revoked', 'duplicate', 'blocked', 'disabled', 'inactive',
])
const warningWords = new Set(['pending', 'processing', 'in_progress', 'partial', 'review', 'open'])

export function toneFor(value?: string | null): Tone {
  const key = String(value ?? '').toLowerCase()
  if (successWords.has(key)) return 'success'
  if (dangerWords.has(key)) return 'danger'
  if (warningWords.has(key)) return 'warning'
  return 'neutral'
}

export function toneLabel(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Unknown'
  const known: Record<string, string> = { success: 'Successful', stk: 'STK Push', c2b: 'C2B', live: 'Live', ok: 'Healthy' }
  const key = raw.toLowerCase()
  if (known[key]) return known[key]
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function StatusBadge({ value, label }: { value?: string | null; label?: string }) {
  return <span className={`status ${toneFor(value)}`}>{label ?? toneLabel(value)}</span>
}

export function DeltaPill({
  value,
  suffix = 'vs previous period',
  invert = false,
  unit = '%',
}: {
  value: number | null
  suffix?: string
  invert?: boolean
  unit?: string
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="delta neutral" title="Not enough data for a comparison">No comparison</span>
  }
  if (Math.abs(value) < 0.05) {
    return <span className="delta neutral" title={`No change ${suffix}`}>0.0{unit}</span>
  }
  const rising = value > 0
  const favourable = invert ? !rising : rising
  return (
    <span className={`delta ${favourable ? 'up' : 'down'}`} title={suffix}>
      <span aria-hidden="true">{rising ? '▲' : '▼'}</span>
      {Math.abs(value).toFixed(1)}{unit}
      <span className="visually-hidden"> {suffix}</span>
    </span>
  )
}

export function KpiCard({
  label,
  value,
  meta,
  delta,
  values,
  tone = 'var(--brand)',
  footer,
  href,
  invert = false,
  unit = '%',
}: {
  label: string
  value: string
  meta: string
  delta: number | null
  values: number[]
  tone?: string
  footer: string
  href: string
  invert?: boolean
  unit?: string
}) {
  return (
    <article className="card kpi">
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        <DeltaPill value={delta} invert={invert} unit={unit} />
      </div>
      <div className="kpi-value-row">
        <strong className="kpi-value">{value}</strong>
      </div>
      <span className="kpi-meta">{meta}</span>
      <Sparkline values={values} tone={tone} label={`${label} trend`} />
      <Link to={href} className="kpi-footer">
        <span>{footer}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </header>
  )
}

export function Alert({ text }: { text: string }) {
  return <div className="alert" role="alert">{text}</div>
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  )
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => <div className="skeleton" key={index} />)}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <span className="panel-sub">{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ label: string; value: T }>
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? 'active' : ''}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}
