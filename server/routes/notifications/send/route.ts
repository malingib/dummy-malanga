import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authenticateApiKey } from '@/lib/api-auth'
import { queueNotification } from '@/lib/notifications'

async function getWorkspaceFromCookie() {
  const { cookies: ck } = await import('@/server/http')
  const store = await ck()
  return store.get('mobiwave_workspace_id')?.value || null
}

export async function POST(request: NextRequest) {
  // Allow both cookie (dashboard) and API key (external)
  let workspaceId: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const auth = await authenticateApiKey(request, 'payments:write')
    if (auth instanceof NextResponse) return auth
    workspaceId = (auth as any).workspaceId
  } else {
    workspaceId = await getWorkspaceFromCookie()
    if (!workspaceId) return NextResponse.json({ error: 'Complete M-Pesa onboarding first.' }, { status: 401 })
  }

  const body = await request.json()
  const channel = String(body?.channel || 'sms').trim() as any
  const eventType = String(body?.event_type || 'payment.receipt').trim()
  const recipient = String(body?.recipient || body?.phone || '').trim()
  const priority = body?.priority != null ? Number(body.priority) : 5
  if (!recipient || !eventType) return NextResponse.json({ error: 'recipient and event_type required' }, { status: 400 })

  if (!workspaceId) return NextResponse.json({ error: 'Workspace not resolved.' }, { status: 400 })
  try {
    const res = await queueNotification({
      workspaceId: workspaceId as string,
      transactionId: body?.transaction_id || body?.transactionId || null,
      channel,
      eventType,
      recipient,
      dedupKey: body?.dedup_key || body?.dedupKey || undefined,
      priority: Number.isFinite(priority) ? Math.min(10, Math.max(1, priority)) : 5,
      templateId: body?.template_id || body?.templateId || null,
      metadata: body?.metadata || { amount: body?.amount, reference: body?.reference, receipt: body?.receipt },
      variables: body?.variables,
    })
    if (res.skipped) return NextResponse.json({ success: true, skipped: res.skipped, id: res.id }, { status: 202 })
    if (res.deduped) return NextResponse.json({ success: true, deduped: true, id: res.id })
    return NextResponse.json({ success: true, id: res.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unable to queue notification' }, { status: 400 })
  }
}
