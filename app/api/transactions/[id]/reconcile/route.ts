import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Mock reconciliation response
    const updated = {
      id,
      status: 'reconciled',
      error_message: null,
      reconciled_at: new Date().toISOString(),
    }

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
