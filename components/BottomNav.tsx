'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  Settings,
  History,
  Bell,
  Plus,
} from 'lucide-react'

interface Props {
  role: 'ADMIN' | 'USER' | 'FRIEND'
}

interface TabItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const adminTabs: TabItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/bets', label: 'Bets', icon: ClipboardList },
  { href: '/admin/series', label: 'Series', icon: Trophy },
  { href: '/admin/users', label: 'Admin', icon: Settings },
]

const userTabs: TabItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/bets', label: 'Bets', icon: ClipboardList },
  { href: '/dashboard/series', label: 'Series', icon: Trophy },
  { href: '/dashboard/history', label: 'History', icon: History },
]

const friendTabs: TabItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/bets', label: 'Bets', icon: ClipboardList },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
]

const tabsByRole: Record<Props['role'], TabItem[]> = {
  ADMIN: adminTabs,
  USER: userTabs,
  FRIEND: friendTabs,
}

export function BottomNav({ role }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (pathname === href) return true
    // Only apply prefix matching for non-root paths
    if (href === '/admin' || href === '/dashboard') return false
    return pathname.startsWith(href + '/')
  }

  const tabs = tabsByRole[role]
  const showFab =
    role === 'USER' &&
    (pathname === '/dashboard' || pathname === '/dashboard/new-bet')

  return (
    <>
      <div className="btm-nav btm-nav-sm sm:hidden z-50">
        {tabs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center ${isActive(item.href) ? 'active text-primary' : ''}`}
          >
            <item.icon className="h-5 w-5" />
            <span className="btm-nav-label text-[10px]">{item.label}</span>
          </Link>
        ))}
      </div>

      {showFab && (
        <Link
          href="/dashboard/new-bet"
          className="btn btn-primary btn-circle fixed bottom-20 right-4 z-50 shadow-lg sm:hidden"
          aria-label="New Bet"
        >
          <Plus className="h-5 w-5" />
        </Link>
      )}
    </>
  )
}
