import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveWorkspace } from '@/lib/api-auth';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('payment_webhook_endpoints').update({ status: 'disabled' }).eq('id', id).eq('workspace_id', workspace.id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to disable webhook endpoint.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Webhook endpoint not found.' }, { status: 404 });
  await supabaseAdmin.from('payment_audit_logs').insert({ workspace_id: workspace.id, actor_user_id: workspace.ownerUserId, action: 'webhook.disabled', resource_type: 'webhook_endpoint', resource_id: id });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const update: { url?: string; events?: string[]; status?: string } = {};
  if (body?.url !== undefined) {
    const url = String(body.url).trim();
    if (!/^https:\/\//i.test(url)) return NextResponse.json({ error: 'Webhook URL must use HTTPS.' }, { status: 400 });
    update.url = url;
  }
  if (body?.events !== undefined) update.events = Array.from(new Set((Array.isArray(body.events) ? body.events : []).map((v: unknown) => String(v))));
  if (body?.status !== undefined && ['active', 'disabled'].includes(String(body.status))) update.status = String(body.status);
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No valid changes supplied.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('payment_webhook_endpoints').update(update).eq('id', id).eq('workspace_id', workspace.id).select('id,url,events,status,updated_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to update webhook endpoint.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Webhook endpoint not found.' }, { status: 404 });
  return NextResponse.json({ endpoint: data });
}
