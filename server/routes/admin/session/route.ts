import { NextRequest, NextResponse } from 'next/server'
import {
  adminPublicSession,
  clearPlatformAdminCookie,
  createPlatformAdminSession,
  getPlatformAdminSession,
  platformAdminConfigured,
  recordPlatformAdminAudit,
  setPlatformAdminCookie,
  verifyPlatformAdminCredentials,
} from '@/lib/platform-admin'

export async function GET() {
  const session = await getPlatformAdminSession()
  return NextResponse.json(adminPublicSession(session))
}

export async function POST(request: NextRequest) {
  if (!platformAdminConfigured()) {
    return NextResponse.json(
      {
        error: 'Platform admin access is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD on the API server.',
        configured: false,
      },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')
  if (!username || !password) {
    return NextResponse.json({ error: 'Enter the platform administrator username and password.' }, { status: 400 })
  }
  if (!verifyPlatformAdminCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid platform administrator credentials.' }, { status: 401 })
  }

  const session = createPlatformAdminSession()
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform administrator'
  const response = NextResponse.json({
    success: true,
    ...adminPublicSession({
      sub: 'platform-admin',
      name,
      username,
      iat: Date.now(),
      exp: new Date(session.expiresAt).getTime(),
    }),
  })
  setPlatformAdminCookie(response, session.token)
  await recordPlatformAdminAudit({ action: 'admin.session.started', targetType: 'platform_admin', actorName: name })
  return response
}

export async function DELETE() {
  const session = await getPlatformAdminSession()
  if (session) await recordPlatformAdminAudit({ action: 'admin.session.ended', targetType: 'platform_admin' })
  const response = NextResponse.json({ success: true })
  clearPlatformAdminCookie(response)
  return response
}
