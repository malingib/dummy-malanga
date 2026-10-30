import { NextRequest, NextResponse } from 'next/server'
import { processNotificationQueue } from '@/lib/notification-worker'

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-cron-secret') || request.headers.get('x-callback-validation-token')
  if (!expected || !provided || provided !== expected) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)))
  try {
    const res = await processNotificationQueue(limit)
    return NextResponse.json({ ...res, timestamp: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Worker failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) { return POST(request) }
