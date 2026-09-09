import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { queryStkStatus } from '@/lib/mpesa'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = (await cookies()).get('mobiwave_workspace_id')?.value
    if (!workspaceId) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 400 })
    const { data: workspace } = await supabaseAdmin.from('payment_workspaces').select('id,shortcode').eq('id', workspaceId).single()
    if (!workspace) return NextResponse.json({ error: 'Payment workspace not found.' }, { status: 404 })
    const { checkoutRequestId } = await request.json()
    if (!checkoutRequestId || typeof checkoutRequestId !== 'string') return NextResponse.json({ error: 'checkoutRequestId is required.' }, { status: 400 })
    const result = await queryStkStatus(checkoutRequestId, workspace.shortcode)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[stk-status] error:', error)
    return NextResponse.json({ error: error?.response?.data?.errorMessage || error?.message || 'Unable to query payment status.' }, { status: 500 })
  }
}
