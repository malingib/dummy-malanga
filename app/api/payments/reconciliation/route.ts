import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() {
  return (await cookies()).get('mobiwave_workspace_id')?.value || null
}

export async function GET() {
  try {
    const id = await workspaceId()
    if (!id) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const { data, error } = await supabaseAdmin.from('payment_reconciliation_runs').select('*').eq('workspace_id', id).order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('[payments/reconciliation] GET error:', error)
    return NextResponse.json({ error: 'Unable to load reconciliation history.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const id = await workspaceId()
    if (!id) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const end = body?.periodEnd ? new Date(body.periodEnd) : new Date()
    const start = body?.periodStart ? new Date(body.periodStart) : new Date(end.getTime() - 24 * 60 * 60 * 1000)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return NextResponse.json({ error: 'Invalid reconciliation period.' }, { status: 400 })

    const { data, error } = await supabaseAdmin.rpc('reconcile_payment_workspace', { p_workspace_id: id, p_period_start: start.toISOString(), p_period_end: end.toISOString() })
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[payments/reconciliation] POST error:', error)
    return NextResponse.json({ error: 'Reconciliation failed. Check the database migration and try again.' }, { status: 500 })
  }
}
