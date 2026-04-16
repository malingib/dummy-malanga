import { NextResponse } from 'next/server'
import { getTransactions } from '@/lib/db'

export async function POST() {
  try {
    const transactions = await getTransactions()

    let matched = 0
    let unmatched = 0
    let duplicates = 0

    // Group transactions by trans_id to find duplicates
    const transIdMap = new Map<string, number>()
    
    for (const tx of transactions) {
      const key = tx.trans_id
      if (transIdMap.has(key)) {
        duplicates++
      } else {
        transIdMap.set(key, 1)
      }

      // Check if transaction has proper data
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
