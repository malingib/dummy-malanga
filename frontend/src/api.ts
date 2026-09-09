export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed'

export type Payment = {
  id: string
  phone_number: string | null
  amount: number | string
  reference: string | null
  status: PaymentStatus
  mpesa_receipt: string | null
  created_at: string
}

export type Stats = {
  totalTransactions: number
  totalAmount: number
  successfulPayments: number
  failedPayments: number
  activeMembers: number
  openCases: number
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export const api = {
  stats: () => request<Stats>('/api/dashboard/stats'),
  payments: () => request<{ transactions?: Payment[]; data?: Payment[] }>('/api/payments/transactions?limit=100'),
}
