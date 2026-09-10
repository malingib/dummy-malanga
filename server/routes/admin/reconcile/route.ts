import { NextResponse } from 'next/server'
import {
  getDuplicateTransactionCount,
  getFailedTransactions,
  reconcileTransaction,
} from '@/lib/db'

export async function POST() {
  try {
    const failedTransactions = await getFailedTransactions()
    const duplicates = await getDuplicateTransactionCount()

    let matched = 0
    let unmatched = 0
    let reconciled = 0
    let reconcileErrors = 0

    for (const tx of failedTransactions) {
      const amount = parseFloat(tx.trans_amount || '0')
      const canAutoReconcile = !!tx.bill_ref_number && !!tx.msisdn && amount > 0

      if (!canAutoReconcile) {
        unmatched++
        continue
      }

      matched++

      try {
        matched++
        await reconcileTransaction(tx.id)
        reconciled++
      } catch {
        reconcileErrors++
      }
    }

    return NextResponse.json({
      totalTransactions: failedTransactions.length,
      matched,
      unmatched,
      duplicates,
      reconciled,
      reconcileErrors,
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
