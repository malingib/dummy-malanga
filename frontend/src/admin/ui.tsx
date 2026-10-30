export const toNumber = (value: unknown) => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

export const money = (value: unknown) =>
  `KES ${toNumber(value).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`

export const compactMoney = (value: unknown) => {
  const number = toNumber(value)
  if (Math.abs(number) >= 1_000_000) return `KES ${(number / 1_000_000).toFixed(1)}M`
  if (Math.abs(number) >= 1_000) return `KES ${Math.round(number / 1_000)}K`
  return `KES ${Math.round(number)}`
}

export const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—'

export const shortDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-KE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—'

export const dateOnly = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—'

export const relativeTime = (value?: string | null) => {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return '—'
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export const maskPhone = (value?: string | null) => (value ? `${value.slice(0, 6)}••••${value.slice(-2)}` : '—')

export const percent = (value: unknown, digits = 1) => `${toNumber(value).toFixed(digits)}%`

export function exportCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>,
) {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [
    columns.map((column) => escape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const titleCase = (value?: string | null) =>
  String(value || 'Unknown')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const methodLabel = (value?: string | null) => {
  const method = String(value || '').trim()
  if (!method) return 'M-Pesa'
  if (method.toLowerCase() === 'stk') return 'STK'
  if (method.toLowerCase() === 'c2b') return 'C2B'
  return titleCase(method)
}

export const methodLabels = (values?: string[] | null) =>
  values?.length ? values.map(methodLabel).join(', ') : 'M-Pesa'
