import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, recordPlatformAdminAudit, requirePlatformAdmin, requirePlatformAdminDatabase } from '@/lib/platform-admin'

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

async function workspaceMap(ids: string[]) {
  if (!ids.length) return new Map<string, any>()
  const { data } = await db.from('payment_workspaces').select('id,business_name,shortcode,environment').in('id', ids)
  return new Map<string, any>((data || []).map((row: any): [string, any] => [String(row.id), row]))
}

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const params = request.nextUrl.searchParams
  const status = params.get('status') || ''
  const severity = params.get('severity') || ''
  const workspaceId = params.get('workspace_id') || ''
  const limit = clampInt(params.get('limit'), 100, 1, 200)

  try {
    let query = db.from('payment_reconciliation_exceptions').select('*', { count: 'exact' })
    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    if (workspaceId) query = query.eq('workspace_id', workspaceId)
    const { data, count, error } = await query.order('created_at', { ascending: false }).limit(limit)
    if (error) throw error

    const map = await workspaceMap(Array.from(new Set((data || []).map((row: any) => row.workspace_id).filter(Boolean))))
    return NextResponse.json({
      success: true,
      data: (data || []).map((row: any) => ({
        ...row,
        business_name: map.get(row.workspace_id)?.business_name || 'Unknown merchant',
        shortcode: map.get(row.workspace_id)?.shortcode || null,
        environment: map.get(row.workspace_id)?.environment || null,
      })),
      count: count || 0,
      limit,
    })
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    console.error('[platform-admin] exceptions failed:', error)
    return NextResponse.json({ error: 'Unable to load platform exceptions.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const body = await request.json().catch(() => ({}))
  const id = String(body?.id || '').trim()
  const status = String(body?.status || '').trim()
  if (!id) return NextResponse.json({ error: 'Exception id is required.' }, { status: 400 })
  if (!['open', 'in_review', 'resolved', 'ignored'].includes(status)) {
    return NextResponse.json({ error: 'Choose a valid exception status.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    status,
    resolution_note: body?.resolution_note == null ? null : String(body.resolution_note).slice(0, 2000),
    resolved_at: status === 'resolved' || status === 'ignored' ? new Date().toISOString() : null,
  }

  const { data, error } = await db
    .from('payment_reconciliation_exceptions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('[platform-admin] exception update failed:', error)
    return NextResponse.json({ error: 'Unable to update the exception.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Exception not found.' }, { status: 404 })

  const map = await workspaceMap([data.workspace_id])
  await recordPlatformAdminAudit({
    action: `exception.${status}`,
    targetType: 'reconciliation_exception',
    targetId: id,
    workspaceId: data.workspace_id,
    metadata: { previous_status: body?.previous_status || null, resolution_note: patch.resolution_note },
  })

  return NextResponse.json({
    success: true,
    data: {
      ...data,
      business_name: map.get(data.workspace_id)?.business_name || 'Unknown merchant',
      shortcode: map.get(data.workspace_id)?.shortcode || null,
      environment: map.get(data.workspace_id)?.environment || null,
    },
  })
}
