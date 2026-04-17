import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createMembers, getMembersByIdentifiers } from '@/lib/db'

const MemberSchema = z.object({
  member_number: z.string().trim().min(1),
  name: z.string().trim().min(1),
  phone_number: z.string().trim().min(10),
  email: z.string().trim().email().optional(),
  id_number: z.string().trim().optional(),
  address: z.string().trim().optional(),
})

type ParsedMemberInput = z.infer<typeof MemberSchema>

interface ImportRequestBody {
  data?: string
  format?: 'csv' | 'json' | 'text'
}

function normalizePhoneNumber(phoneRaw: string): string {
  let phone = phoneRaw.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`
  if (phone.length === 9) phone = `254${phone}`
  return phone
}

function parseCsvOrTextRows(rawData: string) {
  const lines = rawData
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const firstLine = lines[0].toLowerCase()
  const hasHeader = firstLine.includes('member_number') || firstLine.includes('phone_number')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map((line) => {
    const columns = line
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)|\|/)
      .map((column) => column.trim().replace(/^"|"$/g, ''))

    return {
      member_number: columns[0] || '',
      name: columns[1] || '',
      phone_number: columns[2] || '',
      email: columns[3] || undefined,
      id_number: columns[4] || undefined,
      address: columns[5] || undefined,
    }
  })
}

function parseInputData(data: string, format: 'csv' | 'json' | 'text'): ParsedMemberInput[] {
  if (format === 'json') {
    const parsed = JSON.parse(data)
    const members = Array.isArray(parsed) ? parsed : parsed?.members
    if (!Array.isArray(members)) {
      throw new Error('JSON must be an array or { "members": [] }')
    }
    return members
  }

  return parseCsvOrTextRows(data)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImportRequestBody
    const rawData = body.data?.trim()
    const format = body.format || 'csv'

    if (!rawData) {
      return NextResponse.json({ error: 'Missing import data' }, { status: 400 })
    }

    const parsedMembers = parseInputData(rawData, format)
    if (parsedMembers.length === 0) {
      return NextResponse.json({ error: 'No members found in import payload' }, { status: 400 })
    }

    const validMembers: Array<{
      member_number: string
      name: string
      phone_number: string
      email: string | null
      id_number: string | null
      address: string | null
      wallet_balance: number
    }> = []
    const errors: Array<{ member: string; error: string }> = []
    const duplicates: Array<{ member_number: string; name: string; reason: string }> = []

    const seenMemberNumbers = new Set<string>()
    const seenPhoneNumbers = new Set<string>()

    for (const row of parsedMembers) {
      try {
        const validated = MemberSchema.parse(row)
        const normalizedPhone = normalizePhoneNumber(validated.phone_number)

        if (seenMemberNumbers.has(validated.member_number)) {
          duplicates.push({
            member_number: validated.member_number,
            name: validated.name,
            reason: 'Duplicate in import: member number',
          })
          continue
        }

        if (seenPhoneNumbers.has(normalizedPhone)) {
          duplicates.push({
            member_number: validated.member_number,
            name: validated.name,
            reason: 'Duplicate in import: phone number',
          })
          continue
        }

        seenMemberNumbers.add(validated.member_number)
        seenPhoneNumbers.add(normalizedPhone)

        validMembers.push({
          member_number: validated.member_number,
          name: validated.name,
          phone_number: normalizedPhone,
          email: validated.email || null,
          id_number: validated.id_number || null,
          address: validated.address || null,
          wallet_balance: 0,
        })
      } catch (error) {
        errors.push({
          member: (row as { member_number?: string; name?: string }).member_number
            || (row as { name?: string }).name
            || 'Unknown',
          error: (error as Error).message,
        })
      }
    }

    const memberNumbers = validMembers.map((member) => member.member_number)
    const phoneNumbers = validMembers.map((member) => member.phone_number)
    const { existingMemberNumbers, existingPhoneNumbers } = await getMembersByIdentifiers(
      memberNumbers,
      phoneNumbers
    )

    const membersToInsert = []
    for (const member of validMembers) {
      if (existingMemberNumbers.has(member.member_number)) {
        duplicates.push({
          member_number: member.member_number,
          name: member.name,
          reason: 'Already exists in database: member number',
        })
        continue
      }

      if (existingPhoneNumbers.has(member.phone_number)) {
        duplicates.push({
          member_number: member.member_number,
          name: member.name,
          reason: 'Already exists in database: phone number',
        })
        continue
      }

      membersToInsert.push(member)
    }

    if (membersToInsert.length > 0) {
      await createMembers(membersToInsert)
    }

    return NextResponse.json({
      success: true,
      inserted: membersToInsert.length,
      duplicates: duplicates.length,
      errors: errors.length,
      duplicatesList: duplicates,
      errorsList: errors,
      summary: {
        total: parsedMembers.length,
        inserted: membersToInsert.length,
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
