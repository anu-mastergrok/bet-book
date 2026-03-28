'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { LayoutDashboard, BookOpen, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/NotificationBell'

export default function FriendLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'FRIEND')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  const navItems = [
    { href: '/friend/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/friend/bets', icon: BookOpen, label: 'Bets' },
    { href: '/friend/notifications', icon: Bell, label: 'Alerts' },
  ]

  return (
    <div className="min-h-dvh bg-slate-950 text-white pb-20">
      {/* Top header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-amber-400 text-lg">Bet Book</span>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around py-2 z-10">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-4 py-1">
              <Icon size={20} className={active ? 'text-amber-400' : 'text-slate-400'} />
              <span className={`text-xs ${active ? 'text-amber-400' : 'text-slate-500'}`}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
