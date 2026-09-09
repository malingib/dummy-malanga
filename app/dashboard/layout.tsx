'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem { href: string; label: string; description?: string }

const groups: { label: string; items: NavItem[] }[] = [
  { label: 'Workspace', items: [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/transactions', label: 'Payments', description: 'Collections & activity' },
    { href: '/dashboard/members', label: 'Customers' },
    { href: '/dashboard/cases', label: 'Cases' },
  ] },
  { label: 'Operations', items: [
    { href: '/dashboard/onboarding', label: 'M-Pesa connection', description: 'Connection health' },
  ] },
  { label: 'Developers', items: [
    { href: '/dashboard/developer', label: 'Developer API' },
  ] },
  { label: 'Account', items: [
    { href: '/dashboard/settings', label: 'Settings' },
  ] },
]

function Mark() {
  return <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-sm">M</div>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <Mark />
          <div>
            <div className="text-sm font-bold tracking-tight">MobiWave</div>
            <div className="text-[11px] text-muted-foreground">Payments</div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map(group => (
            <div key={group.label}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</div>
              <div className="space-y-1">
                {group.items.map(item => {
                  const active = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)
                  return <Link key={item.href} href={item.href} className={`block rounded-xl px-3 py-2.5 transition ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.description && <div className="mt-0.5 text-[11px] opacity-70">{item.description}</div>}
                  </Link>
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-xl bg-muted/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">M-Pesa status</span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Connected</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Your payment connection is healthy.</p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 lg:hidden"><Mark /><span className="text-sm font-bold">MobiWave Payments</span></div>
          <div className="hidden text-sm text-muted-foreground lg:block">Payments workspace</div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/onboarding" className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">Connection</Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">MW</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
