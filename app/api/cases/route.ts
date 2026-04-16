import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const mockCases = [
      {
        id: '1',
        case_number: 'CASE001',
        member_id: '1',
        description: 'Member requested payment dispute resolution',
        amount_due: 5000,
        amount_paid: 2500,
        status: 'open' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        case_number: 'CASE002',
        member_id: '2',
        description: 'Failed payment - please investigate',
        amount_due: 3000,
        amount_paid: 3000,
        status: 'closed' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    return NextResponse.json(mockCases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json([], { status: 200 });
  }
}
