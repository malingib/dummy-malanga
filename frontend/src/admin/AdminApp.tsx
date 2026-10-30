import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { adminApi, type AdminSession } from './api'
import { AdminOverviewPage } from './pages/Overview'
import { AdminMerchantsPage } from './pages/Merchants'
import { AdminMerchantDetailPage } from './pages/MerchantDetail'
import { AdminTransactionsPage } from './pages/Transactions'
import { AdminExceptionsPage } from './pages/Exceptions'
import { AdminActivationsPage } from './pages/Activations'
import { AdminAuditPage } from './pages/Audit'
import './admin.css'

type AdminIconName =
  | 'overview' | 'merchants' | 'payments' | 'exceptions' | 'activation'
  | 'audit' | 'menu' | 'collapse' | 'bell' | 'logout' | 'external' | 'shield' | 'refresh'

type AdminNavItem = {
  label: string
  path: string
  icon: AdminIconName
  hint: string
  end?: boolean
}

type AdminNavGroup = { label: string; items: AdminNavItem[] }

const navGroups: AdminNavGroup[] = [
  {
    label: 'Control',
    items: [
      { label: 'Overview', path: '/admin', icon: 'overview', hint: 'Network health and volume', end: true },
      { label: 'Merchants', path: '/admin/merchants', icon: 'merchants', hint: 'Workspaces and M-Pesa posture' },
      { label: 'Transactions', path: '/admin/transactions', icon: 'payments', hint: 'All merchant payments' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Exceptions', path: '/admin/exceptions', icon: 'exceptions', hint: 'Reconciliation review queue' },
      { label: 'Activations', path: '/admin/activations', icon: 'activation', hint: 'M-Pesa go-live requests' },
      { label: 'Audit trail', path: '/admin/audit', icon: 'audit', hint: 'Administrative actions' },
    ],
  },
]

const allNav = navGroups.flatMap((group) => group.items)

function AdminIcon({ name, size = 17 }: { name: AdminIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'overview':
      return <svg {...common}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg>
    case 'merchants':
      return <svg {...common}><path d="M4 21V8l8-4 8 4v13" /><path d="M9 21v-6h6v6" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>
    case 'payments':
      return <svg {...common}><path d="M7 7h10" /><path d="m14 4 3 3-3 3" /><path d="M17 17H7" /><path d="m10 14-3 3 3 3" /></svg>
    case 'exceptions':
      return <svg {...common}><path d="M12 3 2.8 19a1.5 1.5 0 0 0 1.3 2h15.8a1.5 1.5 0 0 0 1.3-2Z" /><path d="M12 9v5" /><path d="M12 17.5h.01" /></svg>
    case 'activation':
      return <svg {...common}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10 18.5h4" /><path d="M9.5 6h5" /></svg>
    case 'audit':
      return <svg {...common}><path d="M5 3h11l3 3v15H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
    case 'menu':
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    case 'collapse':
      return <svg {...common}><path d="m14 6-6 6 6 6" /><path d="M20 5v14" /></svg>
    case 'bell':
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></svg>
    case 'logout':
      return <svg {...common}><path d="M10 5H5v14h5" /><path d="M14 8l4 4-4 4" /><path d="M8 12h10" /></svg>
    case 'external':
      return <svg {...common}><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></svg>
    case 'shield':
      return <svg {...common}><path d="M12 2.8 20 6v5.5c0 4.9-3.2 8.2-8 9.7-4.8-1.5-8-4.8-8-9.7V6z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>
    case 'refresh':
      return <svg {...common}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
  }
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="admin-brand">
      <span className="brand-mark">M</span>
      {!compact && (
        <span className="brand-text">
          <strong>MobiWave</strong>
          <span>Platform admin</span>
        </span>
      )}
    </span>
  )
}

function AdminBoot({ message = 'Opening the platform console…' }: { message?: string }) {
  return (
    <div className="admin-state" role="status" aria-live="polite">
      <AdminBrand />
      <div className="admin-state-card">
        <span className="admin-state-spinner" aria-hidden="true" />
        <strong>{message}</strong>
        <p>Verifying your platform administrator session.</p>
      </div>
    </div>
  )
}

function AdminUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="admin-state">
      <AdminBrand />
      <div className="admin-state-card">
        <strong>Platform API unavailable</strong>
        <p>{message}</p>
        <button type="button" className="primary" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}

function AdminLogin({ configured, onAuthenticated }: { configured?: boolean; onAuthenticated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const login = useMutation({
    mutationFn: () => adminApi.login(username, password),
    onSuccess: onAuthenticated,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!configured) return
    login.mutate()
  }

  return (
    <main className="admin-login">
      <section className="admin-login-story" aria-label="MobiWave platform administration">
        <AdminBrand />
        <div className="admin-login-copy">
          <div className="eyebrow">Platform control</div>
          <h1>Run the payment network, not just a workspace.</h1>
          <p>One restricted console for merchant posture, payment volume, exception queues and M-Pesa go-live decisions.</p>
          <ul>
            <li><span><AdminIcon name="overview" size={15} /></span>Network-wide payment and merchant metrics</li>
            <li><span><AdminIcon name="merchants" size={15} /></span>Merchant profiles, shortcodes and connection status</li>
            <li><span><AdminIcon name="exceptions" size={15} /></span>Cross-merchant exception and activation queues</li>
            <li><span><AdminIcon name="audit" size={15} /></span>Every platform action recorded in an audit trail</li>
          </ul>
        </div>
        <div className="admin-login-foot">
          <AdminIcon name="shield" size={16} />
          <span>Restricted access. Sessions expire after 8 hours.</span>
        </div>
      </section>

      <section className="admin-login-panel">
        <div className="admin-login-form-wrap">
          <div className="admin-login-kicker">PLATFORM ADMINISTRATOR</div>
          <h2>Sign in</h2>
          <p className="admin-login-lede">Use the platform credentials configured on the API server. Merchant workspace cookies cannot access this console.</p>

          {configured === false && (
            <div className="alert warning" role="alert">
              Platform admin access is not configured. Set <code>ADMIN_USERNAME</code> and <code>ADMIN_PASSWORD</code> on the API server, then restart it.
            </div>
          )}

          <form onSubmit={submit} className="admin-login-form">
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                disabled={!configured || login.isPending}
                placeholder="admin"
                required
              />
            </label>
            <label>
              Password
              <span className="admin-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={!configured || login.isPending}
                  placeholder="Enter your platform password"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {login.error && (
              <div className="alert" role="alert">
                {login.error instanceof Error ? login.error.message : 'Sign-in failed. Check your credentials.'}
              </div>
            )}
            <button type="submit" className="primary admin-login-submit" disabled={!configured || login.isPending}>
              {login.isPending ? 'Signing in…' : 'Enter platform console'}
            </button>
          </form>

          <div className="admin-login-links">
            <Link to="/">Merchant console <span aria-hidden="true">→</span></Link>
            <span>MobiWave Payments</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function AdminShell({ session, onSignOut, signingOut }: { session: AdminSession; onSignOut: () => void; signingOut: boolean }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const section = useMemo(() => {
    if (location.pathname === '/admin') return 'Overview'
    const item = allNav.find((entry) => entry.path !== '/admin' && location.pathname.startsWith(entry.path))
    return item?.label || 'Overview'
  }, [location.pathname])

  return (
    <div className={`app-shell admin-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Platform administration navigation">
        <Link to="/admin" className="brand admin-brand-link">
          <AdminBrand />
        </Link>

        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            <nav>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon"><AdminIcon name={item.icon} size={16} /></span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        <div className="connection-card admin-scope-card">
          <div className="connection-row">
            <span>Access scope</span>
            <span className="online"><i />All workspaces</span>
          </div>
          <small>Platform actions are recorded. Merchant sessions cannot call these endpoints.</small>
        </div>

        <Link to="/" className="admin-merchant-link">
          <AdminIcon name="external" size={14} />
          <span>Merchant console</span>
        </Link>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main className="main">
        <header className="topbar admin-topbar">
          <div className="topbar-left">
            <button className="menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><AdminIcon name="menu" size={18} /></button>
            <button
              className="icon-button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
            >
              <AdminIcon name="collapse" size={17} />
            </button>
            <div className="admin-crumb">
              <span>Platform</span>
              <b>/</b>
              <strong>{section}</strong>
            </div>
          </div>
          <div className="top-actions">
            <span className="admin-scope"><i aria-hidden="true" />All merchant workspaces</span>
            <Link to="/admin/exceptions" className="notification-button" aria-label="Open platform exception queue">
              <AdminIcon name="bell" size={16} />
            </Link>
            <span className="admin-user">
              <span className="avatar">PA</span>
              <span className="admin-user-copy">
                <strong>{session.name || 'Platform administrator'}</strong>
                <small>Platform admin</small>
              </span>
            </span>
            <button type="button" className="icon-button admin-signout" onClick={onSignOut} disabled={signingOut} aria-label="Sign out of platform admin">
              <AdminIcon name="logout" size={17} />
            </button>
          </div>
        </header>

        <div className="admin-banner" role="status">
          <AdminIcon name="shield" size={14} />
          <span><strong>Platform administration</strong> — actions apply across merchant workspaces and are written to the audit trail.</span>
        </div>

        <div className="content">
          <Routes>
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/merchants" element={<AdminMerchantsPage />} />
            <Route path="/admin/merchants/:id" element={<AdminMerchantDetailPage />} />
            <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
            <Route path="/admin/exceptions" element={<AdminExceptionsPage />} />
            <Route path="/admin/activations" element={<AdminActivationsPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function AdminApp() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const sessionQuery = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: adminApi.session,
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    const handler = () => {
      queryClient.setQueryData<AdminSession>(['admin', 'session'], {
        authenticated: false,
        configured: true,
      })
    }
    window.addEventListener('mobiwave:admin-unauthorized', handler)
    return () => window.removeEventListener('mobiwave:admin-unauthorized', handler)
  }, [queryClient])

  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData<AdminSession>(['admin', 'session'], { authenticated: false, configured: true })
      navigate('/admin', { replace: true })
    },
  })

  if (sessionQuery.isPending) return <AdminBoot />
  if (sessionQuery.error) {
    return <AdminUnavailable message={sessionQuery.error instanceof Error ? sessionQuery.error.message : 'The admin API could not be reached.'} onRetry={() => sessionQuery.refetch()} />
  }
  if (!sessionQuery.data?.authenticated) {
    return (
      <AdminLogin
        configured={sessionQuery.data?.configured}
        onAuthenticated={() => {
          queryClient.invalidateQueries({ queryKey: ['admin'] })
          navigate('/admin', { replace: true })
        }}
      />
    )
  }

  return <AdminShell session={sessionQuery.data} onSignOut={() => logout.mutate()} signingOut={logout.isPending} />
}
