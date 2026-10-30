import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/neon'
import { isDatabaseConnectionError, platformAdminDatabaseConfigured, requirePlatformAdmin } from '@/lib/platform-admin'

type HealthState = 'ok' | 'warning' | 'unknown'

function healthCheck(label: string, value: string, state: HealthState, detail: string) {
  return { label, value, state, detail }
}

type DatabaseState = 'ok' | 'unconfigured' | 'unreachable'

function platformHealth(databaseState: DatabaseState = 'ok') {
  const darajaConfigured = Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY)
  const productionReady = process.env.MOBIPAY_OPERATING_MODE === 'partner_psp' && process.env.PSP_LICENSE_STATUS === 'verified' && Boolean(process.env.PSP_PROVIDER_ID)
  const webhookConfigured = Boolean(process.env.WEBHOOK_ENCRYPTION_KEY)
  const smsConfigured = Boolean(process.env.MOBIWAVE_SMS_API_TOKEN)
  const schedulerConfigured = Boolean(process.env.CRON_SECRET)
  return [
    healthCheck(
      'Platform database',
      databaseState === 'ok' ? 'Reachable' : databaseState === 'unconfigured' ? 'Not configured' : 'Unreachable',
      databaseState === 'ok' ? 'ok' : 'warning',
      databaseState === 'ok'
        ? 'Admin queries completed against the Neon PostgreSQL connection.'
        : databaseState === 'unconfigured'
          ? 'Set DATABASE_URL on the API server.'
          : 'The Neon database did not respond within the request timeout.',
    ),
    healthCheck('Daraja credentials', darajaConfigured ? 'Configured' : 'Missing', darajaConfigured ? 'ok' : 'warning', 'Environment-level M-Pesa consumer credentials used for new connections.'),
    healthCheck('Licensed PSP boundary', productionReady ? 'Production ready' : 'Incomplete', productionReady ? 'ok' : 'warning', productionReady ? 'Partner PSP mode, verified licence and provider id are configured.' : 'Production payments remain gated until MOBIPAY_OPERATING_MODE, PSP_LICENSE_STATUS and PSP_PROVIDER_ID are complete.'),
    healthCheck('Webhook signing', webhookConfigured ? 'Configured' : 'Missing', webhookConfigured ? 'ok' : 'warning', 'Required to encrypt merchant webhook signing secrets and sign deliveries.'),
    healthCheck('SMS provider', smsConfigured ? 'Configured' : 'Missing', smsConfigured ? 'ok' : 'warning', 'MobiWave SMS credentials are read server-side only.'),
    healthCheck('Notification worker', schedulerConfigured ? 'Scheduler configured' : 'Manual only', schedulerConfigured ? 'ok' : 'unknown', 'A cron secret is configured for the notification and webhook workers.'),
  ]
}

function clampDays(value: string | null) {
  const parsed = Number(value || 14)
  if (!Number.isFinite(parsed)) return 14
  return Math.min(Math.max(Math.trunc(parsed), 7), 90)
}

async function countOf(table: string, apply?: (query: any) => any) {
  try {
    let query = db.from(table).select('*', { count: 'exact', head: true })
    if (apply) query = apply(query)
    const { count, error } = await query
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

const dayKey = (value: Date) => {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`
}

function buildSeries(days: number, rows: Array<{ amount?: number | string | null; status?: string | null; created_at: string }>) {
  const groups = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = dayKey(new Date(row.created_at))
    const bucket = groups.get(key) || []
    bucket.push(row)
    groups.set(key, bucket)
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (days - 1 - index))
    const bucket = groups.get(dayKey(day)) || []
    const success = bucket.filter((row) => row.status === 'success')
    return {
      date: dayKey(day),
      label: new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short' }).format(day),
      volume: success.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      count: bucket.length,
      success_rate: bucket.length ? Number(((success.length / bucket.length) * 100).toFixed(1)) : 0,
    }
  })
}

function emptyOverview(days: number, degradedReason = 'Platform database is not configured. Set DATABASE_URL on the API server to load merchant and payment data.') {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const merchantSeries = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (13 - index))
    return {
      date: dayKey(day),
      label: new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short' }).format(day),
      value: 0,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    degraded: true,
    degraded_reason: degradedReason,
    sample_size: 0,
    merchants: {
      total: 0,
      live: 0,
      sandbox: 0,
      production: 0,
      new_in_window: 0,
      series: merchantSeries,
    },
    payments: {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      reversed: 0,
      success_rate: 0,
      volume: 0,
      previous_volume: 0,
      volume_change: null,
      sampled_total: 0,
      series: buildSeries(days, []),
    },
    queues: {
      open_exceptions: 0,
      critical_exceptions: 0,
      activation_requests: 0,
      failed_webhooks: 0,
      failed_notifications: 0,
      oldest_activation_at: null,
    },
    recent_merchants: [],
    recent_exceptions: [],
    activation_queue: [],
  }
}

async function fallbackOverview(days: number) {
  const now = new Date()
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const previousStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000)

  const [
    merchantTotal,
    merchantLive,
    merchantSandbox,
    merchantProduction,
    merchantNew,
    paymentTotal,
    paymentSuccess,
    paymentFailed,
    paymentPending,
    paymentReversed,
    openExceptions,
    criticalExceptions,
    activationRequests,
    failedWebhooks,
    failedNotifications,
  ] = await Promise.all([
    countOf('payment_workspaces'),
    countOf('payment_workspaces', (query) => query.eq('status', 'live')),
    countOf('payment_workspaces', (query) => query.eq('environment', 'sandbox')),
    countOf('payment_workspaces', (query) => query.eq('environment', 'production')),
    countOf('payment_workspaces', (query) => query.gte('created_at', currentStart.toISOString())),
    countOf('payment_transactions'),
    countOf('payment_transactions', (query) => query.eq('status', 'success')),
    countOf('payment_transactions', (query) => query.eq('status', 'failed')),
    countOf('payment_transactions', (query) => query.eq('status', 'pending')),
    countOf('payment_transactions', (query) => query.eq('status', 'reversed')),
    countOf('payment_reconciliation_exceptions', (query) => query.in('status', ['open', 'in_review'])),
    countOf('payment_reconciliation_exceptions', (query) => query.in('status', ['open', 'in_review']).eq('severity', 'critical')),
    countOf('mpesa_activation_requests', (query) => query.not('status', 'in', '(live,cancelled)')),
    countOf('payment_webhook_deliveries', (query) => query.eq('status', 'failed')),
    countOf('payment_notification_events', (query) => query.eq('channel', 'sms').eq('status', 'failed')),
  ])

  const { data: recentRows } = await db
    .from('payment_transactions')
    .select('amount,status,created_at')
    .gte('created_at', previousStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000)

  const rows = recentRows || []
  const currentRows = rows.filter((row: any) => new Date(row.created_at) >= currentStart)
  const previousRows = rows.filter((row: any) => new Date(row.created_at) < currentStart)
  const currentSuccess = currentRows.filter((row: any) => row.status === 'success')
  const previousSuccess = previousRows.filter((row: any) => row.status === 'success')
  const volume = currentSuccess.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  const previousVolume = previousSuccess.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)

  const { data: merchantRows } = await db
    .from('payment_workspaces')
    .select('id,business_name,business_email,shortcode,environment,status,created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: recentExceptions } = await db
    .from('payment_reconciliation_exceptions')
    .select('id,workspace_id,type,severity,status,title,reason,amount,created_at')
    .in('status', ['open', 'in_review'])
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: activationQueue } = await db
    .from('mpesa_activation_requests')
    .select('id,workspace_id,status,environment,requested_methods,notes,last_error,requested_at')
    .not('status', 'in', '(live,cancelled)')
    .order('requested_at', { ascending: true })
    .limit(6)

  const workspaceIds = Array.from(new Set([
    ...(recentExceptions || []).map((row: any) => row.workspace_id),
    ...(activationQueue || []).map((row: any) => row.workspace_id),
  ].filter(Boolean)))
  const { data: workspaceNames } = workspaceIds.length
    ? await db.from('payment_workspaces').select('id,business_name,shortcode').in('id', workspaceIds)
    : { data: [] as any[] }
  const nameMap = new Map<string, any>((workspaceNames || []).map((row: any): [string, any] => [String(row.id), row]))

  const merchantDayGroups = new Map<string, number>()
  for (const row of merchantRows || []) {
    const key = dayKey(new Date((row as any).created_at))
    merchantDayGroups.set(key, (merchantDayGroups.get(key) || 0) + 1)
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const merchantSeries = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (13 - index))
    return { date: dayKey(day), label: new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short' }).format(day), value: merchantDayGroups.get(dayKey(day)) || 0 }
  })

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    degraded: true,
    degraded_reason: 'Migration 018 is not applied. Figures are aggregated from the most recent 1,000 payment rows and 100 workspaces. Apply migration 018 for platform-wide SQL aggregates.',
    sample_size: rows.length,
    merchants: {
      total: merchantTotal,
      live: merchantLive,
      sandbox: merchantSandbox,
      production: merchantProduction,
      new_in_window: merchantNew,
      series: merchantSeries,
    },
    payments: {
      total: paymentTotal,
      success: paymentSuccess,
      failed: paymentFailed,
      pending: paymentPending,
      reversed: paymentReversed,
      success_rate: paymentTotal ? Number(((paymentSuccess / paymentTotal) * 100).toFixed(1)) : 0,
      volume,
      previous_volume: previousVolume,
      volume_change: previousVolume ? Number((((volume - previousVolume) / previousVolume) * 100).toFixed(1)) : null,
      sampled_total: currentRows.length,
      series: buildSeries(days, rows as any),
    },
    queues: {
      open_exceptions: openExceptions,
      critical_exceptions: criticalExceptions,
      activation_requests: activationRequests,
      failed_webhooks: failedWebhooks,
      failed_notifications: failedNotifications,
      oldest_activation_at: activationQueue?.[0]?.requested_at || null,
    },
    recent_merchants: (merchantRows || []).slice(0, 6).map((row: any) => ({
      ...row,
      transaction_count: 0,
      volume: 0,
      open_exceptions: 0,
      last_payment_at: null,
      connection_status: null,
      activation_status: null,
    })),
    recent_exceptions: (recentExceptions || []).map((row: any) => ({
      ...row,
      business_name: nameMap.get(row.workspace_id)?.business_name || 'Unknown merchant',
    })),
    activation_queue: (activationQueue || []).map((row: any) => ({
      ...row,
      business_name: nameMap.get(row.workspace_id)?.business_name || 'Unknown merchant',
      shortcode: nameMap.get(row.workspace_id)?.shortcode || null,
    })),
  }
}

export async function GET(request: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  const days = clampDays(request.nextUrl.searchParams.get('days'))
  if (!platformAdminDatabaseConfigured()) {
    return NextResponse.json({
      success: true,
      ...emptyOverview(days),
      health: platformHealth('unconfigured'),
    })
  }

  const { data, error } = await db.rpc('platform_admin_overview', { p_days: days })

  if (!error && data) {
    return NextResponse.json({
      success: true,
      ...(data as Record<string, unknown>),
      degraded: false,
      health: platformHealth('ok'),
    })
  }

  const message = String(error?.message || '')
  if (isDatabaseConnectionError(error)) {
    console.warn('[platform-admin] overview database unreachable:', message)
    return NextResponse.json({
      success: true,
      ...emptyOverview(days, 'Platform database is unreachable. Check DATABASE_URL and the Neon endpoint, then refresh.'),
      health: platformHealth('unreachable'),
    })
  }

  if (error) console.warn('[platform-admin] overview RPC unavailable, using bounded fallback:', message)
  const fallback = await fallbackOverview(days)
  return NextResponse.json({ success: true, ...fallback, health: platformHealth('ok') })
}
