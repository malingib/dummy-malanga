import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'

export async function GET(request: NextRequest) {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const p = request.nextUrl.searchParams
  const status = p.get('status') || ''
  const channel = p.get('channel') || ''
  const limit = Math.min(Math.max(Number(p.get('limit') || 50), 1), 200)
  let q = db.from('payment_notification_events').select('id,channel,event_type,recipient,status,attempt_count,provider_uid,last_error,created_at,sent_at,dedup_key').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(limit)
  if (['pending','sent','failed','skipped'].includes(status)) q = q.eq('status', status)
  if (channel) q = q.eq('channel', channel)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // attach queue health (Ch20 monitoring)
  const pending = (data || []).filter((r: any) => r.status === 'pending').length
  return NextResponse.json({ data: data || [], queue: { pending, total: data?.length || 0 } })
}
