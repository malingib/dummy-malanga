import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { POST as legacyConfirmation } from '@/app/api/mpesa/confirmation/route'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const shortcode = String(body?.BusinessShortCode || '').trim() || null
  const transactionId = String(body?.TransID || '').trim() || null

  const { data: connection } = shortcode
    ? await supabaseAdmin.from('mpesa_connections').select('id,workspace_id').eq('shortcode', shortcode).eq('environment', process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox').eq('is_active', true).maybeSingle()
    : { data: null }

  const idempotencyKey = transactionId ? `c2b:confirmation:${transactionId}` : `c2b:confirmation:${crypto.randomUUID()}`
  const { data: prior } = await supabaseAdmin.from('mpesa_callback_events').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle()
  if (prior?.status === 'processed' || prior?.status === 'duplicate') {
    return NextResponse.json({ ResultCode: '0', ResultDesc: 'Received' })
  }

  const { data: event } = await supabaseAdmin.from('mpesa_callback_events').insert({
    connection_id: connection?.id || null,
    workspace_id: connection?.workspace_id || null,
    event_type: 'c2b.confirmation',
    idempotency_key: idempotencyKey,
    shortcode,
    payload: body,
    status: connection ? 'received' : 'rejected',
  }).select('id').maybeSingle()

  if (!connection) {
    return NextResponse.json({ ResultCode: '01', ResultDesc: 'Unknown shortcode' }, { status: 200 })
  }

  const forwarded = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  })

  const response = await legacyConfirmation(forwarded)
  const responsePayload = await response.clone().json().catch(() => ({}))
  await supabaseAdmin.from('mpesa_callback_events').update({
    status: response.ok ? 'processed' : 'failed',
    response_payload: responsePayload,
    processed_at: new Date().toISOString(),
  }).eq('id', event?.id || '')

  return response
}
