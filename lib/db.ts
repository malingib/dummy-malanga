import { supabaseAdmin, supabase } from './supabase'
import { Transaction, Member, Case, ValidationLog } from './types'

// Transactions
export async function getTransactions(filters?: {
  status?: string
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
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

export async function createTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .insert([transaction])
    .select()

  if (error) throw error
  return data[0] as Transaction
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

// Members
export async function getMembers(search?: string) {
  let query = supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
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

export async function createMember(member: Omit<Member, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('members')
    .insert([member])
    .select()

  if (error) throw error
  return data[0] as Member
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

// Cases
export async function getCases(filters?: { status?: string }) {
  let query = supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
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

export async function createCase(caseData: Omit<Case, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert([caseData])
    .select()

  if (error) throw error
  return data[0] as Case
}

// Validation logs
export async function createValidationLog(log: Omit<ValidationLog, 'id' | 'created_at'>) {
  const { data, error } = await supabaseAdmin
    .from('validation_logs')
    .insert([log])
    .select()

  if (error) throw error
  return data[0] as ValidationLog
}

// Get stats
export async function getTransactionStats() {
  const [completed, pending, failed, totalAmount] = await Promise.all([
    supabase.from('transactions').select('id', { count: 'exact' }).eq('status', 'completed'),
    supabase.from('transactions').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('transactions').select('id', { count: 'exact' }).eq('status', 'failed'),
    supabase.rpc('get_total_transaction_amount'),
  ])

  return {
    completed: completed.count || 0,
    pending: pending.count || 0,
    failed: failed.count || 0,
    totalAmount: totalAmount.data || 0,
  }
}
