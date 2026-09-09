import 'server-only'

const API_URL = process.env.MOBIWAVE_SMS_API_URL || 'https://sms.mobiwave.co.ke/api/v3'
const TOKEN = process.env.MOBIWAVE_SMS_API_TOKEN
const SENDER_ID = process.env.MOBIWAVE_SMS_SENDER_ID || 'MobiWave'

type PaymentReceipt = {
  recipient: string
  amount: number | string
  reference?: string | null
  receipt?: string | null
  messageTemplate?: string | null
  senderId?: string | null
}

function normalizePhone(phone: string) {
  const value = phone.replace(/\s+/g, '')
  if (value.startsWith('+')) return value.slice(1)
  if (value.startsWith('0')) return `254${value.slice(1)}`
  return value
}

function renderTemplate(template: string, input: PaymentReceipt) {
  return template
    .replaceAll('{{amount}}', Number(input.amount).toLocaleString())
    .replaceAll('{{reference}}', input.reference || '')
    .replaceAll('{{receipt}}', input.receipt || '')
}

export async function sendPaymentReceipt(input: PaymentReceipt) {
  if (!TOKEN) return { sent: false, skipped: true, reason: 'MOBIWAVE_SMS_API_TOKEN is not configured' }

  const fallback = [
    `Payment received: KES ${Number(input.amount).toLocaleString()}.`,
    input.reference ? `Reference: ${input.reference}.` : undefined,
    input.receipt ? `M-Pesa receipt: ${input.receipt}.` : undefined,
    'Thank you for paying with MobiWave.',
  ].filter(Boolean).join(' ')
  const message = input.messageTemplate ? renderTemplate(input.messageTemplate, input) : fallback

  const response = await fetch(`${API_URL}/sms/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      recipient: normalizePhone(input.recipient),
      sender_id: input.senderId || SENDER_ID,
      type: 'plain',
      message,
    }),
    signal: AbortSignal.timeout(7000),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.status === 'error') throw new Error(data?.message || `MobiWave SMS request failed (${response.status})`)
  return { sent: true, skipped: false, data }
}
