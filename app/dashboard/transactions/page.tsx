'use client';

import { useEffect, useState } from 'react';
import { Transaction } from '@/lib/types';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions');
        if (response.ok) {
          const result = await response.json();
          // Handle both direct array and object with data property
          const data = Array.isArray(result) ? result : result.data || result;
          setTransactions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('[v0] Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.msisdn?.includes(search) ||
      tx.bill_ref_number?.includes(search) ||
      tx.trans_id?.includes(search);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'completed' && tx.status === 'completed') ||
      (filter === 'failed' && tx.status === 'failed');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground mt-2">View and manage all M-Pesa transactions</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by phone, bill reference, or request ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'completed' | 'failed')}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Transactions</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Bill Reference</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground">{tx.msisdn}</td>
                    <td className="py-3 px-4 text-foreground">KES {parseFloat(tx.trans_amount || '0').toLocaleString()}</td>
                    <td className="py-3 px-4 text-foreground text-xs">{tx.bill_ref_number}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          tx.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tx.status === 'completed' ? 'Completed' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No transactions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
