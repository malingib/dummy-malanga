import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, SmsDelivery, SmsTemplate } from './api'

type SmsOperationsProps = { money?: (value: number | string) => string }
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'

export function SmsOperations({}: SmsOperationsProps) {
  const client = useQueryClient()
  const deliveries = useQuery({ queryKey: ['sms-delivery'], queryFn: () => api.smsDelivery() })
  const templates = useQuery({ queryKey: ['sms-templates'], queryFn: () => api.smsTemplates() })
  const [tab, setTab] = useState<'delivery' | 'templates'>('delivery')
  const [showTemplate, setShowTemplate] = useState(false)
  const [name, setName] = useState('Payment receipt')
  const [sender, setSender] = useState('MobiWave')
  const [message, setMessage] = useState('Payment received: KES {{amount}}. Reference: {{reference}}. M-Pesa receipt: {{receipt}}. Thank you for paying with MobiWave.')
  const create = useMutation({ mutationFn: () => api.createSmsTemplate({ name: name.trim(), sender_id: sender.trim(), message: message.trim() }), onSuccess: () => { setShowTemplate(false); client.invalidateQueries({ queryKey: ['sms-templates'] }) } })

  const sent = deliveries.data?.data?.filter(d => d.status === 'sent').length || 0
  const failed = deliveries.data?.data?.filter(d => d.status === 'failed').length || 0
  const pending = deliveries.data?.data?.filter(d => d.status === 'pending').length || 0

  return <>
    <div className="page-head"><div><div className="eyebrow">COMMUNICATIONS</div><h1>SMS</h1><p>Payment receipts and customer notifications are delivered through MobiWave SMS.</p></div><button className="primary" onClick={() => setShowTemplate(true)}>New template</button></div>
    <section className="metric-grid"><div className="metric"><span>Delivered</span><strong>{sent}</strong><small>Recent receipt notifications</small></div><div className="metric"><span>Pending</span><strong>{pending}</strong><small>Awaiting delivery processing</small></div><div className="metric"><span>Failed</span><strong className={failed ? 'warning' : ''}>{failed}</strong><small>Need attention</small></div><div className="metric"><span>Provider</span><strong>MobiWave</strong><small>Server-side credentials</small></div></section>
    <div className="dev-tabs"><button className={tab === 'delivery' ? 'active' : ''} onClick={() => setTab('delivery')}>Delivery</button><button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Templates</button></div>
    {tab === 'delivery' && <section className="panel"><div className="panel-head"><div><h2>Receipt delivery</h2><span className="muted">Every successful payment creates a traceable SMS notification event.</span></div><span>{deliveries.data?.data?.length || 0} recent</span></div>{deliveries.isPending ? <LoadingRows /> : deliveries.error ? <div className="alert">Unable to load SMS delivery history.</div> : deliveries.data?.data?.length ? <div className="table-wrap"><table><thead><tr><th>Event</th><th>Recipient</th><th>Status</th><th>Provider</th><th>Created</th><th>Sent</th><th>Error</th></tr></thead><tbody>{deliveries.data.data.map((row: SmsDelivery) => <tr key={row.id}><td><strong>{row.event_type}</strong><small>{row.transaction_id || 'Payment'}</small></td><td>{row.recipient || '—'}</td><td><span className={`status ${row.status === 'sent' ? 'success' : row.status === 'pending' ? 'pending' : row.status === 'failed' ? 'failed' : ''}`}>{row.status}</span></td><td>{row.provider_uid || '—'}</td><td>{date(row.created_at)}</td><td>{date(row.sent_at)}</td><td>{row.error_message || '—'}</td></tr>)}</tbody></table></div> : <div className="empty"><strong>No SMS deliveries yet</strong><span>Successful payments will appear here when receipt notifications are generated.</span></div>}</section>}
    {tab === 'templates' && <section className="panel"><div className="panel-head"><div><h2>Payment receipt templates</h2><span className="muted">Use {{amount}}, {{reference}} and {{receipt}} as payment placeholders.</span></div></div>{templates.isPending ? <LoadingRows /> : templates.data?.data?.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Sender</th><th>Message</th><th>Status</th><th>Updated</th></tr></thead><tbody>{templates.data.data.map((template: SmsTemplate) => <tr key={template.id}><td><strong>{template.name}</strong></td><td>{template.sender_id}</td><td><span className="template-copy">{template.message}</span></td><td><span className={`status ${template.status === 'active' ? 'success' : 'failed'}`}>{template.status}</span></td><td>{date(template.updated_at || template.created_at)}</td></tr>)}</tbody></table></div> : <div className="empty"><strong>No custom templates</strong><span>The built-in receipt remains active. Create a template when you need different customer wording.</span></div>}</section>}
    {showTemplate && <div className="modal-backdrop"><div className="modal"><div className="panel-head"><h2>New SMS template</h2><button onClick={() => setShowTemplate(false)}>×</button></div><form onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate() }} className="form-grid"><label>Template name<input value={name} onChange={e => setName(e.target.value)} required /></label><label>Sender ID<input value={sender} onChange={e => setSender(e.target.value)} maxLength={20} required /></label><label>Message<textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={480} rows={5} required /></label><div className="managed-note"><strong>Available placeholders</strong><span>{{amount}} · {{reference}} · {{receipt}}</span></div><div className="form-actions"><button type="button" onClick={() => setShowTemplate(false)}>Cancel</button><button className="primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create template'}</button></div>{create.error && <div className="alert">{create.error instanceof Error ? create.error.message : 'Unable to create template.'}</div>}</form></div></div>}
  </>
}

function LoadingRows() { return <div className="loading-list">{[1, 2, 3, 4].map(i => <div className="skeleton" key={i} />)}</div> }
