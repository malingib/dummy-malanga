import { NextRequest, NextResponse } from 'next/server'
import { getCases } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined

    const cases = await getCases(search, status)
    return NextResponse.json(cases)
  } catch (error) {
    console.error('[v0] Error fetching cases:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
