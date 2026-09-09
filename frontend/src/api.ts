export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed'
export type ReconciliationStatus = 'unreconciled' | 'matched' | 'unmatched' | 'duplicate' | 'manual'

export type Payment = {
  id: string
  phone_number: string | null
  amount: number | string
  reference: string | null
  status: PaymentStatus
  reconciliation_status?: ReconciliationStatus | null
  mpesa_receipt: string | null
  transaction_id?: string | null
  transaction_type?: string | null
  created_at: string
  completed_at?: string | null
}
export type Stats = { totalTransactions: number; totalAmount: number; successfulPayments: number; failedPayments: number; activeMembers: number; openCases: number }
export type MpesaReadiness = { workspace: { id: string; shortcode: string | null; environment: string; status: string; payment_methods: string[] | null }; readiness: { credentials: boolean; callback: boolean; connection: { credential_status?: string; callback_status?: string; last_tested_at?: string; last_error?: string | null } | null; production: boolean } }
export type ApiKey = { id: string; name: string; key_prefix: string; key_last4: string; scopes: string[]; status: string; created_at: string; last_used_at?: string | null; expires_at?: string | null; revoked_at?: string | null }
export type Webhook = { id: string; url: string; events?: string[]; status: string; created_at: string; updated_at?: string | null; last_success_at?: string | null; last_failure_at?: string | null }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`)
  return payload as T
}
export const api = {
  stats: () => request<Stats>('/api/dashboard/stats'),
  payments: (params: Record<string, string> = {}) => request<{ transactions?: Payment[]; data?: Payment[]; count?: number }>(`/api/payments/transactions?${new URLSearchParams({ limit: '100', ...params })}`),
  mpesa: () => request<MpesaReadiness>('/api/mpesa/admin'),
  testMpesa: () => request<{ success: boolean; credential_status: string; tested_at?: string; error?: string }>('/api/mpesa/admin', { method: 'POST' }),
  stk: (payload: { phone: string; amount: number; reference: string; description: string }) => request<{ success: boolean; data: Record<string, unknown>; transaction: Payment }>('/api/payments/stk', { method: 'POST', body: JSON.stringify(payload) }),
  reconcile: (payload?: { periodStart?: string; periodEnd?: string }) => request<{ success: boolean; data: unknown }>('/api/payments/reconciliation', { method: 'POST', body: JSON.stringify(payload || {}) }),
  reconciliationHistory: () => request<{ success: boolean; data: Array<Record<string, unknown>> }>('/api/payments/reconciliation'),
  apiKeys: () => request<{ keys: ApiKey[] }>('/api/developer/keys'),
  createApiKey: (payload: { name: string; scopes: string[] }) => request<{ key: ApiKey; secret: string; warning: string }>('/api/developer/keys', { method: 'POST', body: JSON.stringify(payload) }),
  revokeApiKey: (id: string) => request<{ success: boolean }>(`/api/developer/keys/${id}`, { method: 'DELETE' }),
  webhooks: () => request<{ endpoints: Webhook[] }>('/api/developer/webhooks'),
  createWebhook: (payload: { url: string; events: string[] }) => request<{ endpoint: Webhook; secret: string; warning: string }>('/api/developer/webhooks', { method: 'POST', body: JSON.stringify(payload) }),
  updateWebhook: (id: string, payload: { url?: string; events?: string[]; status?: string }) => request<{ endpoint: Webhook }>(`/api/developer/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  disableWebhook: (id: string) => request<{ success: boolean }>(`/api/developer/webhooks/${id}`, { method: 'DELETE' }),
  apiPlayground: (path: string, method: 'GET' | 'POST', apiKey: string, body?: Record<string, unknown>, idempotencyKey?: string) => request<Record<string, unknown>>(path, { method, headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: method === 'POST' ? JSON.stringify(body || {}) : undefined }),
}
