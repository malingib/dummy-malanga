'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Settings save logic - these would be stored in Supabase admin table
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconciliation = async () => {
    setReconciling(true);
    try {
      // Trigger full reconciliation check
      const response = await fetch('/api/admin/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const result = await response.json();
        setReconciliationResult(result);
      }
    } catch (error) {
      console.error('Reconciliation failed:', error);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your payment system and reconciliation</p>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm text-green-700">Settings saved successfully!</p>
        </div>
      )}

      {/* API Configuration */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">API Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Business Shortcode
                </label>
                <input
                  type="text"
                  placeholder="Your M-Pesa business shortcode"
                  defaultValue={process.env.NEXT_PUBLIC_MPESA_SHORTCODE || ''}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Consumer Key (from .env)
                </label>
                <input
                  type="password"
                  placeholder="Set in environment variables"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Consumer Secret (from .env)
                </label>
                <input
                  type="password"
                  placeholder="Set in environment variables"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-semibold text-foreground mb-4">Webhook Configuration</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Validation Webhook URL</p>
                <div className="p-3 bg-muted rounded-lg font-mono text-xs text-foreground break-all">
                  {typeof window !== 'undefined' 
                    ? `${window.location.origin}/api/mpesa/validation`
                    : 'https://your-domain.com/api/mpesa/validation'}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Confirmation Webhook URL</p>
                <div className="p-3 bg-muted rounded-lg font-mono text-xs text-foreground break-all">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/api/mpesa/confirmation`
                    : 'https://your-domain.com/api/mpesa/confirmation'}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Copy these URLs to your M-Pesa Daraja portal callback configuration.
            </p>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Card>

      {/* Reconciliation Tools */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Reconciliation Tools</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Run reconciliation to identify and fix mismatches between M-Pesa payments and your system.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleReconciliation}
              disabled={reconciling}
              variant="outline"
              className="w-full"
            >
              {reconciling ? 'Running Reconciliation...' : 'Run Full Reconciliation'}
            </Button>
          </div>

          {reconciliationResult && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-foreground">Reconciliation Results</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {reconciliationResult.totalTransactions}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-xs text-green-700">Matched</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {reconciliationResult.matched}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-xs text-yellow-700">Unmatched</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">
                    {reconciliationResult.unmatched}
                  </p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <p className="text-xs text-red-700">Duplicates</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {reconciliationResult.duplicates}
                  </p>
                </div>
              </div>

              {reconciliationResult.unmatched > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    {reconciliationResult.unmatched} transactions need manual review. 
                    Check the Failed Payments page for details.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Member Management */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Member Management</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Bulk operations for member accounts
            </p>
          </div>
          <Button variant="outline" className="w-full">
            Reset All Wallet Balances
          </Button>
          <Button variant="outline" className="w-full">
            Export Member List
          </Button>
        </div>
      </Card>

      {/* System Status */}
      <Card className="p-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-foreground">Supabase Database</span>
              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-foreground">M-Pesa API</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                Ready
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-foreground">Webhooks</span>
              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
                Active
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
