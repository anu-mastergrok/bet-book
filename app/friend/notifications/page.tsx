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
    const token = accessToken
    const load = async () => {
      try {
        const r = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok || cancelled) return
        const data = await r.json()
        if (!cancelled) setNotifications(data.notifications ?? [])
        // Mark all as read (fire-and-forget)
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-base-content">Notifications</h1>

      {notifications.length === 0 && (
        <div className="text-center text-base-content/40 py-20">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          No notifications yet.
        </div>
      )}

      {notifications.map(n => (
        <div
          key={n.id}
          className={`card shadow-sm ${n.read ? 'bg-base-200' : 'bg-base-300'}`}
        >
          <div className="card-body space-y-1">
            <div className="flex justify-between items-start">
              <p className="font-medium text-base-content text-sm">{n.title}</p>
              {!n.read && <span className="w-2 h-2 bg-primary rounded-full mt-1 flex-shrink-0" />}
            </div>
            <p className="text-base-content/60 text-sm">{n.body}</p>
            <p className="text-base-content/40 text-xs">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
