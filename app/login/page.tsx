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
