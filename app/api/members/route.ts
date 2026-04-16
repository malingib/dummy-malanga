import { NextRequest, NextResponse } from 'next/server';
import { getMembers, createMember } from '@/lib/db';

export async function GET() {
  try {
    const members = await getMembers();
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const member = await createMember({
      member_number: body.member_number,
      name: body.name,
      phone_number: body.phone_number,
      email: body.email || null,
      id_number: body.id_number || null,
      address: body.address || null,
      wallet_balance: body.wallet_balance || 0,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 });
  }
}
