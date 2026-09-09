import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export type ApiAuth = {
  workspaceId: string;
  keyId: string;
  scopes: string[];
  actorUserId: string | null;
};

export const API_SCOPES = ['payments:read', 'payments:write', 'webhooks:manage'] as const;

export function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function createSecret(prefix = 'mw_live_') {
  const value = `${prefix}${randomBytes(30).toString('base64url')}`;
  return { value, prefix: value.slice(0, 12), last4: value.slice(-4), hash: hashSecret(value) };
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function resolveWorkspace(request: NextRequest): Promise<{ id: string; ownerUserId: string | null } | null> {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('mobiwave_workspace_id')?.value;
  if (!workspaceId) return null;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data } = await supabase.auth.getUser(auth.slice(7));
    if (data.user?.id) {
      const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,owner_user_id').eq('id', workspaceId).eq('owner_user_id', data.user.id).maybeSingle();
      return workspace ?? null;
    }
  }
  const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,owner_user_id').eq('id', workspaceId).is('owner_user_id', null).maybeSingle();
  return workspace ?? null;
}

export async function authenticateApiKey(request: NextRequest, requiredScope?: string): Promise<ApiAuth | NextResponse> {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'Missing API key.' }, { status: 401 });
  const secret = authorization.slice(7).trim();
  if (!secret.startsWith('mw_') || secret.length < 20) return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 });
  const keyHash = hashSecret(secret);
  const { data: key, error } = await supabaseAdmin.from('payment_api_keys').select('id,workspace_id,key_hash,scopes,status,expires_at').eq('key_hash', keyHash).maybeSingle();
  if (error || !key || key.status !== 'active' || (key.expires_at && new Date(key.expires_at) <= new Date()) || !safeEquals(key.key_hash, keyHash)) return NextResponse.json({ error: 'Invalid or expired API key.' }, { status: 401 });
  if (requiredScope && !(key.scopes || []).includes(requiredScope)) return NextResponse.json({ error: 'Insufficient API scope.' }, { status: 403 });
  await supabaseAdmin.from('payment_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);
  return { workspaceId: key.workspace_id, keyId: key.id, scopes: key.scopes || [], actorUserId: null };
}
