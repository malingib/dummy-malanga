import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { dateTime, exportCsv, maskPhone, money, toNumber, titleCase } from '../ui'

const PAGE_SIZE = 50

export function AdminTransactionsPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const status = params.get('status') || ''
  const reconciliation = params.get('reconciliation') || ''
  const workspaceId = params.get('workspace_id') || ''
  const offset = Math.max(Number(params.get('offset') || 0), 0)
  const [search, setSearch] = useState(q)

  useEffect(() => setSearch(q), [q])

  const transactions = useQuery({
    queryKey: ['admin', 'transactions', q, status, reconciliation, workspaceId, offset],
    queryFn: () => adminApi.transactions({ q, status, reconciliation, workspace_id: workspaceId, limit: PAGE_SIZE, offset }),
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

  const submit = (event: FormEvent) => {
    event.preventDefault()
    update({ q: search.trim() })
  }

  const rows = transactions.data?.data || []
  const count = transactions.data?.count || 0
  const unavailable = transactions.isError
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(count / PAGE_SIZE), 1)

  return (
    <>
      <PageHeader
        eyebrow="Payment network"
        title="All transactions"
        description="Cross-merchant payment records with status, reconciliation state and M-Pesa receipts."
        actions={
          <>
            <button
              type="button"
              onClick={() => exportCsv(
                'mobiwave-platform-transactions.csv',
                rows as unknown as Array<Record<string, unknown>>,
                [
                  { key: 'created_at', label: 'Created' },
                  { key: 'business_name', label: 'Merchant' },
                  { key: 'phone_number', label: 'Customer' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'reference', label: 'Reference' },
                  { key: 'status', label: 'Status' },
                  { key: 'reconciliation_status', label: 'Reconciliation' },
                  { key: 'mpesa_receipt', label: 'Receipt' },
                  { key: 'transaction_id', label: 'Transaction id' },
                ],
              )}
              disabled={!rows.length}
            >
              Export CSV
            </button>
            <button type="button" className="primary" onClick={() => transactions.refetch()} disabled={transactions.isFetching}>
              {transactions.isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {transactions.error && <Alert text={transactions.error instanceof Error ? transactions.error.message : 'Transactions could not be loaded.'} />}

      <Panel title="Payment ledger" subtitle="Server-side filters; merchant names are joined server-side.">
        <div className="toolbar admin-toolbar">
          <form className="admin-search-form" onSubmit={submit} role="search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search phone, reference, receipt or transaction id…"
              aria-label="Search platform transactions"
            />
            <button type="submit">Search</button>
          </form>
          <select value={status} onChange={(event) => update({ status: event.target.value })} aria-label="Filter by payment status">
            <option value="">All payment statuses</option>
            <option value="pending">Pending</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
          <select value={reconciliation} onChange={(event) => update({ reconciliation: event.target.value })} aria-label="Filter by reconciliation status">
            <option value="">All reconciliation states</option>
            <option value="unreconciled">Unreconciled</option>
            <option value="matched">Matched</option>
            <option value="unmatched">Unmatched</option>
            <option value="duplicate">Duplicate</option>
            <option value="manual">Manual</option>
          </select>
          {workspaceId && (
            <button type="button" className="chip" onClick={() => update({ workspace_id: '' })}>
              Merchant filter active <strong>×</strong>
            </button>
          )}
          <span className="toolbar-meta">{unavailable ? 'Unavailable' : `${count.toLocaleString()} payment${count === 1 ? '' : 's'}`}</span>
        </div>

        {transactions.isPending ? (
          <SkeletonList rows={10} />
        ) : unavailable ? (
          <EmptyState title="Payment data unavailable" copy="Fix the platform database connection using the error above, then refresh." />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <caption className="visually-hidden">Platform payment transactions</caption>
                <thead>
                  <tr>
                    <th scope="col">Merchant</th>
                    <th scope="col">Customer</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reconciliation</th>
                    <th scope="col">M-Pesa receipt</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <Link to={`/admin/merchants/${payment.workspace_id}`} className="row-link"><strong>{payment.business_name}</strong></Link>
                        <small>{payment.shortcode ? `Shortcode ${payment.shortcode}` : titleCase(payment.environment)}</small>
                      </td>
                      <td><strong>{maskPhone(payment.phone_number)}</strong><small>{titleCase(payment.transaction_type)}</small></td>
                      <td className="num">{money(payment.amount)}</td>
                      <td>{payment.reference || '—'}</td>
                      <td><StatusBadge value={payment.status} /></td>
                      <td><StatusBadge value={payment.reconciliation_status || 'unreconciled'} /></td>
                      <td>{payment.mpesa_receipt || '—'}<small>{payment.transaction_id ? String(payment.transaction_id).slice(0, 16) : ''}</small></td>
                      <td>{dateTime(payment.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <span>Page {page} of {pages} · {toNumber(count).toLocaleString()} records</span>
              <div>
                <button type="button" disabled={offset <= 0} onClick={() => update({ offset: String(Math.max(offset - PAGE_SIZE, 0)) })}>Previous</button>
                <button type="button" disabled={offset + PAGE_SIZE >= count} onClick={() => update({ offset: String(offset + PAGE_SIZE) })}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="No transactions match" copy="Clear the filters or search for a different customer or reference." />
        )}
      </Panel>
    </>
  )
}
