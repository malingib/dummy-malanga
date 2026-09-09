import crypto from 'crypto'
import axios from 'axios'

const MPESA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke'
const MPESA_PRODUCTION_URL = 'https://api.safaricom.co.ke'

interface TokenResponse { access_token: string; expires_in: number }

interface ValidationPayload {
  TransactionType: string; TransID: string; TransTime: string; TransAmount: string; BusinessShortCode: string; BillRefNumber: string; InvoiceNumber: string; OrgAccountBalance: string; ThirdPartyTransID: string; MSISDN: string; FirstName: string; MiddleName?: string; LastName: string
}

interface ConfirmationPayload extends ValidationPayload { Result: { ResultCode: string; ResultDesc: string } }

function baseUrl() { return (process.env.MPESA_ENVIRONMENT || 'sandbox') === 'production' ? MPESA_PRODUCTION_URL : MPESA_SANDBOX_URL }

export function generateBasicAuth(consumerKey: string, consumerSecret: string): string { return Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64') }

export async function getMpesaToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY || ''
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || ''
  if (!consumerKey || !consumerSecret) throw new Error('M-Pesa credentials are not configured')
  try {
    const response = await axios.get<TokenResponse>(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${generateBasicAuth(consumerKey, consumerSecret)}` } })
    return response.data.access_token
  } catch (error) { console.error('Failed to get M-Pesa token:', error); throw new Error('Failed to get M-Pesa access token') }
}

export async function initiateStkPush(shortCode: string, phoneNumber: string, amount: number, accountReference: string, description: string, callbackUrl: string) {
  const passkey = process.env.MPESA_PASSKEY || ''
  if (!passkey) throw new Error('M-Pesa passkey is not configured')
  const token = await getMpesaToken()
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
  const response = await axios.post(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, { BusinessShortCode: shortCode, Password: password, Timestamp: timestamp, TransactionType: 'CustomerPayBillOnline', Amount: Math.round(amount), PartyA: formatPhoneNumber(phoneNumber), PartyB: shortCode, PhoneNumber: formatPhoneNumber(phoneNumber), CallBackURL: callbackUrl, AccountReference: accountReference.slice(0, 12), TransactionDesc: description.slice(0, 13) }, { headers: { Authorization: `Bearer ${token}` } })
  return response.data
}

export async function queryStkStatus(checkoutRequestId: string, shortCode: string) {
  const passkey = process.env.MPESA_PASSKEY || ''
  if (!passkey) throw new Error('M-Pesa passkey is not configured')
  const token = await getMpesaToken()
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
  const response = await axios.post(`${baseUrl()}/mpesa/stkpushquery/v1/query`, { BusinessShortCode: shortCode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }, { headers: { Authorization: `Bearer ${token}` } })
  return response.data
}

export function parseBillReference(billRef: string): { caseId?: string; memberId?: string; amount?: number } { const parts = billRef?.split(':') || []; return { caseId: parts[0], memberId: parts[1], amount: parts[2] ? parseInt(parts[2], 10) : undefined } }
export function validateCallbackSignature(payload: any, signature: string): boolean { const token = process.env.CALLBACK_VALIDATION_TOKEN || ''; const hmac = crypto.createHmac('sha256', token).update(JSON.stringify(payload)).digest('hex'); return Boolean(token) && hmac === signature }
export function generateTransactionReference(): string { return `TXN${Date.now()}${Math.random().toString(36).slice(2, 11)}` }
export function formatPhoneNumber(phone: string): string { let cleaned = phone.replace(/\D/g, ''); if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1); else if (!cleaned.startsWith('254')) cleaned = '254' + cleaned; return cleaned }
export function isValidPhoneNumber(phone: string): boolean { return /^254[1-9]\d{8}$/.test(formatPhoneNumber(phone)) }
export function isValidAmount(amount: number): boolean { return amount >= 1 && amount <= 150000 }
export function generateIdempotencyKey(phoneNumber: string, amount: number, timestamp: string): string { return crypto.createHash('sha256').update(`${phoneNumber}:${amount}:${timestamp}`).digest('hex') }

export async function simulateC2bTransaction(shortCode: string, commandId: string, amount: string, msisdn: string, billRefNumber: string): Promise<any> {
  const token = await getMpesaToken()
  try { const response = await axios.post(`${baseUrl()}/mpesa/c2b/v1/simulate`, { ShortCode: shortCode, CommandID: commandId, Amount: amount, Msisdn: msisdn, BillRefNumber: billRefNumber }, { headers: { Authorization: `Bearer ${token}` } }); return response.data } catch (error) { console.error('Failed to simulate C2B transaction:', error); throw error }
}
