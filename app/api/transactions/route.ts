import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined

    const mockTransactions = [
      {
        id: '1',
        trans_id: 'TXN001',
        trans_time: '2024-01-15 10:30:45',
        trans_amount: '1500',
        bill_ref_number: 'CASE001',
        msisdn: '254712345678',
        first_name: 'John',
        last_name: 'Kamau',
        status: 'completed' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        trans_id: 'TXN002',
        trans_time: '2024-01-15 11:15:20',
        trans_amount: '2000',
        bill_ref_number: 'M002',
        msisdn: '254798765432',
        first_name: 'Mary',
        last_name: 'Wanjiru',
        status: 'completed' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        trans_id: 'TXN003',
        trans_time: '2024-01-15 12:45:30',
        trans_amount: '500',
        bill_ref_number: 'CASE002',
        msisdn: '254723456789',
        first_name: 'James',
        last_name: 'Ochieng',
        status: 'failed' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const filtered = status
      ? mockTransactions.filter((tx) => tx.status === status)
      : mockTransactions;

    return NextResponse.json({
      success: true,
      data: filtered,
      count: filtered.length,
    })
  } catch (error) {
    console.error('Transactions query error:', error)
    
    return NextResponse.json({
      success: false,
      data: [],
      count: 0,
    }, { status: 200 })
  }
}
