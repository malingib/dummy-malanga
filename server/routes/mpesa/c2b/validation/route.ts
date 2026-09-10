import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMpesaConnection } from '@/lib/mpesa-connection-resolver'
import { extractC2BIdentifiers, isCallbackBodyTooLarge } from '@/lib/mpesa-callback-rules.mjs'

export async function POST(request: NextRequest) {
  if (isCallbackBodyTooLarge(request.headers.get('content-length'))) {
    return NextResponse.json({ ResultCode: '1', ResultDesc: 'Payload too large' })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ResultCode: '1', ResultDesc: 'Invalid payload' })

  const { shortcode, transactionId } = extractC2BIdentifiers(body)
  let connection = null
  try {
    connection = shortcode ? await resolveMpesaConnection(shortcode) : null
  } catch (error) {
    console.error('[c2b/validation] connection resolution error:', error)
    return NextResponse.json({ ResultCode: '1', ResultDesc: 'Unable to resolve shortcode' })
  }

  const idempotencyKey = transactionId
    ? `c2b:validation:${connection?.id || shortcode || 'unknown'}:${transactionId}`
    : `c2b:validation:${connection?.id || shortcode || 'unknown'}:${crypto.randomUUID()}`

  const { data: prior } = await supabaseAdmin
    .from('mpesa_callback_events')
    .select('id,status,response_payload')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (prior?.status === 'processed' || prior?.status === 'duplicate') {
    return NextResponse.json(prior.response_payload || { ResultCode: '0', ResultDesc: 'Accepted' })
  }

  const responsePayload = connection
    ? { ResultCode: '0', ResultDesc: 'Accepted' }
    : { ResultCode: '1', ResultDesc: 'Unknown shortcode' }

  const { error } = await supabaseAdmin.from('mpesa_callback_events').insert({
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

  if (error && error.code !== '23505') console.error('[c2b/validation] event insert error:', error)
  if (error?.code === '23505') return NextResponse.json({ ResultCode: '0', ResultDesc: 'Accepted' })

  return NextResponse.json(responsePayload)
}
