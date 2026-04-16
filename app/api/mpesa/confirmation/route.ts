import { NextRequest, NextResponse } from 'next/server'

// Track processed transactions to prevent duplicates
const processedTransactions = new Set<string>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[v0] Confirmation request:', {
      TransID: body.TransID,
      MSISDN: body.MSISDN,
      TransAmount: body.TransAmount,
      BillRefNumber: body.BillRefNumber,
    })

    const transactionId = body.TransID
    const resultCode = body.Result?.ResultCode || body.ResultCode || '0'

    // Check for duplicate processing
    const idempotencyKey = [
      body.MSISDN,
      body.TransAmount,
      body.TransTime,
    ].join('|')

    if (processedTransactions.has(idempotencyKey)) {
      console.log('[v0] Duplicate transaction detected, skipping')
      return NextResponse.json({
        ResultCode: '0',
        ResultDesc: 'Received',
      })
    }

    processedTransactions.add(idempotencyKey)

    const status = resultCode === '0' ? 'completed' : 'failed'

    console.log('[v0] Transaction processed:', {
      transactionId,
      status,
      amount: body.TransAmount,
      phone: body.MSISDN,
    })

    // Return M-Pesa acknowledgment
    return NextResponse.json({
      ResultCode: '0',
      ResultDesc: 'Received',
    })
  } catch (error) {
    console.error('[v0] Confirmation endpoint error:', error)
    
    return NextResponse.json({
      ResultCode: '01',
      ResultDesc: 'System error',
    }, { status: 500 })
  }
}
