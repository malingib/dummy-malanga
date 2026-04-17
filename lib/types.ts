export interface Transaction {
  id: string
  trans_id: string
  trans_type?: string
  trans_time?: string
  trans_amount: string
  business_shortcode?: string
  bill_ref_number: string
  invoice_number?: string
  org_account_balance?: string
  third_party_trans_id?: string
  msisdn: string
  first_name?: string
  middle_name?: string
  last_name?: string
  status: 'completed' | 'pending' | 'failed' | 'reconciled'
  error_message?: string | null
  created_at: string
  updated_at: string
  response_data?: Record<string, any> | null
}

export interface Member {
  id: string
  member_number: string
  name: string
  phone_number: string
  email: string | null
  id_number: string | null
  address: string | null
  wallet_balance: number
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  case_number: string
  member_id: string
  description: string
  amount_due: number
  amount_paid: number
  contribution_per_member?: number
  status: 'open' | 'closed' | 'disputed'
  is_active?: boolean
  is_finalized?: boolean
  created_at: string
  updated_at: string
}

export interface ValidationLog {
  id: string
  phone_number: string
  amount: number
  bill_reference: string | null
  validation_result: boolean
  created_at: string
}

export interface CallbackLog {
  id: string
  mpesa_reference: string
  response_code: string
  response_description: string
  created_at: string
}
