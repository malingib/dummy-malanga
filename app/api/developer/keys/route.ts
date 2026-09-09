import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { API_SCOPES, createSecret, resolveWorkspace } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('payment_api_keys').select('id,name,key_prefix,key_last4,scopes,status,created_at,last_used_at,expires_at,revoked_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Unable to load API keys.' }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const scopes: string[] = Array.isArray(body?.scopes) ? Array.from(new Set(body.scopes.map((v: unknown) => String(v)))).filter((v: string) => (API_SCOPES as readonly string[]).includes(v)) : ['payments:read', 'payments:write'];
    if (!name) return NextResponse.json({ error: 'Key name is required.' }, { status: 400 });
    if (!scopes.length) return NextResponse.json({ error: 'At least one valid scope is required.' }, { status: 400 });
    const expiresAt = body?.expiresAt ? new Date(String(body.expiresAt)).toISOString() : null;
    if (body?.expiresAt && Number.isNaN(Date.parse(String(body.expiresAt)))) return NextResponse.json({ error: 'Invalid expiry date.' }, { status: 400 });
    const secret = createSecret();
    const { data, error } = await supabaseAdmin.from('payment_api_keys').insert({ workspace_id: workspace.id, name, key_prefix: secret.prefix, key_last4: secret.last4, key_hash: secret.hash, scopes, expires_at: expiresAt }).select('id,name,key_prefix,key_last4,scopes,status,created_at,expires_at').single();
    if (error) return NextResponse.json({ error: 'Unable to create API key.' }, { status: 500 });
    await supabaseAdmin.from('payment_audit_logs').insert({ workspace_id: workspace.id, actor_user_id: workspace.ownerUserId, action: 'api_key.created', resource_type: 'api_key', resource_id: data.id, metadata: { name, scopes } });
    return NextResponse.json({ key: data, secret: secret.value, warning: 'Store this secret now. It cannot be displayed again.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid API key request.' }, { status: 400 });
  }
}
