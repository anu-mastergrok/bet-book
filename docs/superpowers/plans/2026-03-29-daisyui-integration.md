# DaisyUI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's custom Tailwind component layer with DaisyUI v4, apply Outfit font, add `night`/`corporate` theme toggle, and deliver a fully responsive one-handed-friendly UI.

**Architecture:** Install DaisyUI v4 alongside Tailwind v3. Strip all custom `@layer components` from `globals.css`. Migrate every custom class (`.btn-*`, `.card`, `.input`, `.badge-*`, `.modal`, `.table`, `.nav-link`) to DaisyUI equivalents. A `ThemeProvider` client component persists the selected theme via `localStorage` and writes `data-theme` to `<html>`. Bottom nav (`btm-nav`) already exists as `components/BottomNav.tsx` — restyle it with DaisyUI classes.

**Tech Stack:** Next.js 14 App Router, TypeScript, DaisyUI v4, Tailwind CSS v3, Outfit (Google Fonts), Lucide React icons.

---

## Class Mapping Reference (use throughout all tasks)

| Old custom class | DaisyUI replacement |
|---|---|
| `btn-primary` | `btn btn-primary` |
| `btn-secondary` | `btn btn-neutral` |
| `btn-danger` | `btn btn-error` |
| `btn-success` | `btn btn-success` |
| `btn-ghost` | `btn btn-ghost` |
| `card` / `card-sm` | `card bg-base-200 shadow-sm` (content goes inside `<div className="card-body">`) |
| `input` | `input input-bordered w-full` |
| `label` (CSS class on `<label>`) | `label` — child text span gets `label-text` class |
| `table` (on `<table>`) | `table table-zebra` (wrap in `<div className="overflow-x-auto">`) |
| `badge-success` | `badge badge-success` |
| `badge-warning` | `badge badge-warning` |
| `badge-danger` | `badge badge-error` |
| `badge-info` | `badge badge-info` |
| `badge-muted` | `badge badge-ghost` |
| `modal` (backdrop div) | `modal modal-open modal-bottom sm:modal-middle` |
| `modal-content` (inner div) | `modal-box` |
| `stat-card` container | `stats shadow bg-base-200` wrapping `stat` divs |
| `stat-label` | `stat-title` |
| `stat-value` | `stat-value` (same name, DaisyUI) |
| `nav-link` / `nav-link-active` | `btm-nav` items with `active text-primary` |

## Color Token Mapping (apply to every page)

| Hardcoded Tailwind color | DaisyUI semantic token |
|---|---|
| `bg-slate-950` | `bg-base-100` |
| `bg-slate-900` | `bg-base-200` |
| `bg-slate-800` | `bg-base-300` |
| `border-slate-700` / `border-slate-800` | `border-base-300` |
| `text-slate-100` / `text-slate-200` | `text-base-content` |
| `text-slate-300` | `text-base-content/80` |
| `text-slate-400` | `text-base-content/60` |
| `text-slate-500` | `text-base-content/40` |
| `text-amber-400` / `text-amber-500` (primary actions) | `text-primary` |
| `bg-amber-500` (primary buttons) | handled by `btn-primary` |
| Loading spinner `<Loader className="animate-spin text-amber-400">` | `<span className="loading loading-spinner loading-lg text-primary" />` |

---

## Task 1: Install DaisyUI + update tailwind.config.ts + globals.css

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Run: `npm install daisyui@latest`

- [ ] **Step 1: Install DaisyUI**

```bash
cd /path/to/worktree
npm install daisyui@latest
```

Expected: `daisyui` added to `node_modules` and `package.json`.

- [ ] **Step 2: Replace tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['night', 'corporate'],
  },
}
export default config
```

- [ ] **Step 3: Replace app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: oklch(var(--b2));
}

::-webkit-scrollbar-thumb {
  background: oklch(var(--b3));
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: oklch(var(--bc) / 0.3);
}

/* Number inputs */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  opacity: 0.5;
}

/* Date inputs */
input[type='date']::-webkit-calendar-picker-indicator,
input[type='datetime-local']::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Verify build compiles**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully` (pages will look unstyled until components are updated — that's expected at this stage).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts app/globals.css package.json package-lock.json
git commit -m "feat: install daisyui, switch to Outfit font, strip custom @layer components"
```

---

## Task 2: ThemeProvider component + update app/layout.tsx

**Files:**
- Create: `components/ThemeProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create components/ThemeProvider.tsx**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'night' | 'corporate'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'night',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('night')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    const initial = stored === 'corporate' ? 'corporate' : 'night'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'night' ? 'corporate' : 'night'
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 2: Update app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { GoogleProvider } from '@/components/GoogleProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Bet Book Platform',
  description: 'Digital ledger for tracking cricket/sports betting records',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="night">
      <body>
        <ThemeProvider>
          <GoogleProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </GoogleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add components/ThemeProvider.tsx app/layout.tsx
git commit -m "feat: add ThemeProvider with night/corporate toggle, default data-theme on html"
```

---

## Task 3: Update components/Toast.tsx

**Files:**
- Modify: `components/Toast.tsx`

The `toastStore`, `useToast` hook, and auto-dismiss timer logic stay identical. Only the render output changes to use DaisyUI `alert` classes.

- [ ] **Step 1: Replace components/Toast.tsx**

```tsx
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
  }, [duration, onClose])

  if (!visible) return null

  return (
    <div
      className={`alert ${alertClass[type]} shadow-lg min-w-72 max-w-sm overflow-hidden p-0`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-4 py-3 w-full">
        <span className="flex-1 text-sm leading-snug">{message}</span>
        <button
          onClick={() => { setVisible(false); onClose?.() }}
          className="btn btn-ghost btn-xs btn-circle shrink-0 -mr-1 -mt-0.5"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-0.5 w-full bg-black/10">
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 3: Commit**

```bash
git add components/Toast.tsx
git commit -m "feat: restyle Toast with DaisyUI alert classes"
```

---

## Task 4: Update components/Modal.tsx

**Files:**
- Modify: `components/Modal.tsx`

- [ ] **Step 1: Replace components/Modal.tsx**

```tsx
'use client'

import { ReactNode, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={`modal-box ${sizeClasses[size]}`}>
        <div className="flex justify-between items-center mb-5">
          {title && (
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle ml-auto"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}

export function ConfirmModal({
  isOpen, onConfirm, onCancel, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <div className="flex flex-col items-center text-center gap-4 pb-2">
        {isDangerous && (
          <div className="w-12 h-12 rounded-full bg-error/10 border border-error/20 flex items-center justify-center">
            <AlertTriangle className="text-error" size={22} />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-base-content/60 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button onClick={onCancel} className="btn btn-neutral flex-1">{cancelText}</button>
          <button
            onClick={onConfirm}
            className={`flex-1 btn ${isDangerous ? 'btn-error' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 3: Commit**

```bash
git add components/Modal.tsx
git commit -m "feat: restyle Modal with DaisyUI modal-box + modal-bottom sm:modal-middle"
```

---

## Task 5: Update components/BottomNav.tsx

**Files:**
- Modify: `components/BottomNav.tsx`

DaisyUI `btm-nav` replaces the hand-rolled nav. The `active` class on a `btm-nav` child item activates it. Use `text-primary` for active color.

- [ ] **Step 1: Replace components/BottomNav.tsx**

```tsx
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 3: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat: restyle BottomNav with DaisyUI btm-nav"
```

---

## Task 6: Auth pages — login, register, verify-email

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/register/page.tsx`
- Modify: `app/verify-email/page.tsx`

All three auth pages share the same full-page centered layout. Apply the same pattern to each.

- [ ] **Step 1: Replace app/login/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { useTheme } from '@/components/ThemeProvider'
import { AtSign, Lock, Eye, EyeOff, TrendingUp, Sun, Moon } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const toast = useToast()
  const { theme, toggle } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ identifier: '', password: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const redirectByRole = (role: string) => {
    if (role === 'ADMIN') router.push('/admin')
    else if (role === 'FRIEND') router.push('/friend/dashboard')
    else router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Welcome back!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Welcome!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed')
    }
  }

  return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center p-4">
      <ToastContainer />

      <button
        onClick={toggle}
        className="btn btn-ghost btn-circle fixed top-4 right-4"
        aria-label="Toggle theme"
      >
        {theme === 'night' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl mb-4">
            <TrendingUp className="text-primary" size={28} />
          </div>
          <h1 className="text-2xl font-bold">Bet Book</h1>
          <p className="text-base-content/50 text-sm mt-1">Digital Sports Betting Ledger</p>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg mb-1">Sign in to your account</h2>

            <div className="flex justify-center mb-4">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google sign-in failed')}
                theme="filled_black"
                shape="rectangular"
                text="signin_with"
                width="320"
              />
            </div>

            <div className="divider text-xs text-base-content/40">or</div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="identifier">
                  <span className="label-text">Phone or Email</span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <AtSign size={16} className="text-base-content/40 shrink-0" />
                  <input
                    id="identifier"
                    type="text"
                    name="identifier"
                    placeholder="9876543210 or email@example.com"
                    value={formData.identifier}
                    onChange={handleChange}
                    className="grow"
                    autoComplete="username"
                    required
                  />
                </label>
              </div>

              <div>
                <label className="label" htmlFor="password">
                  <span className="label-text">Password</span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <Lock size={16} className="text-base-content/40 shrink-0" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    className="grow"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </label>
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary w-full mt-2">
                {isLoading ? <span className="loading loading-spinner loading-sm" /> : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-base-content/50 text-sm mt-4">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="link link-primary font-medium">Register here</Link>
            </p>
          </div>
        </div>

        <div className="card bg-base-200 shadow-sm mt-4">
          <div className="card-body py-3">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-1">Demo Credentials</p>
            <p className="text-xs text-base-content/60">
              <span className="text-warning font-medium">Admin:</span> 9999999999 / Admin@123456
            </p>
            <p className="text-xs text-base-content/60">
              <span className="text-primary font-medium">User:</span> 9876543210 / User@12345
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace app/register/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { useTheme } from '@/components/ThemeProvider'
import { User, Mail, Lock, Phone, Eye, EyeOff, TrendingUp, Sun, Moon } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const toast = useToast()
  const { theme, toggle } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', password: '', confirmPassword: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const redirectByRole = (role: string) => {
    if (role === 'ADMIN') router.push('/admin')
    else if (role === 'FRIEND') router.push('/friend/dashboard')
    else router.push('/dashboard')
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Google sign-up failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Account created!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-up failed')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match')
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      if (data.requiresVerification) {
        toast.success('Account created! Please verify your email.')
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
        return
      }
      register(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Account created successfully!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center p-4">
      <ToastContainer />

      <button
        onClick={toggle}
        className="btn btn-ghost btn-circle fixed top-4 right-4"
        aria-label="Toggle theme"
      >
        {theme === 'night' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl mb-4">
            <TrendingUp className="text-primary" size={28} />
          </div>
          <h1 className="text-2xl font-bold">Bet Book</h1>
          <p className="text-base-content/50 text-sm mt-1">Create your account</p>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg mb-1">Create Account</h2>

            <div className="flex justify-center mb-4">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google sign-up failed')}
                theme="filled_black"
                shape="rectangular"
                text="signup_with"
                width="320"
              />
            </div>

            <div className="divider text-xs text-base-content/40">or</div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  <span className="label-text">Full Name <span className="text-error">*</span></span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <User size={16} className="text-base-content/40 shrink-0" />
                  <input id="name" type="text" name="name" placeholder="John Doe"
                    value={formData.name} onChange={handleChange} className="grow" required />
                </label>
              </div>

              <div>
                <label className="label" htmlFor="phone">
                  <span className="label-text">Phone Number <span className="text-error">*</span></span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <Phone size={16} className="text-base-content/40 shrink-0" />
                  <input id="phone" type="tel" name="phone" placeholder="9876543210"
                    value={formData.phone} onChange={handleChange}
                    className="grow" inputMode="numeric" required />
                </label>
              </div>

              <div>
                <label className="label" htmlFor="email">
                  <span className="label-text">
                    Email <span className="label-text-alt text-base-content/40">(optional)</span>
                  </span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <Mail size={16} className="text-base-content/40 shrink-0" />
                  <input id="email" type="email" name="email" placeholder="john@example.com"
                    value={formData.email} onChange={handleChange}
                    className="grow" autoComplete="email" />
                </label>
              </div>

              <div>
                <label className="label" htmlFor="password">
                  <span className="label-text">Password <span className="text-error">*</span></span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <Lock size={16} className="text-base-content/40 shrink-0" />
                  <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                    placeholder="At least 8 characters" value={formData.password}
                    onChange={handleChange} className="grow" required />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={showPassword ? 'Hide' : 'Show'}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </label>
              </div>

              <div>
                <label className="label" htmlFor="confirmPassword">
                  <span className="label-text">Confirm Password <span className="text-error">*</span></span>
                </label>
                <label className="input input-bordered flex items-center gap-2">
                  <Lock size={16} className="text-base-content/40 shrink-0" />
                  <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} name="confirmPassword"
                    placeholder="Confirm your password" value={formData.confirmPassword}
                    onChange={handleChange} className="grow" required />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={showConfirm ? 'Hide' : 'Show'}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </label>
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary w-full mt-2">
                {isLoading ? <span className="loading loading-spinner loading-sm" /> : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-base-content/50 text-sm mt-4">
              Already have an account?{' '}
              <Link href="/login" className="link link-primary font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace app/verify-email/page.tsx**

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { TrendingUp, Mail } from 'lucide-react'

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const toast = useToast()

  const email = searchParams.get('email') ?? ''
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (!email) router.replace('/register')
  }, [email, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Please enter the 6-digit code'); return }
    setIsVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Email verified!')
      if (data.user.role === 'ADMIN') router.push('/admin')
      else if (data.user.role === 'FRIEND') router.push('/friend/dashboard')
      else router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      toast.success('New code sent!')
      setResendCooldown(60)
      setOtp('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center p-4">
      <ToastContainer />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl mb-4">
            <TrendingUp className="text-primary" size={28} />
          </div>
          <h1 className="text-2xl font-bold">Bet Book</h1>
          <p className="text-base-content/50 text-sm mt-1">Verify your email</p>
        </div>

        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="text-primary" size={20} />
              </div>
              <div>
                <h2 className="font-semibold">Check your email</h2>
                <p className="text-xs text-base-content/50 mt-0.5">
                  We sent a 6-digit code to <span className="text-base-content">{email}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="label" htmlFor="otp">
                  <span className="label-text">Verification Code</span>
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input input-bordered w-full text-center text-2xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="btn btn-primary w-full"
              >
                {isVerifying ? <span className="loading loading-spinner loading-sm" /> : 'Verify Email'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-base-content/40 text-sm">Didn&apos;t receive the code?</p>
              <button
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className="btn btn-link btn-sm text-primary disabled:opacity-50 mt-1"
              >
                {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>

            <p className="text-center text-base-content/50 text-sm mt-4">
              Wrong email?{' '}
              <Link href="/register" className="link link-primary font-medium">Go back</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailForm /></Suspense>
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx app/verify-email/page.tsx
git commit -m "feat: restyle auth pages with DaisyUI card, input, btn, divider"
```

---

## Task 7: Update app/dashboard/page.tsx

**Files:**
- Modify: `app/dashboard/page.tsx`

Key structural changes:
1. Replace loading div with DaisyUI skeleton pattern
2. Replace stat cards with DaisyUI `stats` component
3. Replace table with `table table-zebra` inside `overflow-x-auto`
4. Replace all badge classes per mapping table
5. Replace all hardcoded bg/text/border colors per color token mapping
6. Add theme toggle button in header
7. Replace `<Loader>` spinner with `loading loading-spinner`

- [ ] **Step 1: Read the current file**

```bash
cat app/dashboard/page.tsx
```

- [ ] **Step 2: Apply these targeted replacements throughout the file**

**Loading state** — replace the entire loading return:
```tsx
if (!user || isLoading) {
  return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
}
```

**Header** — replace `bg-slate-900/80 border-b border-slate-800`:
```tsx
<header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300">
```

Replace logo box:
```tsx
<div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
  <TrendingUp className="text-primary" size={16} />
</div>
```

Replace `text-slate-100`, `text-slate-500` in header:
```tsx
<h1 className="text-base font-semibold">My Dashboard</h1>
<p className="text-xs text-base-content/40">Welcome, {user.name}</p>
```

Replace header buttons:
```tsx
<Link href="/dashboard/new-bet" className="hidden sm:inline-flex btn btn-primary btn-sm gap-1">
  <Plus size={15} /><span>New Bet</span>
</Link>
<button onClick={handleLogout} className="btn btn-ghost btn-sm gap-1">
  <LogOut size={15} /><span className="hidden sm:inline">Logout</span>
</button>
```

Add theme toggle in header (import `useTheme` and `Sun`/`Moon` from lucide):
```tsx
import { useTheme } from '@/components/ThemeProvider'
// in component:
const { theme, toggle } = useTheme()
// in header buttons row, add:
<button onClick={toggle} className="btn btn-ghost btn-sm btn-circle">
  {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
</button>
```

**Stats row** — replace the entire stats grid with DaisyUI stats:
```tsx
<div className="stats stats-vertical sm:stats-horizontal shadow bg-base-200 w-full">
  <div className="stat">
    <div className="stat-figure">
      {totalPnL >= 0
        ? <TrendingUp className="text-success" size={24} />
        : <TrendingDown className="text-error" size={24} />}
    </div>
    <div className="stat-title">Total P&L</div>
    <div className={`stat-value text-2xl ${totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
      {formatINR(totalPnL, true)}
    </div>
  </div>
  <div className="stat">
    <div className="stat-figure text-secondary"><Target size={24} /></div>
    <div className="stat-title">Total Bets</div>
    <div className="stat-value text-2xl">{bets.length}</div>
  </div>
  <div className="stat">
    <div className="stat-figure text-success"><CheckCircle2 size={24} /></div>
    <div className="stat-title">Wins</div>
    <div className="stat-value text-2xl text-success">{winCount}</div>
    <div className="stat-desc">{winRate}% win rate</div>
  </div>
  <div className="stat">
    <div className="stat-figure text-error"><XCircle size={24} /></div>
    <div className="stat-title">Losses</div>
    <div className="stat-value text-2xl text-error">{lossCount}</div>
    {pendingCount > 0 && <div className="stat-desc">{pendingCount} pending</div>}
  </div>
</div>
```

**Chart cards** — replace `card` divs:
```tsx
<div className="card bg-base-200 shadow-sm">
  <div className="card-body">
    <h2 className="card-title text-sm">P&L by Series</h2>
    {/* chart content unchanged */}
  </div>
</div>
```

Replace `CustomTooltip` background:
```tsx
<div className="bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-xs shadow-xl">
  <p className="text-base-content/50 mb-1">{label}</p>
```

**Bets table card**:
```tsx
<div className="card bg-base-200 shadow-sm p-0 overflow-hidden">
  <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
    <h2 className="font-semibold text-sm">My Bets</h2>
    <span className="text-xs text-base-content/40">{bets.length} records</span>
  </div>
  <div className="overflow-x-auto">
    <table className="table table-zebra">
```

Replace badge classes in table rows:
```tsx
// result badge:
<span className={
  bet.result === 'win' ? 'badge badge-success' :
  bet.result === 'loss' ? 'badge badge-error' : 'badge badge-warning'
}>
  {bet.result}
</span>

// settlement badge:
<span className={
  bet.settlementStatus === 'settled' ? 'badge badge-success' :
  bet.settlementStatus === 'collected' ? 'badge badge-info' :
  bet.settlementStatus === 'lost_in_another_match' ? 'badge badge-error' :
  'badge badge-warning'
}>
  {bet.settlementStatus.replace(/_/g, ' ')}
</span>
```

**Empty state** in table:
```tsx
<div className="py-16 text-center">
  <IndianRupee className="mx-auto text-base-content/20 mb-3" size={32} />
  <p className="font-medium">No bets yet</p>
  <p className="text-base-content/40 text-sm mt-1">Create your first bet to get started</p>
  <Link href="/dashboard/new-bet" className="btn btn-primary btn-sm mt-4 gap-1">
    <Plus size={16} />New Bet
  </Link>
</div>
```

Replace `min-h-dvh bg-slate-950` outer div:
```tsx
<div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
```

Replace `max-w-7xl` main:
```tsx
<main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: restyle dashboard with DaisyUI stats, table-zebra, semantic colors"
```

---

## Task 8: Update app/dashboard/new-bet/page.tsx + app/dashboard/clients/page.tsx

**Files:**
- Modify: `app/dashboard/new-bet/page.tsx`
- Modify: `app/dashboard/clients/page.tsx`

Apply the same color token + class mapping pattern from Task 7.

- [ ] **Step 1: Read both files fully**

```bash
cat app/dashboard/new-bet/page.tsx
cat app/dashboard/clients/page.tsx
```

- [ ] **Step 2: Apply to app/dashboard/new-bet/page.tsx**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Form card: `card bg-base-200 shadow-sm` with `card-body`
- Every `<label>` element: add `className="label"`, child text span: `label-text`
- Every `<input>` / `<select>` / `<textarea>`: replace `.input` with `input input-bordered w-full`; replace `select` styled with `select select-bordered w-full`
- Back link: `btn btn-ghost btn-sm gap-1`
- Submit button: `btn btn-primary w-full`
- Amount preset buttons: `btn btn-sm` with `btn-primary` when selected, `btn-neutral` when not
- Skeleton / loading: `<span className="loading loading-spinner loading-lg text-primary" />`

Preset buttons example pattern (they currently use conditional inline class strings):
```tsx
<button
  type="button"
  onClick={() => handlePreset(amount)}
  className={`btn btn-sm ${selectedPreset === amount ? 'btn-primary' : 'btn-neutral'}`}
>
  ₹{amount.toLocaleString('en-IN')}
</button>
```

- [ ] **Step 3: Apply to app/dashboard/clients/page.tsx**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Client summary cards: `card bg-base-200 shadow-sm` + `card-body`
- Stats within client cards: `stats stats-vertical shadow bg-base-200`
- Table: `table table-zebra` inside `overflow-x-auto`
- Badges: apply mapping table
- Modal: already uses `<Modal>` component — no changes needed (Task 4 handled it)
- Payment form inputs inside modal: `input input-bordered w-full`, `select select-bordered w-full`, `label` + `label-text`
- Accordion expand/collapse buttons: `btn btn-ghost btn-sm`
- Add payment button: `btn btn-primary btn-sm`

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/new-bet/page.tsx app/dashboard/clients/page.tsx
git commit -m "feat: restyle new-bet and clients pages with DaisyUI"
```

---

## Task 9: Update dashboard sub-pages — friends, history, series/[id]

**Files:**
- Modify: `app/dashboard/friends/page.tsx`
- Modify: `app/dashboard/history/page.tsx`
- Modify: `app/dashboard/series/[id]/page.tsx`

- [ ] **Step 1: Read all three files**

```bash
cat app/dashboard/friends/page.tsx
cat app/dashboard/history/page.tsx
cat "app/dashboard/series/[id]/page.tsx"
```

- [ ] **Step 2: Apply to app/dashboard/friends/page.tsx**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Friend cards: `card bg-base-200 shadow-sm` + `card-body`
- Search input: `input input-bordered w-full`
- Buttons: map per class mapping table
- Empty state: `text-base-content/40` for muted text

- [ ] **Step 3: Apply to app/dashboard/history/page.tsx**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Filter panel: `card bg-base-200 shadow-sm` + `card-body`; `input input-bordered w-full`; `select select-bordered w-full`
- Stats summary cards: `stats shadow bg-base-200` with `stat` items
- Table: `table table-zebra` inside `overflow-x-auto`
- Badges: apply mapping table
- Sort toggle buttons: `btn btn-ghost btn-xs`
- Filter toggle button: `btn btn-neutral btn-sm gap-1`
- Clear filters: `btn btn-ghost btn-xs`
- Add breadcrumb at top of main content:
  ```tsx
  <div className="breadcrumbs text-sm mb-4">
    <ul>
      <li><Link href="/dashboard">Dashboard</Link></li>
      <li>History</li>
    </ul>
  </div>
  ```

- [ ] **Step 4: Apply to app/dashboard/series/[id]/page.tsx**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Series detail card: `card bg-base-200 shadow-sm` + `card-body`
- Match cards: `card bg-base-200 shadow-sm` + `card-body`
- Status badges: apply mapping table
- Add breadcrumb:
  ```tsx
  <div className="breadcrumbs text-sm mb-4">
    <ul>
      <li><Link href="/dashboard">Dashboard</Link></li>
      <li>Series</li>
      <li>{series?.name}</li>
    </ul>
  </div>
  ```
- Live dot: keep existing animated ping, change color classes to `bg-success`/`bg-success` instead of `bg-emerald-400`/`bg-emerald-500`

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/friends/page.tsx app/dashboard/history/page.tsx "app/dashboard/series/[id]/page.tsx"
git commit -m "feat: restyle friends, history, series pages with DaisyUI + breadcrumbs"
```

---

## Task 10: Update app/admin/page.tsx

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Read the file**

```bash
cat app/admin/page.tsx
```

- [ ] **Step 2: Apply transformations**

Key changes:
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Logo box: `bg-primary/10 border border-primary/20` + `text-primary`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Stats row: replace `stat-card`/`stat-label`/`stat-value` with DaisyUI `stats shadow bg-base-200` + `stat` + `stat-title` + `stat-value`
- Series/Match management cards: `card bg-base-200 shadow-sm` + `card-body`
- Form inputs: `input input-bordered w-full`, `select select-bordered w-full`
- Labels: `label` + `label-text`
- Table: `table table-zebra` inside `overflow-x-auto`
- Badges: apply mapping table (match `status` uses `badge badge-success`/`badge badge-warning`/`badge badge-ghost`)
- Add/Edit/Delete buttons: `btn btn-primary btn-sm`, `btn btn-ghost btn-xs`, `btn btn-error btn-xs`
- Sync Now button: `btn btn-neutral btn-sm gap-1`
- Activate button: `btn btn-success btn-xs`
- Per-row loading: `<span className="loading loading-spinner loading-xs" />`
- Admin badge in header: `badge badge-warning badge-sm`
- Header buttons:
  ```tsx
  <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-1">
    <LogOut size={15} /><span className="hidden sm:inline">Logout</span>
  </button>
  ```
- Theme toggle in header (import `useTheme`):
  ```tsx
  const { theme, toggle } = useTheme()
  // add button in header:
  <button onClick={toggle} className="btn btn-ghost btn-sm btn-circle">
    {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
  </button>
  ```
- Imported Matches section: `card bg-base-200 shadow-sm` + `card-body`; match cards inside use `card bg-base-300 shadow-sm`

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: restyle admin dashboard with DaisyUI stats, tables, badges"
```

---

## Task 11: Update app/admin/bets/page.tsx

**Files:**
- Modify: `app/admin/bets/page.tsx`

- [ ] **Step 1: Read the file**

```bash
cat app/admin/bets/page.tsx
```

- [ ] **Step 2: Apply transformations**

Key changes (same pattern as Task 10):
- Outer div: `bg-base-100 pb-20 sm:pb-0`
- Header: `bg-base-200/80 backdrop-blur-md border-b border-base-300`
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Filter bar card: `card bg-base-200 shadow-sm` + `card-body`
- Filter inputs/selects: `input input-bordered w-full`, `select select-bordered w-full`
- Table: `table table-zebra` inside `overflow-x-auto`
- Badges: apply mapping table
- Settlement update select dropdowns: `select select-bordered select-sm`
- Summary stats: `stats shadow bg-base-200` pattern
- Add breadcrumb:
  ```tsx
  <div className="breadcrumbs text-sm mb-4">
    <ul>
      <li><Link href="/admin">Admin</Link></li>
      <li>All Bets</li>
    </ul>
  </div>
  ```
- Export/filter buttons: `btn btn-neutral btn-sm gap-1`

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/bets/page.tsx
git commit -m "feat: restyle admin bets page with DaisyUI + breadcrumb"
```

---

## Task 12: Update friend layout + friend pages

**Files:**
- Modify: `app/friend/layout.tsx`
- Modify: `app/friend/dashboard/page.tsx`
- Modify: `app/friend/bets/page.tsx`
- Modify: `app/friend/notifications/page.tsx`

- [ ] **Step 1: Read all four files**

```bash
cat app/friend/layout.tsx
cat app/friend/dashboard/page.tsx
cat app/friend/bets/page.tsx
cat app/friend/notifications/page.tsx
```

- [ ] **Step 2: Replace app/friend/layout.tsx**

Replace the inline bottom nav with DaisyUI `btm-nav`. Import `useTheme` for toggle button.

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/components/ThemeProvider'
import { NotificationBell } from '@/components/NotificationBell'
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
          <NotificationBell />
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
```

- [ ] **Step 3: Apply to app/friend/dashboard/page.tsx**

Key changes:
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Bet cards: `card bg-base-200 shadow-sm` + `card-body`
- Stats: `stats shadow bg-base-200` with `stat` items
- Badges: apply mapping table (result, settlement, dispute status)
- Live dot: `bg-success` / `bg-success` instead of `bg-emerald-*`
- Text colors: apply color token mapping throughout
- Empty state: `text-base-content/40`

- [ ] **Step 4: Apply to app/friend/bets/page.tsx**

Key changes (same as dashboard pattern):
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Bet cards: `card bg-base-200 shadow-sm` + `card-body`
- Badges: apply mapping table
- Confirm/Dispute buttons: `btn btn-success btn-sm`, `btn btn-error btn-sm`
- Live score section: `bg-base-300` instead of `bg-slate-800/50`

- [ ] **Step 5: Apply to app/friend/notifications/page.tsx**

Key changes:
- Loading: `<span className="loading loading-spinner loading-lg text-primary" />`
- Notification cards: `card bg-base-200 shadow-sm` + `card-body`
- Unread indicator: `bg-primary` instead of `bg-amber-500`
- Mark as read button: `btn btn-ghost btn-xs`
- Empty state: `text-base-content/40`

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

- [ ] **Step 7: Commit**

```bash
git add app/friend/layout.tsx app/friend/dashboard/page.tsx app/friend/bets/page.tsx app/friend/notifications/page.tsx
git commit -m "feat: restyle friend layout and pages with DaisyUI btm-nav and components"
```

---

## Task 13: Final build verification + polish

**Files:**
- Run build, fix any TypeScript or class errors

- [ ] **Step 1: Run full build and capture output**

```bash
npm run build 2>&1
```

Expected: `✓ Compiled successfully` and `✓ Generating static pages`

- [ ] **Step 2: Fix any remaining hardcoded color classes**

Search for any leftover custom classes:

```bash
grep -rn "btn-primary\|btn-secondary\|btn-danger\|btn-success\|btn-ghost\|\.card\b\|\.input\b\|badge-success\|badge-warning\|badge-danger\|badge-info\|badge-muted\|\.modal\b\|stat-card\|stat-label\|stat-value\|nav-link" app/ components/ --include="*.tsx" | grep -v "btn btn-\|badge badge-\|modal modal\|stats shadow"
```

If any appear, replace them using the Class Mapping Reference at the top of this plan.

Search for leftover hardcoded slate colors:

```bash
grep -rn "bg-slate-950\|bg-slate-900\|bg-slate-800\|text-slate-100\|text-slate-200\|border-slate-700\|border-slate-800" app/ components/ --include="*.tsx"
```

Replace any found with the Color Token Mapping at the top of this plan.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Fix any lint errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve remaining hardcoded colors and custom class leftovers post-DaisyUI migration"
```
