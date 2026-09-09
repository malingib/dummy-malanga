'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem { href: string; label: string }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/onboarding', label: 'Connect M-Pesa' },
  { href: '/dashboard/transactions', label: 'Transactions' },
  { href: '/dashboard/members', label: 'Members' },
  { href: '/dashboard/cases', label: 'Cases' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-card border-r border-border shadow-sm overflow-y-auto">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-primary">Mobiwave Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Payment Dashboard</p>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`block px-4 py-3 rounded-lg transition-colors ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 m-4 bg-secondary/50 rounded-lg border border-border">
          <p className="text-xs font-semibold text-foreground">Environment</p>
          <p className="text-xs text-muted-foreground mt-1">{process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'Development' : 'Production'}</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><div className="p-8">{children}</div></main>
    </div>
  );
}
