import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/neon';

const allowedSetups = new Set(['paybill', 'till', 'stk']);
const allowedFormats = new Set(['invoice', 'customer', 'phone', 'freeform']);

export async function GET() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get('mobiwave_workspace_id')?.value;
  if (!workspaceId) return NextResponse.json({ onboarding: null });
  const { data, error } = await db.from('payment_workspaces').select('*').eq('id', workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to load onboarding.' }, { status: 500 });
  if (!data) return NextResponse.json({ onboarding: null });
  return NextResponse.json({ onboarding: { id: data.id, status: data.status, business: { name: data.business_name, phone: data.business_phone, email: data.business_email, industry: data.industry || '' }, setup: data.payment_methods, mpesa: { shortcode: data.shortcode, accountFormat: data.account_format }, features: { sms: data.notification_sms, email: data.notification_email, whatsapp: data.notification_whatsapp, webhook: data.developer_webhook }, environment: data.environment, webhook: data.webhook_url } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const business = body?.business;
    const rawSetup: unknown[] = Array.isArray(body?.setup) ? body.setup : [];
    const setup = Array.from(new Set(rawSetup.map((value): string => String(value))));
    const mpesa = body?.mpesa || {};
    const features = body?.features || {};
    const name = String(business?.name || '').trim();
    const phone = String(business?.phone || '').trim();
    const email = String(business?.email || '').trim().toLowerCase();
    const industry = String(business?.industry || '').trim();
    const shortcode = String(mpesa.shortcode || '').trim();
    const accountFormat = String(mpesa.accountFormat || 'invoice');
    if (!name || !phone || !email) return NextResponse.json({ error: 'Business name, phone and email are required.' }, { status: 400 });
    if (!setup.length || setup.some((item) => !allowedSetups.has(item))) return NextResponse.json({ error: 'Select at least one supported M-Pesa payment method.' }, { status: 400 });
    if (!/^\d{5,7}$/.test(shortcode)) return NextResponse.json({ error: 'Enter a valid 5–7 digit M-Pesa business shortcode.' }, { status: 400 });
    if (!allowedFormats.has(accountFormat)) return NextResponse.json({ error: 'Invalid account reference format.' }, { status: 400 });
    const cookieStore = await cookies();
    const existingId = cookieStore.get('mobiwave_workspace_id')?.value;
    const origin = request.nextUrl.origin;
    const row = { owner_user_id: null, business_name: name, business_phone: phone, business_email: email, industry, payment_methods: setup, shortcode, account_format: accountFormat, notification_sms: Boolean(features.sms), notification_email: Boolean(features.email), notification_whatsapp: Boolean(features.whatsapp), developer_webhook: Boolean(features.webhook), webhook_url: Boolean(features.webhook) ? String(body?.webhookUrl || '') : null, status: 'ready_for_credentials', environment: process.env.MPESA_ENVIRONMENT === 'production' ? 'production' : 'sandbox' };
    let saved;
    if (existingId) {
      const { data, error } = await db.from('payment_workspaces').update(row).eq('id', existingId).select('id,status,environment,shortcode').maybeSingle();
      if (error) return NextResponse.json({ error: 'Unable to update payment workspace.' }, { status: 500 });
      saved = data;
    }
    if (!saved) {
      const { data, error } = await db.from('payment_workspaces').insert(row).select('id,status,environment,shortcode').single();
      if (error) return NextResponse.json({ error: 'Unable to create payment workspace.' }, { status: 500 });
      saved = data;
    }
    const response = NextResponse.json({ success: true, workspace: saved, webhooks: { validation: `${origin}/api/mpesa/validation`, confirmation: `${origin}/api/mpesa/confirmation` } });
    response.cookies.set('mobiwave_workspace_id', saved.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    console.error('[onboarding] request error:', error);
    return NextResponse.json({ error: 'Invalid onboarding request.' }, { status: 400 });
  }
}
