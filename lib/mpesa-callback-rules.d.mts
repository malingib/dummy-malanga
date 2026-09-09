export declare const MAX_CALLBACK_BODY_BYTES: number
export declare function normalizeShortcode(value: unknown): string | null
export declare function extractC2BIdentifiers(body: Record<string, unknown>): {
  shortcode: string | null
  transactionId: string | null
}
export declare function validateConfirmationPayload(body: Record<string, unknown>): {
  valid: true
  shortcode: string
  transactionId: string
  amount: number
} | {
  valid: false
  reason: 'missing_shortcode' | 'missing_transaction_id' | 'invalid_amount'
}
export declare function isCallbackBodyTooLarge(contentLength: string | null): boolean
