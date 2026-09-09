import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, PaymentStatus } from './api'

const money = (value: number | string) => `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
const maskPhone = (phone?: string | null) => phone ? `${phone.slice(0, 6)}••••${phone.slice(-2)}` : 'Customer'

export function PaymentDetailOperations() {
  const { id } = useParams()
  const payment = useQuery({ queryKey: ['payment', id], queryFn: () => api.payment(String(id)), enabled: Boolean(id), refetchInterval: data => data.state.data?.data.status === 'pending' ? 5000 : false })
  const current = payment.data?.data
  const checkoutId = current?.transaction_type === 'stk' ? current.transaction_id : null
  const stk = useQuery({ queryKey: ['stk-status', checkoutId], queryFn: () => api.stkStatus(String(checkoutId)), enabled: Boolean(checkoutId && current?.status === 'pending'), refetchInterval: 5000 })

  if (payment.isPending) return <Loading />
  if (payment.error || !current) return <div className="empty"><strong>Payment not found</strong><span>{payment.error instanceof Error ? payment.error.message : 'The payment may have been removed or belongs to another workspace.'}</span><Link to="/payments">Back to payments</Link></div>

  const resultCode = stk.data?.data?.ResultCode
  const liveStatus = resultCode === 0 || resultCode === '0' ? 'Confirmed by M-Pesa' : resultCode !== undefined ? String(stk.data?.data?.ResultDesc || 'M-Pesa reported a failure') : 'Waiting for M-Pesa confirmation'
  const done = current.status === 'success'
  const failed = current.status === 'failed'

  return <>
    <div className="page-head"><div><div className="eyebrow">PAYMENT DETAIL</div><h1>{money(current.amount)}</h1><p>{maskPhone(current.phone_number)} · {current.reference || 'No reference'}</p></div><span className={`status ${current.status}`}>{labelStatus(current.status)}</span></div>
    {current.status === 'pending' && <div className="alert">{liveStatus}. This page refreshes automatically while the payment is pending.</div>}
    {failed && <div className="alert">M-Pesa did not complete this payment. The transaction is recorded as failed.</div>}
    <div className="two-col"><div className="panel"><div className="panel-head"><h2>Payment information</h2><span>{current.transaction_type === 'stk' ? 'STK Push' : 'M-Pesa'}</span></div><DetailRow label="M-Pesa receipt" value={current.mpesa_receipt || 'Pending'} /><DetailRow label="Transaction ID" value={current.transaction_id || current.id} /><DetailRow label="Reference" value={current.reference || '—'} /><DetailRow label="Phone" value={current.phone_number || '—'} /><DetailRow label="Created" value={date(current.created_at)} /><DetailRow label="Result" value={current.result_description || (done ? 'Payment completed' : current.status === 'pending' ? 'Awaiting callback' : 'Payment failed')} /></div>
      <div className="panel"><div className="panel-head"><h2>Payment timeline</h2><span>{done ? 'Complete' : current.status === 'pending' ? 'In progress' : 'Stopped'}</span></div><Timeline label="Payment initiated" value={date(current.created_at)} done /><Timeline label="STK prompt sent" value={current.transaction_type === 'stk' ? 'Customer prompt created' : 'C2B payment'} done /><Timeline label="Customer entered PIN" value={current.status === 'pending' ? 'Waiting for customer' : failed ? 'Not completed' : 'Completed'} done={done} /><Timeline label="Safaricom confirmed" value={current.status === 'pending' ? liveStatus : done ? 'Confirmed' : 'Not confirmed'} done={done} /><Timeline label="MobiWave recorded payment" value={done ? 'Recorded' : current.status === 'pending' ? 'Waiting for callback' : 'Failed'} done={done} /><Timeline label="SMS receipt delivered" value={done ? (payment.data?.notifications?.find(n => n.event_type === 'payment.receipt')?.status || 'Processing') : 'Not sent'} done={payment.data?.notifications?.some(n => n.event_type === 'payment.receipt' && n.status === 'sent') || false} /></div></div>
    {payment.data?.notifications?.length ? <section className="panel"><div className="panel-head"><h2>Notifications</h2><span>{payment.data.notifications.length} events</span></div><div className="table-wrap"><table><thead><tr><th>Channel</th><th>Event</th><th>Status</th><th>Recipient</th><th>Time</th><th>Error</th></tr></thead><tbody>{payment.data.notifications.map(n => <tr key={n.id}><td>{n.channel.toUpperCase()}</td><td>{n.event_type}</td><td><span className={`status ${n.status === 'sent' ? 'success' : n.status === 'pending' ? 'pending' : 'failed'}`}>{n.status}</span></td><td>{n.recipient || '—'}</td><td>{date(n.sent_at || n.created_at)}</td><td>{n.error_message || '—'}</td></tr>)}</tbody></table></div></section> : null}
    <Link to="/payments">← Back to payments</Link>
  </>
}

function labelStatus(status: PaymentStatus) { return status === 'success' ? 'Successful' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : 'Reversed' }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div> }
function Timeline({ label, value, done }: { label: string; value: string; done: boolean }) { return <div className="timeline-row"><span className={done ? 'timeline-dot done' : 'timeline-dot'} /><div><strong>{label}</strong><small>{value}</small></div></div> }
function Loading() { return <div className="loading-list">{[1, 2, 3, 4, 5].map(i => <div className="skeleton" key={i} />)}</div> }
