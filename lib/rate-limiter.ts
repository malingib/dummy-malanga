/**
 * Ch04 Rate Limiter — sliding window counter (fixed-window + weighted prev window)
 * In-memory, per-process. For multi-instance, replace with Redis + Lua (see docs).
 */

type Counter = { count: number; windowStart: number }

const store = new Map<string, Counter>()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let cleanupTimer: NodeJS.Timeout | null = null
function ensureCleanup() {
  if (cleanupTimer || typeof setInterval === 'undefined') return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    // Keep 2 windows to compute weighted count
    for (const [key, c] of store.entries()) {
      if (now - c.windowStart > 2 * getWindowMs()) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  if (cleanupTimer.unref) cleanupTimer.unref()
}

function getWindowMs(): number {
  const v = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
  return Number.isFinite(v) && v > 0 ? v : 60_000
}

function getMax(pathname: string): number {
  if (pathname.includes('/payments/stk') || pathname.includes('/v1/payments/stk')) {
    const v = Number(process.env.RATE_LIMIT_MAX_STK || process.env.RATE_LIMIT_MAX || 20)
    return Number.isFinite(v) && v > 0 ? v : 20
  }
  if (pathname.startsWith('/api/admin/')) {
    // The admin console is a read-heavy SPA. Keep sign-in strict, but do not
    // let normal page navigation consume the same budget as merchant traffic.
    if (pathname === '/api/admin/session') {
      const login = Number(process.env.RATE_LIMIT_MAX_ADMIN_LOGIN || 20)
      return Number.isFinite(login) && login > 0 ? login : 20
    }
    const admin = Number(process.env.RATE_LIMIT_MAX_ADMIN || 240)
    return Number.isFinite(admin) && admin > 0 ? admin : 240
  }
  const v = Number(process.env.RATE_LIMIT_MAX || 60)
  return Number.isFinite(v) && v > 0 ? v : 60
}

function keyFor(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }, pathname: string): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.headers['x-real-ip'] as string || req.socket?.remoteAddress || 'unknown'
  // Scope by IP + route bucket to avoid global block
  const bucket = pathname.includes('/v1/') ? 'v1'
    : pathname.includes('/payments/') ? 'payments'
      : pathname.includes('/mpesa/') ? 'mpesa'
        : pathname.startsWith('/api/admin/') ? 'admin'
          : 'api'
  return `${bucket}:${ip}`
}

function isExempt(pathname: string): boolean {
  // Allow callbacks and health to bypass strict limits but still track
  return pathname === '/health' || pathname === '/ready' || pathname === '/api/health' || pathname === '/api/ready' || pathname === '/api/mpesa/stk/callback' || pathname === '/api/mpesa/confirmation'
}

export function checkRateLimit(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }, pathname: string): { allowed: boolean; remaining: number; limit: number; resetMs: number; retryAfterSec: number } {
  ensureCleanup()
  if (process.env.RATE_LIMIT_ENABLED === 'false') return { allowed: true, remaining: getMax(pathname), limit: getMax(pathname), resetMs: getWindowMs(), retryAfterSec: 0 }
  if (isExempt(pathname)) return { allowed: true, remaining: getMax(pathname), limit: getMax(pathname), resetMs: getWindowMs(), retryAfterSec: 0 }

  const windowMs = getWindowMs()
  const limit = getMax(pathname)
  const k = keyFor(req as any, pathname)
  const now = Date.now()
  const curWindowStart = Math.floor(now / windowMs) * windowMs
  const prevWindowStart = curWindowStart - windowMs

  let cur = store.get(`${k}:${curWindowStart}`)
  if (!cur) {
    cur = { count: 0, windowStart: curWindowStart }
    store.set(`${k}:${curWindowStart}`, cur)
  }
  const prev = store.get(`${k}:${prevWindowStart}`)

  // Sliding window counter: weighted count = prev * (remaining overlap) + cur
  const elapsedInWindow = now - curWindowStart
  const weight = prev ? (windowMs - elapsedInWindow) / windowMs : 0
  const weightedCount = (prev?.count || 0) * weight + cur.count

  const remaining = Math.max(0, limit - Math.ceil(weightedCount) - 1)
  const allowed = weightedCount < limit
  const resetMs = curWindowStart + windowMs - now
  const retryAfterSec = allowed ? 0 : Math.ceil(resetMs / 1000)

  if (allowed) cur.count += 1

  return { allowed, remaining, limit, resetMs, retryAfterSec }
}

export function resetRateLimiterForTests() {
  store.clear()
}
