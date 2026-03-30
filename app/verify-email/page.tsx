'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { TrendingUp, Mail, KeyRound } from 'lucide-react'

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
                <label className="input input-bordered flex items-center gap-2">
                  <KeyRound size={16} className="text-base-content/40 shrink-0" />
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="grow text-center text-2xl tracking-[0.5em] font-mono"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
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
  return (
    <Suspense fallback={<div className="min-h-dvh bg-base-100 flex items-center justify-center"><span className="loading loading-spinner loading-lg text-primary" /></div>}>
      <VerifyEmailForm />
    </Suspense>
  )
}
