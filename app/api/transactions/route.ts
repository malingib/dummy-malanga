import { NextRequest, NextResponse } from 'next/server'
import { getTransactions } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const parsedLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50
    const parsedOffset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0

    const transactions = await getTransactions({
      status: status || undefined,
      search: search || undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
    })
  } catch (error) {
    console.error('[v0] Transactions query error:', error)
    
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      data: [],
      count: 0,
    }, { status: 500 })
  }
}
