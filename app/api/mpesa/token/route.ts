import { NextRequest, NextResponse } from 'next/server'
import { getMpesaToken } from '@/lib/mpesa'

export async function GET(request: NextRequest) {
  try {
    console.log('[v0] Token request received')
    
    const token = await getMpesaToken()
    
    return NextResponse.json({
      access_token: token,
      success: true,
    })
  } catch (error) {
    console.error('[v0] Token generation error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate access token',
    }, { status: 500 })
  }
}
