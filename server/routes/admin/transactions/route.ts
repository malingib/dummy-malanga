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

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const params = request.nextUrl.searchParams
  const search = cleanSearch(params.get('q'))
  const status = params.get('status') || ''
  const reconciliation = params.get('reconciliation') || ''
  const workspaceId = params.get('workspace_id') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const limit = clampInt(params.get('limit'), 50, 1, 100)
  const offset = clampInt(params.get('offset'), 0, 0, 1000000)

  try {
    let query = db.from('payment_transactions').select('*', { count: 'exact' })
    if (workspaceId) query = query.eq('workspace_id', workspaceId)
    if (status && ['pending', 'success', 'failed', 'reversed'].includes(status)) query = query.eq('status', status)
    if (reconciliation && ['unreconciled', 'matched', 'unmatched', 'duplicate', 'manual'].includes(reconciliation)) query = query.eq('reconciliation_status', reconciliation)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lt('created_at', to)
    if (search) query = query.or(`phone_number.ilike.%${search}%,reference.ilike.%${search}%,transaction_id.ilike.%${search}%,mpesa_receipt.ilike.%${search}%`)

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw error

    const workspaceIds = Array.from(new Set((data || []).map((row: any) => row.workspace_id).filter(Boolean)))
    const { data: workspaces } = workspaceIds.length
      ? await db.from('payment_workspaces').select('id,business_name,shortcode,environment').in('id', workspaceIds)
      : { data: [] as any[] }
    const workspaceMap = new Map<string, any>((workspaces || []).map((row: any): [string, any] => [String(row.id), row]))

    return NextResponse.json({
      success: true,
      data: (data || []).map((row: any) => ({
        ...row,
        business_name: workspaceMap.get(row.workspace_id)?.business_name || 'Unknown merchant',
        shortcode: workspaceMap.get(row.workspace_id)?.shortcode || row.shortcode || null,
        environment: workspaceMap.get(row.workspace_id)?.environment || null,
      })),
      count: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    console.error('[platform-admin] transactions failed:', error)
    return NextResponse.json({ error: 'Unable to load platform transactions.' }, { status: 500 })
  }
}
