import { NextRequest, NextResponse } from 'next/server'
import { createValidationLog } from '@/lib/db'
import { validatePhoneNumber, validateAmount, validateBillReference } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[v0] Validation request:', {
      TransID: body.TransID,
      MSISDN: body.MSISDN,
      TransAmount: body.TransAmount,
      BillRefNumber: body.BillRefNumber,
    })

    // Validate phone number
    const phoneError = validatePhoneNumber(body.MSISDN)
    if (phoneError) {
      console.log('[v0] Phone validation failed:', phoneError)
      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: phoneError.message,
      })
    }

    // Validate amount
    const amount = parseFloat(body.TransAmount)
    const amountError = validateAmount(amount)
    if (amountError) {
      console.log('[v0] Amount validation failed:', amountError)
      return NextResponse.json({
        ResultCode: '01',
        ResultDesc: amountError.message,
      })
    }

    // Validate bill reference if provided
    if (body.BillRefNumber) {
      const billError = await validateBillReference(body.BillRefNumber, amount)
      if (billError) {
        console.log('[v0] Bill reference validation failed:', billError)
        
        // Log validation attempt
        await createValidationLog({
          phone_number: body.MSISDN,
          amount: amount,
          bill_reference: body.BillRefNumber,
          validation_result: false,
        })

        return NextResponse.json({
          ResultCode: '01',
          ResultDesc: billError.message,
        })
      }
    }

    // Log successful validation
    await createValidationLog({
      phone_number: body.MSISDN,
      amount: amount,
      bill_reference: body.BillRefNumber || null,
      validation_result: true,
    })

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
