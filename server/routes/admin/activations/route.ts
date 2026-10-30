import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, recordPlatformAdminAudit, requirePlatformAdmin, requirePlatformAdminDatabase } from '@/lib/platform-admin'

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

async function workspaceRows(ids: string[]) {
  if (!ids.length) return new Map<string, any>()
  const { data } = await db.from('payment_workspaces').select('id,business_name,shortcode,environment,status').in('id', ids)
  return new Map<string, any>((data || []).map((row: any): [string, any] => [String(row.id), row]))
}

async function enrich(rows: any[]) {
  const map = await workspaceRows(Array.from(new Set(rows.map((row) => row.workspace_id).filter(Boolean))))
  return rows.map((row) => ({
    ...row,
    business_name: map.get(row.workspace_id)?.business_name || 'Unknown merchant',
    shortcode: map.get(row.workspace_id)?.shortcode || null,
    merchant_environment: map.get(row.workspace_id)?.environment || row.environment,
    merchant_status: map.get(row.workspace_id)?.status || null,
  }))
}

const actions: Record<string, { status: string; reviewed?: boolean; completed?: boolean; workspaceStatus?: string }> = {
  start_review: { status: 'reviewing', reviewed: true },
  request_credentials: { status: 'credentials_required', reviewed: true },
  mark_testing: { status: 'testing', reviewed: true },
  approve: { status: 'live', reviewed: true, completed: true, workspaceStatus: 'live' },
  block: { status: 'blocked', reviewed: true },
  cancel: { status: 'cancelled', reviewed: true, completed: true },
  reopen: { status: 'reviewing', reviewed: true },
}

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const params = request.nextUrl.searchParams
  const status = params.get('status') || ''
  const environment = params.get('environment') || ''
  const limit = clampInt(params.get('limit'), 100, 1, 200)

  try {
    let query = db.from('mpesa_activation_requests').select('*', { count: 'exact' })
    if (status) query = query.eq('status', status)
    if (environment) query = query.eq('environment', environment)
    const { data, count, error } = await query.order('requested_at', { ascending: false }).limit(limit)
    if (error) throw error
    return NextResponse.json({ success: true, data: await enrich(data || []), count: count || 0, limit })
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    console.error('[platform-admin] activations failed:', error)
    return NextResponse.json({ error: 'Unable to load activation requests.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const body = await request.json().catch(() => ({}))
  const id = String(body?.id || '').trim()
  const action = String(body?.action || '').trim()
  const transition = actions[action]
  if (!id) return NextResponse.json({ error: 'Activation request id is required.' }, { status: 400 })
  if (!transition) return NextResponse.json({ error: 'Unsupported activation action.' }, { status: 400 })

  const { data: current, error: currentError } = await db
    .from('mpesa_activation_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (currentError) return NextResponse.json({ error: 'Unable to load the activation request.' }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Activation request not found.' }, { status: 404 })
  if (current.status === 'cancelled' && action !== 'reopen') {
    return NextResponse.json({ error: 'Cancelled requests must be reopened before they can be reviewed.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: transition.status,
    last_error: action === 'block' ? String(body?.note || 'Blocked by platform administration.').slice(0, 1000) : null,
  }
  if (transition.reviewed) patch.reviewed_at = now
  if (transition.completed) patch.completed_at = now
  if (body?.note) patch.notes = String(body.note).slice(0, 2000)

  const { data, error } = await db
    .from('mpesa_activation_requests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    console.error('[platform-admin] activation update failed:', error)
    return NextResponse.json({ error: 'Unable to update the activation request.' }, { status: 500 })
  }

  if (transition.workspaceStatus) {
    await db.from('payment_workspaces').update({ status: transition.workspaceStatus }).eq('id', current.workspace_id)
  }

  await recordPlatformAdminAudit({
    action: `activation.${action}`,
    targetType: 'mpesa_activation_request',
    targetId: id,
    workspaceId: current.workspace_id,
    metadata: { previous_status: current.status, next_status: transition.status, note: body?.note || null },
  })

  const [enriched] = await enrich([data])
  return NextResponse.json({ success: true, data: enriched })
}
