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
