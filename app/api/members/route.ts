import { NextRequest, NextResponse } from 'next/server'
import { getMembers, createMember } from '@/lib/db'
import { z } from 'zod'

const CreateMemberSchema = z.object({
  member_number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone_number: z.string().trim().min(10),
  email: z.string().email().optional().nullable(),
  id_number: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  wallet_balance: z.number().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const parsedLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100

    const members = await getMembers(search, limit)
    return NextResponse.json(members)
  } catch (error) {
    console.error('[v0] Error fetching members:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const memberData = CreateMemberSchema.parse(body)
    
    const member = await createMember({
      member_number: memberData.member_number,
      name: memberData.name,
      phone_number: memberData.phone_number,
      email: memberData.email || null,
      id_number: memberData.id_number || null,
      address: memberData.address || null,
      wallet_balance: memberData.wallet_balance || 0,
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating member:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
