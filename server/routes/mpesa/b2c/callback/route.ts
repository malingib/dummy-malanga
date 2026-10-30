import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/neon'
import { queueWebhook } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Daraja B2C Result: Result -> ResultType 0 success, parameters include TransactionID, TransactionAmount
    const result = body?.Result || body
    const conversationId = String(result?.ConversationID || result?.OriginatorConversationID || body?.ConversationID || '')
    const resultCode = String(result?.ResultCode ?? body?.ResultCode ?? '')
    const resultDesc = String(result?.ResultDesc ?? body?.ResultDesc ?? '')
    const txnId = result?.TransactionID || body?.TransactionID || null

    if (!conversationId) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

    const idempotencyKey = crypto.createHash('sha256').update(`b2c:${conversationId}:${resultCode}`).digest('hex')
    const { data: event } = await db.from('payment_webhook_events').insert({ event_type: 'b2c.callback', idempotency_key: idempotencyKey, payload: body, processed_at: new Date().toISOString() }).select('id').maybeSingle()
    if (!event) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' })

    // Update b2c_payouts by transaction_id or conversation id
    const status = resultCode === '0' ? 'success' : 'failed'
    const { data: payout } = await db.from('b2c_payouts').update({ status, result_code: resultCode, result_desc: resultDesc, mpesa_transaction_id: txnId ? String(txnId) : null, raw_callback: body as any }).eq('transaction_id', conversationId).select('id,workspace_id,amount,reference').maybeSingle()

    if (payout) {
      await db.from('payment_webhook_events').update({ workspace_id: payout.workspace_id }).eq('id', event.id)
      // Double-entry: debit merchant, credit buyer on payout success
      if (status === 'success') {
        const key = conversationId
        await db.from('payment_ledger').upsert([
          { workspace_id: payout.workspace_id, transaction_id: null, event_type: 'payout', account: 'merchant', entry_type: 'debit', amount: payout.amount, reference: payout.reference, idempotency_key: `b2c:${key}:debit` },
          { workspace_id: payout.workspace_id, transaction_id: null, event_type: 'payout', account: 'buyer', entry_type: 'credit', amount: payout.amount, reference: payout.reference, idempotency_key: `b2c:${key}:credit` },
        ] as any, { onConflict: 'workspace_id,idempotency_key,account,entry_type', ignoreDuplicates: true } as any)
      }
      await queueWebhook(status === 'success' ? 'payout.success' : 'payout.failed', conversationId, payout.workspace_id, { id: payout.id, status, amount: payout.amount, reference: payout.reference, txnId })
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    console.error('[b2c-callback] error:', error)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}
