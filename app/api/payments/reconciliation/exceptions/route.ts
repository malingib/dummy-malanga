import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }

export async function GET(request: NextRequest) {
  try {
    const id = await workspaceId()
    if (!id) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    let query = supabaseAdmin.from('payment_reconciliation_exceptions').select('*, payment_transactions(id, amount, phone_number, reference, status, mpesa_receipt, transaction_id, created_at)').eq('workspace_id', id).order('created_at', { ascending: false }).limit(100)
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
    const id = await workspaceId()
    if (!id) return NextResponse.json({ error: 'Payment workspace not configured.' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const { data, error } = await supabaseAdmin.from('payment_reconciliation_exceptions').insert({ workspace_id: id, transaction_id: body.transactionId || null, type: body.type || 'manual_review', severity: body.severity || 'medium', title: body.title || 'Manual reconciliation review', reason: body.reason || null, amount: body.amount ?? null }).select('*').single()
    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('[reconciliation/exceptions] POST error:', error)
    return NextResponse.json({ error: 'Unable to create reconciliation exception.' }, { status: 500 })
  }
}
