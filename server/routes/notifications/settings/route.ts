import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'

async function getWorkspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function GET() {
  const ws = await getWorkspaceId()
  if (!ws) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const { data } = await db.from('notification_settings').select('*').eq('workspace_id', ws).order('channel').order('event_type')
  const { data: wsRow } = await db.from('payment_workspaces').select('notification_sms,notification_email,notification_whatsapp').eq('id', ws).maybeSingle()
  return NextResponse.json({ data: data || [], legacy: wsRow })
}

export async function POST(request: NextRequest) {
  const ws = await getWorkspaceId()
  if (!ws) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const body = await request.json()
  const channel = String(body?.channel || '').trim()
  const eventType = String(body?.event_type || '').trim()
  const enabled = Boolean(body?.enabled)
  const rate = Number(body?.rate_limit_per_min ?? 10)
  if (!['sms','email','whatsapp','push'].includes(channel) || !eventType) return NextResponse.json({ error: 'channel and event_type required' }, { status: 400 })
  if (!Number.isFinite(rate) || rate < 1 || rate > 1000) return NextResponse.json({ error: 'rate_limit_per_min 1-1000' }, { status: 400 })
  const { data, error } = await db.from('notification_settings').upsert({ workspace_id: ws, channel, event_type: eventType, enabled, rate_limit_per_min: Math.trunc(rate) } as any, { onConflict: 'workspace_id,channel,event_type' }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  return POST(request)
}
