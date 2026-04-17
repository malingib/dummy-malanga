import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const fallbackSupabaseUrl = 'https://placeholder.supabase.co'
const fallbackAnonKey = 'placeholder-anon-key'
const resolvedSupabaseUrl = supabaseUrl || fallbackSupabaseUrl
const resolvedSupabaseAnonKey = supabaseAnonKey || fallbackAnonKey

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey)

// Server-side client with service role key
export const supabaseAdmin = createClient(
  resolvedSupabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || resolvedSupabaseAnonKey
)
