import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { authenticateApiKey } from '@/lib/api-auth'
import { initiateB2CPayout } from '@/lib/b2c'

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request, 'payments:write')
  if (auth instanceof NextResponse) return auth
  const idempotencyKey = request.headers.get('idempotency-key')?.trim()
  if (!idempotencyKey || idempotencyKey.length > 128) return NextResponse.json({ error: 'Idempotency-Key header is required and must be 128 characters or fewer.' }, { status: 400 })
  try {
    const body = await request.json()
    const phone = String(body?.phone || '')
    const reference = String(body?.reference || body?.accountReference || 'PAYOUT').trim()
    const commandId = String(body?.commandId || 'BusinessPayment').trim()
    const { data: workspace } = await db.from('payment_workspaces').select('id,environment,status').eq('id', auth.workspaceId).maybeSingle()
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 404 })
    if (workspace.status !== 'active' && workspace.status !== 'ready_for_credentials') return NextResponse.json({ error: 'Payment workspace is not ready.' }, { status: 409 })

    const result = await initiateB2CPayout({
      workspaceId: auth.workspaceId,
      phone,
      amountInput: body?.amount,
      reference,
      commandId,
      idempotencyKey,
      environment: workspace.environment,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    const message = error?.message || 'Unable to initiate B2C payout.'
    const status = message.includes('Production payment initiation is disabled') ? 503 : message.includes('Idempotency key was already used') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
