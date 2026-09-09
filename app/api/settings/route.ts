import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

const editable = new Set(['business_name','business_phone','business_email','industry','account_format','notification_sms','notification_email','notification_whatsapp','developer_webhook','webhook_url'])

export async function GET() {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('payment_workspaces').select('id,business_name,business_phone,business_email,industry,shortcode,account_format,notification_sms,notification_email,notification_whatsapp,developer_webhook,webhook_url,status,environment,created_at,updated_at').eq('id', workspace).maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to load workspace settings.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  return NextResponse.json({ success: true, data })
}

export async function PATCH(request: NextRequest) {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body || {})) if (editable.has(key)) patch[key] = typeof value === 'string' ? value.trim() : value
  if (patch.business_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.business_email))) return NextResponse.json({ error: 'Enter a valid business email.' }, { status: 400 })
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No editable settings supplied.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('payment_workspaces').update(patch).eq('id', workspace).select('id,business_name,business_phone,business_email,industry,shortcode,account_format,notification_sms,notification_email,notification_whatsapp,developer_webhook,webhook_url,status,environment,created_at,updated_at').single()
  if (error) return NextResponse.json({ error: 'Unable to update workspace settings.' }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
