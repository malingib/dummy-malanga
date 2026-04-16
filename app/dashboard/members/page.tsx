'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Member } from '@/lib/types';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/members');
        if (response.ok) {
          const data = await response.json();
          setMembers(data);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const filtered = members.filter(
    (member) =>
      member.phone_number.includes(search) ||
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Members</h1>
          <p className="text-muted-foreground mt-2">Manage member profiles and information</p>
        </div>
        <Button onClick={() => router.push('/dashboard/members/import')}>
          Import Members
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
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
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">ID Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground font-medium">{member.name}</td>
                    <td className="py-3 px-4 text-foreground">{member.phone_number}</td>
                    <td className="py-3 px-4 text-foreground">{member.email || '—'}</td>
                    <td className="py-3 px-4 text-foreground">{member.id_number || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No members found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
