import { NextRequest, NextResponse } from 'next/server'
import { simulateC2bTransaction } from '@/lib/mpesa'
import { validatePhoneNumber, validateAmount } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[v0] Simulate C2B request:', {
      phone: body.phone_number,
      amount: body.amount,
      billRef: body.bill_reference,
    })

    // Validate inputs
    const phoneError = validatePhoneNumber(body.phone_number)
    if (phoneError) {
      return NextResponse.json(
        { error: phoneError.message },
        { status: 400 }
      )
    }

    const amountError = validateAmount(parseFloat(body.amount))
    if (amountError) {
      return NextResponse.json(
        { error: amountError.message },
        { status: 400 }
      )
    }

    const shortCode = process.env.MPESA_SHORTCODE || ''
    const result = await simulateC2bTransaction(
      shortCode,
      'CustomerPayBillOnline',
      body.amount,
      body.phone_number,
      body.bill_reference || 'TEST'
    )

    console.log('[v0] Simulation result:', result)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('[v0] Simulation error:', error)
    
    return NextResponse.json({
      success: false,
      error: error?.response?.data?.errorMessage || 'Simulation failed',
    }, { status: 500 })
  }
}
