'use client';

import { useEffect, useState } from 'react';
import { Case } from '@/lib/types';

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await fetch('/api/cases');
        if (response.ok) {
          const data = await response.json();
          setCases(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('[v0] Failed to fetch cases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  const filtered = cases.filter((caseItem) => {
    const matchesSearch =
      caseItem.case_number?.includes(search) ||
      caseItem.description?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' || (filter === 'open' && caseItem.status !== 'closed') || (filter === 'closed' && caseItem.status === 'closed');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cases</h1>
        <p className="text-muted-foreground mt-2">Track and manage payment dispute cases</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by case number or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'open' | 'closed' | 'all')}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="open">Open Cases</option>
            <option value="closed">Closed Cases</option>
            <option value="all">All Cases</option>
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
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Case #</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Member ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground font-medium">{caseItem.case_number}</td>
                    <td className="py-3 px-4 text-foreground">{caseItem.member_id || '—'}</td>
                    <td className="py-3 px-4 text-foreground text-xs max-w-xs truncate">
                      {caseItem.description}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          caseItem.status === 'closed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {caseItem.status === 'closed' ? 'Closed' : 'Open'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(caseItem.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No cases found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
