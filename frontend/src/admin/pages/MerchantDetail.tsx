import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../api'
import {
  Alert,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonList,
  StatusBadge,
} from '../../components/primitives'
import { dateOnly, dateTime, maskPhone, methodLabels, money, percent, relativeTime, titleCase, toNumber } from '../ui'

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="detail-row"><span>{label}</span><strong>{value || '—'}</strong></div>
}

export function AdminMerchantDetailPage() {
  const { id = '' } = useParams()
  const merchant = useQuery({
    queryKey: ['admin', 'merchant', id],
    queryFn: () => adminApi.merchant(id),
    enabled: Boolean(id),
  })

  if (merchant.isPending) {
    return (
      <>
        <PageHeader eyebrow="Merchant operations" title="Loading merchant…" description="Reading workspace profile, payment posture and operational history." />
        <SkeletonList rows={8} />
      </>
    )
  }

  if (merchant.error) {
    return (
      <>
        <PageHeader eyebrow="Merchant operations" title="Merchant unavailable" description="The workspace could not be loaded." actions={<Link to="/admin/merchants" className="primary">Back to merchants</Link>} />
        <Alert text={merchant.error instanceof Error ? merchant.error.message : 'Merchant workspace could not be loaded.'} />
      </>
    )
  }

  const data = merchant.data?.data
  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Merchant operations" title="Merchant not found" description="This workspace does not exist or has been removed." actions={<Link to="/admin/merchants" className="primary">Back to merchants</Link>} />
        <EmptyState title="Workspace not found" copy="Return to the merchant directory and choose another workspace." />
      </>
    )
  }

  const { merchant: workspace, summary, transactions, exceptions, activations, connections, audit, admin_audit } = data
  const successRate = summary.transaction_count ? (summary.success_count / summary.transaction_count) * 100 : 0

  return (
    <>
      <PageHeader
        eyebrow="Merchant workspace"
        title={workspace.business_name}
        description={`${workspace.business_email || 'No email'} · ${workspace.shortcode ? `Shortcode ${workspace.shortcode}` : 'No shortcode'} · ${titleCase(workspace.environment)} environment`}
        actions={
          <>
            <Link to="/admin/merchants" className="btn-secondary">All merchants</Link>
            <Link to={`/admin/transactions?workspace_id=${workspace.id}`} className="primary">View transactions</Link>
          </>
        }
      />

      {merchant.data?.degraded && (
        <div className="alert warning" role="status">Some workspace aggregates are using fallback data. Apply migration 018 for the platform summary view.</div>
      )}

      <div className="admin-detail-status">
        <StatusBadge value={workspace.status} />
        <StatusBadge value={workspace.environment} />
        {workspace.activation_status && <StatusBadge value={workspace.activation_status} />}
        {workspace.connection_status && <StatusBadge value={workspace.connection_status} />}
        <span className="admin-detail-meta">Created {dateOnly(workspace.created_at)} · Last updated {dateTime(workspace.updated_at)}</span>
      </div>

      <div className="admin-stat-grid">
        <div className="metric"><span>All-time volume</span><strong>{money(summary.volume)}</strong><small>{summary.success_count.toLocaleString()} successful payments</small></div>
        <div className="metric"><span>Payment records</span><strong>{summary.transaction_count.toLocaleString()}</strong><small>{summary.pending_count} pending · {summary.failed_count} failed</small></div>
        <div className="metric"><span>Success rate</span><strong>{percent(successRate)}</strong><small>Across all recorded payments</small></div>
        <div className="metric"><span>Open exceptions</span><strong className={summary.open_exceptions ? 'warning' : ''}>{summary.open_exceptions}</strong><small>{summary.api_keys} active API key record{summary.api_keys === 1 ? '' : 's'}</small></div>
      </div>

      <div className="two-col">
        <Panel title="Workspace profile" subtitle="Identity and merchant configuration.">
          <ProfileRow label="Business email" value={workspace.business_email} />
          <ProfileRow label="Business phone" value={workspace.business_phone} />
          <ProfileRow label="Industry" value={workspace.industry} />
          <ProfileRow label="Shortcode" value={workspace.shortcode} />
          <ProfileRow label="Account format" value={titleCase(workspace.account_format)} />
          <ProfileRow label="Payment methods" value={methodLabels(workspace.payment_methods)} />
          <ProfileRow label="Onboarded" value={dateTime(workspace.created_at)} />
          <ProfileRow label="Last workspace update" value={dateTime(workspace.updated_at)} />
        </Panel>

        <Panel title="M-Pesa posture" subtitle="Connections and callback readiness for this merchant.">
          {connections.length ? (
            <div className="admin-connection-list">
              {connections.map((connection) => (
                <div className="admin-connection" key={connection.id}>
                  <div className="admin-connection-head">
                    <strong>{connection.shortcode}</strong>
                    <span>
                      {connection.is_primary && <StatusBadge value="primary" label="Primary" />}
                      <StatusBadge value={connection.connection_status} />
                    </span>
                  </div>
                  <div className="admin-connection-meta">
                    <span>{titleCase(connection.account_type)} · {titleCase(connection.environment)} · {titleCase(connection.credential_source)} credentials</span>
                    <span>Token: {titleCase(connection.token_status)} · Callbacks: {titleCase(connection.callback_status)}</span>
                    <span>Last tested: {connection.last_tested_at ? dateTime(connection.last_tested_at) : 'Never'}</span>
                  </div>
                  {connection.last_error && <p className="error-text">{connection.last_error}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No M-Pesa connection" copy="This merchant has not created a shortcode connection yet." />
          )}
        </Panel>
      </div>

      <Panel title="Activation history" subtitle="M-Pesa go-live requests and review state." action={<Link to="/admin/activations" className="link-arrow">Activation queue →</Link>}>
        {activations.length ? (
          <div className="admin-timeline">
            {activations.map((activation) => (
              <div className="admin-timeline-row" key={activation.id}>
                <span className={`admin-timeline-dot ${activation.status === 'live' ? 'done' : ''}`} aria-hidden="true" />
                <div>
                  <div className="admin-timeline-head">
                    <strong>{titleCase(activation.status)}</strong>
                    <StatusBadge value={activation.environment} />
                  </div>
                  <span>{methodLabels(activation.requested_methods)} · Requested {dateTime(activation.requested_at)}</span>
                  {activation.notes && <small>{activation.notes}</small>}
                  {activation.last_error && <small className="error-text">{activation.last_error}</small>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activation requests" copy="Activation history appears here when this merchant requests a go-live review." />
        )}
      </Panel>

      <Panel title="Recent payments" subtitle="Latest 100 payment records in this workspace." action={<Link to={`/admin/transactions?workspace_id=${workspace.id}`} className="link-arrow">All payments →</Link>}>
        {transactions.length ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Recent merchant payments</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reconciliation</th>
                  <th scope="col">Receipt</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{maskPhone(payment.phone_number)}</strong><small>{titleCase(payment.transaction_type)}</small></td>
                    <td className="num">{money(payment.amount)}</td>
                    <td>{payment.reference || '—'}</td>
                    <td><StatusBadge value={payment.status} /></td>
                    <td><StatusBadge value={payment.reconciliation_status || 'unreconciled'} /></td>
                    <td>{payment.mpesa_receipt || '—'}</td>
                    <td>{dateTime(payment.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No payments yet" copy="Payments will appear here when the merchant starts collecting." />
        )}
      </Panel>

      <Panel title="Open exceptions" subtitle="Reconciliation issues for platform review." action={<Link to={`/admin/exceptions?workspace_id=${workspace.id}`} className="link-arrow">Review queue →</Link>}>
        {exceptions.length ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Merchant reconciliation exceptions</caption>
              <thead>
                <tr>
                  <th scope="col">Issue</th>
                  <th scope="col">Type</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.slice(0, 10).map((exception) => (
                  <tr key={exception.id}>
                    <td><strong>{exception.title}</strong><small>{exception.reason || '—'}</small></td>
                    <td>{titleCase(exception.type)}</td>
                    <td><StatusBadge value={exception.severity} /></td>
                    <td><StatusBadge value={exception.status} /></td>
                    <td className="num">{money(exception.amount)}</td>
                    <td>{dateTime(exception.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No open exceptions" copy="No reconciliation exceptions are recorded for this merchant." />
        )}
      </Panel>

      <Panel title="Audit trail" subtitle="Platform actions and merchant-level operational events.">
        {admin_audit.length || audit.length ? (
          <div className="admin-timeline">
            {[...admin_audit.map((entry) => ({ ...entry, source: 'Platform' })), ...audit.map((entry) => ({ ...entry, actor_name: 'Merchant / system', source: 'Workspace' }))]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 20)
              .map((entry) => (
                <div className="admin-timeline-row" key={`${entry.source}-${entry.id}`}>
                  <span className="admin-timeline-dot" aria-hidden="true" />
                  <div>
                    <div className="admin-timeline-head">
                      <strong>{titleCase(entry.action)}</strong>
                      <small>{entry.source}</small>
                    </div>
                    <span>{entry.actor_name || 'System'} · {dateTime(entry.created_at)}</span>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && <small>{JSON.stringify(entry.metadata)}</small>}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="No audit entries yet" copy="Platform and workspace actions will appear here as they occur." />
        )}
        <div className="admin-panel-foot">Last refreshed {dateTime(data.fetched_at)} · {relativeTime(data.fetched_at)}</div>
      </Panel>
    </>
  )
}
