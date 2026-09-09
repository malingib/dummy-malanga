import { FormEvent, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, Payment, PaymentStatus, Webhook } from './api'
import { useUiStore } from './store'

type Nav = { label: string; path: string; icon: string }
const nav: Nav[] = [
  { label: 'Overview', path: '/', icon: '⌂' }, { label: 'Payments', path: '/payments', icon: '↕' },
  { label: 'Customers', path: '/customers', icon: '○' }, { label: 'Reconciliation', path: '/reconciliation', icon: '✓' },
  { label: 'M-Pesa', path: '/mpesa', icon: '◈' }, { label: 'SMS', path: '/sms', icon: '✉' },
  { label: 'Developers', path: '/developers', icon: '{}' }, { label: 'Settings', path: '/settings', icon: '⚙' },
]
const money = (value: number | string) => `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
const maskPhone = (phone?: string | null) => phone ? `${phone.slice(0, 6)}••••${phone.slice(-2)}` : 'Customer'

function useDashboardData() {
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: api.stats })
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api.payments() })
  const rows = payments.data?.transactions ?? payments.data?.data ?? []
  return { stats: stats.data, rows, loading: stats.isPending || payments.isPending, error: stats.error || payments.error }
}

function Shell() {
  const { sidebarOpen, toggleSidebar, environment, setEnvironment } = useUiStore()
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">M</div><div><strong>MobiWave</strong><span>Payments</span></div></div>
      <div className="nav-label">Workspace</div><nav>{nav.slice(0, 4).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="nav-label">Operations</div><nav>{nav.slice(4, 6).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="nav-label">Platform</div><nav>{nav.slice(6).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="connection-card"><div className="connection-row"><span>M-Pesa</span><span className="online"><i /> Connected</span></div><small>Payment connection is healthy.</small></div>
    </aside>
    {sidebarOpen && <button className="scrim" onClick={toggleSidebar} aria-label="Close navigation" />}
    <main className="main">
      <header className="topbar"><button className="menu" onClick={toggleSidebar}>☰</button><div className="crumb">Payments workspace</div><div className="top-actions"><select value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}><option value="sandbox">Sandbox</option><option value="production">Production</option></select><div className="avatar">MW</div></div></header>
      <div className="content"><Routes>
        <Route path="/" element={<Overview />} /><Route path="/payments" element={<Payments />} /><Route path="/payments/:id" element={<PaymentDetail />} />
        <Route path="/customers" element={<Customers />} /><Route path="/reconciliation" element={<Reconciliation />} /><Route path="/mpesa" element={<Mpesa />} />
        <Route path="/sms" element={<Sms />} /><Route path="/developers" element={<Developers />} /><Route path="/settings" element={<Settings />} />
      </Routes></div>
    </main>
  </div>
}
function NavItem({ item }: { item: Nav }) { return <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span>{item.label}</NavLink> }

function Overview() {
  const { stats, rows, loading, error } = useDashboardData()
  const successRate = stats?.totalTransactions ? ((stats.successfulPayments / stats.totalTransactions) * 100).toFixed(1) : '0.0'
  return <><div className="page-head"><div><div className="eyebrow">OVERVIEW</div><h1>Good afternoon</h1><p>Your payment system is healthy today.</p></div><Link className="primary" to="/payments?request=1">Request payment</Link></div>
    {error && <Alert text="Live payment data could not be loaded. Check the workspace connection." />}
    <section className="metric-grid"><Metric label="Collected" value={money(stats?.totalAmount ?? 0)} meta="All recorded payments" /><Metric label="Payments" value={(stats?.totalTransactions ?? 0).toLocaleString()} meta="Transactions recorded" /><Metric label="Success rate" value={`${successRate}%`} meta="Successful payments" /><Metric label="Needs attention" value={String(stats?.failedPayments ?? 0)} meta="Failed payments" warning /></section>
    <section className="two-col"><div className="panel activity"><PanelHead title="Payment activity" action="Last 7 days" /><MiniBars rows={rows} /></div><div className="panel health"><PanelHead title="System health" /><HealthRow label="M-Pesa connection" value="Connected" /><HealthRow label="Payment callbacks" value="Healthy" /><HealthRow label="SMS receipts" value="Ready" /><HealthRow label="Webhook queue" value="Healthy" /></div></section>
    <section className="panel"><PanelHead title="Recent payments" action="View all" href="/payments" />{loading ? <LoadingRows /> : <PaymentTable rows={rows.slice(0, 7)} />}</section>
  </>
}

function Payments() {
  const navigate = useNavigate(); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [showRequest, setShowRequest] = useState(false)
  const { rows, loading, error } = useDashboardData()
  const filtered = useMemo(() => rows.filter(r => (!search || [r.phone_number, r.reference, r.mpesa_receipt, r.transaction_id].join(' ').toLowerCase().includes(search.toLowerCase())) && (!status || r.status === status)), [rows, search, status])
  return <><div className="page-head"><div><div className="eyebrow">OPERATIONS</div><h1>Payments</h1><p>Track collections, send payment requests and resolve exceptions.</p></div><button className="primary" onClick={() => setShowRequest(true)}>Request payment</button></div>
    {error && <Alert text="Live payments could not be loaded." />}<div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phone, receipt or reference" /><select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="reversed">Reversed</option></select><button onClick={() => { setSearch(''); setStatus('') }}>Clear</button></div>
    <section className="panel">{loading ? <LoadingRows /> : <PaymentTable rows={filtered} onOpen={id => navigate(`/payments/${id}`)} />}</section>{showRequest && <StkModal onClose={() => setShowRequest(false)} />}</>
}

function StkModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState(''); const [amount, setAmount] = useState(''); const [reference, setReference] = useState('PAYMENT'); const [message, setMessage] = useState('');
  const mutation = useMutation({ mutationFn: api.stk, onSuccess: () => setMessage('STK Push sent. Ask the customer to complete the M-Pesa prompt.'), onError: e => setMessage(e instanceof Error ? e.message : 'Unable to send payment request.') })
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate({ phone, amount: Number(amount), reference: reference.slice(0, 12), description: 'MobiWave payment' }) }
  return <Modal title="Request M-Pesa payment" onClose={onClose}><form onSubmit={submit} className="form-grid"><label>Customer phone<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" required /></label><label>Amount (KES)<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} required /></label><label>Reference<input maxLength={12} value={reference} onChange={e => setReference(e.target.value)} required /></label><div className="form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Sending…' : 'Send STK Push'}</button></div>{message && <Alert text={message} />}</form></Modal>
}

function PaymentTable({ rows, onOpen }: { rows: Payment[]; onOpen?: (id: string) => void }) { return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Reference</th><th>Status</th><th>Receipt</th><th>Time</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className={onOpen ? 'clickable' : ''} onClick={() => onOpen?.(row.id)}><td><strong>{maskPhone(row.phone_number)}</strong><small>{row.transaction_type || 'M-Pesa'}</small></td><td>{money(row.amount)}</td><td>{row.reference || '—'}</td><td><Status status={row.status} /></td><td>{row.mpesa_receipt || '—'}</td><td>{date(row.created_at)}</td></tr>) : <tr><td colSpan={6}><Empty title="No payments found" copy="Try another search or wait for your first payment." /></td></tr>}</tbody></table></div> }
function Status({ status }: { status: PaymentStatus }) { const map = { success: 'Successful', pending: 'Pending', failed: 'Failed', reversed: 'Reversed' }; return <span className={`status ${status}`}>{map[status]}</span> }

function PaymentDetail() {
  const { id } = useParams(); const { rows, loading } = useDashboardData(); const payment = rows.find(r => r.id === id)
  if (loading) return <LoadingRows />
  if (!payment) return <Empty title="Payment not found" copy="The payment may have been removed or belongs to another workspace." />
  return <><div className="page-head"><div><div className="eyebrow">PAYMENT DETAIL</div><h1>{money(payment.amount)}</h1><p>{maskPhone(payment.phone_number)} · {payment.reference || 'No reference'}</p></div><Status status={payment.status} /></div><div className="two-col"><div className="panel"><PanelHead title="Payment information" /><DetailRow label="M-Pesa receipt" value={payment.mpesa_receipt || 'Pending'} /><DetailRow label="Transaction ID" value={payment.transaction_id || payment.id} /><DetailRow label="Reference" value={payment.reference || '—'} /><DetailRow label="Created" value={date(payment.created_at)} /><DetailRow label="Reconciliation" value={payment.reconciliation_status || 'unreconciled'} /></div><div className="panel"><PanelHead title="Timeline" /><Timeline label="Payment initiated" value={date(payment.created_at)} done /><Timeline label="M-Pesa prompt sent" value={payment.transaction_type === 'stk' ? 'STK Push' : 'C2B'} done /><Timeline label="Safaricom confirmation" value={payment.status === 'pending' ? 'Waiting' : payment.status === 'success' ? 'Confirmed' : 'Not confirmed'} done={payment.status !== 'pending'} /><Timeline label="Recorded in MobiWave" value={payment.status === 'pending' ? 'Waiting' : 'Recorded'} done={payment.status !== 'pending'} /><Timeline label="SMS receipt" value={payment.status === 'success' ? 'Ready' : 'Not sent'} done={payment.status === 'success'} /></div></div><Link to="/payments">← Back to payments</Link></>
}

function Customers() {
  const { rows, loading } = useDashboardData(); const [search, setSearch] = useState('')
  const customers = useMemo(() => { const map = new Map<string, { phone: string; count: number; amount: number; last: string }>(); rows.forEach(p => { const phone = p.phone_number || 'Unknown'; const old = map.get(phone) || { phone, count: 0, amount: 0, last: p.created_at }; old.count++; old.amount += Number(p.amount || 0); if (new Date(p.created_at) > new Date(old.last)) old.last = p.created_at; map.set(phone, old) }); return [...map.values()].filter(c => c.phone.toLowerCase().includes(search.toLowerCase())) }, [rows, search])
  return <><div className="page-head"><div><div className="eyebrow">CUSTOMERS</div><h1>Customers</h1><p>Customers are automatically built from your payment activity.</p></div></div><div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer phone" /></div><section className="panel">{loading ? <LoadingRows /> : <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Payments</th><th>Total collected</th><th>Last payment</th></tr></thead><tbody>{customers.map(c => <tr key={c.phone}><td><strong>{maskPhone(c.phone)}</strong></td><td>{c.count}</td><td>{money(c.amount)}</td><td>{date(c.last)}</td></tr>)}{!customers.length && <tr><td colSpan={4}><Empty title="No customers yet" copy="Customers appear automatically after payments are recorded." /></td></tr>}</tbody></table></div>}</section></>
}

function Reconciliation() {
  const queryClient = useQueryClient(); const history = useQuery({ queryKey: ['reconciliation'], queryFn: api.reconciliationHistory }); const { rows } = useDashboardData();
  const run = useMutation({ mutationFn: () => api.reconcile(), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reconciliation'] }) })
  const unmatched = rows.filter(r => r.reconciliation_status && r.reconciliation_status !== 'matched').length
  return <><div className="page-head"><div><div className="eyebrow">OPERATIONS</div><h1>Reconciliation</h1><p>Run matching and resolve payment exceptions from one place.</p></div><button className="primary" onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? 'Running…' : 'Run reconciliation'}</button></div><section className="metric-grid"><Metric label="Payments" value={String(rows.length)} meta="Current transaction window" /><Metric label="Needs review" value={String(unmatched)} meta="Unmatched or exceptional" warning={unmatched > 0} /><Metric label="Runs" value={String(history.data?.data?.length || 0)} meta="Reconciliation history" /><Metric label="Status" value={run.isPending ? 'Running' : 'Ready'} meta="Matching engine" /></section>{run.error && <Alert text={run.error instanceof Error ? run.error.message : 'Reconciliation failed.'} />}{run.data && <Alert text="Reconciliation completed successfully." />}<section className="panel"><PanelHead title="Recent runs" />{history.isPending ? <LoadingRows /> : history.data?.data?.length ? <div className="table-wrap"><table><thead><tr><th>Run</th><th>Created</th><th>Status</th></tr></thead><tbody>{history.data.data.map((r, i) => <tr key={String(r.id || i)}><td>{String(r.id || `Run ${i + 1}`)}</td><td>{date(String(r.created_at || ''))}</td><td><Status status="success" /></td></tr>)}</tbody></table></div> : <Empty title="No reconciliation runs yet" copy="Run reconciliation to match recorded M-Pesa payments and surface exceptions." />}</section></>
}

function Mpesa() {
  const queryClient = useQueryClient(); const q = useQuery({ queryKey: ['mpesa'], queryFn: api.mpesa }); const test = useMutation({ mutationFn: api.testMpesa, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mpesa'] }) })
  const data = q.data
  return <><div className="page-head"><div><div className="eyebrow">M-PESA</div><h1>Connection</h1><p>Technical configuration stays behind the scenes. You manage the business connection.</p></div><button className="primary" onClick={() => test.mutate()} disabled={test.isPending}>{test.isPending ? 'Testing…' : 'Run connection test'}</button></div>{q.error && <Alert text="Unable to read M-Pesa connection status." />}<section className="panel connection-page"><div className="big-status"><div className="check">{data?.readiness.connection?.credential_status === 'verified' ? '✓' : '!'}</div><div><h2>{data?.readiness.connection?.credential_status === 'verified' ? 'Connection is healthy' : 'Connection needs attention'}</h2><p>{data?.workspace?.shortcode ? `PayBill / Till ${data.workspace.shortcode}` : 'Complete payment onboarding to connect M-Pesa.'}</p></div></div><div className="connection-grid"><HealthRow label="Environment" value={data?.workspace.environment || '—'} /><HealthRow label="Credentials" value={data?.readiness.credentials ? 'Configured' : 'Needs setup'} /><HealthRow label="Callbacks" value={data?.readiness.callback ? 'Configured' : 'Needs setup'} /><HealthRow label="STK Push" value={data?.workspace.payment_methods?.includes('stk') ? 'Enabled' : 'Not enabled'} /><HealthRow label="Last tested" value={date(data?.readiness.connection?.last_tested_at)} /></div>{test.data?.error && <Alert text={test.data.error} />}<div className="managed-note"><strong>Mobiwave-managed setup</strong><span>We keep Daraja and callback mechanics out of the normal merchant workflow. If action is required, this page shows the business-level reason.</span></div></section></>
}

function Sms() { return <><div className="page-head"><div><div className="eyebrow">COMMUNICATIONS</div><h1>SMS receipts</h1><p>Payment confirmations use the MobiWave SMS platform natively.</p></div></div><div className="two-col"><div className="panel"><PanelHead title="Receipt delivery" /><HealthRow label="Provider" value="MobiWave SMS" /><HealthRow label="Sender" value="MobiWave" /><HealthRow label="Payment receipts" value="Enabled" /><HealthRow label="Credentials" value="Server-side" /></div><div className="panel"><PanelHead title="Customer preview" /><div className="sms-preview"><strong>Payment received</strong><p>Hello John, we have received KES 4,500 from your M-Pesa account.</p><small>Reference: INV-10482 · Thank you.</small></div></div></div><section className="panel"><PanelHead title="Delivery model" /><p className="muted">Successful payment callbacks create a receipt event. The MobiWave SMS service sends the confirmation without exposing API credentials to the browser.</p></section></> }

function Developers() {
  const keys = useQuery({ queryKey: ['keys'], queryFn: api.apiKeys })
  const hooks = useQuery({ queryKey: ['webhooks'], queryFn: api.webhooks })
  const [tab, setTab] = useState<'keys' | 'webhooks' | 'deliveries' | 'playground'>('keys')
  const [showKey, setShowKey] = useState(false)
  const [keyName, setKeyName] = useState('Production application')
  const [secret, setSecret] = useState('')
  const [showWebhook, setShowWebhook] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['payment.success', 'payment.failed'])
  const [apiKey, setApiKey] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [playgroundResult, setPlaygroundResult] = useState('')
  const [playgroundError, setPlaygroundError] = useState('')
  const [playgroundMode, setPlaygroundMode] = useState<'lookup' | 'stk'>('lookup')
  const [stkPhone, setStkPhone] = useState('')
  const [stkAmount, setStkAmount] = useState('')
  const [stkReference, setStkReference] = useState('TEST')
  const [idempotencyKey, setIdempotencyKey] = useState(() => `mw_${Date.now()}`)
  const deliveries = useQuery({ queryKey: ['webhook-deliveries'], queryFn: () => api.webhookDeliveries(), enabled: tab === 'deliveries' })

  const createKey = useMutation({ mutationFn: () => api.createApiKey({ name: keyName.trim() || 'Application', scopes: ['payments:read', 'payments:write'] }), onSuccess: data => { setSecret(data.secret); setShowKey(false); keys.refetch() } })
  const revokeKey = useMutation({ mutationFn: api.revokeApiKey, onSuccess: () => keys.refetch() })
  const saveWebhook = useMutation({ mutationFn: async () => editingWebhook ? api.updateWebhook(editingWebhook.id, { url: webhookUrl, events: webhookEvents }) : api.createWebhook({ url: webhookUrl, events: webhookEvents }), onSuccess: data => { if ('secret' in data && typeof data.secret === 'string' && data.secret) setWebhookSecret(data.secret); setShowWebhook(false); setEditingWebhook(null); hooks.refetch() } })
  const disableWebhook = useMutation({ mutationFn: api.disableWebhook, onSuccess: () => hooks.refetch() })
  const retryDelivery = useMutation({ mutationFn: api.retryWebhookDelivery, onSuccess: () => deliveries.refetch() })
  const runPlayground = useMutation({ mutationFn: async () => playgroundMode === 'lookup' ? api.apiPlayground(`/api/v1/payments/${paymentId.trim()}`, 'GET', apiKey.trim()) : api.apiPlayground('/api/v1/payments/stk', 'POST', apiKey.trim(), { phone: stkPhone, amount: Number(stkAmount), reference: stkReference, description: 'Developer playground test' }, idempotencyKey), onSuccess: data => { setPlaygroundError(''); setPlaygroundResult(JSON.stringify(data, null, 2)) }, onError: error => { setPlaygroundResult(''); setPlaygroundError(error instanceof Error ? error.message : 'Request failed') } })

  const openCreateWebhook = () => { setEditingWebhook(null); setWebhookUrl('https://'); setWebhookEvents(['payment.success', 'payment.failed']); setShowWebhook(true) }
  const openEditWebhook = (hook: Webhook) => { setEditingWebhook(hook); setWebhookUrl(hook.url); setWebhookEvents(hook.events?.length ? hook.events : ['payment.success', 'payment.failed']); setShowWebhook(true) }
  const toggleEvent = (event: string) => setWebhookEvents(current => current.includes(event) ? current.filter(value => value !== event) : [...current, event])
  const webhookEventsAvailable = ['payment.success', 'payment.failed', 'payment.pending', 'payment.reversed']

  return <>
    <div className="page-head"><div><div className="eyebrow">DEVELOPERS</div><h1>API & webhooks</h1><p>Build integrations with scoped keys, signed webhooks and a safe request playground.</p></div><div className="form-actions"><button onClick={() => setTab('playground')}>Open API playground</button><button className="primary" onClick={() => setShowKey(true)}>Create API key</button></div></div>
    {(secret || webhookSecret) && <div className="secret-box"><strong>{secret ? 'API key secret — copy it now' : 'Webhook signing secret — copy it now'}</strong><code>{secret || webhookSecret}</code><small>Secrets are shown once and are not stored in the browser.</small><button onClick={() => { setSecret(''); setWebhookSecret('') }}>Dismiss</button></div>}
    <div className="dev-tabs"><button className={tab === 'keys' ? 'active' : ''} onClick={() => setTab('keys')}>API keys</button><button className={tab === 'webhooks' ? 'active' : ''} onClick={() => setTab('webhooks')}>Webhooks</button><button className={tab === 'deliveries' ? 'active' : ''} onClick={() => setTab('deliveries')}>Deliveries</button><button className={tab === 'playground' ? 'active' : ''} onClick={() => setTab('playground')}>API playground</button></div>

    {tab === 'keys' && <section className="panel"><PanelHead title="API keys" action={`${keys.data?.keys?.length || 0} keys`} />{keys.isPending ? <LoadingRows /> : keys.data?.keys?.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Last used</th><th>Status</th><th /></tr></thead><tbody>{keys.data.keys.map(k => <tr key={k.id}><td><strong>{k.name}</strong><small>Created {date(k.created_at)}</small></td><td><code>{k.key_prefix}••••{k.key_last4}</code></td><td>{k.scopes.join(', ')}</td><td>{date(k.last_used_at)}</td><td><span className={`status ${k.status === 'active' ? 'success' : 'failed'}`}>{k.status}</span></td><td><button onClick={() => revokeKey.mutate(k.id)} disabled={revokeKey.isPending || k.status !== 'active'}>Revoke</button></td></tr>)}</tbody></table></div> : <Empty title="No API keys" copy="Create a scoped key when you are ready to integrate." />}</section>}

    {tab === 'webhooks' && <section className="panel"><div className="panel-head"><div><h2>Webhook endpoints</h2><span className="muted">MobiWave signs every delivery with your endpoint secret.</span></div><button className="primary" onClick={openCreateWebhook}>Add endpoint</button></div>{hooks.isPending ? <LoadingRows /> : hooks.data?.endpoints?.length ? <div className="table-wrap"><table><thead><tr><th>Endpoint</th><th>Events</th><th>Status</th><th>Last success</th><th>Last failure</th><th /></tr></thead><tbody>{hooks.data.endpoints.map(h => <tr key={h.id}><td><strong>{h.url}</strong><small>{h.id}</small></td><td>{h.events?.join(', ') || '—'}</td><td><span className={`status ${h.status === 'active' ? 'success' : 'failed'}`}>{h.status}</span></td><td>{date(h.last_success_at)}</td><td>{date(h.last_failure_at)}</td><td><div className="form-actions"><button onClick={() => openEditWebhook(h)}>Edit</button>{h.status === 'active' && <button onClick={() => disableWebhook.mutate(h.id)} disabled={disableWebhook.isPending}>Disable</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No webhook endpoints" copy="Add an HTTPS endpoint to receive payment events." />}</section>}

    {tab === 'deliveries' && <section className="panel"><PanelHead title="Webhook deliveries" action={deliveries.data?.deliveries?.length ? `${deliveries.data.deliveries.length} recent` : undefined} />{deliveries.isPending ? <LoadingRows /> : deliveries.error ? <Alert text={deliveries.error instanceof Error ? deliveries.error.message : 'Unable to load webhook deliveries.'} /> : deliveries.data?.deliveries?.length ? <div className="table-wrap"><table><thead><tr><th>Event</th><th>Status</th><th>Attempts</th><th>HTTP</th><th>Created</th><th>Last error</th><th /></tr></thead><tbody>{deliveries.data.deliveries.map(d => <tr key={d.id}><td><strong>{d.event_type}</strong><small>{d.event_id}</small></td><td><span className={`status ${d.status === 'delivered' ? 'success' : d.status === 'pending' ? 'pending' : 'failed'}`}>{d.status}</span></td><td>{d.attempt_count}</td><td>{d.response_status || '—'}</td><td>{date(d.created_at)}</td><td>{d.last_error || '—'}</td><td>{d.status !== 'delivered' && <button onClick={() => retryDelivery.mutate(d.id)} disabled={retryDelivery.isPending}>{retryDelivery.isPending ? 'Retrying…' : 'Retry'}</button>}</td></tr>)}</tbody></table></div> : <Empty title="No webhook deliveries" copy="Payment events will appear here after matching webhook endpoints are active." />}</section>}

    {tab === 'playground' && <section className="two-col"><div className="panel"><PanelHead title="Request" action="Authenticated API" /><div className="form-grid"><label>API key<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste a payments API key" autoComplete="off" /></label><label>Operation<select value={playgroundMode} onChange={e => setPlaygroundMode(e.target.value as 'lookup' | 'stk')}><option value="lookup">GET payment by ID</option><option value="stk">POST STK Push</option></select></label>{playgroundMode === 'lookup' ? <label>Payment ID<input value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="Transaction UUID" /></label> : <><label>Customer phone<input value={stkPhone} onChange={e => setStkPhone(e.target.value)} placeholder="2547xxxxxxxx" /></label><label>Amount (KES)<input type="number" min="1" value={stkAmount} onChange={e => setStkAmount(e.target.value)} /></label><label>Reference<input maxLength={12} value={stkReference} onChange={e => setStkReference(e.target.value)} /></label><label>Idempotency key<input value={idempotencyKey} onChange={e => setIdempotencyKey(e.target.value)} /></label></>}<button className="primary" onClick={() => runPlayground.mutate()} disabled={runPlayground.isPending || !apiKey.trim()}>{runPlayground.isPending ? 'Sending…' : 'Send request'}</button></div></div><div className="panel"><PanelHead title="Response" /><pre className="code-output">{playgroundError || playgroundResult || 'Run a request to inspect the API response.'}</pre><p className="muted">The playground uses your browser session only for this request. Do not paste production secrets into shared screens.</p></div></section>}

    {showKey && <Modal title="Create API key" onClose={() => setShowKey(false)}><form onSubmit={e => { e.preventDefault(); createKey.mutate() }} className="form-grid"><label>Key name<input value={keyName} onChange={e => setKeyName(e.target.value)} required /></label><div className="managed-note"><strong>Scopes</strong><span>Payments read and payments write are enabled for this integration key.</span></div><div className="form-actions"><button type="button" onClick={() => setShowKey(false)}>Cancel</button><button className="primary" disabled={createKey.isPending}>{createKey.isPending ? 'Creating…' : 'Create key'}</button></div>{createKey.error && <Alert text={createKey.error instanceof Error ? createKey.error.message : 'Unable to create key.'} />}</form></Modal>}
    {showWebhook && <Modal title={editingWebhook ? 'Edit webhook endpoint' : 'Add webhook endpoint'} onClose={() => { setShowWebhook(false); setEditingWebhook(null) }}><form onSubmit={e => { e.preventDefault(); if (webhookEvents.length) saveWebhook.mutate() }} className="form-grid"><label>HTTPS endpoint<input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/mobiwave" required /></label><fieldset><legend>Events</legend>{webhookEventsAvailable.map(event => <label key={event} className="check-row"><input type="checkbox" checked={webhookEvents.includes(event)} onChange={() => toggleEvent(event)} />{event}</label>)}</fieldset><div className="form-actions"><button type="button" onClick={() => setShowWebhook(false)}>Cancel</button><button className="primary" disabled={saveWebhook.isPending || !webhookEvents.length}>{saveWebhook.isPending ? 'Saving…' : editingWebhook ? 'Save changes' : 'Create endpoint'}</button></div>{saveWebhook.error && <Alert text={saveWebhook.error instanceof Error ? saveWebhook.error.message : 'Unable to save webhook.'} />}</form></Modal>}
  </>
}

function Settings() { const { environment } = useUiStore(); return <><div className="page-head"><div><div className="eyebrow">WORKSPACE</div><h1>Settings</h1><p>Merchant preferences and operating environment.</p></div></div><section className="panel settings-list"><DetailRow label="Environment" value={environment === 'production' ? 'Production' : 'Sandbox'} /><DetailRow label="Payment provider" value="M-Pesa" /><DetailRow label="Receipts" value="MobiWave SMS" /><DetailRow label="Data isolation" value="Workspace scoped" /><DetailRow label="Security" value="Server-side credentials" /></section></> }

function Metric({ label, value, meta, warning }: { label: string; value: string; meta: string; warning?: boolean }) { return <div className="metric"><span>{label}</span><strong className={warning ? 'warning' : ''}>{value}</strong><small>{meta}</small></div> }
function PanelHead({ title, action, href }: { title: string; action?: string; href?: string }) { return <div className="panel-head"><h2>{title}</h2>{action && (href ? <Link to={href}>{action} →</Link> : <span>{action}</span>)}</div> }
function HealthRow({ label, value }: { label: string; value: string }) { return <div className="health-row"><span>{label}</span><span className="health-value"><i />{value}</span></div> }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div> }
function Timeline({ label, value, done }: { label: string; value: string; done: boolean }) { return <div className="timeline-row"><span className={done ? 'timeline-dot done' : 'timeline-dot'} /> <div><strong>{label}</strong><small>{value}</small></div></div> }
function LoadingRows() { return <div className="loading-list">{[1, 2, 3, 4].map(i => <div className="skeleton" key={i} />)}</div> }
function Alert({ text }: { text: string }) { return <div className="alert">{text}</div> }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className="empty"><strong>{title}</strong><span>{copy}</span></div> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>{children}</div></div> }
function MiniBars({ rows }: { rows: Payment[] }) { const values = Array.from({ length: 7 }, (_, i) => rows.filter(r => new Date(r.created_at).getDay() === (i + 1) % 7).reduce((s, r) => s + Number(r.amount || 0), 0)); const max = Math.max(...values, 1); return <div className="bars">{values.map((v, i) => <div className="bar-col" key={i}><div className="bar" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} /><small>{['M','T','W','T','F','S','S'][i]}</small></div>)}</div> }

export default function App() { return <Shell /> }