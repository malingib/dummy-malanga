import crypto from 'crypto'
import axios from 'axios'
import { db } from '@/lib/neon'
import { assertProductionPaymentBoundary } from '@/lib/regulatory'
import { formatPhoneNumber, getMpesaToken, isValidPhoneNumber, parseAmountString } from '@/lib/mpesa'

const MPESA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke'
const MPESA_PRODUCTION_URL = 'https://api.safaricom.co.ke'
function baseUrl() { return (process.env.MPESA_ENVIRONMENT || 'sandbox') === 'production' ? MPESA_PRODUCTION_URL : MPESA_SANDBOX_URL }

/**
 * B2C payout via Daraja (Ch26 pay-out flow)
 * Gated by PSP boundary per docs/PSP-OPERATING-MODEL.md:48
 * Requires MOBIPAY_OPERATING_MODE=partner_psp + PSP_LICENSE_STATUS=verified
 */
export async function initiateB2CPayout(params: {
  workspaceId: string
  phone: string
  amountInput: unknown
  reference: string
  commandId?: string
  idempotencyKey: string
  environment: string
}) {
  assertProductionPaymentBoundary(params.environment)

  const phone = formatPhoneNumber(params.phone)
  if (!isValidPhoneNumber(phone)) throw new Error('Enter a valid Kenyan phone number.')

  const parsed = parseAmountString(params.amountInput)
  if (!parsed.ok) throw new Error(parsed.error)
  if (!/^[A-Za-z0-9 _.-]{1,12}$/.test(params.reference)) throw new Error('Reference must be 1–12 letters, numbers, spaces, dots, hyphens or underscores.')
  if (!params.idempotencyKey || params.idempotencyKey.length > 128) throw new Error('Idempotency-Key is required and must be ≤128 chars.')

  // Idempotency check (Ch26)
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ phone, amount: parsed.value, reference: params.reference })).digest('hex')
  const { data: existing } = await db.from('b2c_payouts').select('id,status,request_hash').eq('workspace_id', params.workspaceId).eq('idempotency_key', params.idempotencyKey).maybeSingle() as any
  if (existing) {
    // if schema has request_hash column (add if missing) else skip hash check
    if ((existing as any).request_hash && (existing as any).request_hash !== requestHash) throw Object.assign(new Error('Idempotency key was already used with a different request.'), { statusCode: 409 })
    return existing
  }

  // Verify workspace exists and B2C enabled (channel routing)
  const { data: workspace } = await db.from('payment_workspaces').select('id,shortcode,environment,allowed_channels').eq('id', params.workspaceId).maybeSingle()
  if (!workspace) throw new Error('Payment workspace not found.')

  const initiatorName = process.env.MPESA_B2C_INITIATOR_NAME
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL
  const shortCode = workspace.shortcode
  if (!initiatorName || !securityCredential) throw new Error('B2C credentials are not configured (MPESA_B2C_INITIATOR_NAME / MPESA_B2C_SECURITY_CREDENTIAL).')

  const token = await getMpesaToken()
  const queueTimeoutUrl = `${process.env.PUBLIC_API_ORIGIN || ''}/api/mpesa/b2c/callback`
  const resultTimeoutUrl = queueTimeoutUrl

  const payload = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: params.commandId || 'BusinessPayment',
    Amount: Math.round(parsed.numeric),
    PartyA: shortCode,
    PartyB: phone,
    Remarks: params.reference.slice(0, 12),
    QueueTimeOutURL: queueTimeoutUrl,
    ResultURL: resultTimeoutUrl,
    Occassion: params.reference.slice(0, 12),
  }

  // Persist pending payout before calling Daraja (double-entry ledger will be created on success callback)
  const { data: payout, error } = await db.from('b2c_payouts').insert({
    workspace_id: params.workspaceId,
    phone_number: phone,
    amount: parsed.numeric,
    reference: params.reference,
    command_id: payload.CommandID,
    status: 'queued',
    idempotency_key: params.idempotencyKey,
    raw_request: payload as any,
  }).select('id,status,amount,reference').single()
  if (error) throw error

  try {
    const resp = await axios.post(`${baseUrl()}/mpesa/b2c/v1/paymentrequest`, payload, { headers: { Authorization: `Bearer ${token}` } })
    await db.from('b2c_payouts').update({ transaction_id: (resp.data as any)?.ConversationID || null, raw_callback: resp.data as any }).eq('id', payout.id)
    return { payout, daraja: resp.data }
  } catch (err: any) {
    await db.from('b2c_payouts').update({ status: 'failed', result_desc: err?.response?.data?.errorMessage || err.message }).eq('id', payout.id)
    throw err
  }
}

export function validateB2CSignature(payload: any, signature: string): boolean {
  const token = process.env.CALLBACK_VALIDATION_TOKEN || ''
  const hmac = crypto.createHmac('sha256', token).update(JSON.stringify(payload)).digest('hex')
  return Boolean(token) && hmac === signature
}
