import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[v0] Validation request:', {
      TransID: body.TransID,
      MSISDN: body.MSISDN,
      TransAmount: body.TransAmount,
      BillRefNumber: body.BillRefNumber,
    })

    // Basic validation: check phone number format
    if (!body.MSISDN || !/^254\d{9}$/.test(body.MSISDN)) {
      console.log('[v0] Phone validation failed:', body.MSISDN)
      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: 'Invalid phone number format',
      })
    }

    // Validate amount
    const amount = parseFloat(body.TransAmount)
    if (!amount || amount <= 0 || amount > 10000000) {
      console.log('[v0] Amount validation failed:', amount)
      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: 'Invalid transaction amount',
      })
    }

    console.log('[v0] Validation successful for transaction:', body.TransID)

    return NextResponse.json({
      ResultCode: '0',
      ResultDesc: 'Accepted',
    })
  } catch (error) {
    console.error('[v0] Validation endpoint error:', error)
    
    return NextResponse.json({
      ResultCode: '01',
      ResultDesc: 'System error',
    }, { status: 500 })
  }
}
