import { supabaseAdmin, supabase } from './supabase'
import { Transaction, Member, Case, ValidationLog } from './types'

// ============================================================
// TRANSACTIONS
// ============================================================
export async function getTransactions(filters?: {
  status?: string
  limit?: number
  offset?: number
  search?: string
}) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(
      `trans_id.ilike.%${filters.search}%,msisdn.ilike.%${filters.search}%,bill_ref_number.ilike.%${filters.search}%`
    )
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Transaction[]
}

export async function getTransaction(id: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Transaction
}

export async function getTransactionByTransId(transId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('trans_id', transId)
    .single()

  if (error) return null
  return data as Transaction
}

export async function createTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert([transaction])
    .select()

  if (error) throw error
  return data[0] as Transaction
}

export async function upsertTransactionByTransId(
  transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .upsert([transaction], { onConflict: 'trans_id' })
    .select()
    .single()

  if (error) throw error
  return data as Transaction
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()

  if (error) throw error
  return data[0] as Transaction
}

export async function reconcileTransaction(id: string) {
  return updateTransaction(id, {
    status: 'reconciled',
    error_message: null,
  })
}

export async function getFailedTransactions(limit?: number) {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Transaction[]
}

export async function getTransactionStats() {
  const { data, error } = await supabase
    .from('transactions')
    .select('status, trans_amount', { count: 'exact' })

  if (error) throw error

  const stats = {
    total: 0,
    amount: 0,
    successful: 0,
    failed: 0,
  }

  if (Array.isArray(data)) {
    data.forEach((t) => {
      stats.total++
      stats.amount += parseFloat(t.trans_amount || 0)
      if (t.status === 'completed') stats.successful++
      else if (t.status === 'failed') stats.failed++
    })
  }

  return stats
}

export async function getDuplicateTransactionCount() {
  const { data, error } = await supabase
    .from('transactions')
    .select('trans_id')

  if (error) throw error

  const transIdCounts = new Map<string, number>()
  for (const row of data || []) {
    transIdCounts.set(row.trans_id, (transIdCounts.get(row.trans_id) || 0) + 1)
  }

  let duplicates = 0
  transIdCounts.forEach((count) => {
    if (count > 1) duplicates += count - 1
  })

  return duplicates
}

// ============================================================
// MEMBERS
// ============================================================
export async function getMembers(search?: string, limit?: number) {
  let query = supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,phone_number.ilike.%${search}%,member_number.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Member[]
}

export async function getMember(id: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Member
}

export async function getMemberByNumber(memberNumber: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('member_number', memberNumber)
    .single()

  if (error) return null
  return data as Member
}

export async function getMemberByPhone(phoneNumber: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (error) return null
  return data as Member
}

export async function createMember(member: Omit<Member, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('members')
    .insert([member])
    .select()

  if (error) throw error
  return data[0] as Member
}

export async function createMembers(members: Omit<Member, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabaseAdmin
    .from('members')
    .insert(members)
    .select()

  if (error) throw error
  return data as Member[]
}

export async function getMembersByIdentifiers(memberNumbers: string[], phoneNumbers: string[]) {
  const existingMemberNumbers = new Set<string>()
  const existingPhoneNumbers = new Set<string>()

  if (memberNumbers.length > 0) {
    const { data, error } = await supabase
      .from('members')
      .select('member_number')
      .in('member_number', memberNumbers)

    if (error) throw error

    for (const row of data || []) {
      existingMemberNumbers.add(row.member_number)
    }
  }

  if (phoneNumbers.length > 0) {
    const { data, error } = await supabase
      .from('members')
      .select('phone_number')
      .in('phone_number', phoneNumbers)

    if (error) throw error

    for (const row of data || []) {
      existingPhoneNumbers.add(row.phone_number)
    }
  }

  return { existingMemberNumbers, existingPhoneNumbers }
}

export async function updateMember(id: string, updates: Partial<Member>) {
  const { data, error } = await supabaseAdmin
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()

  if (error) throw error
  return data[0] as Member
}

export async function getMembersCount() {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact' })

  if (error) throw error
  return count || 0
}

// ============================================================
// CASES
// ============================================================
export async function getCases(search?: string, status?: string) {
  let query = supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`case_number.ilike.%${search}%,description.ilike.%${search}%`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Case[]
}

export async function getCase(id: string) {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Case
}

export async function getCaseByNumber(caseNumber: string) {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('case_number', caseNumber)
    .single()

  if (error) return null
  return data as Case
}

export async function createCase(caseData: Omit<Case, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert([caseData])
    .select()

  if (error) throw error
  return data[0] as Case
}

export async function updateCase(id: string, updates: Partial<Case>) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .update(updates)
    .eq('id', id)
    .select()

  if (error) throw error
  return data[0] as Case
}

export async function getCasesCount() {
  const { count, error } = await supabase
    .from('cases')
    .select('*', { count: 'exact' })

  if (error) throw error
  return count || 0
}

export async function getActiveCases() {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Case[]
}

// ============================================================
// LOGS
// ============================================================
export async function createValidationLog(log: Omit<ValidationLog, 'id' | 'created_at'>) {
  const { data, error } = await supabaseAdmin
    .from('validation_logs')
    .insert([log])
    .select()
    .single()

  if (error) throw error
  return data as ValidationLog
}

export async function createCallbackLog(log: {
  trans_id?: string
  response_code: string
  response_description: string
}) {
  const { data, error } = await supabaseAdmin
    .from('callback_logs')
    .insert([log])
    .select()
    .single()

  if (error) throw error
  return data
}
