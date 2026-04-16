import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { defaultModel } from '@/lib/ai'
import { z } from 'zod'
import { createMembers, getMemberByNumber, getMemberByPhone } from '@/lib/db'

const MemberSchema = z.object({
  member_number: z.string().min(1),
  name: z.string().min(1),
  phone_number: z.string().min(10),
  email: z.string().email().optional(),
  id_number: z.string().optional(),
  address: z.string().optional(),
  wallet_balance: z.number().default(0),
})

const MembersListSchema = z.object({
  members: z.array(MemberSchema),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data, format } = body

    if (!data || !format) {
      return NextResponse.json(
        { error: 'Missing data or format' },
        { status: 400 }
      )
    }

    // Use AI to parse the member data
    const { object: parsedData } = await generateObject({
      model: defaultModel,
      schema: MembersListSchema,
      prompt: `Parse the following ${format} data and extract member information. 
      
The data contains member information with fields like: member_number, name, phone_number, email, id_number, address.
Please extract all members and normalize the data.
- Ensure phone numbers start with 254 (Kenya country code)
- Normalize phone numbers to remove special characters
- Extract all available fields
- Keep wallet_balance as 0 for new imports

Data to parse:
${data}`,
    })

    // Validate and deduplicate members
    const validMembers = []
    const errors = []
    const duplicates = []

    for (const member of parsedData.members) {
      try {
        // Normalize phone number
        let phone = member.phone_number.replace(/\D/g, '')
        if (!phone.startsWith('254')) {
          if (phone.startsWith('0')) {
            phone = '254' + phone.substring(1)
          } else if (phone.length === 9) {
            phone = '254' + phone
          }
        }

        // Check if member already exists
        const existingByNumber = await getMemberByNumber(member.member_number)
        const existingByPhone = await getMemberByPhone(phone)

        if (existingByNumber || existingByPhone) {
          duplicates.push({
            member_number: member.member_number,
            name: member.name,
            reason: existingByNumber ? 'Duplicate member number' : 'Duplicate phone number',
          })
          continue
        }

        validMembers.push({
          member_number: member.member_number,
          name: member.name,
          phone_number: phone,
          email: member.email || null,
          id_number: member.id_number || null,
          address: member.address || null,
          wallet_balance: 0,
        })
      } catch (error) {
        errors.push({
          member: member.member_number || member.name,
          error: (error as Error).message,
        })
      }
    }

    // Insert valid members
    let inserted: any[] = []
    if (validMembers.length > 0) {
      inserted = await createMembers(validMembers)
    }

    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      duplicates: duplicates.length,
      errors: errors.length,
      members: inserted,
      duplicatesList: duplicates,
      errorsList: errors,
      summary: {
        total: parsedData.members.length,
        inserted: inserted.length,
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
