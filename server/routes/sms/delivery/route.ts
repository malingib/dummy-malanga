import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'

async function workspaceId() {
  return (await cookies()).get('mobiwave_workspace_id')?.value || null
}

function parseLimit(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get('limit') || 100)
  return Math.min(Math.max(Number.isFinite(raw) ? raw : 100, 1), 100)
}

export async function GET(request: NextRequest) {
  try {
    const workspace = await workspaceId()
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })

    const limit = parseLimit(request.nextUrl.searchParams)
    const [smsCount, smsSuccess, smsFailed, deliveriesCount, deliveriesSuccess, deliveriesFailed] = await Promise.all([
      db.from('payment_notification_events').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('channel', 'sms').limit(limit),
      db.from('payment_notification_events').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('channel', 'sms').eq('status', 'sent').limit(limit),
      db.from('payment_notification_events').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('channel', 'sms').eq('status', 'failed').limit(limit),
      db.from('payment_webhook_deliveries').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).limit(limit),
      db.from('payment_webhook_deliveries').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('status', 'delivered').limit(limit),
      db.from('payment_webhook_deliveries').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('status', 'failed').limit(limit),
    ])

    return NextResponse.json({
      data: [],
      queue: {
        sms: {
          total: smsCount.count || 0,
          delivered: smsSuccess.count || 0,
          failed: smsFailed.count || 0,
          state: (smsCount.count || 0) === 0 ? 'unknown' : (smsFailed.count || 0) === 0 ? 'healthy' : 'degraded',
        },
        webhooks: {
          total: deliveriesCount.count || 0,
          delivered: deliveriesSuccess.count || 0,
          failed: deliveriesFailed.count || 0,
          state: (deliveriesCount.count || 0) === 0 ? 'unknown' : (deliveriesFailed.count || 0) === 0 ? 'healthy' : 'degraded',
        },
      },
    })
  } catch (error) {
    console.error('[sms/delivery] GET error:', error)
    return NextResponse.json({ error: 'Unable to load SMS delivery health.' }, { status: 500 })
  }
}
