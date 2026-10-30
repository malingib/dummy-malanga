import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'

async function ws() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function GET(request: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const channel = request.nextUrl.searchParams.get('channel') || ''
  let q = db.from('notification_templates').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (channel) q = q.eq('channel', channel)
  const { data } = await q
  // also include legacy sms templates for compat
  const { data: legacy } = await db.from('payment_sms_templates').select('*').eq('workspace_id', workspaceId)
  return NextResponse.json({ data: data || [], legacy: legacy || [] })
}

export async function POST(request: NextRequest) {
  const workspaceId = await ws()
  if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
  const body = await request.json()
  const channel = String(body?.channel || 'sms').trim()
  const eventType = String(body?.event_type || 'payment.receipt').trim()
  const name = String(body?.name || '').trim()
  const content = String(body?.content || body?.message || '').trim()
  const senderId = body?.sender_id ? String(body.sender_id).trim() : null
  if (!['sms','email','whatsapp','push'].includes(channel) || !name || !content) return NextResponse.json({ error: 'channel, name, content required' }, { status: 400 })
  if (content.length > 2000 || name.length > 80) return NextResponse.json({ error: 'content/name too long' }, { status: 400 })
  const { data, error } = await db.from('notification_templates').insert({ workspace_id: workspaceId, channel, event_type: eventType, name, content, sender_id: senderId, status: 'active' } as any).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Template name exists for this channel/event' : error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
