import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminException } from '../api'
import {
  Alert,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  SkeletonList,
  StatusBadge,
} from '../../components/primitives'
import { dateTime, money, relativeTime, titleCase } from '../ui'

export function AdminExceptionsPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const severity = params.get('severity') || ''
  const workspaceId = params.get('workspace_id') || ''
  const [selected, setSelected] = useState<AdminException | null>(null)
  const [note, setNote] = useState('')
  const [nextStatus, setNextStatus] = useState('in_review')

  const exceptions = useQuery({
    queryKey: ['admin', 'exceptions', status, severity, workspaceId],
    queryFn: () => adminApi.exceptions({ status, severity, workspace_id: workspaceId, limit: 200 }),
  })

  const update = useMutation({
    mutationFn: () => adminApi.updateException({
      id: selected?.id || '',
      status: nextStatus,
      resolution_note: note,
      previous_status: selected?.status,
    }),
    onSuccess: () => {
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'exceptions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'merchant'] })
    },
  })

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const openReview = (exception: AdminException) => {
    setSelected(exception)
    setNote(exception.resolution_note || '')
    setNextStatus(exception.status === 'open' ? 'in_review' : exception.status)
  }

  const rows = exceptions.data?.data || []
  const unavailable = exceptions.isError

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Exception queue"
        description="Reconciliation exceptions across every merchant workspace. Resolve with a note and an audited status change."
        actions={
          <button type="button" className="primary" onClick={() => exceptions.refetch()} disabled={exceptions.isFetching}>
            {exceptions.isFetching ? 'Refreshing…' : 'Refresh queue'}
          </button>
        }
      />

      {exceptions.error && <Alert text={exceptions.error instanceof Error ? exceptions.error.message : 'Exceptions could not be loaded.'} />}
      {update.error && <Alert text={update.error instanceof Error ? update.error.message : 'The exception could not be updated.'} />}

      <Panel title="Open work" subtitle="This view includes open, in-review, resolved and ignored records so the history stays auditable.">
        <div className="toolbar admin-toolbar">
          <select value={status} onChange={(event) => updateParam('status', event.target.value)} aria-label="Filter by exception status">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
          <select value={severity} onChange={(event) => updateParam('severity', event.target.value)} aria-label="Filter by severity">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {workspaceId && (
            <button type="button" className="chip" onClick={() => updateParam('workspace_id', '')}>
              Merchant filter active <strong>×</strong>
            </button>
          )}
          <span className="toolbar-meta">{unavailable ? 'Unavailable' : `${rows.length} loaded`}</span>
        </div>

        {exceptions.isPending ? (
          <SkeletonList rows={8} />
        ) : unavailable ? (
          <EmptyState title="Exception data unavailable" copy="Fix the platform database connection using the error above, then refresh." />
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Platform reconciliation exceptions</caption>
              <thead>
                <tr>
                  <th scope="col">Merchant</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Type</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Age</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((exception) => (
                  <tr key={exception.id}>
                    <td>
                      <Link to={`/admin/merchants/${exception.workspace_id}`} className="row-link"><strong>{exception.business_name}</strong></Link>
                      <small>{exception.shortcode ? `Shortcode ${exception.shortcode}` : exception.environment || '—'}</small>
                    </td>
                    <td className="admin-issue-cell"><strong>{exception.title}</strong><small>{exception.reason || 'No reason recorded'}</small></td>
                    <td>{titleCase(exception.type)}</td>
                    <td><StatusBadge value={exception.severity} /></td>
                    <td><StatusBadge value={exception.status} /></td>
                    <td className="num">{money(exception.amount)}</td>
                    <td>{relativeTime(exception.created_at)}<small>{dateTime(exception.created_at)}</small></td>
                    <td><button type="button" onClick={() => openReview(exception)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No exceptions match" copy="The platform queue is clear for this filter set." />
        )}
      </Panel>

      {selected && (
        <Modal title="Review exception" onClose={() => setSelected(null)}>
          <div className="detail-row"><span>Merchant</span><strong>{selected.business_name}</strong></div>
          <div className="detail-row"><span>Issue</span><strong>{selected.title}</strong></div>
          <div className="detail-row"><span>Amount</span><strong>{money(selected.amount)}</strong></div>
          <div className="detail-row"><span>Current status</span><strong>{titleCase(selected.status)}</strong></div>
          <div className="admin-review-note">
            <label>
              Resolution note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="Explain what was checked, what changed and the evidence used."
              />
            </label>
          </div>
          <div className="admin-review-actions">
            {['in_review', 'resolved', 'ignored'].map((value) => (
              <button
                type="button"
                key={value}
                className={nextStatus === value ? 'primary' : ''}
                onClick={() => setNextStatus(value)}
                aria-pressed={nextStatus === value}
              >
                {titleCase(value)}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setSelected(null)}>Cancel</button>
            <button type="button" className="primary" onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save decision'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
