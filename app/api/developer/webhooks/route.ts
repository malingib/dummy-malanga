import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveWorkspace } from '@/lib/api-auth';
import { encryptSecret } from '@/lib/webhooks';

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('payment_webhook_endpoints').select('id,url,events,status,created_at,updated_at,last_success_at,last_failure_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Unable to load webhook endpoints.' }, { status: 500 });
  return NextResponse.json({ endpoints: data });
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const url = String(body?.url || '').trim();
    const events = Array.isArray(body?.events) ? Array.from(new Set(body.events.map((v: unknown) => String(v)))) : ['payment.success', 'payment.failed'];
    if (!/^https:\/\//i.test(url)) return NextResponse.json({ error: 'Webhook URL must use HTTPS.' }, { status: 400 });
    if (!events.length) return NextResponse.json({ error: 'At least one webhook event is required.' }, { status: 400 });
    const secret = `whsec_${randomBytes(32).toString('base64url')}`;
    const { data, error } = await supabaseAdmin.from('payment_webhook_endpoints').insert({ workspace_id: workspace.id, url, secret_hash: 'managed-by-encryption', secret_ciphertext: encryptSecret(secret), events }).select('id,url,events,status,created_at').single();
    if (error) return NextResponse.json({ error: 'Unable to create webhook endpoint.' }, { status: 500 });
    await supabaseAdmin.from('payment_audit_logs').insert({ workspace_id: workspace.id, actor_user_id: workspace.ownerUserId, action: 'webhook.created', resource_type: 'webhook_endpoint', resource_id: data.id, metadata: { url, events } });
    return NextResponse.json({ endpoint: data, secret, warning: 'Store this signing secret now. It cannot be displayed again.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid webhook request or encryption configuration.' }, { status: 400 });
  }
}
