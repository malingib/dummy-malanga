import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSecret, resolveWorkspace, API_SCOPES } from '@/lib/api-auth';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('payment_api_keys').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', workspace.id).eq('status', 'active').select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to revoke API key.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'API key not found or already revoked.' }, { status: 404 });
  await supabaseAdmin.from('payment_audit_logs').insert({ workspace_id: workspace.id, actor_user_id: workspace.ownerUserId, action: 'api_key.revoked', resource_type: 'api_key', resource_id: id });
  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const requestedScopes = Array.isArray(body?.scopes) ? body.scopes.map((v: unknown) => String(v)).filter((v: string) => (API_SCOPES as readonly string[]).includes(v)) : null;
  const secret = createSecret();
  const update = { key_prefix: secret.prefix, key_last4: secret.last4, key_hash: secret.hash, status: 'active', revoked_at: null, scopes: requestedScopes?.length ? requestedScopes : ['payments:read', 'payments:write'] };
  const { data, error } = await supabaseAdmin.from('payment_api_keys').update(update).eq('id', id).eq('workspace_id', workspace.id).select('id,name,key_prefix,key_last4,scopes,status,created_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to rotate API key.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'API key not found.' }, { status: 404 });
  await supabaseAdmin.from('payment_audit_logs').insert({ workspace_id: workspace.id, actor_user_id: workspace.ownerUserId, action: 'api_key.rotated', resource_type: 'api_key', resource_id: id, metadata: { scopes: update.scopes } });
  return NextResponse.json({ key: data, secret: secret.value, warning: 'Store this secret now. It cannot be displayed again.' });
}
