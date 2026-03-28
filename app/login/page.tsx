'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { AtSign, Lock, Eye, EyeOff, TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const toast = useToast()
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
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer />

      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <TrendingUp className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bet Book</h1>
          <p className="text-slate-400 text-sm mt-1">Digital Sports Betting Ledger</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-slate-100 mb-5">Sign in to your account</h2>

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

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="label">Phone or Email</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="identifier"
                  type="text"
                  name="identifier"
                  placeholder="9876543210 or email@example.com"
                  value={formData.identifier}
                  onChange={handleChange}
                  className="input pl-9"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input pl-9 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Register here
            </Link>
          </p>
        </div>

        <div className="mt-4 bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Demo Credentials</p>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">
              <span className="text-amber-500/80 font-medium">Admin:</span> 9999999999 / Admin@123456
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-violet-400/80 font-medium">User:</span> 9876543210 / User@12345
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
