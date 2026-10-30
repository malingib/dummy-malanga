import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useUiStore } from './store'
import { Overview, Payments, Customers } from './MerchantOperations'
import { PaymentDetailOperations } from './PaymentDetailOperations'
import { SmsOperations } from './SmsOperations'
import { ReconciliationOperations, SettingsOperations } from './FinalizationOperations'
import { MpesaConnectionsOperations } from './MpesaConnectionsOperations'
import { MpesaActivationJourney } from './MpesaActivationJourney'
import { DeveloperOperations } from './DeveloperOperations'

type IconName =
  | 'overview' | 'payments' | 'customers' | 'reconcile' | 'mpesa' | 'sms'
  | 'developers' | 'settings' | 'search' | 'bell' | 'menu' | 'collapse' | 'plus'

type Nav = { label: string; path: string; icon: IconName; hint?: string }

const nav: Nav[] = [
  { label: 'Overview', path: '/', icon: 'overview', hint: 'Collections, health and activity' },
  { label: 'Payments', path: '/payments', icon: 'payments', hint: 'Transactions and STK requests' },
  { label: 'Customers', path: '/customers', icon: 'customers', hint: 'Payers built from activity' },
  { label: 'Reconciliation', path: '/reconciliation', icon: 'reconcile', hint: 'Runs and exceptions' },
  { label: 'M-Pesa', path: '/mpesa', icon: 'mpesa', hint: 'Activation and shortcodes' },
  { label: 'SMS', path: '/sms', icon: 'sms', hint: 'Receipts and templates' },
  { label: 'Developers', path: '/developers', icon: 'developers', hint: 'Keys and webhooks' },
  { label: 'Settings', path: '/settings', icon: 'settings', hint: 'Workspace configuration' },
]

const quickActions: Nav[] = [
  { label: 'Request a payment', path: '/payments?new=1', icon: 'plus', hint: 'Open STK request' },
  { label: 'M-Pesa connections', path: '/mpesa/connections', icon: 'mpesa', hint: 'Manage shortcodes' },
]

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'overview':
      return <svg {...common}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg>
    case 'payments':
      return <svg {...common}><path d="M7 7h10" /><path d="m14 4 3 3-3 3" /><path d="M17 17H7" /><path d="m10 14-3 3 3 3" /></svg>
    case 'customers':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M15 5.5a3 3 0 0 1 0 5.8" /><path d="M17 14.5a5 5 0 0 1 3.5 4.8" /></svg>
    case 'reconcile':
      return <svg {...common}><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></svg>
    case 'mpesa':
      return <svg {...common}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10 18.5h4" /><path d="M9.5 6h5" /></svg>
    case 'sms':
      return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.1A2.5 2.5 0 0 1 4 12.5z" /><path d="M8 8h8M8 11h5" /></svg>
    case 'developers':
      return <svg {...common}><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></svg>
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
    case 'bell':
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></svg>
    case 'menu':
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    case 'collapse':
      return <svg {...common}><path d="m14 6-6 6 6 6" /><path d="M20 5v14" /></svg>
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  }
}

function NavItem({ item, onNavigate }: { item: Nav; onNavigate: () => void }) {
  return (
    <NavLink to={item.path} end={item.path === '/'} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon"><Icon name={item.icon} size={16} /></span>
      <span>{item.label}</span>
    </NavLink>
  )
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const all = [...quickActions, ...nav]
    return needle
      ? all.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(needle))
      : all
  }, [query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  if (!open) return null

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command search" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <span className="nav-icon"><Icon name="search" size={17} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const match = results[0]
                if (match) go(match.path)
                return
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                const next = document.activeElement instanceof HTMLElement ? activeElementSibling(event.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling', document.activeElement) : null
                next?.focus()
              }
            }}
            placeholder="Search pages and actions…"
            aria-label="Search pages and actions"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette-list" role="listbox" aria-label="Results">
          <div className="palette-group">Payments</div>
          <button type="button" role="option" aria-selected={results[0]?.path === '/payments'} className={`palette-item ${results[0]?.path === '/payments' ? 'selected' : ''}`} onClick={() => go('/payments')}>
            <span className="nav-icon"><Icon name="payments" size={15} /></span>
            <span>Jump to payments</span>
            <small>Filter, search and request M-Pesa payments.</small>
          </button>
          {results.map((item, index) => (
            <button
              key={`${item.path}-${item.label}`}
              type="button"
              role="option"
              aria-selected={index === 0}
              className="palette-item"
              onClick={() => go(item.path)}
            >
              <span className="nav-icon"><Icon name={item.icon} size={15} /></span>
              <span>{item.label}</span>
              {item.hint && <small>{item.hint}</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function activeElementSibling(method: 'nextElementSibling' | 'previousElementSibling', element: HTMLElement) {
  let current = element[method]
  while (current) {
    if (current instanceof HTMLElement && current.role === 'option') return current
    current = current[method]
  }
  return null
}

function EnvironmentBadge() {
  const readiness = useQuery({ queryKey: ['mpesa', 'readiness'], queryFn: api.mpesa, staleTime: 60_000, retry: 1 })
  const environment = readiness.data?.workspace.environment
  const shortcode = readiness.data?.workspace.shortcode
  const tone = readiness.isPending ? 'unknown' : readiness.error || !environment ? 'unknown' : environment
  const label = readiness.isPending ? 'Checking…' : readiness.error || !environment ? 'Environment unknown' : environment
  const source = readiness.error
    ? 'Payment environment could not be verified.'
    : `Source: ${shortcode ? `shortcode ${shortcode}` : 'payment workspace'}. Switch environments from the M-Pesa workspace.`
  return (
    <Link to="/mpesa" className={`env-badge ${tone}`} title={source}>
      <i aria-hidden="true" />
      <span style={{ textTransform: 'capitalize' }}>{label}</span>
    </Link>
  )
}

export default function App() {
  const location = useLocation()
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, toggleCollapsed, closeSidebar } = useUiStore()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const readiness = useQuery({ queryKey: ['mpesa', 'readiness'], queryFn: api.mpesa, staleTime: 60_000, retry: 1 })
  const exceptions = useQuery({ queryKey: ['exceptions', 'open'], queryFn: () => api.reconciliationExceptions('open'), staleTime: 60_000, retry: 1 })
  const openExceptions = exceptions.data?.data?.length ?? 0
  const production = readiness.data?.workspace.environment === 'production'
  const primary = readiness.data?.readiness.connection
  const credentialStatus = primary?.credential_status
  const connectionReady = ['verified', 'healthy', 'ok', 'ready'].includes(credentialStatus ?? '')
  const connectionFailed = credentialStatus === 'failed'

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { closeSidebar() }, [location.pathname, closeSidebar])

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <Link to="/" className="brand" aria-label="MobiWave Payments overview">
          <span className="brand-mark">M</span>
          <span className="brand-text"><strong>MobiWave</strong><span>Payments</span></span>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav>{nav.slice(0, 4).map((item) => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
        <div className="nav-label">Operations</div>
        <nav>{nav.slice(4, 6).map((item) => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
        <div className="nav-label">Platform</div>
        <nav>{nav.slice(6).map((item) => <NavItem key={item.path} item={item} onNavigate={closeSidebar} />)}</nav>
        <div className="connection-card">
          <div className="connection-row">
            <span>M-Pesa</span>
            <span className={connectionFailed ? 'online attention' : connectionReady ? 'online' : 'unknown'}>
              {connectionFailed ? <><i />Attention</> : connectionReady ? <><i />Ready</> : 'Unknown'}
            </span>
          </div>
          <small>
            {readiness.error
              ? 'Connection status unavailable. Open M-Pesa to check readiness.'
              : primary
                ? `Shortcode ${readiness.data?.workspace.shortcode ?? 'configured'}. Managed from the M-Pesa workspace.`
                : 'No active shortcode. Finish setup in the M-Pesa workspace.'}
          </small>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={toggleSidebar} aria-label="Close navigation" />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu" onClick={toggleSidebar} aria-label="Open navigation"><Icon name="menu" size={18} /></button>
            <button className="icon-button" onClick={toggleCollapsed} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : undefined }}>
              <Icon name="collapse" size={17} />
            </button>
            <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Open command search">
              <Icon name="search" size={15} />
              <span>Search or jump to…</span>
              <span className="kbd">⌘K</span>
            </button>
          </div>
          <div className="top-actions">
            <EnvironmentBadge />
            <Link to="/reconciliation" className="notification-button" aria-label={`${openExceptions} open reconciliation exceptions`}>
              <Icon name="bell" size={16} />
              {openExceptions > 0 && <span className="notification-dot" />}
            </Link>
            <Link to="/settings" className="avatar" title="Workspace settings">MW</Link>
          </div>
        </header>

        {production && (
          <div className="environment-banner" role="status">
            <strong>Production environment</strong>
            <span>Payment actions use the live PSP boundary configured for this workspace.</span>
          </div>
        )}

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

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
