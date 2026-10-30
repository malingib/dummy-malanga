import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/neon'
import { queueWebhook } from '@/lib/webhooks'
import { queueNotification } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callback = body?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

    const checkoutId = String(callback.CheckoutRequestID)
    const idempotencyKey = crypto.createHash('sha256').update(`stk:${checkoutId}`).digest('hex')

    // Resolve workspace before event insert (Ch26 hardening): lookup pending transaction to bind tenant early
    const { data: preTxn } = await db.from('payment_transactions').select('id,workspace_id,shortcode').eq('transaction_id', checkoutId).maybeSingle()
    const preWorkspaceId = preTxn?.workspace_id || null

    const { data: event } = await db.from('payment_webhook_events').insert({ event_type: 'stk.callback', idempotency_key: idempotencyKey, workspace_id: preWorkspaceId, payload: body, processed_at: new Date().toISOString() }).select('id,workspace_id').maybeSingle()
    if (!event) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' })

    const resultCode = String(callback.ResultCode ?? '')
    const metadata = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : []
    const get = (name: string) => metadata.find((item: any) => item.Name === name)?.Value
    const receipt = get('MpesaReceiptNumber')
    const amount = get('Amount')
    const phone = get('PhoneNumber')
    const status = resultCode === '0' ? 'success' : 'failed'

    // Use string-safe amount parsing (Ch26: amounts as string to avoid float)
    const parsedAmount = amount != null ? String(amount) : undefined
    const numericAmount = parsedAmount != null && /^\d+(\.\d{1,2})?$/.test(parsedAmount) ? Number(parsedAmount) : undefined

    const { data: transaction } = await db.from('payment_transactions').update({ status, result_code: resultCode, result_description: String(callback.ResultDesc || ''), mpesa_receipt: receipt ? String(receipt) : null, phone_number: phone ? String(phone) : undefined, amount: numericAmount, raw_payload: body }).eq('transaction_id', checkoutId).select('id,workspace_id,status,amount,reference,transaction_id,mpesa_receipt,phone_number').maybeSingle()
    if (transaction) {
      if (!event.workspace_id) {
        await db.from('payment_webhook_events').update({ workspace_id: transaction.workspace_id }).eq('id', event.id)
      }
      // Ch26 double-entry ledger: create debit buyer / credit merchant on success (idempotent)
      if (status === 'success') {
        try {
          await db.from('payment_ledger').upsert([
            { workspace_id: transaction.workspace_id, transaction_id: transaction.id, event_type: 'payin', account: 'buyer', entry_type: 'debit', amount: transaction.amount, reference: transaction.reference, idempotency_key: `payin:${checkoutId}:debit` },
            { workspace_id: transaction.workspace_id, transaction_id: transaction.id, event_type: 'payin', account: 'merchant', entry_type: 'credit', amount: transaction.amount, reference: transaction.reference, idempotency_key: `payin:${checkoutId}:credit` },
          ] as any, { onConflict: 'workspace_id,idempotency_key,account,entry_type', ignoreDuplicates: true } as any)
        } catch (ledgerErr) {
          console.error('[stk-callback] ledger insert failed:', ledgerErr)
        }
      }
      await queueWebhook(status === 'success' ? 'payment.success' : 'payment.failed', checkoutId, transaction.workspace_id, { id: transaction.id, transaction_id: transaction.transaction_id, status: transaction.status, amount: transaction.amount, reference: transaction.reference, receipt: transaction.mpesa_receipt, phone: transaction.phone_number })

      if (status === 'success' && transaction.phone_number) {
        // Ch10: queue via notification system — handles settings opt-out, dedup, rate limit, templating, worker retry/DLQ
        try {
          await queueNotification({
            workspaceId: transaction.workspace_id,
            transactionId: transaction.id,
            channel: 'sms',
            eventType: 'payment.receipt',
            recipient: transaction.phone_number,
            dedupKey: `receipt:${checkoutId}`,
            metadata: { amount: transaction.amount, reference: transaction.reference, receipt: transaction.mpesa_receipt, phone: transaction.phone_number },
            priority: 8,
          })
        } catch (notifyErr) {
          console.error('[stk-callback] queueNotification failed:', notifyErr)
        }
      }
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    console.error('[stk-callback] error:', error)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}