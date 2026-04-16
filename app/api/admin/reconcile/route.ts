import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Mock reconciliation data
    const mockTransactions = [
      { trans_id: 'TXN001', bill_ref_number: 'CASE001', msisdn: '254712345678', trans_amount: '1500' },
      { trans_id: 'TXN002', bill_ref_number: 'M002', msisdn: '254798765432', trans_amount: '2000' },
      { trans_id: 'TXN003', bill_ref_number: null, msisdn: '254723456789', trans_amount: '500' },
    ]

    let matched = 0
    let unmatched = 0
    let duplicates = 0

    const transIdMap = new Map<string, number>()
    
    for (const tx of mockTransactions) {
      const key = tx.trans_id
      if (transIdMap.has(key)) {
        duplicates++
      } else {
        transIdMap.set(key, 1)
      }

      if (tx.bill_ref_number && tx.msisdn && tx.trans_amount) {
        matched++
      } else {
        unmatched++
      }
    }

    return NextResponse.json({
      totalTransactions: transactions.length,
      matched,
      unmatched,
      duplicates,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
