import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, requirePlatformAdmin, requirePlatformAdminDatabase } from '@/lib/platform-admin'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Merchant id is required.' }, { status: 400 })

  let degraded = false
  let workspace: Record<string, unknown> | null = null

  const summaryQuery = await db.from('platform_admin_workspace_summaries').select('*').eq('id', id).maybeSingle()
  if (!summaryQuery.error && summaryQuery.data) {
    workspace = summaryQuery.data
  } else {
    if (isDatabaseConnectionError(summaryQuery.error)) {
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    degraded = true
    const base = await db.from('payment_workspaces').select('*').eq('id', id).maybeSingle()
    if (base.error) {
      if (isDatabaseConnectionError(base.error)) {
        return NextResponse.json(
          { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Unable to load merchant workspace.' }, { status: 500 })
    }
    if (!base.data) return NextResponse.json({ error: 'Merchant workspace not found.' }, { status: 404 })
    workspace = base.data
  }

  const [transactions, exceptions, activations, connections, audit, keys] = await Promise.all([
    db.from('payment_transactions').select('*').eq('workspace_id', id).order('created_at', { ascending: false }).limit(100),
    db.from('payment_reconciliation_exceptions').select('*').eq('workspace_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('mpesa_activation_requests').select('*').eq('workspace_id', id).order('requested_at', { ascending: false }).limit(20),
    db.from('mpesa_connections').select('id,shortcode,account_type,environment,credential_source,connection_status,token_status,callback_status,is_primary,is_active,last_tested_at,last_error,created_at').eq('workspace_id', id).order('is_primary', { ascending: false }),
    db.from('payment_audit_logs').select('id,action,resource_type,resource_id,metadata,created_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(30),
    db.from('payment_api_keys').select('*', { count: 'exact', head: true }).eq('workspace_id', id),
  ])

  let adminAudit: unknown[] = []
  const adminAuditQuery = await db
    .from('platform_admin_audit_logs')
    .select('id,actor_name,action,target_type,target_id,metadata,created_at')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (!adminAuditQuery.error) adminAudit = adminAuditQuery.data || []
  else degraded = true

  return NextResponse.json({
    success: true,
    degraded,
    data: {
      merchant: workspace,
      summary: {
        transaction_count: Number((workspace as any)?.transaction_count || 0),
        success_count: Number((workspace as any)?.success_count || 0),
        failed_count: Number((workspace as any)?.failed_count || 0),
        pending_count: Number((workspace as any)?.pending_count || 0),
        volume: Number((workspace as any)?.volume || 0),
        open_exceptions: Number((workspace as any)?.open_exceptions || 0),
        api_keys: keys.count || 0,
      },
      transactions: transactions.data || [],
      exceptions: exceptions.data || [],
      activations: activations.data || [],
      connections: connections.data || [],
      audit: audit.data || [],
      admin_audit: adminAudit,
      fetched_at: new Date().toISOString(),
    },
  })
}
