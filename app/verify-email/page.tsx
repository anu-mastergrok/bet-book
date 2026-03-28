'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { TrendingUp, Mail, Loader } from 'lucide-react'

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
    if (!email) {
      router.replace('/register')
    }
  }, [email, router])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code')
      return
    }
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
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer />

      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <TrendingUp className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bet Book</h1>
          <p className="text-slate-400 text-sm mt-1">Verify your email</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Mail className="text-amber-400" size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Check your email</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                We sent a 6-digit code to <span className="text-slate-300">{email}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="otp" className="label">Verification Code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className="btn-primary w-full"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  Verifying...
                </span>
              ) : 'Verify Email'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-slate-500 text-sm">Didn&apos;t receive the code?</p>
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <p className="text-center text-slate-400 text-sm mt-5">
            Wrong email?{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Go back
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  )
}
