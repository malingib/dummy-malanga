import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { POST as legacyConfirmation } from '@/app/api/mpesa/confirmation/route'
import { assertTransactionRouting, attachTransactionRouting, resolveMpesaConnection } from '@/lib/mpesa-connection-resolver'
import { extractC2BIdentifiers, isCallbackBodyTooLarge, validateConfirmationPayload } from '@/lib/mpesa-callback-rules.mjs'

function resultFromPayload(body: Record<string, unknown>) {
  const nested = body?.Result as Record<string, unknown> | undefined
  return {
    code: String(nested?.ResultCode ?? body?.ResultCode ?? '0'),
    description: String(nested?.ResultDesc ?? body?.ResultDesc ?? 'Received'),
  }
}

export async function POST(request: NextRequest) {
  if (isCallbackBodyTooLarge(request.headers.get('content-length'))) {
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Payload too large' }, { status: 200 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ResultCode: '01', ResultDesc: 'Invalid payload' }, { status: 200 })

  const { shortcode } = extractC2BIdentifiers(body)
  const validation = validateConfirmationPayload(body)
  if (!validation.valid) {
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Invalid payment data' }, { status: 200 })
  }

  const transactionId = validation.transactionId

  let connection = null
  try {
    connection = shortcode ? await resolveMpesaConnection(shortcode) : null
  } catch (error) {
    console.error('[c2b/confirmation] connection resolution error:', error)
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unable to resolve shortcode' }, { status: 200 })
  }

  const idempotencyKey = `c2b:confirmation:${connection?.id || shortcode || 'unknown'}:${transactionId}`

  const { data: prior } = await supabaseAdmin
    .from('mpesa_callback_events')
    .select('id,status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (prior?.status === 'processed' || prior?.status === 'duplicate') {
    return NextResponse.json({ ResultCode: '0', ResultDesc: 'Received' })
  }

  if (!connection) {
    await supabaseAdmin.from('mpesa_callback_events').insert({
      event_type: 'c2b.confirmation',
      idempotency_key: idempotencyKey,
      shortcode,
      payload: body,
      status: 'rejected',
      error_message: 'Unknown or inactive shortcode',
      processed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unknown shortcode' }, { status: 200 })
  }

  try {
    await assertTransactionRouting(transactionId, connection)
  } catch (error) {
    console.error('[c2b/confirmation] routing conflict:', error)
    await supabaseAdmin.from('mpesa_callback_events').insert({
      connection_id: connection.id,
      workspace_id: connection.workspace_id,
      event_type: 'c2b.confirmation',
      idempotency_key: idempotencyKey,
      shortcode,
      payload: body,
      status: 'rejected',
      error_message: 'Payment transaction routing conflict',
      processed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Payment routing conflict' }, { status: 200 })
  }

  const { data: event, error: eventError } = await supabaseAdmin.from('mpesa_callback_events').insert({
    connection_id: connection.id,
    workspace_id: connection.workspace_id,
    event_type: 'c2b.confirmation',
    idempotency_key: idempotencyKey,
    shortcode,
    payload: body,
    status: 'received',
  }).select('id').maybeSingle()

  if (eventError) {
    if (eventError.code === '23505') return NextResponse.json({ ResultCode: '0', ResultDesc: 'Received' })
    console.error('[c2b/confirmation] event insert error:', eventError)
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unable to record callback' }, { status: 200 })
  }

  const response = await legacyConfirmation(request)
  const responsePayload = await response.clone().json().catch(() => ({}))
  const processed = response.ok

  if (!processed) {
    await supabaseAdmin.from('mpesa_callback_events').update({
      status: 'failed',
      response_payload: responsePayload,
      error_message: 'Legacy confirmation processing failed',
      processed_at: new Date().toISOString(),
    }).eq('id', event?.id || '')
    return response
  }

  const result = resultFromPayload(body)
  const amount = validation.amount
  const status = result.code === '0' ? 'success' : 'failed'

  const { error: paymentError } = await supabaseAdmin
    .from('payment_transactions')
    .upsert({
      workspace_id: connection.workspace_id,
      connection_id: connection.id,
      shortcode: connection.shortcode,
      account_type: connection.account_type,
      transaction_id: transactionId,
      transaction_type: String(body?.TransactionType || 'c2b'),
      phone_number: String(body?.MSISDN || ''),
      amount,
      reference: String(body?.BillRefNumber || body?.InvoiceNumber || '').trim() || null,
      status,
      mpesa_receipt: transactionId,
      result_code: result.code,
      result_description: result.description,
      raw_payload: body,
    }, { onConflict: 'workspace_id,transaction_id' })

  if (paymentError) {
    console.error('[c2b/confirmation] payment ledger error:', paymentError)
    await supabaseAdmin.from('mpesa_callback_events').update({
      status: 'failed',
      response_payload: responsePayload,
      error_message: 'Payment ledger persistence failed',
      processed_at: new Date().toISOString(),
    }).eq('id', event?.id || '')
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Payment recording failed' }, { status: 200 })
  }

  try {
    await attachTransactionRouting(transactionId, connection, event?.id)
  } catch (error) {
    console.error('[c2b/confirmation] transaction routing attachment error:', error)
    await supabaseAdmin.from('mpesa_callback_events').update({
      status: 'failed',
      response_payload: responsePayload,
      error_message: 'Transaction routing attachment failed',
      processed_at: new Date().toISOString(),
    }).eq('id', event?.id || '')
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Transaction routing failed' }, { status: 200 })
  }

  await supabaseAdmin.from('mpesa_callback_events').update({
    status: 'processed',
    response_payload: responsePayload,
    processed_at: new Date().toISOString(),
  }).eq('id', event?.id || '')

  await supabaseAdmin.from('mpesa_connections').update({
    callback_verified_at: new Date().toISOString(),
    connection_status: 'ready',
    callback_status: 'verified',
    last_error: null,
  }).eq('id', connection.id)

  return response
}
