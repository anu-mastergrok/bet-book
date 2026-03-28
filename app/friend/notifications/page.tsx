'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bell } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  link: string | null
  createdAt: string
}

export default function FriendNotificationsPage() {
  const { accessToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!r.ok || cancelled) return
        const data = await r.json()
        if (!cancelled) setNotifications(data.notifications ?? [])
        // Mark all as read (fire-and-forget)
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {})
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [accessToken])

  if (isLoading) return <div className="text-center text-slate-400 py-20">Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Notifications</h1>

      {notifications.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          No notifications yet.
        </div>
      )}

      {notifications.map(n => (
        <div
          key={n.id}
          className={`rounded-xl p-4 border space-y-1 ${n.read ? 'bg-slate-900 border-slate-800' : 'bg-slate-800 border-amber-800/40'}`}
        >
          <div className="flex justify-between items-start">
            <p className="font-medium text-white text-sm">{n.title}</p>
            {!n.read && <span className="w-2 h-2 bg-amber-400 rounded-full mt-1 flex-shrink-0" />}
          </div>
          <p className="text-slate-400 text-sm">{n.body}</p>
          <p className="text-slate-600 text-xs">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
        </div>
      ))}
    </div>
  )
}
