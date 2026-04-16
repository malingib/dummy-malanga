import { NextRequest, NextResponse } from 'next/server'
import { updateTransaction, getTransaction } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const transaction = await getTransaction(id)
    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Update transaction status to reconciled
    const updated = await updateTransaction(id, {
      status: 'reconciled',
      error_message: null,
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
