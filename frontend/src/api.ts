export type PaymentStatus = 'pending' | 'success' | 'failed' | 'reversed'
export type ReconciliationStatus = 'unreconciled' | 'matched' | 'unmatched' | 'duplicate' | 'manual'
export type ReconciliationException = { id: string; workspace_id: string; reconciliation_run_id?: string | null; transaction_id?: string | null; type: string; severity: string; status: string; title: string; reason?: string | null; amount?: number | string | null; assigned_to?: string | null; resolution_note?: string | null; resolved_at?: string | null; created_at: string; updated_at: string }
export type MpesaActivation = { id: string; workspace_id: string; status: string; environment: string; requested_methods: string[]; notes?: string | null; last_error?: string | null; requested_at: string; reviewed_at?: string | null; completed_at?: string | null }
export type WorkspaceSettings = { id: string; business_name: string; business_phone: string; business_email: string; industry?: string | null; shortcode: string; account_format: string; notification_sms: boolean; notification_email: boolean; notification_whatsapp: boolean; developer_webhook: boolean; webhook_url?: string | null; status: string; environment: string; created_at: string; updated_at: string }

export type Payment = { id: string; phone_number: string | null; amount: number | string; reference: string | null; status: PaymentStatus; reconciliation_status?: ReconciliationStatus | null; mpesa_receipt: string | null; transaction_id?: string | null; transaction_type?: string | null; result_code?: string | null; result_description?: string | null; created_at: string; completed_at?: string | null }
export type Stats = { totalTransactions: number; totalAmount: number; successfulPayments: number; failedPayments: number; activeMembers: number; openCases: number }
export type MpesaReadiness = { workspace: { id: string; shortcode: string | null; environment: string; status: string; payment_methods: string[] | null }; readiness: { credentials: boolean; callback: boolean; connection: { credential_status?: string; callback_status?: string; last_tested_at?: string; last_error?: string | null } | null; production: boolean } }
export type ApiKey = { id: string; name: string; key_prefix: string; key_last4: string; scopes: string[]; status: string; created_at: string; last_used_at?: string | null; expires_at?: string | null; revoked_at?: string | null }
export type Webhook = { id: string; url: string; events?: string[]; status: string; created_at: string; updated_at?: string | null; last_success_at?: string | null; last_failure_at?: string | null }
export type WebhookDelivery = { id: string; endpoint_id: string; event_type: string; event_id: string; status: string; attempt_count: number; next_attempt_at?: string | null; response_status?: number | null; response_body?: string | null; last_error?: string | null; created_at: string; delivered_at?: string | null }
export type SmsDelivery = { id: string; transaction_id?: string | null; event_type: string; recipient?: string | null; status: string; provider_uid?: string | null; error_message?: string | null; created_at: string; sent_at?: string | null }
export type SmsTemplate = { id: string; name: string; event_type: string; sender_id: string; message: string; status: string; created_at: string; updated_at?: string | null }
export type PaymentNotification = { id: string; channel: string; event_type: string; recipient?: string | null; status: string; provider_uid?: string | null; error_message?: string | null; created_at: string; sent_at?: string | null }

async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`); return payload as T }
export const api = {
  stats: () => request<Stats>('/api/dashboard/stats'),
  payments: (params: Record<string, string> = {}) => request<{ transactions?: Payment[]; data?: Payment[]; count?: number }>(`/api/payments/transactions?${new URLSearchParams({ limit: '100', ...params })}`),
  payment: (id: string) => request<{ data: Payment; notifications: PaymentNotification[] }>(`/api/payments/transactions/${id}`),
  mpesa: () => request<MpesaReadiness>('/api/mpesa/admin'),
  testMpesa: () => request<{ success: boolean; credential_status: string; tested_at?: string; error?: string }>('/api/mpesa/admin', { method: 'POST' }),
  activation: () => request<{ success: boolean; data: MpesaActivation | null }>('/api/mpesa/activation'),
  requestActivation: (notes?: string) => request<{ success: boolean; data: MpesaActivation }>('/api/mpesa/activation', { method: 'POST', body: JSON.stringify({ notes }) }),
  settings: () => request<{ success: boolean; data: WorkspaceSettings }>('/api/settings'),
  updateSettings: (payload: Partial<WorkspaceSettings>) => request<{ success: boolean; data: WorkspaceSettings }>('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  stk: (payload: { phone: string; amount: number; reference: string; description: string }) => request<{ success: boolean; data: Record<string, unknown>; transaction: Payment }>('/api/payments/stk', { method: 'POST', body: JSON.stringify(payload) }),
  stkStatus: (checkoutRequestId: string) => request<{ success: boolean; data: { ResultCode?: string | number; ResultDesc?: string; [key: string]: unknown } }>('/api/payments/stk/status', { method: 'POST', body: JSON.stringify({ checkoutRequestId }) }),
  reconcile: (payload?: { periodStart?: string; periodEnd?: string }) => request<{ success: boolean; data: unknown }>('/api/payments/reconciliation', { method: 'POST', body: JSON.stringify(payload || {}) }),
  reconciliationHistory: () => request<{ success: boolean; data: Array<Record<string, unknown>> }>('/api/payments/reconciliation'),
  reconciliationExceptions: (status?: string) => request<{ data: ReconciliationException[] }>(`/api/payments/reconciliation/exceptions${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  updateReconciliationException: (id: string, payload: { status?: string; severity?: string; resolution_note?: string; assigned_to?: string | null }) => request<{ data: ReconciliationException }>(`/api/payments/reconciliation/exceptions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  smsDelivery: (status?: string) => request<{ data: SmsDelivery[] }>(`/api/sms/delivery${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  smsTemplates: () => request<{ data: SmsTemplate[] }>('/api/sms/templates'),
  createSmsTemplate: (payload: { name: string; sender_id: string; message: string }) => request<{ data: SmsTemplate }>('/api/sms/templates', { method: 'POST', body: JSON.stringify(payload) }),
  apiKeys: () => request<{ keys: ApiKey[] }>('/api/developer/keys'),
  createApiKey: (payload: { name: string; scopes: string[] }) => request<{ key: ApiKey; secret: string; warning: string }>('/api/developer/keys', { method: 'POST', body: JSON.stringify(payload) }),
  revokeApiKey: (id: string) => request<{ success: boolean }>(`/api/developer/keys/${id}`, { method: 'DELETE' }),
  webhooks: () => request<{ endpoints: Webhook[] }>('/api/developer/webhooks'),
  createWebhook: (payload: { url: string; events: string[] }) => request<{ endpoint: Webhook; secret: string; warning: string }>('/api/developer/webhooks', { method: 'POST', body: JSON.stringify(payload) }),
  updateWebhook: async (id: string, payload: { url?: string; events?: string[]; status?: string }) => { const response = await request<{ endpoint: Webhook }>(`/api/developer/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); return { ...response, secret: '' } },
  disableWebhook: (id: string) => request<{ success: boolean }>(`/api/developer/webhooks/${id}`, { method: 'DELETE' }),
  webhookDeliveries: (endpointId?: string) => request<{ deliveries: WebhookDelivery[] }>(`/api/developer/webhooks/deliveries${endpointId ? `?endpoint_id=${encodeURIComponent(endpointId)}` : ''}`),
  retryWebhookDelivery: (deliveryId: string) => request<{ success: boolean; delivery_id: string; result: Record<string, unknown> }>('/api/developer/webhooks/deliveries', { method: 'POST', body: JSON.stringify({ delivery_id: deliveryId }) }),
  apiPlayground: (path: string, method: 'GET' | 'POST', apiKey: string, body?: Record<string, unknown>, idempotencyKey?: string) => request<Record<string, unknown>>(path, { method, headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: method === 'POST' ? JSON.stringify(body || {}) : undefined }),
}
