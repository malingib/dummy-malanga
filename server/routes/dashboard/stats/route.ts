import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Transaction } from '@/lib/types'

export async function GET() {
  try {
    // Get transaction stats
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('status, trans_amount')

    if (txError) throw txError

    let totalAmount = 0
    let successfulPayments = 0
    let failedPayments = 0

    if (txData) {
      txData.forEach((tx: Pick<Transaction, 'status' | 'trans_amount'>) => {
        const amount = parseFloat(tx.trans_amount || '0')
        totalAmount += amount
        if (tx.status === 'completed') successfulPayments++
        else if (tx.status === 'failed') failedPayments++
      })
    }

    // Get members count
    const { count: membersCount, error: membersError } = await supabase
      .from('members')
      .select('*', { count: 'exact' })

    if (membersError) throw membersError

    // Get open cases count
    const { count: casesCount, error: casesError } = await supabase
      .from('cases')
      .select('*', { count: 'exact' })
      .neq('status', 'closed')

    if (casesError) throw casesError

    const stats = {
      totalTransactions: txData?.length || 0,
      totalAmount: Math.round(totalAmount),
      successfulPayments,
      failedPayments,
      activeMembers: membersCount || 0,
      openCases: casesCount || 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[v0] Error fetching stats:', error)
    return NextResponse.json(
      {
        totalTransactions: 0,
        totalAmount: 0,
        successfulPayments: 0,
        failedPayments: 0,
        activeMembers: 0,
        openCases: 0,
      },
      { status: 500 }
    )
  }
}
