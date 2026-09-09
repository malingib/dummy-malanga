import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { queueWebhook } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callback = body?.Body?.stkCallback
    if (!callback?.CheckoutRequestID) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

    const checkoutId = String(callback.CheckoutRequestID)
    const idempotencyKey = crypto.createHash('sha256').update(`stk:${checkoutId}`).digest('hex')
    const { data: event } = await supabaseAdmin.from('payment_webhook_events').insert({ event_type: 'stk.callback', idempotency_key: idempotencyKey, payload: body, processed_at: new Date().toISOString() }).select('id').maybeSingle()
    if (!event) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Already processed' })

    const resultCode = String(callback.ResultCode ?? '')
    const metadata = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : []
    const get = (name: string) => metadata.find((item: any) => item.Name === name)?.Value
    const receipt = get('MpesaReceiptNumber')
    const amount = get('Amount')
    const phone = get('PhoneNumber')
    const status = resultCode === '0' ? 'success' : 'failed'

    const { data: transaction } = await supabaseAdmin.from('payment_transactions').update({ status, result_code: resultCode, result_description: String(callback.ResultDesc || ''), mpesa_receipt: receipt ? String(receipt) : null, phone_number: phone ? String(phone) : undefined, amount: amount ? Number(amount) : undefined, raw_payload: body }).eq('transaction_id', checkoutId).select('id,workspace_id,status,amount,reference,transaction_id,mpesa_receipt,phone_number').maybeSingle()
    if (transaction) {
      await supabaseAdmin.from('payment_webhook_events').update({ workspace_id: transaction.workspace_id }).eq('id', event.id)
      await queueWebhook(status === 'success' ? 'payment.success' : 'payment.failed', checkoutId, transaction.workspace_id, { id: transaction.id, transaction_id: transaction.transaction_id, status: transaction.status, amount: transaction.amount, reference: transaction.reference, receipt: transaction.mpesa_receipt, phone: transaction.phone_number })
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  } catch (error) {
    console.error('[stk-callback] error:', error)
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }
}
