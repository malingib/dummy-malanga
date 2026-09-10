import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveWorkspace } from '@/lib/api-auth';
import { deliverWebhook } from '@/lib/webhooks';

export async function GET(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const endpointId = request.nextUrl.searchParams.get('endpoint_id');
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
  let query = supabaseAdmin.from('payment_webhook_deliveries').select('id,endpoint_id,event_type,event_id,status,attempt_count,next_attempt_at,response_status,response_body,last_error,created_at,delivered_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(limit);
  if (endpointId) query = query.eq('endpoint_id', endpointId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load webhook deliveries.' }, { status: 500 });
  return NextResponse.json({ deliveries: data || [] });
}

export async function POST(request: NextRequest) {
  const workspace = await resolveWorkspace(request);
  if (!workspace) return NextResponse.json({ error: 'Workspace authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const deliveryId = String(body?.delivery_id || '').trim();
  if (!deliveryId) return NextResponse.json({ error: 'delivery_id is required.' }, { status: 400 });
  const { data: delivery, error } = await supabaseAdmin.from('payment_webhook_deliveries').select('id,endpoint_id,status').eq('id', deliveryId).eq('workspace_id', workspace.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to load webhook delivery.' }, { status: 500 });
  if (!delivery) return NextResponse.json({ error: 'Webhook delivery not found.' }, { status: 404 });
  if (delivery.status === 'delivered') return NextResponse.json({ error: 'This webhook delivery has already succeeded.' }, { status: 409 });
  await supabaseAdmin.from('payment_webhook_deliveries').update({ status: 'pending', next_attempt_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id).eq('workspace_id', workspace.id);
  const result = await deliverWebhook(delivery.id);
  return NextResponse.json({ success: result.ok, delivery_id: delivery.id, result }, { status: result.ok ? 200 : 502 });
}
