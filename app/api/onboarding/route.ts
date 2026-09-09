import { NextRequest, NextResponse } from 'next/server';

const allowedSetups = new Set(['paybill', 'till', 'stk']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const business = body?.business;
    const setup = Array.isArray(body?.setup) ? body.setup : [];
    const mpesa = body?.mpesa;
    const features = body?.features || {};

    if (!business?.name || !business?.phone || !business?.email) {
      return NextResponse.json({ error: 'Business name, phone and email are required.' }, { status: 400 });
    }
    if (!setup.length || setup.some((item: unknown) => !allowedSetups.has(String(item)))) {
      return NextResponse.json({ error: 'Select at least one supported M-Pesa payment method.' }, { status: 400 });
    }
    if (!mpesa?.shortcode || !/^\d{5,7}$/.test(String(mpesa.shortcode))) {
      return NextResponse.json({ error: 'Enter a valid 5–7 digit M-Pesa business shortcode.' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const onboarding = {
      status: 'ready_for_credentials',
      business: { name: String(business.name).trim(), phone: String(business.phone).trim(), email: String(business.email).trim().toLowerCase(), industry: String(business.industry || '').trim() },
      setup,
      mpesa: { shortcode: String(mpesa.shortcode), accountFormat: String(mpesa.accountFormat || 'invoice') },
      features: { sms: Boolean(features.sms), email: Boolean(features.email), whatsapp: Boolean(features.whatsapp), webhook: Boolean(features.webhook) },
      webhooks: { validation: `${origin}/api/mpesa/validation`, confirmation: `${origin}/api/mpesa/confirmation` },
    };

    // Never accept or persist Daraja secrets through this endpoint.
    console.info('[onboarding] configured payment workspace', { business: onboarding.business.name, shortcode: onboarding.mpesa.shortcode, setup: onboarding.setup });
    return NextResponse.json({ success: true, onboarding });
  } catch (error) {
    console.error('[onboarding] request error:', error);
    return NextResponse.json({ error: 'Invalid onboarding request.' }, { status: 400 });
  }
}
