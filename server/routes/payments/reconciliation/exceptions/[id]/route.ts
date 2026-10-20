import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeWorkspace } from '@/lib/workspace-auth'

const allowedStatuses = new Set(['open', 'in_review', 'resolved', 'ignored'])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeWorkspace(request)
    if (!access) return NextResponse.json({ error: 'Authentication or workspace access required.' }, { status: 401 })
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'Invalid exception status.' }, { status: 400 })
      patch.status = status
      patch.resolved_at = status === 'resolved' || status === 'ignored' ? new Date().toISOString() : null
    }
    if (body.resolution_note !== undefined) {
      patch.resolution_note = body.resolution_note == null ? null : String(body.resolution_note).trim().slice(0, 2000)
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No supported changes supplied.' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('payment_reconciliation_exceptions')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', access.workspaceId)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[reconciliation/exceptions/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Unable to update reconciliation exception.' }, { status: 500 })
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Reconciliation exceptions are retained for audit. Mark the exception as ignored instead.' },
    { status: 405, headers: { Allow: 'PATCH' } },
  )
}
