import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'M-Pesa Dashboard',
  description: 'M-Pesa C2B Payment Processing and Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
