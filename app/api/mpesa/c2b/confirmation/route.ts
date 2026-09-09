import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { POST as legacyConfirmation } from '@/app/api/mpesa/confirmation/route'
import { assertTransactionRouting, attachTransactionRouting, resolveMpesaConnection } from '@/lib/mpesa-connection-resolver'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const shortcode = String(body?.BusinessShortCode || '').trim() || null
  const transactionId = String(body?.TransID || '').trim() || null

  let connection = null
  try {
    connection = shortcode ? await resolveMpesaConnection(shortcode) : null
  } catch (error) {
    console.error('[c2b/confirmation] connection resolution error:', error)
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unable to resolve shortcode' }, { status: 200 })
  }

  const idempotencyKey = transactionId
    ? `c2b:confirmation:${connection?.id || shortcode || 'unknown'}:${transactionId}`
    : `c2b:confirmation:${connection?.id || shortcode || 'unknown'}:${crypto.randomUUID()}`

  const { data: prior } = await supabaseAdmin.from('mpesa_callback_events').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle()
  if (prior?.status === 'processed' || prior?.status === 'duplicate') return NextResponse.json({ ResultCode: '0', ResultDesc: 'Received' })

  if (!connection) {
    await supabaseAdmin.from('mpesa_callback_events').insert({ event_type: 'c2b.confirmation', idempotency_key: idempotencyKey, shortcode, payload: body, status: 'rejected', error_message: 'Unknown or inactive shortcode', processed_at: new Date().toISOString() })
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unknown shortcode' }, { status: 200 })
  }

  try {
    await assertTransactionRouting(transactionId || '', connection)
  } catch (error) {
    console.error('[c2b/confirmation] routing conflict:', error)
    await supabaseAdmin.from('mpesa_callback_events').insert({ connection_id: connection.id, workspace_id: connection.workspace_id, event_type: 'c2b.confirmation', idempotency_key: idempotencyKey, shortcode, payload: body, status: 'rejected', error_message: 'Payment transaction routing conflict', processed_at: new Date().toISOString() })
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

  const forwarded = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(body) })
  const response = await legacyConfirmation(forwarded)
  const responsePayload = await response.clone().json().catch(() => ({}))
  const processed = response.ok

  if (processed && transactionId) {
    try {
      await attachTransactionRouting(transactionId, connection, event?.id)
    } catch (error) {
      console.error('[c2b/confirmation] transaction routing attachment error:', error)
      await supabaseAdmin.from('mpesa_callback_events').update({ status: 'failed', response_payload: responsePayload, error_message: 'Transaction routing attachment failed', processed_at: new Date().toISOString() }).eq('id', event?.id || '')
      return NextResponse.json({ ResultCode: '01', ResultDesc: 'Transaction routing failed' }, { status: 200 })
    }
  }

  await supabaseAdmin.from('mpesa_callback_events').update({ status: processed ? 'processed' : 'failed', response_payload: responsePayload, processed_at: new Date().toISOString() }).eq('id', event?.id || '')

  if (processed) {
    await supabaseAdmin.from('mpesa_connections').update({ callback_verified_at: new Date().toISOString(), connection_status: 'ready', callback_status: 'verified', last_error: null }).eq('id', connection.id)
  }

  return response
}
