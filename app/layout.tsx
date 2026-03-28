import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { GoogleProvider } from '@/components/GoogleProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

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
    <html lang="en" suppressHydrationWarning data-theme="night">
      <body>
        <ThemeProvider>
          <GoogleProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </GoogleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
