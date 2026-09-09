import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getMpesaToken } from '@/lib/mpesa';

export async function GET() {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value;
  if (!workspaceId) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 });
  const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,shortcode,payment_methods,environment,status').eq('id', workspaceId).maybeSingle();
  if (!workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const environment = workspace.environment || 'sandbox';
  const credentialsConfigured = Boolean(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_PASSKEY && workspace.shortcode);
  const callbackConfigured = Boolean(process.env.MPESA_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL);
  const { data: connection } = await supabaseAdmin.from('payment_mpesa_connections').select('credential_status,callback_status,last_tested_at,last_error').eq('workspace_id', workspace.id).maybeSingle();
  return NextResponse.json({ workspace: { id: workspace.id, shortcode: workspace.shortcode, environment, status: workspace.status, payment_methods: workspace.payment_methods }, readiness: { credentials: credentialsConfigured, callback: callbackConfigured, connection: connection || null, production: environment === 'production' } });
}

export async function POST() {
  const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value;
  if (!workspaceId) return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 });
  const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,shortcode,environment').eq('id', workspaceId).maybeSingle();
  if (!workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  const now = new Date().toISOString();
  try {
    await getMpesaToken();
    await supabaseAdmin.from('payment_mpesa_connections').upsert({ workspace_id: workspace.id, shortcode: workspace.shortcode, environment: workspace.environment, credential_status: 'verified', last_tested_at: now, last_error: null }, { onConflict: 'workspace_id' });
    return NextResponse.json({ success: true, credential_status: 'verified', tested_at: now });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'M-Pesa credential test failed.';
    await supabaseAdmin.from('payment_mpesa_connections').upsert({ workspace_id: workspace.id, shortcode: workspace.shortcode, environment: workspace.environment, credential_status: 'missing', last_tested_at: now, last_error: message.slice(0, 500) }, { onConflict: 'workspace_id' });
    return NextResponse.json({ success: false, credential_status: 'missing', error: 'M-Pesa credential test failed.' }, { status: 400 });
  }
}
