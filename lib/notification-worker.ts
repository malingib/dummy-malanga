/**
 * Notification Worker — Ch10: pulls from queue, sends via third-party, retry with backoff, DLQ, monitoring
 * Per Ch19: batching, WAL-like persistence, consumer group (here: single worker, can scale horizontally)
 */
import { db } from '@/lib/neon'
import { getNotificationWithTemplate, renderNotificationContent } from '@/lib/notifications'
import { sendPaymentReceipt } from '@/lib/mobiwave-sms'

const MAX_ATTEMPTS = 8 // after 8 → failed (DLQ)

function backoffSeconds(attempt: number): number {
  return Math.min(3600, 30 * Math.pow(2, Math.max(0, attempt - 1))) // 30,60,120,240...3600
}

async function sendViaChannel(notificationId: string): Promise<{ ok: boolean; providerUid?: string; error?: string }> {
  const resolved = await getNotificationWithTemplate(notificationId)
  if (!resolved) return { ok: false, error: 'Notification not found' }
  const { notification, template, variables } = resolved

  if (notification.channel === 'sms') {
    // Resolve message: template content or fallback via sendPaymentReceipt's own fallback
    const amount = variables.amount ?? (notification.metadata as any)?.amount
    const reference = variables.reference ?? (notification.metadata as any)?.reference
    const receipt = variables.receipt ?? (notification.metadata as any)?.receipt
    try {
      const result = await sendPaymentReceipt({
        recipient: notification.recipient,
        amount: amount ?? 0,
        reference: reference || undefined,
        receipt: receipt || undefined,
        messageTemplate: template?.content || undefined,
        senderId: template?.senderId || undefined,
      })
      if (result.skipped) return { ok: true, providerUid: undefined } // treated as skipped, not failed
      return { ok: true, providerUid: (result.data as any)?.data?.uid || (result.data as any)?.uid }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'SMS send failed' }
    }
  }

  if (notification.channel === 'email') {
    // Placeholder: integrate SendGrid/Mailgun — for now mark as failed to DLQ if not configured
    return { ok: false, error: 'Email channel not configured' }
  }

  if (notification.channel === 'whatsapp') {
    return { ok: false, error: 'WhatsApp channel not configured' }
  }

  return { ok: false, error: `Channel ${notification.channel} not implemented` }
}

export async function processNotificationQueue(limit = 20): Promise<{ processed: number; sent: number; failed: number; skipped: number; retried: number }> {
  const { data: queue, error } = await db
    .from('payment_notification_events')
    .select('id')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('next_attempt_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  if (!queue?.length) return { processed: 0, sent: 0, failed: 0, skipped: 0, retried: 0 }

  let sent = 0, failed = 0, skipped = 0, retried = 0

  for (const row of queue) {
    const { data: fresh } = await db.from('payment_notification_events').select('id,status,attempt_count,channel,workspace_id').eq('id', row.id).maybeSingle()
    if (!fresh || !['pending', 'failed'].includes(fresh.status)) continue

    const attempt = Number(fresh.attempt_count || 0) + 1

    const result = await sendViaChannel(fresh.id)

    if (result.ok) {
      // Success or skipped (no token case treated as skipped upstream but here ok)
      const newStatus = result.providerUid ? 'sent' : 'skipped'
      await db.from('payment_notification_events').update({
        status: newStatus,
        attempt_count: attempt,
        provider_uid: result.providerUid || null,
        sent_at: new Date().toISOString(),
        last_error: null,
      } as any).eq('id', fresh.id)
      await db.from('notification_event_tracking').insert({
        notification_id: fresh.id,
        workspace_id: fresh.workspace_id,
        event_type: newStatus === 'sent' ? 'sent' : 'skipped',
        channel: fresh.channel,
        provider_response: { providerUid: result.providerUid },
      } as any)
      if (newStatus === 'sent') sent++
      else skipped++
    } else {
      const isTerminal = attempt >= MAX_ATTEMPTS
      const nextAt = new Date(Date.now() + backoffSeconds(attempt) * 1000).toISOString()
      await db.from('payment_notification_events').update({
        status: isTerminal ? 'failed' : 'pending',
        attempt_count: attempt,
        next_attempt_at: nextAt,
        last_error: result.error || 'Delivery failed',
      } as any).eq('id', fresh.id)
      await db.from('notification_event_tracking').insert({
        notification_id: fresh.id,
        workspace_id: fresh.workspace_id,
        event_type: isTerminal ? 'failed' : 'queued',
        channel: fresh.channel,
        provider_response: { error: result.error, attempt, nextAttemptAt: nextAt },
      } as any)
      if (isTerminal) failed++
      else retried++
    }
  }

  return { processed: queue.length, sent, failed, skipped, retried }
}

// For direct enqueue+immediate attempt (used by inline callers that want async)
export async function enqueueAndProcess(input: Parameters<typeof import('./notifications').queueNotification>[0]) {
  const { queueNotification } = await import('./notifications')
  const res = await queueNotification(input)
  // Don't block enqueue caller; schedule worker tick
  if (res.id && !res.deduped && !res.skipped) {
    // Fire-and-forget single-item process (best-effort); batch worker will retry anyway
    processNotificationQueue(5).catch((e) => console.error('[notification-worker] enqueueAndProcess tick failed:', e))
  }
  return res
}
