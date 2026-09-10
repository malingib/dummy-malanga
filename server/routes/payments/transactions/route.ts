import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function workspaceId() {
  return (await cookies()).get('mobiwave_workspace_id')?.value || null
}

export async function GET(request: NextRequest) {
  try {
    const id = await workspaceId()
    if (!id) return NextResponse.json({ error: 'Payment workspace not configured.', data: [] }, { status: 401 })

    const params = request.nextUrl.searchParams
    const search = params.get('search')?.trim() || ''
    const status = params.get('status') || ''
    const reconciliation = params.get('reconciliation') || ''
    const from = params.get('from') || ''
    const to = params.get('to') || ''
    const limitRaw = Number(params.get('limit') || 50)
    const offsetRaw = Number(params.get('offset') || 0)
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100)
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0)

    let query = supabaseAdmin.from('payment_transactions').select('*', { count: 'exact' }).eq('workspace_id', id).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (status && ['pending', 'success', 'failed', 'reversed'].includes(status)) query = query.eq('status', status)
    if (reconciliation && ['unreconciled', 'matched', 'unmatched', 'duplicate', 'manual'].includes(reconciliation)) query = query.eq('reconciliation_status', reconciliation)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lt('created_at', to)
    if (search) query = query.or(`phone_number.ilike.%${search}%,reference.ilike.%${search}%,transaction_id.ilike.%${search}%,mpesa_receipt.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [], count: count || 0, limit, offset })
  } catch (error) {
    console.error('[payments/transactions] GET error:', error)
    return NextResponse.json({ error: 'Unable to load payment transactions.', data: [] }, { status: 500 })
  }
}
