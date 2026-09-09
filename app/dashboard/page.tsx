'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Stats = {
  totalTransactions: number
  totalAmount: number
  successfulPayments: number
  failedPayments: number
  activeMembers: number
  openCases: number
}

type Payment = {
  id: string
  phone_number: string | null
  amount: number | string
  reference: string | null
  status: 'pending' | 'success' | 'failed' | 'reversed'
  mpesa_receipt: string | null
  created_at: string
}

const money = (value: number | string) => `KES ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const shortMoney = (value: number) => value >= 1000000 ? `KES ${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `KES ${(value / 1000).toFixed(0)}K` : `KES ${value.toFixed(0)}`

function Status({ status }: { status: Payment['status'] }) {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
    reversed: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  }
  const labels = { success: 'Successful', pending: 'Pending', failed: 'Failed', reversed: 'Reversed' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [statsResponse, paymentsResponse] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/payments/transactions?limit=100'),
        ])
        const statsResult = await statsResponse.json()
        const paymentsResult = await paymentsResponse.json()
        if (!statsResponse.ok) throw new Error(statsResult.error || 'Unable to load dashboard.')
        if (active) {
          setStats(statsResult)
          setPayments(paymentsResponse.ok ? paymentsResult.data || [] : [])
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load dashboard.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      return date
    })
    return days.map(date => {
      const key = date.toISOString().slice(0, 10)
      const total = payments.filter(payment => payment.status === 'success' && payment.created_at.slice(0, 10) === key).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      return { day: date.toLocaleDateString(undefined, { weekday: 'short' }), amount: total }
    })
  }, [payments])

  const successRate = stats && stats.totalTransactions > 0 ? (stats.successfulPayments / stats.totalTransactions) * 100 : 0
  const attention = (stats?.failedPayments || 0) + (stats?.openCases || 0)

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Good afternoon</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your M-Pesa payment system at a glance.</p>
        </div>
        <Link href="/dashboard/transactions" className="inline-flex w-fit items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">View payments</Link>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Collected', stats ? money(stats.totalAmount) : '—', 'Total payment volume'],
          ['Payments', stats ? stats.totalTransactions.toLocaleString() : '—', 'Recorded transactions'],
          ['Success rate', stats ? `${successRate.toFixed(1)}%` : '—', 'Completed payments'],
          ['Needs attention', loading ? '—' : attention.toLocaleString(), 'Failed payments & open cases'],
        ].map(([label, value, caption]) => <div key={label} className="bg-card p-5 sm:p-6"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs text-muted-foreground">{caption}</div></div>)}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div><h2 className="text-base font-semibold">Payment activity</h2><p className="mt-1 text-xs text-muted-foreground">Successful collections over the last 7 days</p></div>
            <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium">7 days</span>
          </div>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="paymentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopOpacity={0.22} /><stop offset="100%" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [shortMoney(Number(value)), 'Collected']} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }} />
                <Area type="monotone" dataKey="amount" stroke="currentColor" fill="url(#paymentFill)" strokeWidth={2.5} className="text-primary" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between"><div><h2 className="text-base font-semibold">System health</h2><p className="mt-1 text-xs text-muted-foreground">Payment infrastructure status</p></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Healthy</span></div>
          <div className="mt-6 space-y-4">
            {[['M-Pesa connection', 'Connected', true], ['Payment callbacks', 'Receiving', true], ['SMS receipts', 'Active', true], ['Reconciliation', stats?.failedPayments ? 'Needs review' : 'Up to date', !stats?.failedPayments]].map(([label, value, ok]) => <div key={label} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><span className="text-sm text-muted-foreground">{label}</span><span className={`text-sm font-medium ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{value}</span></div>)}
          </div>
          <Link href="/dashboard/onboarding" className="mt-6 block rounded-lg border border-border px-3 py-2.5 text-center text-sm font-medium hover:bg-muted">Manage connection</Link>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold">Recent payments</h2><p className="mt-1 text-xs text-muted-foreground">The latest activity on your account</p></div><Link href="/dashboard/transactions" className="text-xs font-medium text-primary hover:underline">View all</Link></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-5 py-3 text-left font-medium sm:px-6">Customer</th><th className="px-3 py-3 text-left font-medium">Reference</th><th className="px-3 py-3 text-left font-medium">Amount</th><th className="px-3 py-3 text-left font-medium">Status</th><th className="px-3 py-3 text-right font-medium sm:px-6">Time</th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? [1,2,3,4].map(i => <tr key={i}>{[1,2,3,4,5].map(j => <td key={j} className="px-3 py-4 first:px-5 last:px-5 sm:first:px-6 sm:last:px-6"><div className="h-4 animate-pulse rounded bg-muted" /></td>)}</tr>) : payments.slice(0, 6).map(payment => <tr key={payment.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-medium sm:px-6"><div>{payment.phone_number || 'Unknown customer'}</div><div className="mt-0.5 text-xs text-muted-foreground">{payment.mpesa_receipt || 'M-Pesa payment'}</div></td><td className="max-w-40 truncate px-3 py-4 text-muted-foreground">{payment.reference || '—'}</td><td className="whitespace-nowrap px-3 py-4 font-medium">{money(payment.amount)}</td><td className="px-3 py-4"><Status status={payment.status} /></td><td className="whitespace-nowrap px-3 py-4 text-right text-xs text-muted-foreground sm:px-6">{new Date(payment.created_at).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}</td></tr>)}
            </tbody>
          </table>
          {!loading && payments.length === 0 && <div className="px-6 py-12 text-center"><p className="text-sm font-medium">No payments yet</p><p className="mt-1 text-xs text-muted-foreground">Your first M-Pesa collection will appear here.</p><Link href="/dashboard/onboarding" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Connect M-Pesa</Link></div>}
        </div>
      </section>
    </div>
  )
}
