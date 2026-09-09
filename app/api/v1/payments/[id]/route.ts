import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request, 'payments:read');
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from('payment_transactions').select('id,transaction_id,transaction_type,phone_number,amount,reference,status,result_code,result_description,mpesa_receipt,created_at,updated_at,reconciliation_status,reconciled_at').eq('id', id).eq('workspace_id', auth.workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to load payment.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  return NextResponse.json({ payment: data });
}
