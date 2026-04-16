export interface Transaction {
  id: string
  mpesa_reference: string
  phone_number: string
  amount: number
  bill_reference: string | null
  case_id: string | null
  status: 'completed' | 'pending' | 'failed'
  created_at: string
  updated_at: string
  response_data: Record<string, any> | null
}

export interface Member {
  id: string
  name: string
  phone_number: string
  email: string | null
  id_number: string | null
  created_at: string
  updated_at: string
}

export interface Case {
  id: string
  case_number: string
  member_id: string
  amount_due: number
  amount_paid: number
  status: 'open' | 'closed' | 'disputed'
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
