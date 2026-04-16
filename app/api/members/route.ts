import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const members = [
      {
        id: '1',
        member_number: 'M001',
        name: 'John Kamau',
        phone_number: '254712345678',
        email: 'john@example.com',
        id_number: '12345678',
        address: 'Nairobi',
        wallet_balance: 5000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        member_number: 'M002',
        name: 'Mary Wanjiru',
        phone_number: '254798765432',
        email: 'mary@example.com',
        id_number: '87654321',
        address: 'Mombasa',
        wallet_balance: 8500,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const member = {
      id: Math.random().toString(36).substr(2, 9),
      member_number: body.member_number,
      name: body.name,
      phone_number: body.phone_number,
      email: body.email || null,
      id_number: body.id_number || null,
      address: body.address || null,
      wallet_balance: body.wallet_balance || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
