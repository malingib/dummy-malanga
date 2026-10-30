export class AdminApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.payload = payload
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const adminPath = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(adminPath(path), {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/admin/session')) {
      window.dispatchEvent(new Event('mobiwave:admin-unauthorized'))
    }
    throw new AdminApiError(payload?.error || `Admin request failed (${response.status})`, response.status, payload)
  }
  return payload as T
}

function queryString(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') query.set(key, String(value))
  }
  const value = query.toString()
  return value ? `?${value}` : ''
}

export type AdminSession = {
  authenticated: boolean
  configured: boolean
  name?: string
  username?: string
  expires_at?: string
}

export type AdminHealthCheck = {
  label: string
  value: string
  state: 'ok' | 'warning' | 'unknown'
  detail: string
}

export type AdminSeriesPoint = {
  date: string
  label: string
  value?: number
  volume?: number
  count?: number
  success_rate?: number
}

export type AdminMerchantSummary = {
  id: string
  business_name: string
  business_email?: string | null
  business_phone?: string | null
  industry?: string | null
  shortcode?: string | null
  account_format?: string | null
  environment: string
  status: string
  payment_methods?: string[] | null
  created_at: string
  updated_at?: string | null
  transaction_count?: number | string | null
  success_count?: number | string | null
  failed_count?: number | string | null
  pending_count?: number | string | null
  volume?: number | string | null
  last_payment_at?: string | null
  connection_status?: string | null
  callback_status?: string | null
  last_tested_at?: string | null
  activation_status?: string | null
  activation_requested_at?: string | null
  open_exceptions?: number | string | null
}

export type AdminPayment = {
  id: string
  workspace_id: string
  business_name?: string
  shortcode?: string | null
  environment?: string | null
  phone_number?: string | null
  amount: number | string
  reference?: string | null
  status: string
  reconciliation_status?: string | null
  mpesa_receipt?: string | null
  transaction_id?: string | null
  transaction_type?: string | null
  result_code?: string | null
  result_description?: string | null
  created_at: string
  completed_at?: string | null
}

export type AdminException = {
  id: string
  workspace_id: string
  business_name?: string
  shortcode?: string | null
  environment?: string | null
  reconciliation_run_id?: string | null
  transaction_id?: string | null
  type: string
  severity: string
  status: string
  title: string
  reason?: string | null
  amount?: number | string | null
  resolution_note?: string | null
  resolved_at?: string | null
  created_at: string
  updated_at: string
}

export type AdminActivation = {
  id: string
  workspace_id: string
  business_name?: string
  shortcode?: string | null
  merchant_environment?: string | null
  merchant_status?: string | null
  status: string
  environment: string
  requested_methods: string[]
  notes?: string | null
  last_error?: string | null
  requested_at: string
  reviewed_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
}

export type AdminAuditEntry = {
  id: string
  actor_name: string
  action: string
  target_type?: string | null
  target_id?: string | null
  workspace_id?: string | null
  business_name?: string | null
  shortcode?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
}

export type AdminConnection = {
  id: string
  shortcode: string
  account_type: string
  environment: string
  credential_source: string
  connection_status: string
  token_status: string
  callback_status: string
  is_primary: boolean
  is_active: boolean
  last_tested_at?: string | null
  last_error?: string | null
  created_at: string
}

export type AdminOverview = {
  success: boolean
  generated_at: string
  window_days: number
  degraded?: boolean
  degraded_reason?: string
  sample_size?: number
  merchants: {
    total: number
    live: number
    sandbox: number
    production: number
    new_in_window: number
    series: AdminSeriesPoint[]
  }
  payments: {
    total: number
    success: number
    failed: number
    pending: number
    reversed: number
    success_rate: number
    volume: number
    previous_volume: number
    volume_change: number | null
    sampled_total?: number
    series: AdminSeriesPoint[]
  }
  queues: {
    open_exceptions: number
    critical_exceptions: number
    activation_requests: number
    failed_webhooks: number
    failed_notifications: number
    oldest_activation_at?: string | null
  }
  health: AdminHealthCheck[]
  recent_merchants: AdminMerchantSummary[]
  activation_queue: AdminActivation[]
  recent_exceptions: AdminException[]
}

export type AdminMerchantDetail = {
  success: boolean
  degraded: boolean
  data: {
    merchant: AdminMerchantSummary
    summary: {
      transaction_count: number
      success_count: number
      failed_count: number
      pending_count: number
      volume: number
      open_exceptions: number
      api_keys: number
    }
    transactions: AdminPayment[]
    exceptions: AdminException[]
    activations: AdminActivation[]
    connections: AdminConnection[]
    audit: AdminAuditEntry[]
    admin_audit: AdminAuditEntry[]
    fetched_at: string
  }
}

export const adminApi = {
  session: () => request<AdminSession>('/api/admin/session'),
  login: (username: string, password: string) =>
    request<AdminSession & { success: true }>('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ success: true }>('/api/admin/session', { method: 'DELETE' }),
  overview: (days = 14) => request<AdminOverview>(`/api/admin/overview${queryString({ days })}`),
  merchants: (params: { q?: string; status?: string; environment?: string; limit?: number; offset?: number } = {}) =>
    request<{ success: boolean; data: AdminMerchantSummary[]; count: number; limit: number; offset: number; degraded?: boolean; degraded_reason?: string }>(
      `/api/admin/merchants${queryString(params)}`,
    ),
  merchant: (id: string) => request<AdminMerchantDetail>(`/api/admin/merchants/${encodeURIComponent(id)}`),
  transactions: (params: { q?: string; status?: string; reconciliation?: string; workspace_id?: string; from?: string; to?: string; limit?: number; offset?: number } = {}) =>
    request<{ success: boolean; data: AdminPayment[]; count: number; limit: number; offset: number }>(
      `/api/admin/transactions${queryString(params)}`,
    ),
  exceptions: (params: { status?: string; severity?: string; workspace_id?: string; limit?: number } = {}) =>
    request<{ success: boolean; data: AdminException[]; count: number; limit: number }>(
      `/api/admin/exceptions${queryString(params)}`,
    ),
  updateException: (payload: { id: string; status: string; resolution_note?: string; previous_status?: string }) =>
    request<{ success: boolean; data: AdminException }>('/api/admin/exceptions', { method: 'PATCH', body: JSON.stringify(payload) }),
  activations: (params: { status?: string; environment?: string; limit?: number } = {}) =>
    request<{ success: boolean; data: AdminActivation[]; count: number; limit: number }>(
      `/api/admin/activations${queryString(params)}`,
    ),
  updateActivation: (payload: { id: string; action: string; note?: string }) =>
    request<{ success: boolean; data: AdminActivation }>('/api/admin/activations', { method: 'PATCH', body: JSON.stringify(payload) }),
  audit: (params: { limit?: number; workspace_id?: string } = {}) =>
    request<{ success: boolean; data: AdminAuditEntry[]; count: number; warning?: string; migration_required?: boolean }>(
      `/api/admin/audit${queryString(params)}`,
    ),
}
