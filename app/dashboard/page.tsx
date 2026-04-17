'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';

interface Stats {
  totalTransactions: number;
  totalAmount: number;
  successfulPayments: number;
  failedPayments: number;
  activeMembers: number;
  openCases: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your payment system</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard
            title="Total Transactions"
            value={stats.totalTransactions}
            description="All recorded transactions"
          />
          <StatsCard
            title="Total Amount"
            value={`KES ${stats.totalAmount.toLocaleString()}`}
            description="Sum of all transactions"
          />
          <StatsCard
            title="Successful Payments"
            value={stats.successfulPayments}
            description={`${stats.totalTransactions > 0 ? Math.round((stats.successfulPayments / stats.totalTransactions) * 100) : 0}% success rate`}
          />
          <StatsCard
            title="Failed Payments"
            value={stats.failedPayments}
            description="Require reconciliation"
          />
          <StatsCard
            title="Active Members"
            value={stats.activeMembers}
            description="Members with transactions"
          />
          <StatsCard
            title="Open Cases"
            value={stats.openCases}
            description="Cases needing attention"
          />
        </div>
      ) : null}

      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href="/dashboard/transactions"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-center"
          >
            View Transactions
          </a>
          <a
            href="/dashboard/members"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-center"
          >
            Manage Members
          </a>
          <a
            href="/dashboard/cases"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-center"
          >
            View Cases
          </a>
          <a
            href="/dashboard/settings"
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition text-center"
          >
            Settings
          </a>
        </div>
      </div>
    </div>
  );
}
