import { NextRequest, NextResponse } from 'next/server';
import { deliverWebhook } from '@/lib/webhooks';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-cron-secret');
  if (!expected || !provided || provided !== expected) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)));
  const { data: deliveries, error } = await supabaseAdmin.from('payment_webhook_deliveries').select('id').eq('status', 'pending').lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at', { ascending: true }).limit(limit);
  if (error) return NextResponse.json({ error: 'Unable to load webhook queue.' }, { status: 500 });
  const results = [];
  for (const delivery of deliveries || []) results.push(await deliverWebhook(delivery.id));
  return NextResponse.json({ processed: results.length, delivered: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length });
}
