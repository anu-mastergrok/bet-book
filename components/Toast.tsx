'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
    return () => { this.listeners.delete(fn) }
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

const alertClass: Record<ToastProps['type'], string> = {
  success: 'alert-success',
  error: 'alert-error',
  info: 'alert-info',
  warning: 'alert-warning',
}

function Toast({ message, type, duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const remaining = Math.max(0, 100 - ((Date.now() - start) / duration) * 100)
      setProgress(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 50)
    const timer = setTimeout(() => { setVisible(false); onClose?.() }, duration)
    return () => { clearTimeout(timer); clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  if (!visible) return null

  return (
    <div
      className={`alert ${alertClass[type]} shadow-lg min-w-72 max-w-sm overflow-hidden relative`}
      role="alert"
    >
      <span className="flex-1 text-sm leading-snug">{message}</span>
      <button
        onClick={() => { setVisible(false); onClose?.() }}
        className="btn btn-ghost btn-xs btn-circle shrink-0 -mr-1 -mt-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-black/10">
        <div className="h-full bg-black/20 transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<(ToastProps & { id: number })[]>([])

  useEffect(() => {
    return toastStore.subscribe(toast => {
      setToasts(prev => [...prev, { ...toast, id: Date.now() + Math.random() }])
    })
  }, [])

  return (
    <div className="toast toast-end toast-bottom z-50" aria-label="Notifications">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        />
      ))}
    </div>
  )
}
