'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bell } from 'lucide-react'
import Link from 'next/link'

export function NotificationBell() {
  const { accessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!accessToken) return
    const load = () => {
      fetch('/api/notifications', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(r => { if (r.ok) return r.json() })
        .then(data => { if (data) setUnreadCount(data.unreadCount ?? 0) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [accessToken])

  return (
    <Link href="/friend/notifications" className="relative text-base-content/60 hover:text-base-content">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary text-primary-content text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
