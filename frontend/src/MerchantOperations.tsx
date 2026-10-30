import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Payment, type PaymentStatus } from './api'
import { PaymentDetailOperations } from './PaymentDetailOperations'
import { AreaChart } from './components/charts'
import {
  Alert,
  EmptyState,
  KpiCard,
  Modal,
  PageHeader,
  Panel,
  SegmentedControl,
  SkeletonList,
  StatusBadge,
  toneFor,
  toneLabel,
} from './components/primitives'

export const money = (value: number | string) =>
  `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

export const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '—'

export const maskPhone = (value?: string | null) => (value ? `${value.slice(0, 6)}••••${value.slice(-2)}` : 'Customer')

const compactMoney = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${Math.round(value / 1_000)}K`
      : String(Math.round(value))

export function usePayments() {
  const overview = useQuery({ queryKey: ['dashboard', 'overview', 7], queryFn: () => api.overview(7) })
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api.payments() })
  return {
    overview: overview.data?.payments,
    rows: payments.data?.transactions ?? payments.data?.data ?? [],
    loading: overview.isPending || payments.isPending,
    error: overview.error || payments.error,
  }
}

type Range = 7 | 30 | 90

const startOfDay = (input: Date | string) => {
  const value = new Date(input)
  value.setHours(0, 0, 0, 0)
  return value
}

const dayKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

function buildDays(range: Range) {
  const today = startOfDay(new Date())
  return Array.from({ length: range }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (range - 1 - index))
    return day
  })
}

function bucket(rows: Payment[], days: Date[], select: (rows: Payment[]) => number) {
  const groups = new Map<string, Payment[]>()
  for (const row of rows) {
    const key = dayKey(startOfDay(row.created_at))
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return days.map((day) => select(groups.get(dayKey(day)) ?? []))
}

const percentChange = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function windowRows(rows: Payment[], range: Range, offset = 0) {
  const end = startOfDay(new Date())
  end.setDate(end.getDate() - offset * range)
  const start = new Date(end)
  start.setDate(end.getDate() - range + 1)
  return rows.filter((row) => {
    const created = startOfDay(row.created_at)
    return created >= start && created <= end
  })
}

function useSystemHealth() {
  const readiness = useQuery({ queryKey: ['mpesa', 'readiness'], queryFn: api.mpesa, staleTime: 60_000, retry: 1 })
  const sms = useQuery({ queryKey: ['sms', 'delivery'], queryFn: () => api.smsDelivery(), staleTime: 60_000, retry: 1 })
  const deliveries = useQuery({ queryKey: ['webhooks', 'deliveries'], queryFn: () => api.webhookDeliveries(), staleTime: 60_000, retry: 1 })

  const connection = readiness.data?.readiness.connection
  const smsQueue = sms.data?.queue
  const deliveryQueue = deliveries.data?.queue

  const rows: Array<{ label: string; value: string; href: string; detail?: string }> = [
    {
      label: 'M-Pesa credentials',
      value: readiness.isPending ? 'Checking' : readiness.error ? 'Unknown' : connection?.credential_status ?? 'Unknown',
      href: '/mpesa',
    },
    {
      label: 'Payment callbacks',
      value: readiness.isPending ? 'Checking' : readiness.error ? 'Unknown' : connection?.callback_status ?? 'Unknown',
      href: '/mpesa',
    },
    {
      label: 'SMS delivery',
      value: sms.isPending ? 'Checking' : sms.error ? 'Unknown' : smsQueue?.state ?? 'Unknown',
      detail: smsQueue && (smsQueue.total > 0 || smsQueue.delivered > 0 || smsQueue.failed > 0) ? `${smsQueue.delivered} delivered, ${smsQueue.failed} failed` : undefined,
      href: '/sms',
    },
    {
      label: 'Webhook queue',
      value: deliveries.isPending ? 'Checking' : deliveries.error ? 'Unknown' : deliveryQueue?.state ?? 'Unknown',
      detail: deliveryQueue && (deliveryQueue.total > 0 || deliveryQueue.delivered > 0 || deliveryQueue.failed > 0) ? `${deliveryQueue.delivered} delivered, ${deliveryQueue.failed} failed` : undefined,
      href: '/developers',
    },
  ]

  const checkedAt = Math.max(readiness.dataUpdatedAt, sms.dataUpdatedAt, deliveries.dataUpdatedAt)
  return { rows, readiness, checkedAt, smsQueue, deliveryQueue }
}

function Lifecycle({ stats, rows }: { stats?: { totalTransactions: number; successfulPayments: number; failedPayments: number }; rows: Payment[] }) {
  const total = stats?.totalTransactions ?? 0
  const completed = stats?.successfulPayments ?? 0
  const failed = stats?.failedPayments ?? 0
  const reversed = rows.filter((row) => row.status === 'reversed').length
  const pending = Math.max(total - completed - failed - reversed, 0)
  const stages = [
    { label: 'Created', value: total, tone: 'neutral', copy: 'All payment records' },
    { label: 'Processing', value: pending, tone: 'pending', copy: 'Awaiting confirmation' },
    { label: 'Completed', value: completed, tone: 'success', copy: 'Confirmed payments' },
    { label: 'Needs review', value: failed, tone: 'failed', copy: reversed ? `${reversed} reversed in view` : 'Failed or unmatched' },
  ] as const

  return (
    <Panel
      title="Payment lifecycle"
      subtitle="Every request should end in a recorded outcome."
      action={<Link to="/reconciliation" className="link-arrow">Open reconciliation →</Link>}
      className="lifecycle-panel"
    >
      <div className="lifecycle" aria-label="Payment lifecycle summary">
        {stages.map((stage, index) => (
          <div className="lifecycle-step" key={stage.label}>
            <div className={`lifecycle-node ${stage.tone}`}>{stage.value.toLocaleString()}</div>
            <div>
              <strong>{stage.label}</strong>
              <small>{stage.copy}</small>
            </div>
            {index < stages.length - 1 && <span className="lifecycle-connector" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function HealthPanel() {
  const { rows, checkedAt } = useSystemHealth()
  return (
    <Panel
      title="System health"
      subtitle={checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first check'}
    >
      <div className="health-list">
        {rows.map((row) => {
          const tone = toneFor(row.value)
          return (
            <Link to={row.href} className="health-row" key={row.label}>
              <span>{row.label}</span>
              <span className={`health-value ${tone}`}>
                <i aria-hidden="true" />
                {toneLabel(row.value)}
                {row.detail ? <small> · {row.detail}</small> : null}
              </span>
            </Link>
          )
        })}
      </div>
    </Panel>
  )
}

function ConnectionPanel() {
  const readiness = useQuery({ queryKey: ['mpesa', 'readiness'], queryFn: api.mpesa, staleTime: 60_000, retry: 1 })
  const connection = readiness.data?.readiness.connection
  const workspace = readiness.data?.workspace

  return (
    <Panel
      title="M-Pesa connection"
      subtitle="Environment and shortcode used for collections."
      action={<Link to="/mpesa" className="link-arrow">Open →</Link>}
    >
      {readiness.isPending ? (
        <SkeletonList rows={2} />
      ) : readiness.error ? (
        <EmptyState title="Connection status unavailable" copy="Open M-Pesa to verify readiness. Payment actions should be treated as unverified until then." />
      ) : !connection ? (
        <EmptyState title="No active shortcode" copy="Finish M-Pesa setup before requesting payments." />
      ) : (
        <div className="connection-meta">
          <div><span>Shortcode</span><strong>{workspace?.shortcode ?? '—'}</strong></div>
          <div><span>Environment</span><strong style={{ textTransform: 'capitalize' }}>{workspace?.environment ?? '—'}</strong></div>
          <div><span>Credentials</span><strong>{toneLabel(connection.credential_status)}</strong></div>
          <div><span>Callbacks</span><strong>{toneLabel(connection.callback_status)}</strong></div>
          <div><span>Last tested</span><strong>{connection.last_tested_at ? date(connection.last_tested_at) : 'Never'}</strong></div>
          <div><span>Workspace</span><strong>{toneLabel(workspace?.status)}</strong></div>
        </div>
      )}
    </Panel>
  )
}

function PaymentTable({ rows, onOpen, sort, onSortChange }: { rows: Payment[]; onOpen?: (id: string) => void; sort?: { key: string; direction: 'ascending' | 'descending' }; onSortChange?: (key: string) => void }) {
  const activeSort: { key: string; direction: 'ascending' | 'descending' } = sort ?? { key: 'time', direction: 'descending' }
  if (!rows.length) {
    return <EmptyState title="No payments found" copy="Try another search or wait for your first payment." />
  }
  const directionFor = (key: string) => activeSort.key === key ? activeSort.direction : undefined
  const nextDirection = (current?: string) => current === 'customer' || current === 'reference' || current === 'status' || current === 'receipt'
    ? current === activeSort.key && activeSort.direction === 'ascending' ? 'descending' : 'ascending'
    : current === activeSort.key && activeSort.direction === 'ascending' ? 'descending' : 'ascending'
  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">Payment transactions</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={directionFor('customer')} className={activeSort.key === 'customer' ? 'sortable' : ''} onClick={() => onSortChange?.(nextDirection('customer'))}>Customer</th>
            <th scope="col" aria-sort={directionFor('amount')} className={`num ${activeSort.key === 'amount' ? 'sortable' : ''}`} onClick={() => onSortChange?.(nextDirection('amount'))}>Amount</th>
            <th scope="col" aria-sort={directionFor('reference')} className={activeSort.key === 'reference' ? 'sortable' : ''} onClick={() => onSortChange?.(nextDirection('reference'))}>Reference</th>
            <th scope="col" aria-sort={directionFor('status')} className={activeSort.key === 'status' ? 'sortable' : ''} onClick={() => onSortChange?.(nextDirection('status'))}>Status</th>
            <th scope="col" aria-sort={directionFor('receipt')} className={activeSort.key === 'receipt' ? 'sortable' : ''} onClick={() => onSortChange?.(nextDirection('receipt'))}>M-Pesa receipt</th>
            <th scope="col" aria-sort={directionFor('time')} className={`num ${activeSort.key === 'time' ? 'sortable' : ''}`} onClick={() => onSortChange?.(nextDirection('time'))}>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={onOpen ? 'clickable' : ''}
              onClick={() => onOpen?.(row.id)}
            >
              <td>
                {onOpen
                  ? <Link to={`/payments/${row.id}`} className="row-link" onClick={(event) => event.stopPropagation()}><strong>{maskPhone(row.phone_number)}</strong></Link>
                  : <strong>{maskPhone(row.phone_number)}</strong>}
                <small>{row.transaction_type || 'M-Pesa'}</small>
              </td>
              <td className="num">{money(row.amount)}</td>
              <td>{row.reference || '—'}</td>
              <td><StatusBadge value={row.status} /></td>
              <td>{row.mpesa_receipt || '—'}</td>
              <td className="num">{date(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Overview() {
  const { overview: stats, rows, loading, error } = usePayments()
  const [range, setRange] = useState<Range>(7)
  const navigate = useNavigate()
  const days = useMemo(() => buildDays(range), [range])
  const previousDays = useMemo(() => {
    const end = startOfDay(new Date())
    end.setDate(end.getDate() - range)
    return Array.from({ length: range }, (_, index) => {
      const day = new Date(end)
      day.setDate(end.getDate() - (range - 1 - index))
      return day
    })
  }, [range])

  const currentRows = useMemo(() => windowRows(rows, range), [rows, range])
  const previousRows = useMemo(() => windowRows(rows, range, 1), [rows, range])

  const collectedSeries = useMemo(() => (stats?.series ?? []).map((point) => point.volume), [stats])
  const countSeries = useMemo(() => (stats?.series ?? []).map((point) => point.count), [stats])
  const rateSeries = useMemo(() => (stats?.series ?? []).map((point) => point.success_rate), [stats])
  const attentionSeries = useMemo(() => (stats?.series ?? []).map((point) => point.attention), [stats])

  const collectedCurrent = stats?.volume ?? 0
  const collectedPrevious = stats?.previous_volume ?? 0
  const lifetimeRate = stats?.count ? stats.success_rate : 0
  const windowRate = stats?.success_rate ?? null
  const previousRate = stats?.previous_success_rate ?? null
  const attentionCurrent = stats?.attention ?? 0
  const attentionPrevious = stats?.previous_attention ?? 0
  const failedOnly = rows.filter((row) => row.status === 'failed').length
  const attentionRows = rows.filter((row) => row.status === 'failed' || row.status === 'reversed' || row.reconciliation_status === 'unmatched')
  const reversed = rows.filter((row) => row.status === 'reversed').length
  const unmatched = rows.filter((row) => row.reconciliation_status === 'unmatched').length
  const message = `${attentionRows.length} payment${attentionRows.length === 1 ? '' : 's'} need attention`

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Payment operations"
        description={`Collections, M-Pesa connectivity and reconciliation for this workspace. ${stats ? `Based on ${stats.sampled_total} payments.` : ''}`}
        actions={
          <>
            <SegmentedControl
              label="Time range"
              value={range}
              onChange={(value) => {
                setRange(value as Range)
                useQueryClient().invalidateQueries({ queryKey: ['dashboard', 'overview'] })
              }}
              options={[{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }, { label: '90 days', value: 90 }]}
            />
            <Link className="primary" to="/payments?new=1">Request payment</Link>
          </>
        }
      />

      {error && <Alert text="Live payment data could not be loaded. Figures below may be stale or unavailable." />}

      {(attentionRows.length > 0) && (
        <div className="attention" role="status">
          <span className="attention-copy"><i aria-hidden="true" />{message}</span>
          <div className="attention-chips">
            {failedOnly > 0 && <Link className="chip" to="/payments?status=failed">Failed <strong>{failedOnly}</strong></Link>}
            {reversed > 0 && <Link className="chip" to="/payments?status=reversed">Reversed <strong>{reversed}</strong></Link>}
            {unmatched > 0 && <Link className="chip" to="/reconciliation">Unmatched <strong>{unmatched}</strong></Link>}
            <Link className="link-arrow" to="/reconciliation">Review →</Link>
          </div>
        </div>
      )}

      <div className="metric-grid kpi-grid">
        <KpiCard
          label="Collected"
          value={stats ? `KES ${stats.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          meta={stats ? 'Server-side window total' : 'Awaiting data'}
          delta={percentChange(collectedCurrent, collectedPrevious)}
          values={collectedSeries}
          footer={`Last ${range} days`}
          href="/payments"
        />
        <KpiCard
          label="Payments"
          value={stats ? String(stats.count) : '—'}
          meta={stats ? 'Window payment count' : 'Awaiting data'}
          delta={percentChange(currentRows.length, previousRows.length)}
          values={countSeries}
          footer={`${currentRows.length} in last ${range} days`}
          href="/payments"
        />
        <KpiCard
          label="Success rate"
          value={stats ? `${lifetimeRate.toFixed(1)}%` : '—'}
          meta={stats ? 'Window success rate' : 'Awaiting data'}
          delta={windowRate !== null && previousRate !== null ? windowRate - previousRate : null}
          values={rateSeries}
          footer="Across loaded payments"
          href="/payments?status=success"
          unit="pp"
        />
        <KpiCard
          label="Needs attention"
          value={stats ? String(stats.attention) : '—'}
          meta={stats ? 'Failed or reversed in window' : 'Awaiting data'}
          delta={percentChange(attentionCurrent, attentionPrevious)}
          values={attentionSeries}
          tone="var(--danger)"
          footer={unmatched ? `${unmatched} unmatched` : 'Open exceptions'}
          href="/payments?status=failed"
          invert
        />
      </div>

      <Lifecycle stats={{ totalTransactions: stats?.count ?? 0, successfulPayments: stats?.success ?? 0, failedPayments: stats?.failed ?? 0 }} rows={rows} />

      <div className="overview-grid">
        <Panel
          title="Successful collections"
          subtitle={`Last ${range} days · server-side view`}
          action={<Link to="/payments" className="link-arrow">View payments →</Link>}
        >
          <AreaChart
            points={days.map((day, index) => ({
              label: new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(day),
              value: (stats?.series ?? [])[index]?.volume ?? 0,
            }))}
            format={(value) => (value >= 1000 ? `KES ${(value / 1000).toFixed(1)}K` : `KES ${Math.round(value)}`)}
            label={`Successful collections over the last ${range} days`}
          />
          <div className="chart-legend">
            <span><i aria-hidden="true" />Successful collections</span>
            <span>{stats ? `KES ${stats.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })} in period` : 'Awaiting data'}</span>
          </div>
        </Panel>

        <div className="stack">
          <HealthPanel />
          <ConnectionPanel />
        </div>
      </div>

      <Panel
        title="Recent payments"
        subtitle="Newest records, including pending confirmations."
        action={<Link to="/payments" className="link-arrow">View all →</Link>}
      >
        {loading ? <SkeletonList rows={5} /> : <PaymentTable rows={rows.slice(0, 7)} onOpen={(id) => navigate(`/payments/${id}`)} />}
      </Panel>
    </>
  )
}

export function Payments() {
  const navigate = useNavigate()
  const { rows, loading, error } = usePayments()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [open, setOpen] = useState(params.get('new') === '1')

  useEffect(() => {
    if (params.get('new') === '1') setOpen(true)
  }, [params])

  const updateParams = (next: { q?: string; status?: string }) => {
    const merged = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value)
      else merged.delete(key)
    }
    merged.delete('new')
    setParams(merged, { replace: true })
  }

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!search || [row.phone_number, row.reference, row.mpesa_receipt, row.transaction_id].join(' ').toLowerCase().includes(search.toLowerCase())) &&
          (!status || row.status === status),
      ),
    [rows, search, status],
  )

  const closeModal = () => {
    setOpen(false)
    if (params.get('new')) {
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Payments"
        description="Track collections and send M-Pesa payment requests."
        actions={<button className="primary" onClick={() => setOpen(true)}>Request payment</button>}
      />
      {error && <Alert text="Live payments could not be loaded." />}
      <div className="toolbar">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); updateParams({ q: event.target.value, status }) }}
          placeholder="Search phone, receipt or reference"
          aria-label="Search payments"
        />
        <select
          value={status}
          onChange={(event) => { setStatus(event.target.value); updateParams({ q: search, status: event.target.value }) }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="success">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="reversed">Reversed</option>
        </select>
        <button onClick={() => { setSearch(''); setStatus(''); setParams({}, { replace: true }) }}>Clear</button>
        <span className="toolbar-meta">{filtered.length} of {rows.length} payments</span>
      </div>
      <section className="panel">
        {loading ? <SkeletonList rows={6} /> : <PaymentTable rows={filtered} onOpen={(id) => navigate(`/payments/${id}`)} />}
      </section>
      {open && <StkModal onClose={closeModal} />}
    </>
  )
}

const normalisePhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.length === 9 && /^[71]/.test(digits)) return `254${digits}`
  return digits
}

const isValidPhone = (value: string) => /^254[71]\d{8}$/.test(value)

const displayPhone = (value: string) =>
  value.length === 12 ? `+${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6, 9)} ${value.slice(9)}` : value

function StkModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('PAYMENT')
  const [intentKey, setIntentKey] = useState(() => crypto.randomUUID())
  const readiness = useQuery({ queryKey: ['mpesa', 'readiness'], queryFn: api.mpesa, staleTime: 60_000, retry: 1 })
  const normalised = normalisePhone(phone)
  const validPhone = isValidPhone(normalised)
  const validAmount = Number(amount) >= 1
  const validReference = /^[A-Za-z0-9 _.-]{1,12}$/.test(reference)

  useEffect(() => {
    setIntentKey(crypto.randomUUID())
  }, [phone, amount, reference])

  const mutation = useMutation({
    mutationFn: () =>
      api.stk(
        { phone: normalised, amount: Number(amount), reference: reference.slice(0, 12), description: 'MobiWave payment' },
        intentKey,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
    },
  })

  const workspace = readiness.data?.workspace
  const environment = workspace?.environment ?? (readiness.error ? 'unknown' : 'checking')

  return (
    <Modal title="Request M-Pesa payment" onClose={onClose}>
      {mutation.data?.transaction ? (
        <div className="pending-card">
          <span className="pending-icon" aria-hidden="true">⏳</span>
          <strong>Waiting for the customer</strong>
          <p>The STK prompt was sent to {displayPhone(normalised)}. The payment stays pending until M-Pesa confirms or the request expires.</p>
          <div className="preview-row"><span>Reference</span><strong>{reference}</strong></div>
          <div className="preview-row"><span>Amount</span><strong>{money(amount)}</strong></div>
          <div className="pending-actions">
            <Link className="primary" to={`/payments/${mutation.data.transaction.id}`} onClick={onClose}>Open payment</Link>
            <button className="btn-secondary" onClick={() => mutation.reset()}>Send another</button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            mutation.mutate()
          }}
          className="form-grid"
        >
          <label>Customer phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="07XX XXX XXX" inputMode="tel" />
          </label>
          {phone && !validPhone && <span className="field-hint error-text">Enter a valid Kenyan number, e.g. 0712 345 678.</span>}
          <label>Amount (KES)
            <input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label>Reference
            <input maxLength={12} value={reference} onChange={(event) => setReference(event.target.value)} required />
          </label>
          <div className="stk-preview">
            <div className="preview-row"><span>Paying to</span><strong>{workspace?.shortcode ? `${workspace.shortcode} · ${workspace.environment}` : environment === 'checking' ? 'Checking connection…' : 'Connection unverified'}</strong></div>
            <div className="preview-row"><span>Phone</span><strong>{validPhone ? displayPhone(normalised) : 'Enter a valid number'}</strong></div>
            <div className="preview-row"><span>Amount</span><strong>{validAmount ? money(amount) : '—'}</strong></div>
            <div className="preview-total"><span>Customer will pay</span><strong>{validAmount ? money(amount) : '—'}</strong></div>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary" disabled={mutation.isPending || !validPhone || !validAmount || !validReference}>
              {mutation.isPending ? 'Sending…' : 'Send STK Push'}
            </button>
          </div>
          {mutation.error && <Alert text={mutation.error instanceof Error ? mutation.error.message : 'Unable to send payment request.'} />}
        </form>
      )}
    </Modal>
  )
}

export function Customers() {
  const { rows, loading } = usePayments()
  const [search, setSearch] = useState('')
  const customers = useMemo(() => {
    const map = new Map<string, { phone: string; count: number; amount: number; last: string }>()
    rows.forEach((payment) => {
      const phone = payment.phone_number || 'Unknown'
      const customer = map.get(phone) || { phone, count: 0, amount: 0, last: payment.created_at }
      customer.count++
      customer.amount += Number(payment.amount || 0)
      if (new Date(payment.created_at) > new Date(customer.last)) customer.last = payment.created_at
      map.set(phone, customer)
    })
    return [...map.values()].filter((customer) => customer.phone.toLowerCase().includes(search.toLowerCase()))
  }, [rows, search])

  return (
    <>
      <PageHeader eyebrow="Customers" title="Customers" description="Customers are built automatically from payment activity." />
      <div className="toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer phone" aria-label="Search customers" />
        <span className="toolbar-meta">{customers.length} customers</span>
      </div>
      <section className="panel">
        {loading ? (
          <SkeletonList rows={5} />
        ) : !customers.length ? (
          <EmptyState title="No customers yet" copy="Customers appear after payments are recorded." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">Customer</th><th scope="col" className="num">Payments</th><th scope="col" className="num">Total collected</th><th scope="col">Last payment</th></tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.phone}>
                    <td><strong>{maskPhone(customer.phone)}</strong></td>
                    <td className="num">{customer.count}</td>
                    <td className="num">{money(customer.amount)}</td>
                    <td>{date(customer.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export type { PaymentStatus }
export { PaymentDetailOperations }
