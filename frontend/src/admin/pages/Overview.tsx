import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../api'
import { AreaChart } from '../../components/charts'
import {
  Alert,
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
  SegmentedControl,
  SkeletonList,
  StatusBadge,
} from '../../components/primitives'
import { compactMoney, methodLabels, money, relativeTime, shortDateTime, toNumber, titleCase } from '../ui'

type Range = 7 | 14 | 30 | 90

const toneForHealth = (state: string) => state === 'ok' ? 'success' : state === 'warning' ? 'warning' : 'neutral'

export function AdminOverviewPage() {
  const [range, setRange] = useState<Range>(14)
  const overview = useQuery({
    queryKey: ['admin', 'overview', range],
    queryFn: () => adminApi.overview(range),
  })

  const data = overview.data
  const paymentSeries = data?.payments.series || []
  const merchantSeries = data?.merchants.series || []
  const chartPoints = useMemo(
    () => paymentSeries.map((point) => ({ label: String(point.label || ''), value: toNumber(point.volume) })),
    [paymentSeries],
  )
  const merchantValues = merchantSeries.map((point) => toNumber(point.value))
  const volumeValues = paymentSeries.map((point) => toNumber(point.volume))
  const rateValues = paymentSeries.map((point) => toNumber(point.success_rate))
  const attentionValues = [
    toNumber(data?.queues.open_exceptions),
    toNumber(data?.queues.activation_requests),
    toNumber(data?.queues.failed_webhooks),
    toNumber(data?.queues.failed_notifications),
    toNumber(data?.queues.critical_exceptions),
  ]
  const attentionTotal = toNumber(data?.queues.open_exceptions) + toNumber(data?.queues.activation_requests) + toNumber(data?.queues.failed_webhooks) + toNumber(data?.queues.failed_notifications)
  const production = toNumber(data?.merchants.production)
  const sandbox = toNumber(data?.merchants.sandbox)

  return (
    <>
      <PageHeader
        eyebrow="Platform control"
        title="Network overview"
        description="Merchant posture, payment volume and the queues that need a platform decision."
        actions={
          <>
            <SegmentedControl
              label="Overview time range"
              value={range}
              onChange={(value) => setRange(value as Range)}
              options={[{ label: '7d', value: 7 }, { label: '14d', value: 14 }, { label: '30d', value: 30 }, { label: '90d', value: 90 }]}
            />
            <button type="button" className="primary" onClick={() => overview.refetch()} disabled={overview.isFetching}>
              {overview.isFetching ? 'Refreshing…' : 'Refresh data'}
            </button>
          </>
        }
      />

      {overview.error && (
        <Alert text={overview.error instanceof Error ? overview.error.message : 'Platform overview could not be loaded.'} />
      )}
      {data?.degraded && (
        <div className="alert warning" role="status">
          {data.degraded_reason || 'Some platform aggregates are running in a bounded fallback mode.'}
        </div>
      )}

      {attentionTotal > 0 && (
        <div className="attention" role="status">
          <span className="attention-copy"><i aria-hidden="true" />{attentionTotal} platform item{attentionTotal === 1 ? '' : 's'} need attention</span>
          <div className="attention-chips">
            {toNumber(data?.queues.open_exceptions) > 0 && <Link className="chip" to="/admin/exceptions">Exceptions <strong>{toNumber(data?.queues.open_exceptions)}</strong></Link>}
            {toNumber(data?.queues.activation_requests) > 0 && <Link className="chip" to="/admin/activations">Activations <strong>{toNumber(data?.queues.activation_requests)}</strong></Link>}
            {toNumber(data?.queues.failed_webhooks) > 0 && <Link className="chip" to="/admin/merchants">Webhook failures <strong>{toNumber(data?.queues.failed_webhooks)}</strong></Link>}
            {toNumber(data?.queues.failed_notifications) > 0 && <Link className="chip" to="/admin/merchants">Notification failures <strong>{toNumber(data?.queues.failed_notifications)}</strong></Link>}
            <Link className="link-arrow" to="/admin/exceptions">Triage now →</Link>
          </div>
        </div>
      )}

      {overview.isPending ? (
        <div className="metric-grid kpi-grid">
          {[1, 2, 3, 4].map((item) => <div className="card kpi" key={item}><div className="skeleton" style={{ height: 88 }} /></div>)}
        </div>
      ) : (
        <div className="metric-grid kpi-grid">
          <KpiCard
            label="Active merchants"
            value={String(toNumber(data?.merchants.live))}
            meta={`${toNumber(data?.merchants.total)} workspaces · ${production} production · ${sandbox} sandbox`}
            delta={null}
            values={merchantValues}
            footer="Review merchant posture"
            href="/admin/merchants"
          />
          <KpiCard
            label="Processed volume"
            value={compactMoney(data?.payments.volume)}
            meta={`${range} days · ${toNumber(data?.payments.success).toLocaleString()} successful payments`}
            delta={data?.payments.volume_change ?? null}
            values={volumeValues}
            footer="Inspect all transactions"
            href="/admin/transactions"
          />
          <KpiCard
            label="Payment success"
            value={`${toNumber(data?.payments.success_rate).toFixed(1)}%`}
            meta={`${toNumber(data?.payments.success).toLocaleString()} of ${toNumber(data?.payments.total).toLocaleString()} payments`}
            delta={null}
            values={rateValues}
            footer="Review failed and pending"
            href="/admin/transactions?status=failed"
          />
          <KpiCard
            label="Open attention"
            value={String(attentionTotal)}
            meta={`${toNumber(data?.queues.open_exceptions)} exceptions · ${toNumber(data?.queues.activation_requests)} activations`}
            delta={null}
            values={attentionValues}
            footer="Open operations queues"
            href="/admin/exceptions"
            invert
          />
        </div>
      )}

      <div className="overview-grid">
        <Panel
          title="Processed volume"
          subtitle={`Successful collections across all merchants · ${range} days`}
          action={<Link to="/admin/transactions" className="link-arrow">All transactions →</Link>}
        >
          {overview.isPending ? (
            <SkeletonList rows={4} />
          ) : paymentSeries.length ? (
            <AreaChart
              points={chartPoints}
              label={`Platform processed volume for the last ${range} days`}
              format={(value) => compactMoney(value)}
              height={250}
            />
          ) : (
            <EmptyState title="No payment volume in this period" copy="Successful merchant payments will appear here once processed." />
          )}
        </Panel>

        <Panel title="Platform readiness" subtitle="Configuration and access signals — not a payment guarantee.">
          {overview.isPending ? (
            <SkeletonList rows={5} />
          ) : (
            <div className="health-list">
              {(data?.health || []).map((check) => (
                <div className="health-row admin-health-row" key={check.label} title={check.detail}>
                  <span>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </span>
                  <span className={`health-value ${toneForHealth(check.state)}`}>
                    <i aria-hidden="true" />
                    {check.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="admin-split">
        <Panel
          title="Recent merchants"
          subtitle={`${toNumber(data?.merchants.new_in_window)} new in the last ${range} days`}
          action={<Link to="/admin/merchants" className="link-arrow">All merchants →</Link>}
        >
          {(data?.recent_merchants || []).length ? (
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">Recently created merchant workspaces</caption>
                <thead>
                  <tr>
                    <th scope="col">Merchant</th>
                    <th scope="col">Environment</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">Volume</th>
                    <th scope="col">Last payment</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent_merchants || []).map((merchant) => (
                    <tr key={merchant.id}>
                      <td>
                        <Link to={`/admin/merchants/${merchant.id}`} className="row-link"><strong>{merchant.business_name}</strong></Link>
                        <small>{merchant.shortcode ? `Shortcode ${merchant.shortcode}` : merchant.business_email || 'No shortcode'}</small>
                      </td>
                      <td><StatusBadge value={merchant.environment} /></td>
                      <td><StatusBadge value={merchant.status} /></td>
                      <td className="num">{money(merchant.volume)}</td>
                      <td>{merchant.last_payment_at ? shortDateTime(merchant.last_payment_at) : 'No payments'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No merchants yet" copy="Merchant workspaces will appear here after onboarding." />
          )}
        </Panel>

        <Panel title="Operations queue" subtitle="Oldest open items first.">
          <div className="admin-queue-block">
            <div className="admin-queue-head">
              <strong>M-Pesa activations</strong>
              <Link to="/admin/activations">View queue →</Link>
            </div>
            {(data?.activation_queue || []).length ? (data?.activation_queue || []).map((item) => (
              <Link to="/admin/activations" className="admin-queue-row" key={item.id}>
                <span>
                  <strong>{item.business_name}</strong>
                  <small>{item.environment} · {methodLabels(item.requested_methods)} · {relativeTime(item.requested_at)}</small>
                </span>
                <StatusBadge value={item.status} />
              </Link>
            )) : <div className="admin-empty-row">No activation requests waiting.</div>}
          </div>

          <div className="admin-queue-block">
            <div className="admin-queue-head">
              <strong>Recent exceptions</strong>
              <Link to="/admin/exceptions">View queue →</Link>
            </div>
            {(data?.recent_exceptions || []).length ? (data?.recent_exceptions || []).map((item) => (
              <Link to="/admin/exceptions" className="admin-queue-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.business_name} · {titleCase(item.type)} · {relativeTime(item.created_at)}</small>
                </span>
                <StatusBadge value={item.severity} />
              </Link>
            )) : <div className="admin-empty-row">No open reconciliation exceptions.</div>}
          </div>
        </Panel>
      </div>
    </>
  )
}
