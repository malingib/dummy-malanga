import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { hasSupabaseAuthConfig, supabaseClient } from './supabase-client'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false)
      return
    }
    let active = true
    void supabaseClient.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    })
    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabaseClient) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabaseClient.auth.signUp({ email: email.trim().toLowerCase(), password })
        if (authError) throw authError
        if (data.session) setSession(data.session)
        else setMessage('Account created. Check your email to confirm the account, then sign in.')
      } else {
        const { data, error: authError } = await supabaseClient.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        if (authError) throw authError
        setSession(data.session)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div style={styles.screen}><p>Loading secure session…</p></div>

  if (!hasSupabaseAuthConfig || !supabaseClient) {
    return <div style={styles.screen}><section style={styles.card}>
      <h1 style={styles.title}>MobiWave Payments</h1>
      <p style={styles.muted}>Secure merchant access is not configured.</p>
      <p style={styles.help}>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the frontend deployment environment, then redeploy.</p>
    </section></div>
  }

  if (!session) return <div style={styles.screen}>
    <section style={styles.card}>
      <div style={styles.brand}>MobiWave Payments</div>
      <h1 style={styles.title}>{mode === 'signin' ? 'Sign in to your workspace' : 'Create your merchant account'}</h1>
      <p style={styles.muted}>Secure access to payment records and reconciliation.</p>
      <form onSubmit={submit} style={styles.form}>
        <label style={styles.label}>Email address
          <input style={styles.input} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label style={styles.label}>Password
          <input style={styles.input} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        {error && <p role="alert" style={styles.error}>{error}</p>}
        {message && <p role="status" style={styles.success}>{message}</p>}
        <button type="submit" disabled={busy} style={styles.primary}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }} style={styles.switch}>
        {mode === 'signin' ? 'New to MobiWave Payments? Create an account' : 'Already registered? Sign in'}
      </button>
      <p style={styles.help}>Use an account configured in the connected Supabase Auth project. Workspace access is checked server-side.</p>
    </section>
  </div>

  return <div>
    <div style={styles.sessionBar}>
      <span>Signed in as <strong>{session.user.email || 'merchant user'}</strong></span>
      <button type="button" style={styles.signOut} onClick={() => void supabaseClient.auth.signOut()}>Sign out</button>
    </div>
    {children}
  </div>
}

const styles: Record<string, React.CSSProperties> = {
  screen: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fa', padding: 24, color: '#17202a', fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 440, boxSizing: 'border-box', background: '#fff', border: '1px solid #dfe4ea', borderRadius: 12, padding: 28, boxShadow: '0 12px 36px rgba(15, 23, 42, .06)' },
  brand: { fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#28634f', marginBottom: 20 },
  title: { fontSize: 25, lineHeight: 1.2, margin: '0 0 10px', fontWeight: 650 },
  muted: { fontSize: 14, color: '#596579', lineHeight: 1.5, margin: '0 0 22px' },
  form: { display: 'grid', gap: 16 },
  label: { display: 'grid', gap: 7, fontSize: 13, fontWeight: 600 },
  input: { boxSizing: 'border-box', width: '100%', padding: '11px 12px', border: '1px solid #cbd3dc', borderRadius: 7, fontSize: 15, background: '#fff', color: '#17202a' },
  primary: { border: 0, borderRadius: 7, padding: '12px 14px', background: '#176b53', color: '#fff', fontSize: 14, fontWeight: 650, cursor: 'pointer' },
  switch: { marginTop: 18, padding: 0, border: 0, background: 'transparent', color: '#176b53', fontSize: 13, cursor: 'pointer', textAlign: 'left' },
  help: { marginTop: 18, color: '#657084', fontSize: 12, lineHeight: 1.5 },
  error: { color: '#b42318', fontSize: 13, margin: 0 },
  success: { color: '#176b53', fontSize: 13, margin: 0 },
  sessionBar: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, padding: '9px 18px', background: '#fff', borderBottom: '1px solid #e1e6eb', fontSize: 12, color: '#596579' },
  signOut: { border: '1px solid #cbd3dc', borderRadius: 6, padding: '6px 10px', background: '#fff', color: '#17202a', cursor: 'pointer' },
}
