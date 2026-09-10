import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('payment_transactions').select('*').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load payment.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
  const { data: notifications } = await supabaseAdmin.from('payment_notification_events').select('id,channel,event_type,recipient,status,provider_uid,error_message,created_at,sent_at').eq('workspace_id', workspaceId).eq('transaction_id', id).order('created_at', { ascending: false })
  return NextResponse.json({ data, notifications: notifications || [] })
}
