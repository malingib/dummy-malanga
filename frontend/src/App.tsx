import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useUiStore } from './store'
import { Overview, Payments, Customers } from './MerchantOperations'
import { PaymentDetailOperations } from './PaymentDetailOperations'
import { SmsOperations } from './SmsOperations'
import { ReconciliationOperations, SettingsOperations } from './FinalizationOperations'
import { MpesaConnectionsOperations } from './MpesaConnectionsOperations'
import { MpesaActivationJourney } from './MpesaActivationJourney'
import { DeveloperOperations } from './DeveloperOperations'

type Nav = { label: string; path: string; icon: IconName }
type IconName = 'overview' | 'payments' | 'customers' | 'reconcile' | 'mpesa' | 'sms' | 'developers' | 'settings'

const nav: Nav[] = [
  { label: 'Overview', path: '/', icon: 'overview' },
  { label: 'Payments', path: '/payments', icon: 'payments' },
  { label: 'Customers', path: '/customers', icon: 'customers' },
  { label: 'Reconciliation', path: '/reconciliation', icon: 'reconcile' },
  { label: 'M-Pesa', path: '/mpesa', icon: 'mpesa' },
  { label: 'SMS', path: '/sms', icon: 'sms' },
  { label: 'Developers', path: '/developers', icon: 'developers' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
]

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'overview': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case 'payments': return <svg {...common}><path d="M7 7h10"/><path d="m14 4 3 3-3 3"/><path d="M17 17H7"/><path d="m10 14-3 3 3 3"/></svg>
    case 'customers': return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M15 5.5a3 3 0 0 1 0 5.8"/><path d="M17 14.5a5 5 0 0 1 3.5 4.8"/></svg>
    case 'reconcile': return <svg {...common}><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></svg>
    case 'mpesa': return <svg {...common}><rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M10 18h4"/><path d="M9 6h6"/></svg>
    case 'sms': return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.1A2.5 2.5 0 0 1 4 12.5z"/><path d="M8 8h8M8 11h5"/></svg>
    case 'developers': return <svg {...common}><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m14 5-4 14"/></svg>
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
  }
}

function NavItem({ item, onNavigate }: { item: Nav; onNavigate: () => void }) {
  return <NavLink to={item.path} end={item.path === '/'} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
    <span className="nav-icon"><Icon name={item.icon} size={16} /></span><span>{item.label}</span>
  </NavLink>
}

function pageLabel(pathname: string) {
  if (pathname.startsWith('/payments/')) return 'Payment details'
  if (pathname.startsWith('/mpesa/')) return 'M-Pesa connections'
  return nav.find(item => item.path === pathname)?.label ?? 'Payments workspace'
}

export default function App() {
  const { sidebarOpen, toggleSidebar, environment, setEnvironment } = useUiStore()
  const location = useLocation()
  const closeSidebar = () => { if (sidebarOpen) toggleSidebar() }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
      <Link to="/" className="brand" onClick={closeSidebar} aria-label="MobiWave Payments overview">
        <div className="brand-mark">M</div><div><strong>MobiWave</strong><span>Payments</span></div>
      </Link>
      <div className="nav-label">Workspace</div>
      <nav>{nav.slice(0, 4).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
      <div className="nav-label">Operations</div>
      <nav>{nav.slice(4, 6).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
      <div className="nav-label">Platform</div>
      <nav>{nav.slice(6).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
      <div className="connection-card">
        <div className="connection-row"><span>M-Pesa</span><span className="online"><i /> Managed</span></div>
        <small>Payment connectivity is managed from the M-Pesa workspace.</small>
      </div>
    </aside>

    {sidebarOpen && <button className="scrim" onClick={toggleSidebar} aria-label="Close navigation" />}

    <main className="main">
      <header className="topbar">
        <div className="topbar-left">
          <button className="menu" onClick={toggleSidebar} aria-label="Open navigation">☰</button>
          <div className="crumb"><span>MobiPay</span><b>/</b><strong>{pageLabel(location.pathname)}</strong></div>
        </div>
        <div className="top-actions">
          <label className={`environment-select ${environment === 'production' ? 'production' : ''}`}>
            <span>Environment</span>
            <select value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')} aria-label="Environment">
              <option value="sandbox">Sandbox</option><option value="production">Production</option>
            </select>
          </label>
          <button className="notification-button" aria-label="Notifications"><span className="notification-dot" /></button>
          <div className="avatar" aria-label="MobiWave account">MW</div>
        </div>
      </header>

      {environment === 'production' && <div className="environment-banner" role="status"><strong>Production environment</strong><span>Payment actions use your configured production PSP boundary.</span></div>}

      <div className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/payments/:id" element={<PaymentDetailOperations />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/reconciliation" element={<ReconciliationOperations />} />
          <Route path="/mpesa" element={<MpesaActivationJourney />} />
          <Route path="/mpesa/connections" element={<MpesaConnectionsOperations />} />
          <Route path="/sms" element={<SmsOperations />} />
          <Route path="/developers" element={<DeveloperOperations />} />
          <Route path="/settings" element={<SettingsOperations />} />
        </Routes>
      </div>
    </main>
  </div>
}
