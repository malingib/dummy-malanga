import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value || null
    if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })

    const [{ data: connections, error: connectionError }, { data: health, error: healthError }] = await Promise.all([
      supabaseAdmin
        .from('mpesa_callback_health')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('shortcode'),
      supabaseAdmin
        .from('mpesa_workspace_callback_health')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle(),
    ])

    if (connectionError) throw connectionError
    if (healthError) throw healthError

    return NextResponse.json({ success: true, data: { health, connections: connections || [] } })
  } catch (error) {
    console.error('[mpesa/health] GET error:', error)
    return NextResponse.json({ error: 'Unable to load M-Pesa health.' }, { status: 500 })
  }
}
