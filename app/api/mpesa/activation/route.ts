import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function GET() {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('mpesa_activation_requests').select('*').eq('workspace_id', workspace).order('requested_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load activation status.' }, { status: 500 })
  return NextResponse.json({ success: true, data: data || null })
}

export async function POST(request: NextRequest) {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const { data: ws } = await supabaseAdmin.from('payment_workspaces').select('environment,payment_methods').eq('id', workspace).maybeSingle()
  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  const { data: existing } = await supabaseAdmin.from('mpesa_activation_requests').select('id,status').eq('workspace_id', workspace).not('status', 'in', '(live,cancelled)').maybeSingle()
  if (existing) return NextResponse.json({ success: true, data: existing })
  const { data, error } = await supabaseAdmin.from('mpesa_activation_requests').insert({ workspace_id: workspace, environment: ws.environment || 'sandbox', requested_methods: ws.payment_methods || [], notes: String(body?.notes || '').slice(0, 1000) || null }).select('*').single()
  if (error) return NextResponse.json({ error: 'Unable to create activation request.' }, { status: 500 })
  await supabaseAdmin.from('payment_workspaces').update({ status: 'ready_for_credentials' }).eq('id', workspace)
  return NextResponse.json({ success: true, data }, { status: 201 })
}
