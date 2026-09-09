import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const shortcode = String(body?.BusinessShortCode || body?.TillNumber || '').trim() || null
  const transactionId = String(body?.TransID || '').trim() || null
  const idempotencyKey = transactionId ? `c2b:validation:${shortcode || 'unknown'}:${transactionId}` : `c2b:validation:${crypto.randomUUID()}`

  const { data: connections } = shortcode
    ? await supabaseAdmin.from('mpesa_connections').select('id,workspace_id,environment').eq('shortcode', shortcode).eq('is_active', true)
    : { data: [] }
  const connection = connections?.find((item) => item.environment === (process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox')) || connections?.[0] || null

  const { data: prior } = await supabaseAdmin.from('mpesa_callback_events').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle()
  if (prior?.status === 'processed' || prior?.status === 'duplicate') return NextResponse.json({ ResultCode: '0', ResultDesc: 'Accepted' })

  const responsePayload = connection ? { ResultCode: '0', ResultDesc: 'Accepted' } : { ResultCode: '1', ResultDesc: 'Unknown shortcode' }
  await supabaseAdmin.from('mpesa_callback_events').insert({
    connection_id: connection?.id || null,
    workspace_id: connection?.workspace_id || null,
    event_type: 'c2b.validation',
    idempotency_key: idempotencyKey,
    shortcode,
    payload: body,
    status: connection ? 'processed' : 'rejected',
    response_payload: responsePayload,
    processed_at: new Date().toISOString(),
  })

  return NextResponse.json(responsePayload)
}
