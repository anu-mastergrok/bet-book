'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/components/ThemeProvider'
import { LayoutDashboard, BookOpen, Bell, Sun, Moon } from 'lucide-react'
import Link from 'next/link'

export default function FriendLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'FRIEND')) router.push('/login')
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  const isActive = (href: string) => pathname === href

  return (
    <div className="min-h-dvh bg-base-100 pb-20">
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-primary text-lg">Bet Book</span>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="btn btn-ghost btn-sm btn-circle">
            {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="btn btn-ghost btn-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>

      <div className="btm-nav btm-nav-sm sm:hidden z-50">
        <Link href="/friend/dashboard" className={isActive('/friend/dashboard') ? 'active text-primary' : ''}>
          <LayoutDashboard size={22} />
          <span className="btm-nav-label text-[10px]">Home</span>
        </Link>
        <Link href="/friend/bets" className={isActive('/friend/bets') ? 'active text-primary' : ''}>
          <BookOpen size={22} />
          <span className="btm-nav-label text-[10px]">Bets</span>
        </Link>
        <Link href="/friend/notifications" className={isActive('/friend/notifications') ? 'active text-primary' : ''}>
          <Bell size={22} />
          <span className="btm-nav-label text-[10px]">Alerts</span>
        </Link>
      </div>
    </div>
  )
}
