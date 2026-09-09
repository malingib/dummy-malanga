import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const shortcode = String(body?.BusinessShortCode || body?.TillNumber || '').trim() || null
  const transactionId = String(body?.TransID || '').trim() || null
  const idempotencyKey = transactionId ? `c2b:validation:${transactionId}` : `c2b:validation:${crypto.randomUUID()}`

  const { data: connection } = shortcode
    ? await supabaseAdmin.from('mpesa_connections').select('id,workspace_id').eq('shortcode', shortcode).eq('environment', process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox').eq('is_active', true).maybeSingle()
    : { data: null }

  const { data: prior } = await supabaseAdmin.from('mpesa_callback_events').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle()
  if (prior?.status === 'processed' || prior?.status === 'duplicate') {
    return NextResponse.json({ ResultCode: '0', ResultDesc: 'Accepted' })
  }

  await supabaseAdmin.from('mpesa_callback_events').insert({
    connection_id: connection?.id || null,
    workspace_id: connection?.workspace_id || null,
    event_type: 'c2b.validation',
    idempotency_key: idempotencyKey,
    shortcode,
    payload: body,
    status: connection ? 'processed' : 'rejected',
    response_payload: connection ? { ResultCode: '0', ResultDesc: 'Accepted' } : { ResultCode: '1', ResultDesc: 'Unknown shortcode' },
    processed_at: new Date().toISOString(),
  })

  if (!connection) return NextResponse.json({ ResultCode: '1', ResultDesc: 'Unknown shortcode' })
  return NextResponse.json({ ResultCode: '0', ResultDesc: 'Accepted' })
}
