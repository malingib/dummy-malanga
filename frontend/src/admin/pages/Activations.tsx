import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type AdminActivation } from '../api'
import {
  Alert,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  SkeletonList,
  StatusBadge,
} from '../../components/primitives'
import { dateTime, methodLabels, relativeTime, titleCase } from '../ui'

const actions = [
  { value: 'start_review', label: 'Start review', description: 'Move the request into platform review.' },
  { value: 'request_credentials', label: 'Request credentials', description: 'Ask the merchant to complete M-Pesa credentials.' },
  { value: 'mark_testing', label: 'Mark testing', description: 'Record that connection and callback testing is underway.' },
  { value: 'approve', label: 'Approve go-live', description: 'Mark the request live and move the workspace to live status.' },
  { value: 'block', label: 'Block request', description: 'Stop the request with an explicit reason for the merchant.' },
  { value: 'cancel', label: 'Cancel request', description: 'Close the request without approving it.' },
  { value: 'reopen', label: 'Reopen request', description: 'Return a cancelled request to review.' },
]

export function AdminActivationsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [environment, setEnvironment] = useState('')
  const [selected, setSelected] = useState<AdminActivation | null>(null)
  const [action, setAction] = useState('start_review')
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState('')

  const activations = useQuery({
    queryKey: ['admin', 'activations', status, environment],
    queryFn: () => adminApi.activations({ status, environment, limit: 200 }),
  })

  const update = useMutation({
    mutationFn: () => adminApi.updateActivation({ id: selected?.id || '', action, note }),
    onSuccess: () => {
      setSelected(null)
      setValidation('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'activations'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'merchant'] })
    },
  })

  const openManage = (activation: AdminActivation) => {
    setSelected(activation)
    setAction(activation.status === 'cancelled' ? 'reopen' : activation.status === 'requested' ? 'start_review' : 'mark_testing')
    setNote(activation.notes || '')
    setValidation('')
  }

  const submit = () => {
    if (!selected) return
    if (action === 'block' && !note.trim()) {
      setValidation('Add a reason before blocking an activation request.')
      return
    }
    setValidation('')
    update.mutate()
  }

  const rows = activations.data?.data || []
  const unavailable = activations.isError
  const waiting = rows.filter((row) => !['live', 'cancelled'].includes(row.status)).length

  return (
    <>
      <PageHeader
        eyebrow="M-Pesa operations"
        title="Go-live queue"
        description="Review merchant activation requests, request evidence, test connections and make audited go-live decisions."
        actions={
          <button type="button" className="primary" onClick={() => activations.refetch()} disabled={activations.isFetching}>
            {activations.isFetching ? 'Refreshing…' : 'Refresh queue'}
          </button>
        }
      />

      {activations.error && <Alert text={activations.error instanceof Error ? activations.error.message : 'Activation requests could not be loaded.'} />}
      {update.error && <Alert text={update.error instanceof Error ? update.error.message : 'The activation request could not be updated.'} />}

      {waiting > 0 && (
        <div className="attention" role="status">
          <span className="attention-copy"><i aria-hidden="true" />{waiting} activation request{waiting === 1 ? '' : 's'} waiting for a platform decision</span>
          <div className="attention-chips">
            <Link to="/admin/merchants" className="chip">Review merchant posture <strong>→</strong></Link>
          </div>
        </div>
      )}

      <Panel title="Activation requests" subtitle="Newest requests first. Approving is a platform action and is written to the audit trail.">
        <div className="toolbar admin-toolbar">
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter activation requests by status">
            <option value="">All statuses</option>
            <option value="requested">Requested</option>
            <option value="reviewing">Reviewing</option>
            <option value="credentials_required">Credentials required</option>
            <option value="testing">Testing</option>
            <option value="blocked">Blocked</option>
            <option value="live">Live</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={environment} onChange={(event) => setEnvironment(event.target.value)} aria-label="Filter activation requests by environment">
            <option value="">All environments</option>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
          <span className="toolbar-meta">{unavailable ? 'Unavailable' : `${rows.length} request${rows.length === 1 ? '' : 's'} loaded`}</span>
        </div>

        {activations.isPending ? (
          <SkeletonList rows={7} />
        ) : unavailable ? (
          <EmptyState title="Activation data unavailable" copy="Fix the platform database connection using the error above, then refresh." />
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Platform M-Pesa activation requests</caption>
              <thead>
                <tr>
                  <th scope="col">Merchant</th>
                  <th scope="col">Environment</th>
                  <th scope="col">Requested methods</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Last update</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((activation) => (
                  <tr key={activation.id}>
                    <td>
                      <Link to={`/admin/merchants/${activation.workspace_id}`} className="row-link"><strong>{activation.business_name}</strong></Link>
                      <small>{activation.shortcode ? `Shortcode ${activation.shortcode}` : 'No shortcode'}{activation.merchant_status ? ` · Workspace ${titleCase(activation.merchant_status)}` : ''}</small>
                    </td>
                    <td><StatusBadge value={activation.environment} /></td>
                    <td>{methodLabels(activation.requested_methods)}</td>
                    <td><StatusBadge value={activation.status} /></td>
                    <td>{relativeTime(activation.requested_at)}<small>{dateTime(activation.requested_at)}</small></td>
                    <td>{activation.completed_at ? dateTime(activation.completed_at) : activation.reviewed_at ? dateTime(activation.reviewed_at) : 'Not reviewed'}</td>
                    <td><button type="button" onClick={() => openManage(activation)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No activation requests" copy="New M-Pesa go-live requests will appear here for platform review." />
        )}
      </Panel>

      {selected && (
        <Modal title="Manage activation request" onClose={() => setSelected(null)}>
          <div className="detail-row"><span>Merchant</span><strong>{selected.business_name}</strong></div>
          <div className="detail-row"><span>Current status</span><strong>{titleCase(selected.status)}</strong></div>
          <div className="detail-row"><span>Environment</span><strong>{titleCase(selected.environment)}</strong></div>
          <div className="detail-row"><span>Requested methods</span><strong>{methodLabels(selected.requested_methods)}</strong></div>
          {selected.last_error && <div className="detail-row"><span>Last error</span><strong className="error-text">{selected.last_error}</strong></div>}

          <div className="admin-decision-grid">
            {actions.filter((option) => option.value !== 'reopen' || selected.status === 'cancelled').map((option) => (
              <button
                type="button"
                key={option.value}
                className={`admin-decision ${action === option.value ? 'selected' : ''}`}
                onClick={() => setAction(option.value)}
                aria-pressed={action === option.value}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>

          <div className="admin-review-note">
            <label>
              {action === 'block' ? 'Block reason (required)' : 'Decision note'}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder={action === 'block' ? 'Explain exactly what must change before this merchant can go live.' : 'Add context for the merchant and the audit trail.'}
              />
            </label>
          </div>

          {validation && <div className="alert" role="alert">{validation}</div>}

          <div className="form-actions">
            <button type="button" onClick={() => setSelected(null)}>Cancel</button>
            <button type="button" className="primary" onClick={submit} disabled={update.isPending}>
              {update.isPending ? 'Recording…' : 'Record decision'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
