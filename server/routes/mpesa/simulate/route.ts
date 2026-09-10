import { NextRequest, NextResponse } from 'next/server'
import { simulateC2bTransaction } from '@/lib/mpesa'
import { validatePhoneNumber, validateAmount } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = body.phone_number || body.phone
    const amount = body.amount
    const reference = body.bill_reference || body.reference || 'TEST'

    const phoneError = validatePhoneNumber(phone)
    if (phoneError) return NextResponse.json({ error: phoneError.message }, { status: 400 })

    const amountError = validateAmount(parseFloat(amount))
    if (amountError) return NextResponse.json({ error: amountError.message }, { status: 400 })

    const shortCode = body.shortcode || process.env.MPESA_SHORTCODE || ''
    const result = await simulateC2bTransaction(shortCode, 'CustomerPayBillOnline', amount, phone, reference)

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[simulate] error:', error)
    return NextResponse.json({ success: false, error: error?.response?.data?.errorMessage || 'Simulation failed' }, { status: 500 })
  }
}
