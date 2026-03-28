'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  onClose?: () => void
}

const toastStore = {
  listeners: new Set<(toast: ToastProps) => void>(),

  subscribe(fn: (toast: ToastProps) => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  },

  show(toast: ToastProps) {
    this.listeners.forEach(fn => fn(toast))
  },
}

export function useToast() {
  return {
    success: (message: string) => toastStore.show({ message, type: 'success', duration: 3000 }),
    error: (message: string) => toastStore.show({ message, type: 'error', duration: 5000 }),
    info: (message: string) => toastStore.show({ message, type: 'info', duration: 3000 }),
    warning: (message: string) => toastStore.show({ message, type: 'warning', duration: 4000 }),
  }
}

const config = {
  success: {
    icon: CheckCircle,
    bg: 'bg-slate-800 border-emerald-500/30',
    iconColor: 'text-emerald-400',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-slate-800 border-red-500/30',
    iconColor: 'text-red-400',
    bar: 'bg-red-500',
  },
  info: {
    icon: Info,
    bg: 'bg-slate-800 border-violet-500/30',
    iconColor: 'text-violet-400',
    bar: 'bg-violet-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-slate-800 border-amber-500/30',
    iconColor: 'text-amber-400',
    bar: 'bg-amber-500',
  },
}

function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(100)
  const { icon: Icon, bg, iconColor, bar } = config[type]

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 50)

    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`${bg} border rounded-xl shadow-2xl overflow-hidden min-w-[280px] max-w-sm animate-in slide-in-from-right-4 fade-in duration-200`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <Icon className={`${iconColor} shrink-0 mt-0.5`} size={18} />
        <span className="flex-1 text-sm text-slate-200 leading-snug">{message}</span>
        <button
          onClick={() => { setIsVisible(false); onClose?.() }}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 -mr-1 -mt-0.5 p-1 rounded"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-0.5 bg-slate-700">
        <div
          className={`h-full ${bar} transition-all duration-100`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<(ToastProps & { id: number })[]>([])

  useEffect(() => {
    const unsubscribe = toastStore.subscribe((toast) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { ...toast, id }])
    })
    return unsubscribe
  }, [])

  const handleRemove = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => handleRemove(toast.id)}
        />
      ))}
    </div>
  )
}
