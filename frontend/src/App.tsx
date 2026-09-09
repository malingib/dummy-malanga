import { useMemo } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, Payment, Stats } from './api'
import { useUiStore } from './store'

type Nav = { label: string; path: string; icon: string }
const nav: Nav[] = [
  { label: 'Overview', path: '/', icon: '⌂' },
  { label: 'Payments', path: '/payments', icon: '↕' },
  { label: 'Customers', path: '/customers', icon: '○' },
  { label: 'Reconciliation', path: '/reconciliation', icon: '✓' },
  { label: 'M-Pesa connection', path: '/mpesa', icon: '◈' },
  { label: 'SMS', path: '/sms', icon: '✉' },
  { label: 'Developers', path: '/developers', icon: '{}' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
]

const money = (value: number | string) => `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const date = (value: string) => new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function useDashboardData() {
  const stats = useQuery({ queryKey: ['dashboard', 'stats'], queryFn: api.stats })
  const payments = useQuery({ queryKey: ['dashboard', 'payments'], queryFn: api.payments })
  const rows = payments.data?.transactions ?? payments.data?.data ?? []
  return { stats: stats.data, rows, loading: stats.isPending || payments.isPending, error: stats.error || payments.error }
}

function Shell() {
  const { sidebarOpen, toggleSidebar, environment, setEnvironment } = useUiStore()
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">M</div><div><strong>MobiWave</strong><span>Payments</span></div></div>
      <div className="nav-label">Workspace</div>
      <nav>{nav.slice(0, 4).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="nav-label">Operations</div>
      <nav>{nav.slice(4, 6).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="nav-label">Platform</div>
      <nav>{nav.slice(6).map(item => <NavItem key={item.path} item={item} />)}</nav>
      <div className="connection-card"><div className="connection-row"><span>M-Pesa</span><span className="online"><i /> Connected</span></div><small>Payment connection is healthy.</small></div>
    </aside>
    {sidebarOpen && <button className="scrim" onClick={toggleSidebar} aria-label="Close navigation" />}
    <main className="main">
      <header className="topbar"><button className="menu" onClick={toggleSidebar}>☰</button><div className="crumb">Payments workspace</div><div className="top-actions"><select value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}><option value="sandbox">Sandbox</option><option value="production">Production</option></select><button className="icon-button">◔</button><div className="avatar">MW</div></div></header>
      <div className="content"><Routes><Route path="/" element={<Overview />} /><Route path="/payments" element={<Payments />} /><Route path="/mpesa" element={<Mpesa />} /><Route path="/reconciliation" element={<Reconciliation />} /><Route path="/sms" element={<Sms />} /><Route path="/developers" element={<Developers />} /><Route path="/customers" element={<Placeholder title="Customers" copy="Customer profiles and payment history are coming into the new operations workspace." />} /><Route path="/settings" element={<Placeholder title="Settings" copy="Workspace settings will live here without exposing payment infrastructure details." />} /></Routes></div>
    </main>
  </div>
}

function NavItem({ item }: { item: Nav }) { return <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span>{item.label}</NavLink> }

function Overview() {
  const { stats, rows, loading, error } = useDashboardData()
  const successRate = stats && stats.totalTransactions ? ((stats.successfulPayments / stats.totalTransactions) * 100).toFixed(1) : '0.0'
  return <>
    <div className="page-head"><div><div className="eyebrow">OVERVIEW</div><h1>Good afternoon</h1><p>Your payment system is healthy today.</p></div><Link className="primary" to="/payments">View payments</Link></div>
    {error && <Alert text="We could not load live payment data. Check the API connection." />}
    <section className="metric-grid">
      <Metric label="Collected today" value={money(stats?.totalAmount ?? 0)} meta="Across all payment channels" />
      <Metric label="Payments" value={(stats?.totalTransactions ?? 0).toLocaleString()} meta="Transactions recorded" />
      <Metric label="Success rate" value={`${successRate}%`} meta="Successful payments" />
      <Metric label="Needs attention" value={String(stats?.failedPayments ?? 0)} meta="Failed payments" warning />
    </section>
    <section className="two-col">
      <div className="panel activity"><PanelHead title="Payment activity" action="Last 7 days" /><div className="fake-chart"><div className="chart-line" /><div className="chart-axis"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div>
      <div className="panel health"><PanelHead title="System health" /><HealthRow label="M-Pesa connection" value="Connected" /><HealthRow label="Payment callbacks" value="Healthy" /><HealthRow label="SMS receipts" value="Ready" /><HealthRow label="Webhook queue" value="Healthy" /></div>
    </section>
    <section className="panel"><PanelHead title="Recent payments" action="View all" href="/payments" />{loading ? <LoadingRows /> : <PaymentTable rows={rows.slice(0, 6)} />}</section>
  </>
}

function Payments() {
  const { rows, loading, error } = useDashboardData()
  return <><div className="page-head"><div><div className="eyebrow">OPERATIONS</div><h1>Payments</h1><p>Track collections, customer payments and exceptions.</p></div><button className="primary">Request payment</button></div>{error && <Alert text="Live payments could not be loaded." />}<div className="toolbar"><input placeholder="Search by phone, receipt or reference" /><select><option>All statuses</option><option>Successful</option><option>Pending</option><option>Failed</option></select><button>Filter</button></div><section className="panel">{loading ? <LoadingRows /> : <PaymentTable rows={rows} />}</section></>
}

function PaymentTable({ rows }: { rows: Payment[] }) { return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Reference</th><th>Status</th><th>Receipt</th><th>Time</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><strong>{row.phone_number || 'Customer'}</strong></td><td>{money(row.amount)}</td><td>{row.reference || '—'}</td><td><Status status={row.status} /></td><td>{row.mpesa_receipt || '—'}</td><td>{date(row.created_at)}</td></tr>) : <tr><td colSpan={6}><Empty title="No payments yet" copy="Payments received through your M-Pesa connection will appear here." /></td></tr>}</tbody></table></div> }
function Status({ status }: { status: Payment['status'] }) { const map = { success: 'Successful', pending: 'Pending', failed: 'Failed', reversed: 'Reversed' }; return <span className={`status ${status}`}>{map[status]}</span> }
function Metric({ label, value, meta, warning }: { label: string; value: string; meta: string; warning?: boolean }) { return <div className="metric"><span>{label}</span><strong className={warning ? 'warning' : ''}>{value}</strong><small>{meta}</small></div> }
function PanelHead({ title, action, href }: { title: string; action?: string; href?: string }) { return <div className="panel-head"><h2>{title}</h2>{action && (href ? <Link to={href}>{action} →</Link> : <span>{action}</span>)}</div> }
function HealthRow({ label, value }: { label: string; value: string }) { return <div className="health-row"><span>{label}</span><span className="health-value"><i />{value}</span></div> }
function LoadingRows() { return <div className="loading-list">{[1, 2, 3, 4].map(i => <div className="skeleton" key={i} />)}</div> }
function Alert({ text }: { text: string }) { return <div className="alert">{text}</div> }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className="empty"><strong>{title}</strong><span>{copy}</span></div> }
function Placeholder({ title, copy }: { title: string; copy: string }) { return <div className="page-head"><div><div className="eyebrow">WORKSPACE</div><h1>{title}</h1><p>{copy}</p></div></div> }
function Mpesa() { return <><div className="page-head"><div><div className="eyebrow">M-PESA</div><h1>Connection</h1><p>You should not need to understand Daraja to run payments.</p></div><Link className="primary" to="/">Back to overview</Link></div><div className="panel connection-page"><div className="big-status"><div className="check">✓</div><div><h2>Connection is healthy</h2><p>Your M-Pesa payment channel is connected and ready for collections.</p></div></div><div className="connection-grid"><HealthRow label="Payment channel" value="PayBill / C2B" /><HealthRow label="STK Push" value="Ready" /><HealthRow label="Callbacks" value="Connected" /><HealthRow label="SMS receipts" value="Enabled" /></div><div className="managed-note"><strong>Mobiwave-managed setup</strong><span>Technical callback configuration stays behind the scenes. If your connection needs attention, we'll tell you what to do in plain language.</span></div></div></> }
function Reconciliation() { return <><div className="page-head"><div><div className="eyebrow">OPERATIONS</div><h1>Reconciliation</h1><p>Resolve exceptions without hunting through raw M-Pesa callbacks.</p></div></div><div className="metric-grid"><Metric label="Matched" value="0" meta="Ready to reconcile" /><Metric label="Unmatched" value="0" meta="Need review" warning /><Metric label="Exceptions" value="0" meta="Failed or inconsistent" /><Metric label="Last sync" value="—" meta="No sync recorded" /></div><div className="panel"><Empty title="You're all caught up" copy="When a payment cannot be matched automatically, it will appear here with the reason and the next action." /></div></> }
function Sms() { return <><div className="page-head"><div><div className="eyebrow">COMMUNICATIONS</div><h1>SMS receipts</h1><p>Payment confirmations are sent through the MobiWave SMS platform.</p></div></div><div className="two-col"><div className="panel"><PanelHead title="Receipt delivery" /><HealthRow label="Provider" value="MobiWave SMS" /><HealthRow label="Sender" value="MobiWave" /><HealthRow label="Payment receipts" value="Enabled" /></div><div className="panel"><PanelHead title="Receipt preview" /><div className="sms-preview"><strong>Payment received</strong><p>Hello John, we have received KES 4,500 from your M-Pesa account.</p><small>Reference: INV-10482 · Thank you.</small></div></div></div></> }
function Developers() { return <><div className="page-head"><div><div className="eyebrow">DEVELOPERS</div><h1>API & webhooks</h1><p>Technical controls for teams that need them — not a prerequisite for merchants.</p></div></div><div className="panel"><div className="dev-row"><div><strong>API access</strong><span>Create scoped keys for your application.</span></div><button>Manage keys</button></div><div className="dev-row"><div><strong>Webhooks</strong><span>Monitor signed payment events and delivery retries.</span></div><button>View webhooks</button></div><div className="dev-row"><div><strong>API playground</strong><span>Test requests against your sandbox workspace.</span></div><button>Open playground</button></div></div></> }

export default function App() { return <Shell /> }
