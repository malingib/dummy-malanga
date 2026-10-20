import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authorizeWorkspace } from '@/lib/workspace-auth'

const allowedStatuses = new Set(['open', 'in_review', 'resolved', 'ignored'])
const allowedTypes = new Set(['unmatched', 'amount_mismatch', 'duplicate', 'missing_reference', 'manual_review', 'provider_mismatch'])
const allowedSeverities = new Set(['low', 'medium', 'high', 'critical'])

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeWorkspace(request)
    if (!access) return NextResponse.json({ error: 'Authentication or workspace access required.' }, { status: 401 })
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    if (status && !allowedStatuses.has(status)) return NextResponse.json({ error: 'Invalid exception status.' }, { status: 400 })
    if (type && !allowedTypes.has(type)) return NextResponse.json({ error: 'Invalid exception type.' }, { status: 400 })

    let query = supabaseAdmin
      .from('payment_reconciliation_exceptions')
      .select('*, payment_transactions(id, amount, phone_number, reference, status, mpesa_receipt, transaction_id, connection_id, shortcode, account_type, created_at)')
      .eq('workspace_id', access.workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('[reconciliation/exceptions] GET error:', error)
    return NextResponse.json({ error: 'Unable to load reconciliation exceptions.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeWorkspace(request)
    if (!access) return NextResponse.json({ error: 'Authentication or workspace access required.' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const type = String(body?.type || 'manual_review')
    const severity = String(body?.severity || 'medium')
    const title = String(body?.title || 'Manual reconciliation review').trim().slice(0, 180)
    const reason = body?.reason == null ? null : String(body.reason).trim().slice(0, 2000)
    const amount = body?.amount == null ? null : Number(body.amount)
    if (!allowedTypes.has(type)) return NextResponse.json({ error: 'Invalid exception type.' }, { status: 400 })
    if (!allowedSeverities.has(severity)) return NextResponse.json({ error: 'Invalid exception severity.' }, { status: 400 })
    if (!title) return NextResponse.json({ error: 'Exception title is required.' }, { status: 400 })
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return NextResponse.json({ error: 'Invalid exception amount.' }, { status: 400 })

    const transactionId = body?.transactionId == null ? null : String(body.transactionId)
    if (transactionId) {
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('payment_transactions')
        .select('id')
        .eq('id', transactionId)
        .eq('workspace_id', access.workspaceId)
        .maybeSingle()
      if (transactionError) throw transactionError
      if (!transaction) return NextResponse.json({ error: 'Transaction not found in this workspace.' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('payment_reconciliation_exceptions')
      .insert({ workspace_id: access.workspaceId, transaction_id: transactionId, type, severity, title, reason, amount, status: 'open' })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[reconciliation/exceptions] POST error:', error)
    return NextResponse.json({ error: 'Unable to create reconciliation exception.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await authorizeWorkspace(request)
    if (!access) return NextResponse.json({ error: 'Authentication or workspace access required.' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const exceptionId = String(body?.id || '').trim()
    const status = String(body?.status || '').trim()
    if (!exceptionId) return NextResponse.json({ error: 'Exception id is required.' }, { status: 400 })
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: 'Invalid exception status.' }, { status: 400 })
    const resolutionNote = body?.resolution_note == null ? null : String(body.resolution_note).trim().slice(0, 2000)
    const patch: Record<string, unknown> = { status, resolution_note: resolutionNote }
    patch.resolved_at = status === 'resolved' || status === 'ignored' ? new Date().toISOString() : null
    const { data, error } = await supabaseAdmin
      .from('payment_reconciliation_exceptions')
      .update(patch)
      .eq('id', exceptionId)
      .eq('workspace_id', access.workspaceId)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[reconciliation/exceptions] PATCH error:', error)
    return NextResponse.json({ error: 'Unable to update reconciliation exception.' }, { status: 500 })
  }
}
