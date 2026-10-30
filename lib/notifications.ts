/**
 * Notification System — Ch10: templates, settings opt-out, dedup, rate limit, validation, event tracking
 * Queue semantics per Ch19: persistent, retryable, consumer groups
 */
import crypto from 'crypto'
import { db } from '@/lib/neon'

export type NotificationChannel = 'sms' | 'email' | 'whatsapp' | 'push'
export type NotificationEventType = string // e.g. 'payment.receipt', 'payment.failed', 'payout.success'

export interface QueueNotificationInput {
  workspaceId: string
  transactionId?: string | null
  channel: NotificationChannel
  eventType: NotificationEventType
  recipient: string
  dedupKey?: string
  priority?: number
  templateId?: string | null
  metadata?: Record<string, unknown>
  variables?: Record<string, string | number | null>
}

function normalizeRecipient(channel: NotificationChannel, recipient: string): string {
  const raw = recipient.trim()
  if (channel === 'sms' || channel === 'whatsapp') {
    let v = raw.replace(/\s+/g, '')
    if (v.startsWith('+')) v = v.slice(1)
    if (v.startsWith('0')) v = `254${v.slice(1)}`
    if (!v.startsWith('254')) v = v.startsWith('254') ? v : `254${v}`
    return v
  }
  return raw
}

export function validateNotification(input: QueueNotificationInput): { ok: true } | { ok: false; error: string } {
  if (!input.workspaceId) return { ok: false, error: 'workspaceId required' }
  if (!input.recipient?.trim()) return { ok: false, error: 'recipient required' }
  if (!input.channel) return { ok: false, error: 'channel required' }
  if (!input.eventType) return { ok: false, error: 'eventType required' }
  const r = normalizeRecipient(input.channel, input.recipient)
  if (input.channel === 'sms' && !/^254[1-9]\d{8}$/.test(r)) return { ok: false, error: 'Invalid Kenyan phone number' }
  if (input.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)) return { ok: false, error: 'Invalid email' }
  return { ok: true }
}

export async function checkNotificationSettings(workspaceId: string, channel: NotificationChannel, eventType: NotificationEventType): Promise<boolean> {
  const { data } = await db.from('notification_settings').select('enabled').eq('workspace_id', workspaceId).eq('channel', channel).eq('event_type', eventType).maybeSingle()
  if (!data) {
    // Fallback to legacy payment_workspaces.notification_sms for sms/payment.receipt
    if (channel === 'sms' && eventType === 'payment.receipt') {
      const { data: ws } = await db.from('payment_workspaces').select('notification_sms').eq('id', workspaceId).maybeSingle()
      return Boolean(ws?.notification_sms ?? true)
    }
    return true // default enabled
  }
  return Boolean(data.enabled)
}

export async function checkRateLimit(workspaceId: string, channel: NotificationChannel, recipient: string): Promise<{ allowed: boolean; setting?: any }> {
  const norm = normalizeRecipient(channel, recipient)
  // Fetch setting
  const { data: setting } = await db.from('notification_settings').select('rate_limit_per_min').eq('workspace_id', workspaceId).eq('channel', channel).maybeSingle()
  const limit = setting?.rate_limit_per_min ?? 10
  // Check state table (simple fixed window per minute)
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const windowIso = windowStart.toISOString()
  const { data: state } = await db.from('notification_rate_limit_state').select('window_start,count').eq('workspace_id', workspaceId).eq('channel', channel).eq('recipient', norm).maybeSingle()
  if (!state) return { allowed: true }
  const sameWindow = new Date(state.window_start).getTime() === windowStart.getTime()
  const count = sameWindow ? Number(state.count) : 0
  return { allowed: count < limit, setting }
}

async function incrementRateLimit(workspaceId: string, channel: NotificationChannel, recipient: string) {
  const norm = normalizeRecipient(channel, recipient)
  const windowStart = new Date()
  windowStart.setSeconds(0, 0)
  const windowIso = windowStart.toISOString()
  const { data: existing } = await db.from('notification_rate_limit_state').select('count,window_start').eq('workspace_id', workspaceId).eq('channel', channel).eq('recipient', norm).maybeSingle()
  if (!existing) {
    await db.from('notification_rate_limit_state').insert({ workspace_id: workspaceId, channel, recipient: norm, window_start: windowIso, count: 1 } as any)
  } else if (new Date(existing.window_start).getTime() === windowStart.getTime()) {
    await db.from('notification_rate_limit_state').update({ count: Number(existing.count) + 1 }).eq('workspace_id', workspaceId).eq('channel', channel).eq('recipient', norm)
  } else {
    await db.from('notification_rate_limit_state').update({ window_start: windowIso, count: 1 }).eq('workspace_id', workspaceId).eq('channel', channel).eq('recipient', norm)
  }
}

function renderTemplate(content: string, variables: Record<string, string | number | null | undefined>): string {
  let out = content
  for (const [k, v] of Object.entries(variables)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}|\\{\\{${k}\\}\\}|\\$\\{${k}\\}`, 'g')
    out = out.replace(re, v == null ? '' : String(v))
  }
  // Also support {{amount}} with locale formatting if not already formatted
  return out
}

export async function resolveTemplate(workspaceId: string, channel: NotificationChannel, eventType: NotificationEventType, templateId?: string | null): Promise<{ content: string; senderId?: string; variables: string[] } | null> {
  if (templateId) {
    const { data } = await db.from('notification_templates').select('content,sender_id,variables').eq('id', templateId).eq('workspace_id', workspaceId).maybeSingle()
    if (data) return { content: data.content, senderId: data.sender_id, variables: data.variables }
  }
  // Workspace template fallback
  const { data: tpl } = await db.from('notification_templates').select('content,sender_id,variables').eq('workspace_id', workspaceId).eq('channel', channel).eq('event_type', eventType).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (tpl) return { content: tpl.content, senderId: tpl.sender_id, variables: tpl.variables }
  // Legacy payment_sms_templates fallback for sms/payment.receipt
  if (channel === 'sms' && eventType === 'payment.receipt') {
    const { data: legacy } = await db.from('payment_sms_templates').select('message,sender_id').eq('workspace_id', workspaceId).eq('event_type', eventType).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (legacy?.message) return { content: legacy.message, senderId: legacy.sender_id, variables: ['amount', 'reference', 'receipt'] }
  }
  return null
}

export async function queueNotification(input: QueueNotificationInput): Promise<{ id: string | null; deduped: boolean; skipped?: string }> {
  const validation = validateNotification(input)
  if (!validation.ok) throw new Error(validation.error)

  const recipient = normalizeRecipient(input.channel, input.recipient)
  const dedupKey = input.dedupKey || crypto.createHash('sha256').update(`${input.workspaceId}:${input.channel}:${input.eventType}:${recipient}:${input.transactionId || ''}`).digest('hex')

  // Dedup check (Ch10: check event IDs)
  const { data: existing } = await db.from('payment_notification_events').select('id,status').eq('workspace_id', input.workspaceId).eq('dedup_key', dedupKey).maybeSingle()
  if (existing) return { id: existing.id, deduped: true }

  // Settings opt-out (Ch10)
  const enabled = await checkNotificationSettings(input.workspaceId, input.channel, input.eventType)
  if (!enabled) {
    const { data: row } = await db.from('payment_notification_events').insert({
      workspace_id: input.workspaceId,
      transaction_id: input.transactionId || null,
      channel: input.channel,
      event_type: input.eventType,
      recipient,
      status: 'skipped',
      dedup_key: dedupKey,
      metadata: { reason: 'opted_out', ...(input.metadata || {}) },
      template_id: input.templateId || null,
      priority: input.priority ?? 5,
    } as any).select('id').maybeSingle()
    // Track
    if (row?.id) await db.from('notification_event_tracking').insert({ notification_id: row.id, workspace_id: input.workspaceId, event_type: 'skipped', channel: input.channel, provider_response: { reason: 'opted_out' } } as any)
    return { id: row?.id || null, deduped: false, skipped: 'opted_out' }
  }

  // Rate limit (Ch10: cap frequency)
  const rl = await checkRateLimit(input.workspaceId, input.channel, recipient)
  if (!rl.allowed) {
    const { data: row } = await db.from('payment_notification_events').insert({
      workspace_id: input.workspaceId,
      transaction_id: input.transactionId || null,
      channel: input.channel,
      event_type: input.eventType,
      recipient,
      status: 'skipped',
      dedup_key: dedupKey,
      metadata: { reason: 'rate_limited', ...(input.metadata || {}) },
      template_id: input.templateId || null,
      priority: input.priority ?? 5,
    } as any).select('id').maybeSingle()
    if (row?.id) await db.from('notification_event_tracking').insert({ notification_id: row.id, workspace_id: input.workspaceId, event_type: 'skipped', channel: input.channel, provider_response: { reason: 'rate_limited' } } as any)
    return { id: row?.id || null, deduped: false, skipped: 'rate_limited' }
  }

  const { data: row, error } = await db.from('payment_notification_events').insert({
    workspace_id: input.workspaceId,
    transaction_id: input.transactionId || null,
    channel: input.channel,
    event_type: input.eventType,
    recipient,
    status: 'pending',
    dedup_key: dedupKey,
    metadata: input.metadata || {},
    template_id: input.templateId || null,
    priority: input.priority ?? 5,
    next_attempt_at: new Date().toISOString(),
  } as any).select('id').maybeSingle()
  if (error) throw error
  if (row?.id) {
    await incrementRateLimit(input.workspaceId, input.channel, recipient)
    await db.from('notification_event_tracking').insert({ notification_id: row.id, workspace_id: input.workspaceId, event_type: 'queued', channel: input.channel } as any)
  }
  return { id: row?.id || null, deduped: false }
}

export async function getNotificationWithTemplate(notificationId: string): Promise<{ notification: any; template: any; variables: Record<string, any> } | null> {
  const { data: n } = await db.from('payment_notification_events').select('*').eq('id', notificationId).maybeSingle()
  if (!n) return null
  const tpl = await resolveTemplate(n.workspace_id, n.channel as NotificationChannel, n.event_type, n.template_id)
  // Build variables from metadata + transaction lookup
  let variables: Record<string, any> = { ...(n.metadata as any) }
  if (n.transaction_id) {
    const { data: txn } = await db.from('payment_transactions').select('amount,reference,mpesa_receipt,phone_number').eq('id', n.transaction_id).maybeSingle()
    if (txn) variables = { amount: txn.amount, reference: txn.reference, receipt: txn.mpesa_receipt, phone: txn.phone_number, ...variables }
  }
  return { notification: n, template: tpl, variables }
}

export function renderNotificationContent(templateContent: string, variables: Record<string, any>): string {
  return renderTemplate(templateContent, variables)
}
