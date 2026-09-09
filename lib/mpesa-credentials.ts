import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function encryptionKey() {
  const raw = process.env.MOBIWAVE_MPESA_ENCRYPTION_KEY
  if (!raw) throw new Error('MOBIWAVE_MPESA_ENCRYPTION_KEY is not configured')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('MOBIWAVE_MPESA_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encryptMpesaSecret(value: string | null | undefined) {
  if (!value) return null
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decryptMpesaSecret(value: string | null | undefined) {
  if (!value) return null
  const packed = Buffer.from(value, 'base64')
  if (packed.length <= IV_LENGTH + TAG_LENGTH) throw new Error('Invalid encrypted M-Pesa secret')
  const iv = packed.subarray(0, IV_LENGTH)
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
