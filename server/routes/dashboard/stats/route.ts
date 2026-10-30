import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/neon'

type StatusAggregate = {
  status: string
  count: string
  amount: string
}

export async function GET() {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
  if (!workspaceId) {
    return NextResponse.json({
      totalTransactions: 0,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      activeMembers: 0,
      openCases: 0,
    })
  }

  try {
    const rows = await db.query<StatusAggregate>(
      `select status, count(*)::bigint as count, coalesce(sum(amount), 0)::text as amount
       from public.payment_transactions
       where workspace_id = $1
       group by status`,
      [workspaceId],
    )

    let totalTransactions = 0
    let totalAmount = 0
    let successfulPayments = 0
    let failedPayments = 0

    for (const row of rows) {
      const count = Number(row.count || 0)
      totalTransactions += count
      if (row.status === 'success') {
        successfulPayments += count
        totalAmount += Number(row.amount || 0)
      }
      if (row.status === 'failed') failedPayments += count
    }

    return NextResponse.json({
      totalTransactions,
      totalAmount: Math.round(totalAmount),
      successfulPayments,
      failedPayments,
      activeMembers: 0,
      openCases: 0,
    })
  } catch (error) {
    console.error('[dashboard/stats] query failed:', error)
    return NextResponse.json(
      {
        totalTransactions: 0,
        totalAmount: 0,
        successfulPayments: 0,
        failedPayments: 0,
        activeMembers: 0,
        openCases: 0,
      },
      { status: 500 },
    )
  }
}
