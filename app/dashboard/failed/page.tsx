'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FailedTransaction {
  id: string
  trans_id: string
  msisdn: string
  trans_amount: string
  trans_time: string
  bill_ref_number: string
  status: string
  error_message?: string
  created_at: string
}

export default function FailedPaymentsPage() {
  const [transactions, setTransactions] = useState<FailedTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [reconciling, setReconciling] = useState<string | null>(null)

  useEffect(() => {
    fetchFailedTransactions()
  }, [])

  const fetchFailedTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transactions?status=failed')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReconcile = async (transactionId: string) => {
    setReconciling(transactionId)
    try {
      const response = await fetch(`/api/transactions/${transactionId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        setTransactions(transactions.filter((t) => t.id !== transactionId))
      }
    } catch (error) {
      console.error('Reconciliation failed:', error)
    } finally {
      setReconciling(null)
    }
  }

  const filteredTransactions = transactions.filter(
    (t) =>
      t.trans_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.msisdn.includes(searchTerm) ||
      t.bill_ref_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Failed Payments</h1>
        <p className="text-muted-foreground mt-2">Review and reconcile failed transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Failed</p>
          <p className="text-3xl font-bold text-foreground mt-2">{transactions.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold text-destructive mt-2">
            KES {transactions
              .reduce((sum, t) => sum + parseFloat(t.trans_amount || '0'), 0)
              .toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pending Reconciliation</p>
          <p className="text-3xl font-bold text-foreground mt-2">{transactions.length}</p>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <input
          type="text"
          placeholder="Search by transaction ID, phone, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Card>

      {/* Transactions Table */}
      <Card className="p-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {transactions.length === 0 ? 'No failed transactions' : 'No matching transactions'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Transaction ID</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Phone</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Reference</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Time</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Error</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-3 text-foreground font-mono text-xs">{transaction.trans_id}</td>
                    <td className="p-3 text-foreground">{transaction.msisdn}</td>
                    <td className="p-3 text-foreground font-semibold">KES {parseFloat(transaction.trans_amount).toLocaleString()}</td>
                    <td className="p-3 text-foreground text-xs">{transaction.bill_ref_number}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(transaction.trans_time).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                        {transaction.error_message || 'Failed'}
                      </span>
                    </td>
                    <td className="p-3">
                      <Button
                        onClick={() => handleReconcile(transaction.id)}
                        disabled={reconciling === transaction.id}
                        size="sm"
                        variant="outline"
                      >
                        {reconciling === transaction.id ? 'Reconciling...' : 'Reconcile'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
