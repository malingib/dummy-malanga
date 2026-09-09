'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type PaymentTransaction = {
  id: string
  transaction_id: string | null
  transaction_type: string
  phone_number: string | null
  amount: number | string
  reference: string | null
  status: 'pending' | 'success' | 'failed' | 'reversed'
  mpesa_receipt: string | null
  result_description: string | null
  reconciliation_status: 'unreconciled' | 'matched' | 'unmatched' | 'duplicate' | 'manual'
  created_at: string
}

type ReconciliationRun = {
  id: string
  period_start: string
  period_end: string
  status: string
  transaction_count: number
  matched_count: number
  unmatched_count: number
  duplicate_count: number
  total_amount: number | string
  matched_amount: number | string
  unmatched_amount: number | string
  created_at: string
}

const statusLabels: Record<string, string> = {
  success: 'Success', pending: 'Pending', failed: 'Failed', reversed: 'Reversed',
}

const reconciliationLabels: Record<string, string> = {
  matched: 'Matched', unmatched: 'Unmatched', duplicate: 'Duplicate', manual: 'Manual', unreconciled: 'Unreconciled',
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [history, setHistory] = useState<ReconciliationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [reconciling, setReconciling] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [reconciliation, setReconciliation] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (reconciliation) params.set('reconciliation', reconciliation)
      const [txResponse, historyResponse] = await Promise.all([
        fetch(`/api/payments/transactions?${params.toString()}`),
        fetch('/api/payments/reconciliation'),
      ])
      const txResult = await txResponse.json()
      const historyResult = await historyResponse.json()
      if (!txResponse.ok) throw new Error(txResult.error || 'Unable to load transactions.')
      setTransactions(txResult.data || [])
      if (historyResponse.ok) setHistory(historyResult.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payments.')
    } finally {
      setLoading(false)
    }
  }, [search, status, reconciliation])

  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => ({
    count: transactions.length,
    amount: transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
    successful: transactions.filter(tx => tx.status === 'success').length,
    pending: transactions.filter(tx => tx.status === 'pending').length,
    unmatched: transactions.filter(tx => tx.reconciliation_status !== 'matched').length,
  }), [transactions])

  const runReconciliation = async () => {
    setReconciling(true)
    setError('')
    try {
      const response = await fetch('/api/payments/reconciliation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Reconciliation failed.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reconciliation failed.')
    } finally {
      setReconciling(false)
    }
  }

  const formatMoney = (value: number | string) => `KES ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments Operations</h1>
          <p className="mt-2 text-muted-foreground">Monitor M-Pesa collections, investigate exceptions and reconcile your ledger.</p>
        </div>
        <button onClick={runReconciliation} disabled={reconciling || loading} className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground disabled:opacity-50">
          {reconciling ? 'Reconciling…' : 'Run reconciliation'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Transactions', stats.count.toLocaleString()],
          ['Volume', formatMoney(stats.amount)],
          ['Successful', stats.successful.toLocaleString()],
          ['Pending', stats.pending.toLocaleString()],
          ['Needs review', stats.unmatched.toLocaleString()],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold text-foreground">{value}</div></div>)}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phone, reference, receipt or transaction ID" className="rounded-lg border border-border bg-background px-4 py-2 text-foreground" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2 text-foreground">
            <option value="">All statuses</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="reversed">Reversed</option>
          </select>
          <select value={reconciliation} onChange={e => setReconciliation(e.target.value)} className="rounded-lg border border-border bg-background px-4 py-2 text-foreground">
            <option value="">All reconciliation states</option><option value="matched">Matched</option><option value="unmatched">Unmatched</option><option value="duplicate">Duplicate</option><option value="manual">Manual</option><option value="unreconciled">Unreconciled</option>
          </select>
        </div>

        {loading ? <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border"><tr>{['Date','Phone','Amount','Reference','M-Pesa receipt','Status','Reconciliation'].map(h => <th key={h} className="px-3 py-3 text-left font-semibold text-foreground">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {transactions.map(tx => <tr key={tx.id} className="hover:bg-muted/40">
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</td>
                <td className="px-3 py-3 text-foreground">{tx.phone_number || '—'}</td>
                <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">{formatMoney(tx.amount)}</td>
                <td className="max-w-40 truncate px-3 py-3 text-foreground">{tx.reference || '—'}</td>
                <td className="px-3 py-3 text-xs text-foreground">{tx.mpesa_receipt || '—'}</td>
                <td className="px-3 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{statusLabels[tx.status] || tx.status}</span></td>
                <td className="px-3 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{reconciliationLabels[tx.reconciliation_status] || tx.reconciliation_status}</span></td>
              </tr>)}
            </tbody>
          </table>
          {transactions.length === 0 && <div className="py-10 text-center text-muted-foreground">No payment transactions match these filters.</div>}
        </div>}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4"><h2 className="text-lg font-semibold text-foreground">Reconciliation history</h2><p className="text-sm text-muted-foreground">Previous ledger checks for this payment workspace.</p></div>
        {history.length === 0 ? <div className="py-6 text-sm text-muted-foreground">No reconciliation runs yet.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border"><tr>{['Run','Period','Transactions','Matched','Unmatched','Duplicates','Volume'].map(h => <th key={h} className="px-3 py-3 text-left font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{history.map(run => <tr key={run.id}><td className="px-3 py-3 text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td><td className="px-3 py-3 text-xs">{new Date(run.period_start).toLocaleDateString()} – {new Date(run.period_end).toLocaleDateString()}</td><td className="px-3 py-3">{run.transaction_count}</td><td className="px-3 py-3">{run.matched_count}</td><td className="px-3 py-3">{run.unmatched_count}</td><td className="px-3 py-3">{run.duplicate_count}</td><td className="px-3 py-3">{formatMoney(run.total_amount)}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
