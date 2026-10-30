import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, requirePlatformAdmin, requirePlatformAdminDatabase } from '@/lib/platform-admin'

function cleanSearch(value: string | null) {
  return (value || '').replace(/[,()]/g, ' ').trim()
}

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

async function fallbackMerchants(search: string, status: string, environment: string, limit: number, offset: number) {
  let query = db.from('payment_workspaces').select('*', { count: 'exact' })
  if (status) query = query.eq('status', status)
  if (environment) query = query.eq('environment', environment)
  if (search) query = query.or(`business_name.ilike.%${search}%,business_email.ilike.%${search}%,shortcode.ilike.%${search}%`)
  const { data: workspaces, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw error

  const ids = (workspaces || []).map((row: any) => row.id)
  const [transactions, exceptions, connections, activations] = ids.length
    ? await Promise.all([
        db.from('payment_transactions').select('workspace_id,status,amount,created_at').in('workspace_id', ids).order('created_at', { ascending: false }).limit(5000),
        db.from('payment_reconciliation_exceptions').select('workspace_id,status').in('workspace_id', ids).in('status', ['open', 'in_review']).limit(5000),
        db.from('mpesa_connections').select('workspace_id,connection_status,callback_status,last_tested_at,is_primary').in('workspace_id', ids).eq('is_active', true).limit(500),
        db.from('mpesa_activation_requests').select('workspace_id,status,requested_at').in('workspace_id', ids).not('status', 'in', '(cancelled)').order('requested_at', { ascending: false }).limit(500),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as any

  const txGroups = new Map<string, any[]>()
  for (const row of transactions.data || []) {
    const group = txGroups.get(row.workspace_id) || []
    group.push(row)
    txGroups.set(row.workspace_id, group)
  }
  const exceptionGroups = new Map<string, number>()
  for (const row of exceptions.data || []) exceptionGroups.set(row.workspace_id, (exceptionGroups.get(row.workspace_id) || 0) + 1)
  const connectionMap = new Map<string, any>()
  for (const row of connections.data || []) if (!connectionMap.has(row.workspace_id) || row.is_primary) connectionMap.set(row.workspace_id, row)
  const activationMap = new Map<string, any>()
  for (const row of activations.data || []) if (!activationMap.has(row.workspace_id)) activationMap.set(row.workspace_id, row)

  const data = (workspaces || []).map((workspace: any) => {
    const rows = txGroups.get(workspace.id) || []
    const success = rows.filter((row) => row.status === 'success')
    const connection = connectionMap.get(workspace.id)
    const activation = activationMap.get(workspace.id)
    return {
      ...workspace,
      transaction_count: rows.length,
      success_count: success.length,
      failed_count: rows.filter((row) => row.status === 'failed').length,
      pending_count: rows.filter((row) => row.status === 'pending').length,
      volume: success.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      last_payment_at: rows[0]?.created_at || null,
      connection_status: connection?.connection_status || null,
      callback_status: connection?.callback_status || null,
      last_tested_at: connection?.last_tested_at || null,
      activation_status: activation?.status || null,
      activation_requested_at: activation?.requested_at || null,
      open_exceptions: exceptionGroups.get(workspace.id) || 0,
    }
  })

  return { success: true, data, count: count || 0, limit, offset, degraded: true, degraded_reason: 'Aggregates use the most recent 5,000 payment rows. Apply migration 018 for the platform summary view.' }
}

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const params = request.nextUrl.searchParams
  const search = cleanSearch(params.get('q'))
  const status = params.get('status') || ''
  const environment = params.get('environment') || ''
  const limit = clampInt(params.get('limit'), 100, 1, 100)
  const offset = clampInt(params.get('offset'), 0, 0, 100000)

  try {
    let query = db.from('platform_admin_workspace_summaries').select('*', { count: 'exact' })
    if (status) query = query.eq('status', status)
    if (environment) query = query.eq('environment', environment)
    if (search) query = query.or(`business_name.ilike.%${search}%,business_email.ilike.%${search}%,shortcode.ilike.%${search}%`)
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [], count: count || 0, limit, offset, degraded: false })
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[platform-admin] merchant directory database unreachable:', error instanceof Error ? error.message : error)
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    console.warn('[platform-admin] summary view unavailable, using fallback:', error instanceof Error ? error.message : error)
    try {
      return NextResponse.json(await fallbackMerchants(search, status, environment, limit, offset))
    } catch (fallbackError) {
      console.error('[platform-admin] merchants failed:', fallbackError)
      return NextResponse.json({ error: 'Unable to load merchant workspaces.' }, { status: 500 })
    }
  }
}
