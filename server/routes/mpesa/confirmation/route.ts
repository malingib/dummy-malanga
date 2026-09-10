import { NextRequest, NextResponse } from 'next/server'
import {
  createCallbackLog,
  getTransactionByTransId,
  upsertTransactionByTransId,
} from '@/lib/db'
import { validateAmount, validateCallbackFields, validatePhoneNumber } from '@/lib/validation'

interface MpesaConfirmationPayload {
  TransactionType?: string
  TransID?: string
  TransTime?: string
  TransAmount?: string
  BusinessShortCode?: string
  BillRefNumber?: string
  InvoiceNumber?: string
  OrgAccountBalance?: string
  ThirdPartyTransID?: string
  MSISDN?: string
  FirstName?: string
  MiddleName?: string
  LastName?: string
  Result?: {
    ResultCode?: string
    ResultDesc?: string
  }
  ResultCode?: string
  ResultDesc?: string
}

function toIsoTimestamp(mpesaTime?: string): string | undefined {
  if (!mpesaTime) return undefined
  if (!/^\d{14}$/.test(mpesaTime)) return mpesaTime

  const year = mpesaTime.slice(0, 4)
  const month = mpesaTime.slice(4, 6)
  const day = mpesaTime.slice(6, 8)
  const hours = mpesaTime.slice(8, 10)
  const minutes = mpesaTime.slice(10, 12)
  const seconds = mpesaTime.slice(12, 14)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MpesaConfirmationPayload
    const validationError = validateCallbackFields(body)

    if (validationError) {
      await createCallbackLog({
        trans_id: body.TransID,
        response_code: '01',
        response_description: validationError.message,
      })

      return NextResponse.json(
        { ResultCode: '01', ResultDesc: validationError.message },
        { status: 400 }
      )
    }

    const resultCode = body.Result?.ResultCode || body.ResultCode || '0'
    const resultDesc = body.Result?.ResultDesc || body.ResultDesc || 'Received'
    const transAmount = parseFloat(body.TransAmount || '0')

    const phoneError = validatePhoneNumber(body.MSISDN || '')
    const amountError = validateAmount(transAmount)

    if (phoneError || amountError) {
      const message = phoneError?.message || amountError?.message || 'Invalid payload'
      await createCallbackLog({
        trans_id: body.TransID,
        response_code: '01',
        response_description: message,
      })

      return NextResponse.json(
        { ResultCode: '01', ResultDesc: message },
        { status: 400 }
      )
    }

    const existing = await getTransactionByTransId(body.TransID!)
    const status = resultCode === '0' ? 'completed' : 'failed'

    await upsertTransactionByTransId({
      trans_id: body.TransID!,
      trans_type: body.TransactionType || undefined,
      trans_time: toIsoTimestamp(body.TransTime),
      trans_amount: body.TransAmount || '0',
      business_shortcode: body.BusinessShortCode || undefined,
      bill_ref_number: body.BillRefNumber || '',
      invoice_number: body.InvoiceNumber || undefined,
      org_account_balance: body.OrgAccountBalance || undefined,
      third_party_trans_id: body.ThirdPartyTransID || undefined,
      msisdn: body.MSISDN!,
      first_name: body.FirstName || undefined,
      middle_name: body.MiddleName || undefined,
      last_name: body.LastName || undefined,
      status,
      error_message: status === 'failed' ? resultDesc : null,
      response_data: body,
    })

    await createCallbackLog({
      trans_id: body.TransID,
      response_code: '0',
      response_description: existing
        ? 'Duplicate callback received and transaction updated'
        : 'Transaction recorded',
    })

    return NextResponse.json({
      ResultCode: '0',
      ResultDesc: 'Received',
    })
  } catch (error) {
    console.error('[confirmation] endpoint error:', error)

    return NextResponse.json(
      {
        ResultCode: '01',
        ResultDesc: 'System error',
      },
      { status: 500 }
    )
  }
}
