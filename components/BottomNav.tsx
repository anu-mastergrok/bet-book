'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, Users, BookOpen, Zap } from 'lucide-react'

interface Props {
  role: 'USER' | 'ADMIN'
}

export function BottomNav({ role }: Props) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname === path || pathname.startsWith(path + '/')
  }

  if (role === 'ADMIN') {
    return (
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
        <div className="flex items-end">
          {/* Dashboard Tab */}
          <Link
            href="/admin"
            className="flex flex-col items-center gap-0.5 py-2 flex-1"
          >
            <LayoutDashboard
              size={24}
              className={isActive('/admin') ? 'text-amber-400' : 'text-slate-400'}
            />
            <span
              className={`text-[10px] font-medium ${
                isActive('/admin') ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              Dashboard
            </span>
          </Link>

          {/* All Bets Tab */}
          <Link
            href="/admin/bets"
            className="flex flex-col items-center gap-0.5 py-2 flex-1"
          >
            <Zap
              size={24}
              className={isActive('/admin/bets') ? 'text-amber-400' : 'text-slate-400'}
            />
            <span
              className={`text-[10px] font-medium ${
                isActive('/admin/bets') ? 'text-amber-400' : 'text-slate-500'
              }`}
            >
              All Bets
            </span>
          </Link>
        </div>
      </nav>
    )
  }

  // User navigation
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
      <div className="flex items-end">
        {/* Home Tab */}
        <Link
          href="/dashboard"
          className="flex flex-col items-center gap-0.5 py-2 flex-1"
        >
          <LayoutDashboard
            size={24}
            className={isActive('/dashboard') ? 'text-amber-400' : 'text-slate-400'}
          />
          <span
            className={`text-[10px] font-medium ${
              isActive('/dashboard') ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            Home
          </span>
        </Link>

        {/* New Bet Tab */}
        <Link href="/dashboard/new-bet" className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center -mt-5 shadow-lg ${
              isActive('/dashboard/new-bet') ? 'bg-amber-400' : 'bg-amber-500'
            }`}
          >
            <Plus size={22} className="text-slate-900" />
          </div>
          <span
            className={`text-[10px] font-medium ${
              isActive('/dashboard/new-bet') ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            New Bet
          </span>
        </Link>

        {/* Clients Tab */}
        <Link
          href="/dashboard/clients"
          className="flex flex-col items-center gap-0.5 py-2 flex-1"
        >
          <Users
            size={24}
            className={isActive('/dashboard/clients') ? 'text-amber-400' : 'text-slate-400'}
          />
          <span
            className={`text-[10px] font-medium ${
              isActive('/dashboard/clients') ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            Clients
          </span>
        </Link>

        {/* History Tab */}
        <Link
          href="/dashboard/history"
          className="flex flex-col items-center gap-0.5 py-2 flex-1"
        >
          <BookOpen
            size={24}
            className={isActive('/dashboard/history') ? 'text-amber-400' : 'text-slate-400'}
          />
          <span
            className={`text-[10px] font-medium ${
              isActive('/dashboard/history') ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            History
          </span>
        </Link>
      </div>
    </nav>
  )
}
