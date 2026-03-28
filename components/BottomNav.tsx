'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Users, BookOpen, UserCheck } from 'lucide-react'

interface Props {
  role: 'USER' | 'ADMIN'
}

export function BottomNav({ role }: Props) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/admin') return pathname === path
    return pathname === path || pathname.startsWith(path + '/')
  }

  if (role === 'ADMIN') {
    return (
      <div className="btm-nav btm-nav-sm sm:hidden z-50">
        <Link href="/admin" className={isActive('/admin') ? 'active text-primary' : ''}>
          <LayoutDashboard size={22} />
          <span className="btm-nav-label text-[10px]">Dashboard</span>
        </Link>
        <Link href="/admin/bets" className={isActive('/admin/bets') ? 'active text-primary' : ''}>
          <BookOpen size={22} />
          <span className="btm-nav-label text-[10px]">All Bets</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="btm-nav btm-nav-sm sm:hidden z-50">
      <Link href="/dashboard" className={isActive('/dashboard') ? 'active text-primary' : ''}>
        <LayoutDashboard size={22} />
        <span className="btm-nav-label text-[10px]">Home</span>
      </Link>
      <Link href="/dashboard/new-bet" className={isActive('/dashboard/new-bet') ? 'active text-primary' : ''}>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center -mt-5 shadow-lg ${isActive('/dashboard/new-bet') ? 'bg-primary' : 'bg-primary/80'}`}>
          <Plus size={22} className="text-primary-content" />
        </div>
        <span className="btm-nav-label text-[10px]">New Bet</span>
      </Link>
      <Link href="/dashboard/clients" className={isActive('/dashboard/clients') ? 'active text-primary' : ''}>
        <Users size={22} />
        <span className="btm-nav-label text-[10px]">Clients</span>
      </Link>
      <Link href="/dashboard/history" className={isActive('/dashboard/history') ? 'active text-primary' : ''}>
        <BookOpen size={22} />
        <span className="btm-nav-label text-[10px]">History</span>
      </Link>
      <Link href="/dashboard/friends" className={isActive('/dashboard/friends') ? 'active text-primary' : ''}>
        <UserCheck size={22} />
        <span className="btm-nav-label text-[10px]">Friends</span>
      </Link>
    </div>
  )
}
