import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const status = params.get('status') || ''
  const limit = Math.min(Math.max(Number(params.get('limit') || 100), 1), 100)
  let query = supabaseAdmin.from('payment_notification_events').select('*').eq('workspace_id', workspaceId).eq('channel', 'sms').order('created_at', { ascending: false }).limit(limit)
  if (['pending', 'sent', 'failed', 'skipped'].includes(status)) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load SMS delivery history.' }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
