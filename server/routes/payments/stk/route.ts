import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { assertProductionPaymentBoundary } from '@/lib/regulatory'
import { formatPhoneNumber, initiateStkPush, isValidAmount, isValidPhoneNumber } from '@/lib/mpesa'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
    if (!workspaceId) return NextResponse.json({ error: 'Complete M-Pesa onboarding first.' }, { status: 400 })
    const { data: workspace, error } = await supabaseAdmin.from('payment_workspaces').select('id,shortcode,payment_methods,environment,status').eq('id', workspaceId).single()
    if (error || !workspace) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 404 })
    assertProductionPaymentBoundary(workspace.environment)
    if (!workspace.payment_methods?.includes('stk')) return NextResponse.json({ error: 'STK Push is not enabled for this workspace.' }, { status: 400 })
    const body = await request.json()
    const phone = String(body?.phone || '')
    const amount = Number(body?.amount)
    const reference = String(body?.reference || 'PAYMENT')
    const description = String(body?.description || 'Mobiwave payment')
    if (!isValidPhoneNumber(phone)) return NextResponse.json({ error: 'Enter a valid Kenyan phone number.' }, { status: 400 })
    if (!isValidAmount(amount)) return NextResponse.json({ error: 'Amount must be between KES 1 and KES 150,000.' }, { status: 400 })
    if (reference.length > 12) return NextResponse.json({ error: 'Reference must be 12 characters or fewer.' }, { status: 400 })

    const callbackUrl = `${request.nextUrl.origin}/api/mpesa/stk/callback`
    const result = await initiateStkPush(workspace.shortcode, formatPhoneNumber(phone), amount, reference, description, callbackUrl)
    const { data: transaction, error: transactionError } = await supabaseAdmin.from('payment_transactions').insert({ workspace_id: workspace.id, transaction_type: 'stk', phone_number: formatPhoneNumber(phone), amount, reference, status: 'pending', transaction_id: result.CheckoutRequestID || null, raw_payload: result }).select('id,transaction_id,status,amount,reference').single()
    if (transactionError) throw transactionError
    return NextResponse.json({ success: true, data: result, transaction })
  } catch (error: any) {
    console.error('[stk] error:', error)
    const message = error instanceof Error ? error.message : error?.response?.data?.errorMessage || 'Unable to initiate STK Push.'
    const status = message.includes('Production payment initiation is disabled') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
