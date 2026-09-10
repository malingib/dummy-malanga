import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ReconciliationException } from './api'

const date = (value?: string | null) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const money = (value: number | string | null | undefined) =>
  `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

const Loading = () => (
  <div className="loading-list" aria-busy="true" aria-label="Loading">
    {[1, 2, 3, 4].map((item) => (
      <div className="skeleton" key={item} />
    ))}
  </div>
)

const Alert = ({ text }: { text: string }) => <div className="alert">{text}</div>

const Status = ({ value }: { value: string }) => {
  const normalized = value.toLowerCase()
  const success = ['success', 'resolved', 'active', 'live', 'delivered'].includes(normalized)
  const pending = ['pending', 'open', 'in_review', 'requested', 'reviewing'].includes(normalized)
  const tone = success ? 'success' : pending ? 'pending' : 'failed'

  return <span className={`status ${tone}`}>{value.replace(/_/g, ' ')}</span>
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>
        {sub && <span className="muted">{sub}</span>}
      </div>
    </div>
  )
}

export function ReconciliationOperations() {
  const queryClient = useQueryClient()
  const history = useQuery({
    queryKey: ['reconciliation'],
    queryFn: api.reconciliationHistory,
  })
  const exceptions = useQuery({
    queryKey: ['reconciliation-exceptions'],
    queryFn: () => api.reconciliationExceptions(),
  })

  const [tab, setTab] = useState<'runs' | 'exceptions'>('runs')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<ReconciliationException | null>(null)
  const [note, setNote] = useState('')

  const run = useMutation({
    mutationFn: () => api.reconcile(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-exceptions'] })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { status: string; resolution_note: string } }) =>
      api.updateReconciliationException(id, payload),
    onSuccess: () => {
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['reconciliation-exceptions'] })
    },
  })

  const rows = (exceptions.data?.data || []).filter((item) => !status || item.status === status)
  const openCount = rows.filter((item) => item.status === 'open').length

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">OPERATIONS</div>
          <h1>Reconciliation</h1>
          <p>Run matching and resolve persisted payment exceptions.</p>
        </div>
        <button className="primary" type="button" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? 'Running…' : 'Run reconciliation'}
        </button>
      </div>

      {run.error && <Alert text={run.error instanceof Error ? run.error.message : 'Reconciliation failed.'} />}
      {update.error && <Alert text={update.error instanceof Error ? update.error.message : 'Unable to update exception.'} />}

      <div className="dev-tabs" role="tablist" aria-label="Reconciliation views">
        <button type="button" className={tab === 'runs' ? 'active' : ''} onClick={() => setTab('runs')}>
          Runs
        </button>
        <button type="button" className={tab === 'exceptions' ? 'active' : ''} onClick={() => setTab('exceptions')}>
          Exceptions {openCount ? `(${openCount})` : ''}
        </button>
      </div>

      {tab === 'runs' && (
        history.isPending ? (
          <Loading />
        ) : (
          <section className="panel">
            {history.error && <Alert text={history.error instanceof Error ? history.error.message : 'Unable to load reconciliation history.'} />}
            {history.data?.data?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Created</th>
                      <th>Matched</th>
                      <th>Exceptions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.data.map((item, index) => (
                      <tr key={String(item.id || index)}>
                        <td>{String(item.id || `Run ${index + 1}`).slice(0, 12)}</td>
                        <td>{date(String(item.created_at || ''))}</td>
                        <td>{String(item.matched_count ?? item.matched ?? '—')}</td>
                        <td>{String(item.exception_count ?? item.unmatched_count ?? '—')}</td>
                        <td><Status value="success" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <strong>No reconciliation runs yet</strong>
                <span>Run reconciliation to start matching payments.</span>
              </div>
            )}
          </section>
        )
      )}

      {tab === 'exceptions' && (
        <section className="panel">
          <Head title="Exceptions" sub="Review, annotate and resolve persisted payment exceptions." />
          <div className="toolbar">
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter exceptions by status">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>

          {exceptions.isPending ? (
            <Loading />
          ) : exceptions.error ? (
            <Alert text={exceptions.error instanceof Error ? exceptions.error.message : 'Unable to load exceptions.'} />
          ) : rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        <small>{item.reason || '—'}</small>
                      </td>
                      <td>{item.type}</td>
                      <td>{money(item.amount)}</td>
                      <td>{item.severity}</td>
                      <td><Status value={item.status} /></td>
                      <td>{date(item.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item)
                            setNote(item.resolution_note || '')
                          }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <strong>No exceptions</strong>
              <span>Reconciliation will create exceptions for unmatched or duplicate payments.</span>
            </div>
          )}
        </section>
      )}

      {selected && (
        <Modal title="Review exception" onClose={() => setSelected(null)}>
          <div className="detail-row">
            <span>Issue</span>
            <strong>{selected.title}</strong>
          </div>
          <div className="detail-row">
            <span>Amount</span>
            <strong>{money(selected.amount)}</strong>
          </div>
          <label>
            Resolution note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => update.mutate({ id: selected.id, payload: { status: 'ignored', resolution_note: note } })}>
              Ignore
            </button>
            <button type="button" onClick={() => update.mutate({ id: selected.id, payload: { status: 'in_review', resolution_note: note } })}>
              In review
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => update.mutate({ id: selected.id, payload: { status: 'resolved', resolution_note: note } })}
              disabled={update.isPending}
            >
              {update.isPending ? 'Saving…' : 'Resolve'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export function MpesaOperations() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['mpesa'], queryFn: api.mpesa })
  const activation = useQuery({ queryKey: ['mpesa-activation'], queryFn: api.activation })
  const test = useMutation({
    mutationFn: api.testMpesa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mpesa'] }),
  })
  const request = useMutation({
    mutationFn: api.requestActivation,
    onSuccess: () => {
      setShow(false)
      setNotes('')
      queryClient.invalidateQueries({ queryKey: ['mpesa-activation'] })
    },
  })

  const [show, setShow] = useState(false)
  const [notes, setNotes] = useState('')
  const data = query.data
  const activationData = activation.data?.data

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">M-PESA</div>
          <h1>Connection & activation</h1>
          <p>Managed M-Pesa setup with business-level status and activation.</p>
        </div>
        <button className="primary" type="button" onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {test.error && <Alert text={test.error instanceof Error ? test.error.message : 'Connection test failed.'} />}
      {test.data?.error && <Alert text={test.data.error} />}
      {request.error && <Alert text={request.error instanceof Error ? request.error.message : 'Unable to submit activation request.'} />}

      <section className="metric-grid">
        <div className="metric">
          <span>Environment</span>
          <strong>{data?.workspace.environment || '—'}</strong>
          <small>{data?.workspace.shortcode || 'No shortcode'}</small>
        </div>
        <div className="metric">
          <span>Credentials</span>
          <strong>{data?.readiness.credentials ? 'Ready' : 'Setup needed'}</strong>
          <small>Server-side</small>
        </div>
        <div className="metric">
          <span>Callbacks</span>
          <strong>{data?.readiness.callback ? 'Ready' : 'Setup needed'}</strong>
          <small>Payment callbacks</small>
        </div>
        <div className="metric">
          <span>Activation</span>
          <strong>{activationData?.activation?.status || 'Not requested'}</strong>
          <small>Managed workflow</small>
        </div>
      </section>

      <section className="panel connection-page">
        <Head title="M-Pesa readiness" sub="Technical Daraja mechanics remain behind the managed workflow." />
        <div className="connection-grid">
          <div className="health-row"><span>Credentials</span><span>{data?.readiness.credentials ? 'Configured' : 'Needs setup'}</span></div>
          <div className="health-row"><span>Callbacks</span><span>{data?.readiness.callback ? 'Configured' : 'Needs setup'}</span></div>
          <div className="health-row"><span>STK Push</span><span>{data?.workspace.payment_methods?.includes('stk') ? 'Enabled' : 'Not enabled'}</span></div>
          <div className="health-row"><span>Last tested</span><span>{date(data?.readiness.connection?.last_tested_at)}</span></div>
        </div>

        <div className="managed-note">
          <strong>Managed activation</strong>
          <span>Request activation here. MobiWave can progress review, credentials, testing and go-live without exposing infrastructure details to merchants.</span>
        </div>

        {activationData ? (
          <div className="activation-state">
            <Status value={activationData.activation?.status || 'requested'} />
            {activationData.activation?.last_error && <p className="muted">{activationData.activation.last_error}</p>}
          </div>
        ) : (
          <button className="primary" type="button" onClick={() => setShow(true)} style={{ marginTop: 16 }}>
            Request activation
          </button>
        )}
      </section>

      {show && (
        <Modal title="Request M-Pesa activation" onClose={() => setShow(false)}>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Add any business or activation context…" />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => setShow(false)}>Cancel</button>
            <button className="primary" type="button" onClick={() => request.mutate(notes)} disabled={request.isPending}>
              {request.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export function SettingsOperations() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['settings'], queryFn: api.settings })
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  const save = useMutation({
    mutationFn: () => api.updateSettings(draft || {}),
    onSuccess: () => {
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const data = query.data?.data

  if (query.isPending) return <Loading />
  if (!data) return <Alert text={query.error instanceof Error ? query.error.message : 'Workspace settings unavailable.'} />

  const value = (key: string) => draft?.[key] ?? data[key as keyof typeof data] ?? ''
  const setValue = (key: string, value: unknown) => setDraft({ ...data, ...draft, [key]: value })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Settings</h1>
          <p>Edit business profile and notification behaviour stored in the workspace.</p>
        </div>
        {draft && (
          <button className="primary" type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      {save.error && <Alert text={save.error instanceof Error ? save.error.message : 'Unable to save settings.'} />}

      <section className="two-col">
        <section className="panel">
          <Head title="Business profile" />
          <label>Business name<input value={String(value('business_name'))} onChange={(event) => setValue('business_name', event.target.value)} /></label>
          <label>Business phone<input value={String(value('business_phone'))} onChange={(event) => setValue('business_phone', event.target.value)} /></label>
          <label>Business email<input type="email" value={String(value('business_email'))} onChange={(event) => setValue('business_email', event.target.value)} /></label>
          <label>Industry<input value={String(value('industry'))} onChange={(event) => setValue('industry', event.target.value)} /></label>
          <label>
            Account format
            <select value={String(value('account_format'))} onChange={(event) => setValue('account_format', event.target.value)}>
              <option value="paybill">PayBill</option>
              <option value="till">Till</option>
            </select>
          </label>
        </section>

        <section className="panel">
          <Head title="Notifications" />
          <Toggle label="SMS receipts" value={Boolean(value('notification_sms'))} onChange={(enabled) => setValue('notification_sms', enabled)} />
          <Toggle label="Email notifications" value={Boolean(value('notification_email'))} onChange={(enabled) => setValue('notification_email', enabled)} />
          <Toggle label="WhatsApp notifications" value={Boolean(value('notification_whatsapp'))} onChange={(enabled) => setValue('notification_whatsapp', enabled)} />
          <Toggle label="Developer webhooks" value={Boolean(value('developer_webhook'))} onChange={(enabled) => setValue('developer_webhook', enabled)} />
          <label>Webhook URL<input value={String(value('webhook_url'))} onChange={(event) => setValue('webhook_url', event.target.value)} placeholder="https://example.com/webhooks" /></label>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 15 }}>
        <Head title="Workspace status" />
        <div className="detail-row"><span>Environment</span><strong>{data.environment}</strong></div>
        <div className="detail-row"><span>Shortcode</span><strong>{data.shortcode}</strong></div>
        <div className="detail-row"><span>Status</span><strong>{data.status}</strong></div>
        <div className="detail-row"><span>Created</span><strong>{date(data.created_at)}</strong></div>
      </section>
    </>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="health-row">
      <span>{label}</span>
      <button type="button" className={value ? 'primary' : ''} onClick={() => onChange(!value)}>
        {value ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  )
}
