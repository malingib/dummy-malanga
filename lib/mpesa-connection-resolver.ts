import { supabaseAdmin } from '@/lib/supabase'

type Environment = 'sandbox' | 'production'

export type ResolvedMpesaConnection = {
  id: string
  workspace_id: string
  shortcode: string
  account_type: 'paybill' | 'till'
  environment: Environment
  is_active: boolean
}

function runtimeEnvironment(): Environment {
  return process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export async function resolveMpesaConnection(shortcode: string, environment?: Environment) {
  const normalized = String(shortcode || '').trim()
  if (!normalized) return null

  const targetEnvironment = environment || runtimeEnvironment()
  const { data, error } = await supabaseAdmin
    .from('mpesa_connections')
    .select('id,workspace_id,shortcode,account_type,environment,is_active')
    .eq('shortcode', normalized)
    .eq('environment', targetEnvironment)
    .eq('is_active', true)
    .limit(2)

  if (error) throw new Error(error.message)
  if (!data?.length) return null
  if (data.length > 1) throw new Error(`Multiple active M-Pesa connections found for shortcode ${normalized}`)
  return data[0] as ResolvedMpesaConnection
}

export async function attachTransactionRouting(transactionId: string, connection: ResolvedMpesaConnection, callbackEventId?: string | null) {
  if (!transactionId) return

  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update({
      workspace_id: connection.workspace_id,
      connection_id: connection.id,
      shortcode: connection.shortcode,
      account_type: connection.account_type,
      ...(callbackEventId ? { callback_event_id: callbackEventId } : {}),
    })
    .eq('transaction_id', transactionId)
    .eq('workspace_id', connection.workspace_id)

  if (error) throw new Error(error.message)
}

export async function assertTransactionRouting(transactionId: string, connection: ResolvedMpesaConnection) {
  if (!transactionId) return

  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('id,workspace_id,connection_id,shortcode')
    .eq('transaction_id', transactionId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return

  if (data.workspace_id !== connection.workspace_id || (data.connection_id && data.connection_id !== connection.id) || (data.shortcode && data.shortcode !== connection.shortcode)) {
    throw new Error('Payment transaction routing conflict detected')
  }
}
