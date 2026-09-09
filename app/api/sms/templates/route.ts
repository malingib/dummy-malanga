import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function getWorkspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('payment_sms_templates').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load SMS templates.' }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  try {
    const body = await request.json()
    const name = String(body?.name || '').trim()
    const message = String(body?.message || '').trim()
    const senderId = String(body?.sender_id || 'MobiWave').trim()
    if (!name || !message) return NextResponse.json({ error: 'Template name and message are required.' }, { status: 400 })
    if (name.length > 80 || message.length > 480 || senderId.length > 20) return NextResponse.json({ error: 'Template or sender ID is too long.' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('payment_sms_templates').insert({ workspace_id: workspaceId, name, message, sender_id: senderId, event_type: 'payment.receipt' }).select('*').single()
    if (error) return NextResponse.json({ error: error.code === '23505' ? 'A template with this name already exists.' : 'Unable to create SMS template.' }, { status: 400 })
    return NextResponse.json({ data }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Invalid template request.' }, { status: 400 }) }
}
