import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { hasDatabaseEnv, db } from './neon'

/**
 * Platform admin access is deliberately separate from the merchant workspace
 * cookie. Merchant routes use `mobiwave_workspace_id`; platform routes only
 * accept the signed `mobiwave_platform_admin` session.
 */
export const PLATFORM_ADMIN_COOKIE = 'mobiwave_platform_admin'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

export type PlatformAdminSession = {
  sub: 'platform-admin'
  name: string
  username: string
  iat: number
  exp: number
}

function adminPassword() {
  return process.env.PLATFORM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
}

function adminUsername() {
  return process.env.PLATFORM_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin'
}

function sessionSecret() {
  return process.env.PLATFORM_ADMIN_SESSION_SECRET || adminPassword()
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function platformAdminConfigured() {
  return Boolean(adminPassword())
}

export function verifyPlatformAdminCredentials(username: string, password: string) {
  if (!platformAdminConfigured()) return false
  return safeEqual(username.trim(), adminUsername()) && safeEqual(password, adminPassword())
}

export function createPlatformAdminSession(): { token: string; expiresAt: string } {
  const now = Date.now()
  const payload: PlatformAdminSession = {
    sub: 'platform-admin',
    name: process.env.PLATFORM_ADMIN_NAME || 'Platform administrator',
    username: adminUsername(),
    iat: now,
    exp: now + SESSION_TTL_MS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { token: `${encoded}.${sign(encoded)}`, expiresAt: new Date(payload.exp).toISOString() }
}

export function verifyPlatformAdminSession(token?: string | null): PlatformAdminSession | null {
  if (!token || !platformAdminConfigured()) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  if (!safeEqual(signature, sign(encoded))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PlatformAdminSession
    if (payload.sub !== 'platform-admin') return null
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function getPlatformAdminSession(): Promise<PlatformAdminSession | null> {
  const token = (await cookies()).get(PLATFORM_ADMIN_COOKIE)?.value
  return verifyPlatformAdminSession(token)
}

export async function requirePlatformAdmin(): Promise<NextResponse | null> {
  const session = await getPlatformAdminSession()
  if (session) return null
  return NextResponse.json(
    { error: 'Platform administrator authentication is required.' },
    { status: 401 },
  )
}

/**
 * Platform data routes must fail fast when the database connection is not
 * configured. Otherwise queries fail one by one and the console appears to
 * load forever.
 */
export function requirePlatformAdminDatabase(): NextResponse | null {
  if (hasDatabaseEnv) return null
  return NextResponse.json(
    {
      error: 'Platform administration is not connected to a database. Set DATABASE_URL on the API server.',
      database_configured: false,
    },
    { status: 503 },
  )
}

export function platformAdminDatabaseConfigured() {
  return hasDatabaseEnv
}

export function setPlatformAdminCookie(response: NextResponse, token: string, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  response.cookies.set(PLATFORM_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  })
}

export function clearPlatformAdminCookie(response: NextResponse) {
  response.cookies.set(PLATFORM_ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function recordPlatformAdminAudit(input: {
  action: string
  targetType?: string
  targetId?: string | null
  workspaceId?: string | null
  actorName?: string
  metadata?: Record<string, unknown>
}) {
  // Sign-in must stay fast even when the admin console is running without a
  // database connection for local review or an early deployment.
  if (!hasDatabaseEnv) return
  const session = await getPlatformAdminSession()
  try {
    const { error } = await db.from('platform_admin_audit_logs').insert({
      actor_name: input.actorName || session?.name || 'platform-admin',
      action: input.action,
      target_type: input.targetType || null,
      target_id: input.targetId || null,
      workspace_id: input.workspaceId || null,
      metadata: input.metadata || {},
    })
    if (error) {
      // Audit writes must never make an operational action appear to fail.
      console.warn('[platform-admin] audit write skipped:', error.message)
    }
  } catch (error) {
    console.warn('[platform-admin] audit write skipped:', error instanceof Error ? error.message : error)
  }
}

/**
 * Distinguishes an unreachable database from a query/schema error so callers
 * can fail fast instead of trying another bounded fallback query.
 */
export function isDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown } | null)?.message === 'string'
      ? String((error as { message: string }).message)
      : String(error ?? '')
  const code = typeof (error as { code?: unknown } | null)?.code === 'string'
    ? String((error as { code: string }).code)
    : ''
  return /fetch failed|timed out|timeout|aborted|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ConnectTimeout|Connection terminated|terminating connection|WebSocket|DATABASE_NOT_CONFIGURED/i.test(`${message} ${code}`)
}

export function adminPublicSession(session: PlatformAdminSession | null) {
  return {
    authenticated: Boolean(session),
    configured: platformAdminConfigured(),
    ...(session ? { name: session.name, username: session.username, expires_at: new Date(session.exp).toISOString() } : {}),
  }
}
