import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, requirePlatformAdmin, requirePlatformAdminDatabase } from '@/lib/platform-admin'

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied
  const unavailable = requirePlatformAdminDatabase()
  if (unavailable) return unavailable

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 100), 1), 200)
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''

  let query = db.from('platform_admin_audit_logs').select('*', { count: 'exact' })
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { data, count, error } = await query.order('created_at', { ascending: false }).limit(limit)

  if (error) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        { error: 'Platform database is unreachable. Check the Neon connection and DATABASE_URL, then refresh.', database_configured: true },
        { status: 503 },
      )
    }
    const missingTable = error.code === '42P01' || /does not exist/i.test(error.message)
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      migration_required: missingTable,
      warning: missingTable ? 'Apply migration 018 to enable the platform admin audit trail.' : 'The platform audit trail is temporarily unavailable.',
    })
  }

  const ids = Array.from(new Set((data || []).map((row: any) => row.workspace_id).filter(Boolean)))
  const { data: workspaces } = ids.length
    ? await db.from('payment_workspaces').select('id,business_name,shortcode').in('id', ids)
    : { data: [] as any[] }
  const map = new Map<string, any>((workspaces || []).map((row: any): [string, any] => [String(row.id), row]))

  return NextResponse.json({
    success: true,
    data: (data || []).map((row: any) => ({
      ...row,
      business_name: row.workspace_id ? map.get(row.workspace_id)?.business_name || 'Unknown merchant' : null,
      shortcode: row.workspace_id ? map.get(row.workspace_id)?.shortcode || null : null,
    })),
    count: count || 0,
    limit,
  })
}
