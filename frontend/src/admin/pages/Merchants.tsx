import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi, type AdminMerchantSummary } from '../api'
import {
  Alert,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonList,
  StatusBadge,
} from '../../components/primitives'
import { dateTime, exportCsv, money, relativeTime, toNumber, titleCase } from '../ui'

const PAGE_SIZE = 25

const statuses = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready_for_credentials', label: 'Ready for credentials' },
  { value: 'sandbox_ready', label: 'Sandbox ready' },
  { value: 'live', label: 'Live' },
]

export function AdminMerchantsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const environment = params.get('environment') || ''
  const offset = Math.max(Number(params.get('offset') || 0), 0)
  const [search, setSearch] = useState(q)

  useEffect(() => setSearch(q), [q])

  const merchants = useQuery({
    queryKey: ['admin', 'merchants', q, status, environment, offset],
    queryFn: () => adminApi.merchants({ q, status, environment, limit: PAGE_SIZE, offset }),
  })

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('offset' in patch)) next.delete('offset')
    setParams(next, { replace: true })
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    update({ q: search.trim() })
  }

  const rows = merchants.data?.data || []
  const count = merchants.data?.count || 0
  const unavailable = merchants.isError
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(count / PAGE_SIZE), 1)

  return (
    <>
      <PageHeader
        eyebrow="Merchant operations"
        title="Merchant workspaces"
        description="Inspect onboarding, M-Pesa connection posture, volume and open exceptions for every workspace."
        actions={
          <>
            <button
              type="button"
              onClick={() => exportCsv(
                'mobiwave-merchants.csv',
                rows as unknown as Array<Record<string, unknown>>,
                [
                  { key: 'business_name', label: 'Merchant' },
                  { key: 'business_email', label: 'Email' },
                  { key: 'shortcode', label: 'Shortcode' },
                  { key: 'environment', label: 'Environment' },
                  { key: 'status', label: 'Status' },
                  { key: 'volume', label: 'Volume' },
                  { key: 'transaction_count', label: 'Payments' },
                  { key: 'open_exceptions', label: 'Open exceptions' },
                  { key: 'last_payment_at', label: 'Last payment' },
                ],
              )}
              disabled={!rows.length}
            >
              Export CSV
            </button>
            <button type="button" className="primary" onClick={() => merchants.refetch()} disabled={merchants.isFetching}>
              {merchants.isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {merchants.error && <Alert text={merchants.error instanceof Error ? merchants.error.message : 'Merchant workspaces could not be loaded.'} />}
      {merchants.data?.degraded && (
        <div className="alert warning" role="status">{merchants.data.degraded_reason || 'Merchant aggregates are using a bounded fallback.'}</div>
      )}

      <Panel title="Workspace directory" subtitle="Server-side filtered across merchant name, email and shortcode.">
        <div className="toolbar admin-toolbar">
          <form className="admin-search-form" onSubmit={submitSearch} role="search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search merchant, email or shortcode…"
              aria-label="Search merchant workspaces"
            />
            <button type="submit">Search</button>
          </form>
          <select value={status} onChange={(event) => update({ status: event.target.value })} aria-label="Filter by workspace status">
            {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={environment} onChange={(event) => update({ environment: event.target.value })} aria-label="Filter by environment">
            <option value="">All environments</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
          <span className="toolbar-meta">{unavailable ? 'Unavailable' : `${count.toLocaleString()} workspace${count === 1 ? '' : 's'}`}</span>
        </div>

        {merchants.isPending ? (
          <SkeletonList rows={8} />
        ) : unavailable ? (
          <EmptyState title="Merchant data unavailable" copy="Fix the platform database connection using the error above, then refresh." />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">Merchant workspaces and payment posture</caption>
                <thead>
                  <tr>
                    <th scope="col">Merchant</th>
                    <th scope="col">Environment</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">Volume</th>
                    <th scope="col" className="num">Payments</th>
                    <th scope="col">M-Pesa</th>
                    <th scope="col" className="num">Open issues</th>
                    <th scope="col">Last payment</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((merchant: AdminMerchantSummary) => {
                    const issues = toNumber(merchant.open_exceptions)
                    return (
                      <tr key={merchant.id}>
                        <td>
                          <Link to={`/admin/merchants/${merchant.id}`} className="row-link"><strong>{merchant.business_name}</strong></Link>
                          <small>{merchant.business_email || merchant.business_phone || 'No contact on file'}</small>
                        </td>
                        <td><StatusBadge value={merchant.environment} /></td>
                        <td>
                          <StatusBadge value={merchant.status} />
                          {merchant.activation_status && <small>Activation: {titleCase(merchant.activation_status)}</small>}
                        </td>
                        <td className="num">{money(merchant.volume)}</td>
                        <td className="num">{toNumber(merchant.transaction_count).toLocaleString()}</td>
                        <td>
                          <StatusBadge value={merchant.connection_status || 'not connected'} />
                          <small>{merchant.callback_status ? `Callbacks: ${titleCase(merchant.callback_status)}` : 'No callback state'}</small>
                        </td>
                        <td className="num">
                          {issues ? <Link to={`/admin/exceptions?workspace_id=${merchant.id}`} className="admin-count-link">{issues}</Link> : '0'}
                        </td>
                        <td>{merchant.last_payment_at ? <>{dateTime(merchant.last_payment_at)}<small>{relativeTime(merchant.last_payment_at)}</small></> : 'No payments'}</td>
                        <td><Link to={`/admin/merchants/${merchant.id}`} className="admin-row-action">Open</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <span>Page {page} of {pages}</span>
              <div>
                <button type="button" disabled={offset <= 0} onClick={() => update({ offset: String(Math.max(offset - PAGE_SIZE, 0)) })}>Previous</button>
                <button type="button" disabled={offset + PAGE_SIZE >= count} onClick={() => update({ offset: String(offset + PAGE_SIZE) })}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="No merchant workspaces match" copy="Clear the filters or search for a different merchant." />
        )}
      </Panel>
    </>
  )
}
