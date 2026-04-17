import { NextRequest, NextResponse } from 'next/server'
import { createValidationLog } from '@/lib/db'
import { validateAmount, validateBillReference, validatePhoneNumber } from '@/lib/validation'

interface MpesaValidationPayload {
  MSISDN?: string
  TransAmount?: string
  BillRefNumber?: string
  TransID?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MpesaValidationPayload
    const amount = parseFloat(body.TransAmount || '0')
    const amountForLog = Number.isFinite(amount) ? amount : 0

    const phoneError = validatePhoneNumber(body.MSISDN || '')
    if (phoneError) {
      await createValidationLog({
        phone_number: body.MSISDN || '',
        amount: amountForLog,
        bill_reference: body.BillRefNumber || null,
        validation_result: false,
      })

      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: phoneError.message,
      })
    }

    const amountError = validateAmount(amount)
    if (amountError) {
      await createValidationLog({
        phone_number: body.MSISDN || '',
        amount: amountForLog,
        bill_reference: body.BillRefNumber || null,
        validation_result: false,
      })

      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: amountError.message,
      })
    }

    const billRefError = body.BillRefNumber
      ? await validateBillReference(body.BillRefNumber, amount)
      : null

    if (billRefError) {
      await createValidationLog({
        phone_number: body.MSISDN || '',
        amount: amountForLog,
        bill_reference: body.BillRefNumber || null,
        validation_result: false,
      })

      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: billRefError.message,
      })
    }

    await createValidationLog({
      phone_number: body.MSISDN || '',
      amount: amountForLog,
      bill_reference: body.BillRefNumber || null,
      validation_result: true,
    })

    return NextResponse.json({
      ResultCode: '0',
      ResultDesc: 'Accepted',
    })
  } catch (error) {
    console.error('[validation] endpoint error:', error)

    return NextResponse.json(
      {
        ResultCode: '01',
        ResultDesc: 'System error',
      },
      { status: 500 }
    )
  }
}
