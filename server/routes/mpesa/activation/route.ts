import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { getMpesaConnection, obtainMpesaToken, registerMpesaCallbacks, simulateMpesaConnection } from '@/lib/mpesa-connection-service'

async function workspaceId() {
  return (await cookies()).get('mobiwave_workspace_id')?.value || null
}

function journeyStatus(connection: Record<string, unknown> | null) {
  if (!connection) return 'connection_required'
  if (connection.connection_status === 'failed') return 'attention_required'
  if (connection.callback_status === 'registered' && connection.connection_status === 'testing') return 'payment_test'
  if (connection.connection_status === 'verified') return 'callback_setup'
  if (connection.token_status === 'healthy') return 'callback_setup'
  return 'verify_connection'
}

async function syncActivation(workspace: string) {
  const { data: connections } = await supabaseAdmin
    .from('mpesa_connections')
    .select('id,shortcode,account_type,environment,connection_status,token_status,callback_status,is_primary,is_active,last_tested_at,last_error')
    .eq('workspace_id', workspace)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  const primary = connections?.find((item) => item.is_primary) || connections?.[0] || null
  const status = primary ? journeyStatus(primary) : 'connection_required'

  const { data: activation } = await supabaseAdmin
    .from('mpesa_activation_requests')
    .select('*')
    .eq('workspace_id', workspace)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activation) {
    const mapped = status === 'attention_required' ? 'blocked'
      : status === 'payment_test' ? 'testing'
      : status === 'connection_required' ? 'requested'
      : status === 'callback_setup' ? 'credentials_required'
      : activation.status === 'live' ? 'live' : 'reviewing'
    if (activation.status !== 'live' && activation.status !== 'cancelled' && activation.status !== mapped) {
      await supabaseAdmin.from('mpesa_activation_requests').update({ status: mapped, last_error: primary?.last_error || null }).eq('id', activation.id)
    }
  }

  return { activation, connections: connections || [], primary, journey_status: status }
}

export async function GET() {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const state = await syncActivation(workspace)
  return NextResponse.json({ success: true, data: state })
}

export async function POST(request: NextRequest) {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const { data: ws } = await supabaseAdmin.from('payment_workspaces').select('environment,payment_methods').eq('id', workspace).maybeSingle()
  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })

  const { data: existing } = await supabaseAdmin.from('mpesa_activation_requests').select('id,status').eq('workspace_id', workspace).not('status', 'in', '(live,cancelled)').maybeSingle()
  if (existing) return NextResponse.json({ success: true, data: existing })

  const { data, error } = await supabaseAdmin.from('mpesa_activation_requests').insert({
    workspace_id: workspace,
    environment: ws.environment || 'sandbox',
    requested_methods: ws.payment_methods || [],
    notes: String(body?.notes || '').slice(0, 1000) || null,
  }).select('*').single()
  if (error) return NextResponse.json({ error: 'Unable to create activation request.' }, { status: 500 })
  await supabaseAdmin.from('payment_workspaces').update({ status: 'ready_for_credentials' }).eq('id', workspace)
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const workspace = await workspaceId()
  if (!workspace) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const connectionId = String(body?.connection_id || '')
  if (!connectionId) return NextResponse.json({ error: 'Connection id is required.' }, { status: 400 })

  const { data: connection } = await supabaseAdmin.from('mpesa_connections').select('id,workspace_id,shortcode,environment').eq('id', connectionId).eq('workspace_id', workspace).maybeSingle()
  if (!connection) return NextResponse.json({ error: 'M-Pesa connection not found.' }, { status: 404 })

  try {
    if (body.action === 'verify') {
      await obtainMpesaToken(connectionId)
    } else if (body.action === 'register_callbacks') {
      await registerMpesaCallbacks(connectionId)
    } else if (body.action === 'activate') {
      await obtainMpesaToken(connectionId)
      await registerMpesaCallbacks(connectionId)
    } else if (body.action === 'test') {
      await simulateMpesaConnection(connectionId, Number(body.amount || 10), String(body.phone || ''), String(body.reference || 'MOBIWAVE-TEST'))
    } else {
      return NextResponse.json({ error: 'Unsupported activation action.' }, { status: 400 })
    }

    const state = await syncActivation(workspace)
    return NextResponse.json({ success: true, data: state })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'M-Pesa activation failed.'
    await supabaseAdmin.from('mpesa_activation_requests').update({ status: 'blocked', last_error: message }).eq('workspace_id', workspace).not('status', 'in', '(live,cancelled)')
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
