import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { GoogleProvider } from '@/components/GoogleProvider'

export const metadata: Metadata = {
  title: 'Bet Book Platform',
  description: 'Digital ledger for tracking cricket/sports betting records',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GoogleProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </GoogleProvider>
      </body>
    </html>
  )
}
