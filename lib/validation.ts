import { getCase } from './db'

export interface ValidationError {
  code: string
  message: string
}

// Validate phone number
export function validatePhoneNumber(phone: string): ValidationError | null {
  const phoneRegex = /^(\+?254|0)[1-9]\d{8}$/
  
  if (!phoneRegex.test(phone)) {
    return {
      code: 'INVALID_PHONE',
      message: 'Invalid phone number format',
    }
  }
  
  return null
}

// Validate amount
export function validateAmount(amount: number): ValidationError | null {
  if (amount < 1) {
    return {
      code: 'INVALID_AMOUNT_MIN',
      message: 'Amount must be at least 1 KES',
    }
  }
  
  if (amount > 150000) {
    return {
      code: 'INVALID_AMOUNT_MAX',
      message: 'Amount cannot exceed 150000 KES',
    }
  }
  
  return null
}

// Validate bill reference exists and amount matches
export async function validateBillReference(
  billRef: string,
  amount: number
): Promise<ValidationError | null> {
  try {
    // For format: CASE_ID
    const caseData = await getCase(billRef)
    
    if (!caseData) {
      return {
        code: 'INVALID_BILL_REF',
        message: 'Bill reference not found',
      }
    }
    
    // Check if amount matches or is acceptable
    const remainingAmount = caseData.amount_due - caseData.amount_paid
    if (amount > remainingAmount) {
      return {
        code: 'AMOUNT_EXCEEDS_DUE',
        message: `Amount exceeds amount due (${remainingAmount} KES remaining)`,
      }
    }
    
    return null
  } catch (error) {
    // Bill reference may not exist, which is ok - allow payment without reference
    return null
  }
}

// Validate M-Pesa callback required fields
export function validateCallbackFields(payload: any): ValidationError | null {
  const requiredFields = [
    'TransactionType',
    'TransID',
    'TransTime',
    'TransAmount',
    'BusinessShortCode',
    'MSISDN',
    'Result',
  ]
  
  for (const field of requiredFields) {
    if (!payload[field]) {
      return {
        code: 'MISSING_FIELD',
        message: `Missing required field: ${field}`,
      }
    }
  }
  
  return null
}

// Validate phone number format for response
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  } else if (cleaned.startsWith('254')) {
    cleaned = cleaned.substring(3)
  }
  
  return cleaned
}
