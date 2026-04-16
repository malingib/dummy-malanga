import { NextRequest, NextResponse } from 'next/server'
import { getTransactions } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0

    console.log('[v0] Transactions query:', { status, limit, offset })

    const transactions = await getTransactions({
      status: status || undefined,
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
      error: 'Failed to fetch transactions',
    }, { status: 500 })
  }
}
