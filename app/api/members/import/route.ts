import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const MemberSchema = z.object({
  member_number: z.string().min(1),
  name: z.string().min(1),
  phone_number: z.string().min(10),
  email: z.string().email().optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  wallet_balance: z.number().default(0),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { members } = body

    if (!members || !Array.isArray(members)) {
      return NextResponse.json(
        { error: 'Missing or invalid members array' },
        { status: 400 }
      )
    }

    // Validate and process members
    const validMembers = []
    const errors = []
    const duplicates = []
    const seenNumbers = new Set<string>()
    const seenPhones = new Set<string>()

    for (const member of members) {
      try {
        const validated = MemberSchema.parse(member)

        // Normalize phone number
        let phone = validated.phone_number.replace(/\D/g, '')
        if (!phone.startsWith('254')) {
          if (phone.startsWith('0')) {
            phone = '254' + phone.substring(1)
          } else if (phone.length === 9) {
            phone = '254' + phone
          }
        }

        // Check for duplicates within import
        if (seenNumbers.has(validated.member_number)) {
          duplicates.push({
            member_number: validated.member_number,
            name: validated.name,
            reason: 'Duplicate in import - member number already exists',
          })
          continue
        }

        if (seenPhones.has(phone)) {
          duplicates.push({
            member_number: validated.member_number,
            name: validated.name,
            reason: 'Duplicate in import - phone number already exists',
          })
          continue
        }

        seenNumbers.add(validated.member_number)
        seenPhones.add(phone)

        validMembers.push({
          id: Math.random().toString(36).substr(2, 9),
          member_number: validated.member_number,
          name: validated.name,
          phone_number: phone,
          email: validated.email || null,
          id_number: validated.id_number || null,
          address: validated.address || null,
          wallet_balance: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } catch (error) {
        errors.push({
          member: member.member_number || member.name || 'Unknown',
          error: (error as Error).message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      inserted: validMembers.length,
      duplicates: duplicates.length,
      errors: errors.length,
      members: validMembers,
      duplicatesList: duplicates,
      errorsList: errors,
      summary: {
        total: members.length,
        inserted: validMembers.length,
        skipped: duplicates.length + errors.length,
      },
    })
  } catch (error) {
    console.error('Member import error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
