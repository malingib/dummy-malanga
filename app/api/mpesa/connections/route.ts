import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { createOrUpdateMpesaConnection, registerMpesaCallbacks, obtainMpesaToken, simulateMpesaConnection } from '@/lib/mpesa-connection-service'

async function workspaceId() { return (await cookies()).get('mobiwave_workspace_id')?.value || null }
function publicConnection(row: Record<string, unknown>) { return { id: row.id, shortcode: row.shortcode, account_type: row.account_type, environment: row.environment, credential_source: row.credential_source, connection_status: row.connection_status, token_status: row.token_status, callback_status: row.callback_status, is_primary: row.is_primary, is_active: row.is_active, token_last_obtained_at: row.token_last_obtained_at, callback_registered_at: row.callback_registered_at, callback_verified_at: row.callback_verified_at, last_tested_at: row.last_tested_at, last_error: row.last_error, created_at: row.created_at } }

export async function GET() {
  const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('mpesa_connections').select('*').eq('workspace_id', workspace).order('is_primary', { ascending: false }).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Unable to load M-Pesa connections.' }, { status: 500 })
  return NextResponse.json({ success: true, data: (data || []).map(publicConnection) })
}

export async function POST(request: NextRequest) {
  const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const body = await request.json().catch(() => ({})); const shortcode = String(body?.shortcode || '').trim()
  if (!/^\d{5,7}$/.test(shortcode)) return NextResponse.json({ error: 'Enter a valid M-Pesa shortcode.' }, { status: 400 })
  try {
    const connection = await createOrUpdateMpesaConnection({ workspaceId: workspace, shortcode, accountType: body?.account_type === 'till' ? 'till' : 'paybill', environment: body?.environment === 'production' ? 'production' : 'sandbox', credentialSource: body?.credential_source === 'mobiwave' ? 'mobiwave' : 'merchant', consumerKey: body?.consumer_key, consumerSecret: body?.consumer_secret, passkey: body?.passkey, isPrimary: Boolean(body?.is_primary) })
    return NextResponse.json({ success: true, data: publicConnection(connection) }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save M-Pesa connection.' }, { status: 500 }) }
}

export async function PATCH(request: NextRequest) {
  const workspace = await workspaceId(); if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const body = await request.json().catch(() => ({})); const connectionId = String(body?.id || '')
  if (!connectionId) return NextResponse.json({ error: 'Connection id is required.' }, { status: 400 })
  const { data: connection } = await supabaseAdmin.from('mpesa_connections').select('*').eq('id', connectionId).eq('workspace_id', workspace).maybeSingle()
  if (!connection) return NextResponse.json({ error: 'M-Pesa connection not found.' }, { status: 404 })
  try {
    if (body?.action === 'verify') await obtainMpesaToken(connectionId)
    else if (body?.action === 'register_callbacks') await registerMpesaCallbacks(connectionId)
    else if (body?.action === 'activate') { await obtainMpesaToken(connectionId); await registerMpesaCallbacks(connectionId) }
    else if (body?.action === 'test') {
      const amount = Number(body?.amount || 10); const phone = String(body?.phone || '')
      if (!/^\+?254\d{9}$/.test(phone.replace(/\s/g, '').replace(/^0/, '254')) && !/^0\d{9}$/.test(phone.replace(/\s/g, ''))) return NextResponse.json({ error: 'Enter a valid Kenyan test phone number.' }, { status: 400 })
      await simulateMpesaConnection(connectionId, amount, phone, String(body?.reference || 'MOBIWAVE-TEST'))
    } else if (body?.action === 'deactivate') await supabaseAdmin.from('mpesa_connections').update({ is_active: false, connection_status: 'suspended' }).eq('id', connectionId).eq('workspace_id', workspace)
    else return NextResponse.json({ error: 'Unsupported connection action.' }, { status: 400 })
    const { data: updated } = await supabaseAdmin.from('mpesa_connections').select('*').eq('id', connectionId).single()
    return NextResponse.json({ success: true, data: updated ? publicConnection(updated) : null })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'M-Pesa connection operation failed.' }, { status: 502 }) }
}
