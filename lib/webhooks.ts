import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

function encryptionKey() {
  const value = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!value) throw new Error('WEBHOOK_ENCRYPTION_KEY is not configured.');
  return Buffer.from(value, 'base64').length === 32 ? Buffer.from(value, 'base64') : createHashKey(value);
}

function createHashKey(value: string) {
  return createHmac('sha256', 'mobiwave-webhook-key').update(value).digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(payload: string) {
  const [iv, tag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !ciphertext) throw new Error('Invalid encrypted webhook secret.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function queueWebhook(eventType: string, eventId: string, workspaceId: string, payload: Record<string, unknown>) {
  const { data: endpoints } = await supabaseAdmin.from('payment_webhook_endpoints').select('id,events').eq('workspace_id', workspaceId).eq('status', 'active');
  if (!endpoints?.length) return;
  const rows = endpoints.filter((endpoint) => (endpoint.events || []).includes(eventType)).map((endpoint) => ({ endpoint_id: endpoint.id, workspace_id: workspaceId, event_type: eventType, event_id: eventId, payload }));
  if (rows.length) await supabaseAdmin.from('payment_webhook_deliveries').upsert(rows, { onConflict: 'endpoint_id,event_id', ignoreDuplicates: true });
}

export async function deliverWebhook(deliveryId: string) {
  const { data: delivery } = await supabaseAdmin.from('payment_webhook_deliveries').select('id,endpoint_id,workspace_id,event_type,event_id,payload,attempt_count').eq('id', deliveryId).maybeSingle();
  if (!delivery) return { ok: false, error: 'Delivery not found.' };
  const { data: endpoint } = await supabaseAdmin.from('payment_webhook_endpoints').select('url,secret_ciphertext,status').eq('id', delivery.endpoint_id).maybeSingle();
  if (!endpoint || endpoint.status !== 'active') return { ok: false, error: 'Endpoint disabled or missing.' };
  const secret = decryptSecret(endpoint.secret_ciphertext);
  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const attempt = Number(delivery.attempt_count || 0) + 1;
  try {
    const response = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mobiwave-event': delivery.eventType, 'x-mobiwave-event-id': delivery.eventId, 'x-mobiwave-timestamp': String(timestamp), 'x-mobiwave-signature': `v1=${signature}` }, body, signal: AbortSignal.timeout(10000) });
    const responseBody = (await response.text()).slice(0, 4000);
    if (response.ok) {
      await supabaseAdmin.from('payment_webhook_deliveries').update({ status: 'delivered', attempt_count: attempt, response_status: response.status, response_body: responseBody, delivered_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id);
      await supabaseAdmin.from('payment_webhook_endpoints').update({ last_success_at: new Date().toISOString() }).eq('id', endpoint.id);
      return { ok: true, status: response.status };
    }
    throw new Error(`Webhook returned HTTP ${response.status}`);
  } catch (error: unknown) {
    const backoffSeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));
    await supabaseAdmin.from('payment_webhook_deliveries').update({ status: attempt >= 8 ? 'failed' : 'pending', attempt_count: attempt, next_attempt_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(), last_error: error instanceof Error ? error.message : 'Webhook delivery failed' }).eq('id', delivery.id);
    await supabaseAdmin.from('payment_webhook_endpoints').update({ last_failure_at: new Date().toISOString() }).eq('id', endpoint.id);
    return { ok: false, error: 'Webhook delivery failed.' };
  }
}
