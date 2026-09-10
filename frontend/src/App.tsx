import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useUiStore } from './store'
import { Overview, Payments, Customers } from './MerchantOperations'
import { PaymentDetailOperations } from './PaymentDetailOperations'
import { SmsOperations } from './SmsOperations'
import { ReconciliationOperations, SettingsOperations } from './FinalizationOperations'
import { MpesaActivationJourney } from './MpesaActivationJourney'
import { DeveloperOperations } from './DeveloperOperations'

type Nav = { label: string; path: string; icon: string }

const nav: Nav[] = [
  { label: 'Overview', path: '/', icon: '⌂' },
  { label: 'Payments', path: '/payments', icon: '↕' },
  { label: 'Customers', path: '/customers', icon: '○' },
  { label: 'Reconciliation', path: '/reconciliation', icon: '✓' },
  { label: 'M-Pesa', path: '/mpesa', icon: '◈' },
  { label: 'SMS', path: '/sms', icon: '✉' },
  { label: 'Developers', path: '/developers', icon: '{}' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
]

function NavItem({ item, onNavigate }: { item: Nav; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  )
}

function pageLabel(pathname: string) {
  if (pathname.startsWith('/payments/')) return 'Payment details'
  return nav.find(item => item.path === pathname)?.label ?? 'Payments workspace'
}

export default function App() {
  const { sidebarOpen, toggleSidebar, environment, setEnvironment } = useUiStore()
  const location = useLocation()
  const closeSidebar = () => {
    if (sidebarOpen) toggleSidebar()
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">M</div>
          <div>
            <strong>MobiWave</strong>
            <span>Payments</span>
          </div>
        </div>

        <div className="nav-label">Workspace</div>
        <nav>{nav.slice(0, 4).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>

        <div className="nav-label">Operations</div>
        <nav>{nav.slice(4, 6).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>

        <div className="nav-label">Platform</div>
        <nav>{nav.slice(6).map(item => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>

        <div className="connection-card">
          <div className="connection-row">
            <span>M-Pesa</span>
            <span className="online"><i /> Managed</span>
          </div>
          <small>Connection and activation are managed from M-Pesa.</small>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={toggleSidebar} aria-label="Close navigation" />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu" onClick={toggleSidebar} aria-label="Open navigation">☰</button>
            <div className="crumb">
              <span>Payments</span>
              <b>/</b>
              <strong>{pageLabel(location.pathname)}</strong>
            </div>
          </div>
          <div className="top-actions">
            <label className="environment-select">
              <span>Environment</span>
              <select value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>
            <div className="avatar" aria-label="MobiWave account">MW</div>
          </div>
        </header>

        <div className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/:id" element={<PaymentDetailOperations />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/reconciliation" element={<ReconciliationOperations />} />
            <Route path="/mpesa" element={<MpesaActivationJourney />} />
            <Route path="/mpesa/connections" element={<MpesaActivationJourney />} />
            <Route path="/sms" element={<SmsOperations />} />
            <Route path="/developers" element={<DeveloperOperations />} />
            <Route path="/settings" element={<SettingsOperations />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
