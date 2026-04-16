import { NextRequest, NextResponse } from 'next/server'
import { 
  createTransaction, 
  updateTransaction, 
  getTransaction,
  getCase,
  createValidationLog 
} from '@/lib/db'
import { parseBillReference, generateIdempotencyKey } from '@/lib/mpesa'
import crypto from 'crypto'

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
    const idempotencyKey = generateIdempotencyKey(
      body.MSISDN,
      body.TransAmount,
      body.TransTime
    )

    if (processedTransactions.has(idempotencyKey)) {
      console.log('[v0] Duplicate transaction detected, skipping')
      return NextResponse.json({
        ResultCode: '0',
        ResultDesc: 'Received',
      })
    }

    processedTransactions.add(idempotencyKey)

    // Check if already exists
    try {
      const existing = await getTransaction(transactionId)
      if (existing) {
        console.log('[v0] Transaction already exists:', transactionId)
        return NextResponse.json({
          ResultCode: '0',
          ResultDesc: 'Received',
        })
      }
    } catch (e) {
      // Transaction doesn't exist yet, continue
    }

    const status = resultCode === '0' ? 'completed' : 'failed'

    // Parse bill reference to extract case information
    let caseId = null
    if (body.BillRefNumber) {
      try {
        const billData = parseBillReference(body.BillRefNumber)
        caseId = billData.caseId
      } catch (e) {
        console.log('[v0] Failed to parse bill reference:', body.BillRefNumber)
      }
    }

    // Create transaction record
    const transaction = await createTransaction({
      mpesa_reference: transactionId,
      phone_number: body.MSISDN,
      amount: parseFloat(body.TransAmount),
      bill_reference: body.BillRefNumber || null,
      case_id: caseId || null,
      status: status,
      response_data: {
        TransactionType: body.TransactionType,
        TransTime: body.TransTime,
        ResultCode: resultCode,
        ResultDesc: body.Result?.ResultDesc || '',
        FirstName: body.FirstName,
        LastName: body.LastName,
        OrgAccountBalance: body.OrgAccountBalance,
      },
    })

    console.log('[v0] Transaction created:', transaction.id)

    // If successful and has case reference, update case amount paid
    if (status === 'completed' && caseId) {
      try {
        const caseData = await getCase(caseId)
        const newAmountPaid = caseData.amount_paid + parseFloat(body.TransAmount)
        const caseStatus = newAmountPaid >= caseData.amount_due ? 'closed' : 'open'

        await updateTransaction(caseId, {
          amount_paid: newAmountPaid,
          status: caseStatus,
        } as any)

        console.log('[v0] Case updated:', caseId, { amount_paid: newAmountPaid })
      } catch (e) {
        console.error('[v0] Failed to update case:', e)
      }
    }

    // Log validation event
    await createValidationLog({
      phone_number: body.MSISDN,
      amount: parseFloat(body.TransAmount),
      bill_reference: body.BillRefNumber || null,
      validation_result: status === 'completed',
    })

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
