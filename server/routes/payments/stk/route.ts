import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'
import { assertProductionPaymentBoundary } from '@/lib/regulatory'
import { formatPhoneNumber, initiateStkPush, isValidPhoneNumber, parseAmountString } from '@/lib/mpesa'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
    if (!workspaceId) return NextResponse.json({ error: 'Complete M-Pesa onboarding first.' }, { status: 400 })
    const { data: workspace, error } = await db.from('payment_workspaces').select('id,shortcode,payment_methods,environment,status').eq('id', workspaceId).single()
    if (error || !workspace) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 404 })
    assertProductionPaymentBoundary(workspace.environment)
    if (!workspace.payment_methods?.includes('stk')) return NextResponse.json({ error: 'STK Push is not enabled for this workspace.' }, { status: 400 })
    const body = await request.json()
    const phone = String(body?.phone || '')
    const amountInput = body?.amount
    const reference = String(body?.reference || 'PAYMENT').trim()
    const description = String(body?.description || 'Mobiwave payment').trim()
    if (!isValidPhoneNumber(phone)) return NextResponse.json({ error: 'Enter a valid Kenyan phone number.' }, { status: 400 })
    const parsedAmount = parseAmountString(amountInput)
    if (!parsedAmount.ok) return NextResponse.json({ error: parsedAmount.error }, { status: 400 })
    const amount = parsedAmount.numeric
    const amountString = parsedAmount.value
    if (!/^[A-Za-z0-9 _.-]{1,12}$/.test(reference)) return NextResponse.json({ error: 'Reference must be 1–12 letters, numbers, spaces, dots, hyphens or underscores.' }, { status: 400 })

    // Idempotency: if client sends Idempotency-Key, deduplicate via payment_idempotency_keys (Ch26 exactly-once)
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() || request.headers.get('x-idempotency-key')?.trim() || null
    let requestHash: string | null = null
    if (idempotencyKey) {
      if (idempotencyKey.length > 128) return NextResponse.json({ error: 'Idempotency-Key must be 128 characters or fewer.' }, { status: 400 })
      requestHash = createHash('sha256').update(JSON.stringify({ phone: formatPhoneNumber(phone), amount: amountString, reference, description })).digest('hex')
      const { data: existing } = await db.from('payment_idempotency_keys').select('request_hash,response_status,response_body').eq('workspace_id', workspace.id).eq('idempotency_key', idempotencyKey).maybeSingle()
      if (existing) {
        if (existing.request_hash !== requestHash) return NextResponse.json({ error: 'Idempotency key was already used with a different request.' }, { status: 409 })
        return NextResponse.json(existing.response_body, { status: existing.response_status })
      }
    }

    const callbackUrl = `${request.nextUrl.origin}/api/mpesa/stk/callback`
    const result = await initiateStkPush(workspace.shortcode, formatPhoneNumber(phone), amount, reference, description, callbackUrl)
    const { data: transaction, error: transactionError } = await db.from('payment_transactions').insert({ workspace_id: workspace.id, transaction_type: 'stk', phone_number: formatPhoneNumber(phone), amount, reference, status: 'pending', transaction_id: result.CheckoutRequestID || null, raw_payload: result }).select('id,transaction_id,status,amount,reference').single()
    if (transactionError) throw transactionError
    const responseBody = { success: true, data: result, transaction }
    if (idempotencyKey && requestHash) {
      await db.from('payment_idempotency_keys').insert({ workspace_id: workspace.id, idempotency_key: idempotencyKey, request_hash: requestHash, response_status: 200, response_body: responseBody })
    }
    return NextResponse.json(responseBody)
  } catch (error: any) {
    console.error('[stk] error:', error)
    const message = error instanceof Error ? error.message : error?.response?.data?.errorMessage || 'Unable to initiate STK Push.'
    const status = message.includes('Production payment initiation is disabled') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
