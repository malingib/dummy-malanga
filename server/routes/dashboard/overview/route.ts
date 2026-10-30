import { ApiRequest, ApiResponse, cookies } from '../http'
import { db } from '../../lib/neon'

const RANGES = new Set([7, 30, 90])

function parseRange(url: URL): number {
  const raw = Number(url.searchParams.get('range') || 7)
  if (!Number.isFinite(raw) || !RANGES.has(raw)) return 7
  return raw
}

function startOfDay(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildDays(range: number): Date[] {
  const today = startOfDay(new Date())
  return Array.from({ length: range }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (range - 1 - index))
    return day
  })
}

function buildSeries(rows: Array<{ amount?: number | string | null; status?: string | null; created_at: string }>, range: number) {
  const days = buildDays(range)
  const buckets = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = dayKey(startOfDay(row.created_at))
    const bucket = buckets.get(key) || []
    bucket.push(row)
    buckets.set(key, bucket)
  }
  return days.map((day) => {
    const bucket = buckets.get(dayKey(day)) || []
    const success = bucket.filter((row) => row.status === 'success')
    const failedOrReversed = bucket.filter((row) => row.status === 'failed' || row.status === 'reversed')
    return {
      date: dayKey(day),
      label: new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(day),
      volume: success.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      count: bucket.length,
      success_rate: bucket.length ? Number(((success.length / bucket.length) * 100).toFixed(1)) : 0,
      attention: failedOrReversed.length,
    }
  })
}

export async function GET(request: ApiRequest) {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value || null
  if (!workspaceId) {
    return new ApiResponse({ error: 'Payment workspace not configured.' }, { status: 401 })
  }

  const range = parseRange(request.nextUrl)

  try {
    const previousStart = new Date()
    previousStart.setHours(0, 0, 0, 0)
    previousStart.setDate(previousStart.getDate() - range * 2)

    const { data: rows, error } = await db
      .from('payment_transactions')
      .select('amount,status,created_at,transaction_type,mpesa_receipt,reconciliation_status')
      .eq('workspace_id', workspaceId)
      .gte('created_at', previousStart.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const series = buildSeries(rows || [], range)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentStart = new Date(today)
    currentStart.setDate(currentStart.getDate() - range + 1)
    const currentRows = (rows || []).filter((row) => new Date(row.created_at) >= currentStart)
    const previousRows = (rows || []).filter((row) => new Date(row.created_at) < currentStart)

    const currentSuccess = currentRows.filter((row) => row.status === 'success')
    const previousSuccess = previousRows.filter((row) => row.status === 'success')
    const volume = currentSuccess.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const previousVolume = previousSuccess.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const volumeChange = previousVolume ? Number((((volume - previousVolume) / previousVolume) * 100).toFixed(1)) : null

    const totalTransactions = (rows || []).length
    const successfulPayments = (rows || []).filter((row) => row.status === 'success').length
    const failedPayments = (rows || []).filter((row) => row.status === 'failed').length
    const reversed = (rows || []).filter((row) => row.status === 'reversed').length
    const unmatched = (rows || []).filter((row) => row.reconciliation_status === 'unmatched').length
    const successRate = totalTransactions ? Number(((successfulPayments / totalTransactions) * 100).toFixed(1)) : 0
    const currentCount = currentRows.length
    const previousCount = previousRows.length
    const countChange = previousCount ? Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1)) : null
    const attentionCount = currentRows.filter((row) => row.status === 'failed' || row.status === 'reversed').length
    const previousAttention = previousRows.filter((row) => row.status === 'failed' || row.status === 'reversed').length
    const attentionChange = previousAttention ? Number((((attentionCount - previousAttention) / previousAttention) * 100).toFixed(1)) : null

    return new ApiResponse({
      success: true,
      window_days: range,
      generated_at: new Date().toISOString(),
      sampled_total: (rows || []).length,
      payments: {
        volume,
        previous_volume: previousVolume,
        volume_change: volumeChange,
        count: totalTransactions,
        previous_count: previousCount,
        count_change: countChange,
        success: successfulPayments,
        failed: failedPayments,
        pending: (rows || []).filter((row) => row.status === 'pending').length,
        reversed,
        unmatched,
        success_rate: successRate,
        previous_success_rate: previousCount ? Number(((previousRows.filter((row) => row.status === 'success').length / previousCount) * 100).toFixed(1)) : null,
        attention: attentionCount,
        previous_attention: previousAttention,
        attention_change: attentionChange,
        series,
      },
    })
  } catch (error) {
    console.error('[dashboard/overview] query failed:', error)
    return new ApiResponse({ error: 'Unable to load overview data.' }, { status: 500 })
  }
}
