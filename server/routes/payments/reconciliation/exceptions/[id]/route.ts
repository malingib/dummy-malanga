import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await workspaceId()
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const allowed = ['status', 'severity', 'assigned_to', 'resolution_note', 'reason', 'title'] as const
    const patch: Record<string, unknown> = {}
    for (const key of allowed) if (body[key] !== undefined) patch[key] = body[key]
    if (body.status === 'resolved') patch.resolved_at = new Date().toISOString()
    if (body.status && body.status !== 'resolved') patch.resolved_at = null
    const { data, error } = await supabaseAdmin.from('payment_reconciliation_exceptions').update(patch).eq('id', id).eq('workspace_id', workspace).select('*').single()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[reconciliation/exceptions/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Unable to update reconciliation exception.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const workspace = await workspaceId()
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const { id } = await params
    const { error } = await supabaseAdmin.from('payment_reconciliation_exceptions').delete().eq('id', id).eq('workspace_id', workspace)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[reconciliation/exceptions/:id] DELETE error:', error)
    return NextResponse.json({ error: 'Unable to delete reconciliation exception.' }, { status: 500 })
  }
}
