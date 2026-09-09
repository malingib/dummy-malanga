import { supabaseAdmin } from '@/lib/supabase'
import { decryptMpesaSecret, encryptMpesaSecret } from '@/lib/mpesa-credentials'

type Environment = 'sandbox' | 'production'
type AccountType = 'paybill' | 'till'

type ConnectionInput = {
  workspaceId: string
  shortcode: string
  accountType?: AccountType
  environment?: Environment
  credentialSource?: 'merchant' | 'mobiwave'
  consumerKey?: string
  consumerSecret?: string
  passkey?: string
  isPrimary?: boolean
}

function apiBase(environment: Environment) {
  return environment === 'production' ? (process.env.MPESA_PRODUCTION_BASE_URL || 'https://api.safaricom.co.ke') : (process.env.MPESA_SANDBOX_BASE_URL || 'https://sandbox.safaricom.co.ke')
}
function authUrl(environment: Environment) { return `${apiBase(environment)}/oauth/v1/generate?grant_type=client_credentials` }
function callbackUrl(path: string) { const base = (process.env.MOBIWAVE_API_BASE_URL || '').replace(/\/$/, ''); if (!base) throw new Error('MOBIWAVE_API_BASE_URL is not configured'); return `${base}${path}` }

export async function createOrUpdateMpesaConnection(input: ConnectionInput) {
  const environment = input.environment || 'sandbox'; const accountType = input.accountType || 'paybill'; const credentialSource = input.credentialSource || 'merchant'
  const encryptedConsumerKey = encryptMpesaSecret(input.consumerKey); const encryptedConsumerSecret = encryptMpesaSecret(input.consumerSecret); const encryptedPasskey = encryptMpesaSecret(input.passkey)
  const payload = { workspace_id: input.workspaceId, shortcode: input.shortcode.trim(), account_type: accountType, environment, credential_source: credentialSource, ...(encryptedConsumerKey ? { consumer_key_encrypted: encryptedConsumerKey } : {}), ...(encryptedConsumerSecret ? { consumer_secret_encrypted: encryptedConsumerSecret } : {}), ...(encryptedPasskey ? { passkey_encrypted: encryptedPasskey } : {}), is_primary: Boolean(input.isPrimary), connection_status: 'draft', callback_status: 'not_configured' }
  const { data, error } = await supabaseAdmin.from('mpesa_connections').upsert(payload, { onConflict: 'workspace_id,shortcode,environment' }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

export async function getMpesaConnection(connectionId: string) {
  const { data, error } = await supabaseAdmin.from('mpesa_connections').select('*').eq('id', connectionId).maybeSingle()
  if (error) throw new Error(error.message); if (!data) throw new Error('M-Pesa connection not found'); return data
}

export async function obtainMpesaToken(connectionId: string) {
  const connection = await getMpesaConnection(connectionId)
  const consumerKey = decryptMpesaSecret(connection.consumer_key_encrypted); const consumerSecret = decryptMpesaSecret(connection.consumer_secret_encrypted)
  if (!consumerKey || !consumerSecret) throw new Error('M-Pesa credentials are required for this connection')
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
  const response = await fetch(authUrl(connection.environment as Environment), { method: 'GET', headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' }, cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) { const message = String(body?.errorMessage || body?.error || 'Unable to obtain M-Pesa access token'); await supabaseAdmin.from('mpesa_connections').update({ token_status: 'failed', connection_status: 'failed', last_error: message }).eq('id', connectionId); throw new Error(message) }
  await supabaseAdmin.from('mpesa_connections').update({ token_status: 'healthy', connection_status: 'verified', token_last_obtained_at: new Date().toISOString(), last_error: null }).eq('id', connectionId)
  return String(body.access_token)
}

export async function registerMpesaCallbacks(connectionId: string) {
  const connection = await getMpesaConnection(connectionId); const token = await obtainMpesaToken(connectionId)
  const confirmationUrl = callbackUrl('/api/mpesa/c2b/confirmation'); const validationUrl = callbackUrl('/api/mpesa/c2b/validation'); const responseType = process.env.MPESA_C2B_RESPONSE_TYPE || 'Completed'
  const { data: existing } = await supabaseAdmin.from('mpesa_callback_registrations').select('id').eq('connection_id', connectionId).maybeSingle()
  const { data: registration, error: registrationError } = existing
    ? await supabaseAdmin.from('mpesa_callback_registrations').update({ status: 'registering', confirmation_url: confirmationUrl, validation_url: validationUrl, response_type: responseType, last_error: null }).eq('connection_id', connectionId).select('*').single()
    : await supabaseAdmin.from('mpesa_callback_registrations').insert({ connection_id: connectionId, status: 'registering', confirmation_url: confirmationUrl, validation_url: validationUrl, response_type: responseType }).select('*').single()
  if (registrationError) throw new Error(registrationError.message)
  const url = `${apiBase(connection.environment as Environment)}${process.env.MPESA_C2B_REGISTER_PATH || '/mpesa/c2b/v1/registerurl'}`
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ShortCode: connection.shortcode, ResponseType: responseType, ConfirmationURL: confirmationUrl, ValidationURL: validationUrl }), cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || String(body?.ResponseCode || body?.responseCode || '') === '1') { const message = String(body?.ResponseDescription || body?.errorMessage || body?.error || 'Safaricom callback registration failed'); await supabaseAdmin.from('mpesa_callback_registrations').update({ status: 'failed', last_error: message, safaricom_response: body }).eq('id', registration.id); await supabaseAdmin.from('mpesa_connections').update({ callback_status: 'failed', connection_status: 'failed', last_error: message }).eq('id', connectionId); throw new Error(message) }
  await supabaseAdmin.from('mpesa_callback_registrations').update({ status: 'registered', conversation_id: body?.ConversationID || body?.conversationID || null, originator_conversation_id: body?.OriginatorConversationID || body?.originatorConversationID || null, safaricom_response: body, registered_at: new Date().toISOString(), last_error: null }).eq('id', registration.id)
  await supabaseAdmin.from('mpesa_connections').update({ callback_status: 'registered', callback_registered_at: new Date().toISOString(), connection_status: 'testing', last_error: null }).eq('id', connectionId)
  return body
}

export async function simulateMpesaConnection(connectionId: string, amount: number, phone: string, reference = 'MOBIWAVE-TEST') {
  const connection = await getMpesaConnection(connectionId)
  if (connection.environment !== 'sandbox') throw new Error('Automated payment testing is only available for sandbox connections')
  const token = await obtainMpesaToken(connectionId)
  const response = await fetch(`${apiBase('sandbox')}/mpesa/c2b/v1/simulate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ShortCode: connection.shortcode, CommandID: 'CustomerPayBillOnline', Amount: amount, Msisdn: phone.replace(/\D/g, '').replace(/^0/, '254'), BillRefNumber: reference }), cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) { const message = String(body?.errorMessage || body?.error || 'Sandbox payment test failed'); await supabaseAdmin.from('mpesa_connections').update({ connection_status: 'failed', last_error: message }).eq('id', connectionId); throw new Error(message) }
  await supabaseAdmin.from('mpesa_connections').update({ connection_status: 'testing', last_tested_at: new Date().toISOString(), last_error: null }).eq('id', connectionId)
  return body
}
