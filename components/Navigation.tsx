'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold text-primary">
            M-Pesa System
          </Link>

          <div className="flex gap-6">
            <Link
              href="/dashboard"
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                isActive('/dashboard') && pathname === '/dashboard'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/transactions"
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                isActive('/dashboard/transactions')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Transactions
            </Link>
            <Link
              href="/dashboard/members"
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                isActive('/dashboard/members')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Members
            </Link>
            <Link
              href="/dashboard/cases"
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                isActive('/dashboard/cases')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Cases
            </Link>
            <Link
              href="/dashboard/settings"
              className={`px-3 py-2 text-sm font-medium rounded-md transition ${
                isActive('/dashboard/settings')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
