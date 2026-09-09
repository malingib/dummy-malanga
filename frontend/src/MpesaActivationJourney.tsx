import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type MpesaConnection } from './api'

const steps = [
  ['connection', 'Connection details'],
  ['verify', 'Connection verified'],
  ['callbacks', 'Payment notifications'],
  ['test', 'Payment test'],
  ['ready', 'Ready to collect'],
] as const

function label(connection?: MpesaConnection | null) {
  if (!connection) return 'Add an M-Pesa connection'
  if (connection.connection_status === 'failed') return 'Fix the M-Pesa connection'
  if (connection.token_status !== 'healthy') return 'Verify your M-Pesa connection'
  if (connection.callback_status !== 'registered') return 'Configure payment notifications'
  if (!connection.callback_verified_at) return 'Run a payment test'
  if (!['ready', 'live'].includes(connection.connection_status)) return 'Confirm your payment test'
  return 'Ready to collect payments'
}

export function MpesaActivationJourney() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['mpesa-activation'], queryFn: api.activation, refetchInterval: 5000 })
  const [phone, setPhone] = useState('0712345678')
  const [amount, setAmount] = useState('10')
  const [showTest, setShowTest] = useState(false)
  const connections = q.data?.data?.connections || []
  const journey = q.data?.data?.journey_status || 'connection_required'
  const connection = (q.data?.data?.primary || connections[0]) as MpesaConnection | undefined
  const action = useMutation({
    mutationFn: ({ action }: { action: 'verify' | 'register_callbacks' | 'test' }) => api.activationAction(connection!.id, action, action === 'test' ? { phone, amount: Number(amount), reference: 'MOBIWAVE-TEST' } : undefined),
    onSuccess: () => { setShowTest(false); qc.invalidateQueries({ queryKey: ['mpesa-activation'] }); qc.invalidateQueries({ queryKey: ['mpesa-connections'] }) },
  })

  const current = journey === 'connection_required' ? 'connection' : journey === 'verify_connection' ? 'verify' : journey === 'callback_setup' ? 'callbacks' : journey === 'payment_test' ? 'test' : journey === 'attention_required' ? 'verify' : 'ready'
  const index = Math.max(0, steps.findIndex(([key]) => key === current))

  return <>
    <div className="page-head"><div><div className="eyebrow">M-PESA</div><h1>Connection & activation</h1><p>Set up your M-Pesa connection once. MobiWave handles the payment notification plumbing.</p></div></div>

    <section className="panel">
      <div className="panel-head"><div><h2>{label(connection)}</h2><span className="muted">{connection ? `${connection.account_type === 'till' ? 'Till' : 'PayBill'} ${connection.shortcode} · ${connection.environment}` : 'No connection has been added yet.'}</span></div>{connection && <span className={`status ${current === 'ready' ? 'success' : current === 'verify' && connection.connection_status === 'failed' ? 'failed' : 'pending'}`}>{current === 'ready' ? 'Ready' : current === 'verify' && connection.connection_status === 'failed' ? 'Attention' : 'In setup'}</span>}</div>
      <div className="connection-grid" style={{marginTop:20}}>{steps.map(([key, title], i) => <div className="health-row" key={key}><span>{title}</span><span>{i < index || (current === 'ready' && i === index) ? 'Complete' : i === index ? 'Current' : 'Pending'}</span></div>)}</div>
      {connection?.last_error && <div className="alert" style={{marginTop:16}}>{connection.last_error}</div>}

      <div className="form-actions" style={{marginTop:20}}>
        {!connection && <a className="primary" href="/mpesa/connections">Add connection</a>}
        {connection && current === 'verify' && <button className="primary" onClick={() => action.mutate({action:'verify'})} disabled={action.isPending}>{action.isPending ? 'Verifying…' : 'Verify connection'}</button>}
        {connection && current === 'callbacks' && <button className="primary" onClick={() => action.mutate({action:'register_callbacks'})} disabled={action.isPending}>{action.isPending ? 'Configuring…' : 'Configure notifications'}</button>}
        {connection && current === 'test' && <button className="primary" onClick={() => setShowTest(true)}>Run payment test</button>}
        {connection && current === 'ready' && <a className="primary" href="/payments">Request payment</a>}
        {connection && <a href="/mpesa/connections">Manage connections</a>}
      </div>
    </section>

    {connections.length > 1 && <section className="panel" style={{marginTop:15}}><div className="panel-head"><div><h2>Payment connections</h2><span className="muted">Each shortcode is routed independently.</span></div></div><div className="table-wrap"><table><thead><tr><th>Account</th><th>Environment</th><th>Status</th><th>Callbacks</th><th>Test</th></tr></thead><tbody>{connections.map(c => <tr key={c.id}><td><strong>{c.account_type === 'till' ? 'Till' : 'PayBill'} {c.shortcode}</strong>{c.is_primary && <small>Primary</small>}</td><td>{c.environment}</td><td>{c.connection_status}</td><td>{c.callback_status}</td><td>{c.callback_verified_at ? 'Verified' : 'Pending'}</td></tr>)}</tbody></table></div></section>}

    {showTest && connection && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>Run sandbox payment test</h2><button onClick={() => setShowTest(false)}>×</button></div><p className="muted">This sends a sandbox C2B payment to the selected shortcode. Production connections cannot use automated tests.</p><label>Test phone<input value={phone} onChange={e=>setPhone(e.target.value)} /></label><label>Amount<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} /></label>{action.error && <div className="alert">{action.error instanceof Error ? action.error.message : 'Payment test failed.'}</div>}<div className="form-actions"><button onClick={()=>setShowTest(false)}>Cancel</button><button className="primary" onClick={()=>action.mutate({action:'test'})} disabled={action.isPending}>{action.isPending ? 'Starting test…' : 'Start test'}</button></div></div></div>}
  </>
}
