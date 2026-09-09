import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_CALLBACK_BODY_BYTES,
  normalizeShortcode,
  extractC2BIdentifiers,
  validateConfirmationPayload,
  isCallbackBodyTooLarge,
} from '../lib/mpesa-callback-rules.mjs'

test('normalizes shortcode and transaction identifiers', () => {
  assert.equal(normalizeShortcode(' 123456 '), '123456')
  assert.equal(normalizeShortcode(''), null)
  assert.deepEqual(extractC2BIdentifiers({ BusinessShortCode: ' 123456 ', TransID: ' ABC123 ' }), {
    shortcode: '123456',
    transactionId: 'ABC123',
  })
})

test('accepts a valid C2B confirmation payload', () => {
  assert.deepEqual(validateConfirmationPayload({
    BusinessShortCode: '123456',
    TransID: 'QWE123',
    TransAmount: '1500.00',
  }), {
    valid: true,
    shortcode: '123456',
    transactionId: 'QWE123',
    amount: 1500,
  })
})

test('rejects missing shortcode, transaction ID and invalid amounts', () => {
  assert.equal(validateConfirmationPayload({ TransID: 'QWE123', TransAmount: '10' }).reason, 'missing_shortcode')
  assert.equal(validateConfirmationPayload({ BusinessShortCode: '123456', TransAmount: '10' }).reason, 'missing_transaction_id')
  assert.equal(validateConfirmationPayload({ BusinessShortCode: '123456', TransID: 'QWE123', TransAmount: '0' }).reason, 'invalid_amount')
  assert.equal(validateConfirmationPayload({ BusinessShortCode: '123456', TransID: 'QWE123', TransAmount: 'NaN' }).reason, 'invalid_amount')
})

test('enforces callback payload size limit', () => {
  assert.equal(isCallbackBodyTooLarge(String(MAX_CALLBACK_BODY_BYTES)), false)
  assert.equal(isCallbackBodyTooLarge(String(MAX_CALLBACK_BODY_BYTES + 1)), true)
  assert.equal(isCallbackBodyTooLarge(null), false)
})
