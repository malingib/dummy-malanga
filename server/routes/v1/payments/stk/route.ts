import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateApiKey } from '@/lib/api-auth';
import { formatPhoneNumber, initiateStkPush, isValidAmount, isValidPhoneNumber } from '@/lib/mpesa';

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request, 'payments:write');
  if (auth instanceof NextResponse) return auth;
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 128) return NextResponse.json({ error: 'Idempotency-Key header is required and must be 128 characters or fewer.' }, { status: 400 });
  try {
    const body = await request.json();
    const phone = String(body?.phone || '');
    const amount = Number(body?.amount);
    const reference = String(body?.reference || 'PAYMENT').trim();
    const description = String(body?.description || 'Mobiwave payment').trim();
    if (!isValidPhoneNumber(phone)) return NextResponse.json({ error: 'Enter a valid Kenyan phone number.' }, { status: 400 });
    if (!isValidAmount(amount)) return NextResponse.json({ error: 'Amount must be between KES 1 and KES 150,000.' }, { status: 400 });
    if (!/^[A-Za-z0-9 _.-]{1,12}$/.test(reference)) return NextResponse.json({ error: 'Reference must be 1–12 letters, numbers, spaces, dots, hyphens or underscores.' }, { status: 400 });
    const requestHash = createHash('sha256').update(JSON.stringify({ phone: formatPhoneNumber(phone), amount, reference, description })).digest('hex');
    const { data: existing } = await supabaseAdmin.from('payment_idempotency_keys').select('request_hash,response_status,response_body').eq('workspace_id', auth.workspaceId).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) {
      if (existing.request_hash !== requestHash) return NextResponse.json({ error: 'Idempotency key was already used with a different request.' }, { status: 409 });
      return NextResponse.json(existing.response_body, { status: existing.response_status });
    }
    const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,shortcode,payment_methods,status').eq('id', auth.workspaceId).maybeSingle();
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 404 });
    if (workspace.status !== 'ready_for_credentials' && workspace.status !== 'active') return NextResponse.json({ error: 'Payment workspace is not ready.' }, { status: 409 });
    if (!workspace.payment_methods?.includes('stk')) return NextResponse.json({ error: 'STK Push is not enabled for this workspace.' }, { status: 400 });
    const callbackUrl = `${request.nextUrl.origin}/api/mpesa/stk/callback`;
    const result = await initiateStkPush(workspace.shortcode, formatPhoneNumber(phone), amount, reference, description, callbackUrl);
    const { data: transaction, error: transactionError } = await supabaseAdmin.from('payment_transactions').insert({ workspace_id: workspace.id, transaction_type: 'stk', phone_number: formatPhoneNumber(phone), amount, reference, status: 'pending', transaction_id: result.CheckoutRequestID || null, raw_payload: result }).select('id,transaction_id,status,amount,reference').single();
    if (transactionError) throw transactionError;
    const responseBody = { success: true, data: result, transaction };
    await supabaseAdmin.from('payment_idempotency_keys').insert({ workspace_id: auth.workspaceId, idempotency_key: idempotencyKey, request_hash: requestHash, response_status: 200, response_body: responseBody });
    return NextResponse.json(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to initiate STK Push.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
