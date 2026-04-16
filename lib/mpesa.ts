import crypto from 'crypto'
import axios from 'axios'

const MPESA_SANDBOX_URL = 'https://sandbox.safaricom.co.ke'
const MPESA_PRODUCTION_URL = 'https://api.safaricom.co.ke'

interface TokenResponse {
  access_token: string
  expires_in: number
}

interface ValidationPayload {
  TransactionType: string
  TransID: string
  TransTime: string
  TransAmount: string
  BusinessShortCode: string
  BillRefNumber: string
  InvoiceNumber: string
  OrgAccountBalance: string
  ThirdPartyTransID: string
  MSISDN: string
  FirstName: string
  MiddleName?: string
  LastName: string
}

interface ConfirmationPayload extends ValidationPayload {
  Result: {
    ResultCode: string
    ResultDesc: string
  }
}

// Generate base64 encoded auth
export function generateBasicAuth(consumerKey: string, consumerSecret: string): string {
  const credentials = `${consumerKey}:${consumerSecret}`
  return Buffer.from(credentials).toString('base64')
}

// Get M-Pesa access token
export async function getMpesaToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY || ''
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET || ''
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox'
  
  const baseUrl = environment === 'production' ? MPESA_PRODUCTION_URL : MPESA_SANDBOX_URL
  const basicAuth = generateBasicAuth(consumerKey, consumerSecret)

  try {
    const response = await axios.get<TokenResponse>(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      }
    )

    return response.data.access_token
  } catch (error) {
    console.error('Failed to get M-Pesa token:', error)
    throw new Error('Failed to get M-Pesa access token')
  }
}

// Parse bill reference to extract case ID and member info
export function parseBillReference(billRef: string): {
  caseId?: string
  memberId?: string
  amount?: number
} {
  // Format: CASE_ID:MEMBER_ID or CASE_ID:MEMBER_ID:AMOUNT
  const parts = billRef?.split(':') || []
  
  return {
    caseId: parts[0],
    memberId: parts[1],
    amount: parts[2] ? parseInt(parts[2], 10) : undefined,
  }
}

// Validate M-Pesa callback signature
export function validateCallbackSignature(
  payload: any,
  signature: string
): boolean {
  const token = process.env.CALLBACK_VALIDATION_TOKEN || ''
  
  // Create the string to sign from the payload
  const stringToSign = JSON.stringify(payload)
  
  // Generate HMAC SHA256
  const hmac = crypto
    .createHmac('sha256', token)
    .update(stringToSign)
    .digest('hex')

  return hmac === signature
}

// Generate transaction reference
export function generateTransactionReference(): string {
  return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`
}

// Format phone number to M-Pesa format (254XXXXXXXXX)
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1)
  } else if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned
  }
  
  return cleaned
}

// Validate phone number format
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone)
  return /^254[1-9]\d{8}$/.test(formatted)
}

// Validate amount
export function isValidAmount(amount: number): boolean {
  return amount >= 1 && amount <= 150000
}

// Generate idempotency key
export function generateIdempotencyKey(
  phoneNumber: string,
  amount: number,
  timestamp: string
): string {
  return crypto
    .createHash('sha256')
    .update(`${phoneNumber}:${amount}:${timestamp}`)
    .digest('hex')
}

// Simulate C2B transaction (for testing)
export async function simulateC2bTransaction(
  shortCode: string,
  commandId: string,
  amount: string,
  msisdn: string,
  billRefNumber: string
): Promise<any> {
  const token = await getMpesaToken()
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox'
  const baseUrl = environment === 'production' ? MPESA_PRODUCTION_URL : MPESA_SANDBOX_URL

  try {
    const response = await axios.post(
      `${baseUrl}/mpesa/c2b/v1/simulate`,
      {
        ShortCode: shortCode,
        CommandID: commandId,
        Amount: amount,
        Msisdn: msisdn,
        BillRefNumber: billRefNumber,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('Failed to simulate C2B transaction:', error)
    throw error
  }
}
