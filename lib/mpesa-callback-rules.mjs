const MAX_CALLBACK_BODY_BYTES = 256 * 1024

export function normalizeShortcode(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function extractC2BIdentifiers(body) {
  return {
    shortcode: normalizeShortcode(body?.BusinessShortCode || body?.TillNumber),
    transactionId: normalizeShortcode(body?.TransID),
  }
}

export function validateConfirmationPayload(body) {
  const { shortcode, transactionId } = extractC2BIdentifiers(body)
  const amount = Number(body?.TransAmount)
  if (!shortcode) return { valid: false, reason: 'missing_shortcode' }
  if (!transactionId) return { valid: false, reason: 'missing_transaction_id' }
  if (!Number.isFinite(amount) || amount <= 0) return { valid: false, reason: 'invalid_amount' }
  return { valid: true, shortcode, transactionId, amount }
}

export function isCallbackBodyTooLarge(contentLength) {
  const value = Number(contentLength)
  return Number.isFinite(value) && value > MAX_CALLBACK_BODY_BYTES
}

export { MAX_CALLBACK_BODY_BYTES }
