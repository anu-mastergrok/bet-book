'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { ArrowLeft, Loader, TrendingUp, MapPin, Calendar } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'
import { BottomNav } from '@/components/BottomNav'

interface Series {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
}

interface Match {
  id: string
  seriesId: string
  teamA: string
  teamB: string
  matchDate: string
  venue: string
  status: string
}

export default function NewBetPage() {
  const router = useRouter()
  const { user, accessToken } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [series, setSeries] = useState<Series[]>([])
  const [matches, setMatches] = useState<Match[]>([])

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    matchId: '',
    clientName: '',
    clientUserId: '',
    betOnTeam: '',
    betAmount: '',
    odds: '',
    betType: 'match_winner',
    notes: '',
  })

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role === 'ADMIN') { router.push('/admin'); return }
    fetchData()
  }, [user, router])

  const fetchData = async () => {
    try {
      const [seriesRes, matchesRes] = await Promise.all([
        fetch('/api/series', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/matches', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      if (!seriesRes.ok || !matchesRes.ok) throw new Error('Failed to fetch data')
      const seriesData = await seriesRes.json()
      const matchesData = await matchesRes.json()
      setSeries(seriesData.series)
      setMatches(matchesData.matches)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreset = (amount: number) => {
    setSelectedPreset(amount)
    setFormData(prev => ({ ...prev, betAmount: amount.toString() }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'betAmount') {
      setSelectedPreset(null)
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!formData.matchId || !formData.clientName || !formData.betOnTeam ||
        !formData.betAmount || !formData.odds) {
        throw new Error('Please fill in all required fields')
      }

      const betAmount = parseFloat(formData.betAmount)
      const odds = parseFloat(formData.odds)

      if (isNaN(betAmount) || betAmount <= 0) throw new Error('Bet amount must be a positive number')
      if (isNaN(odds) || odds <= 0) throw new Error('Odds must be a positive number')

      const response = await fetch('/api/bets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...formData,
          betAmount: betAmount.toString(),
          odds: odds.toString(),
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create bet')
      }

      toast.success('Bet created successfully!')
      router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create bet')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <Loader className="animate-spin text-amber-400" size={32} />
      </div>
    )
  }

  const selectedMatch = matches.find(m => m.id === formData.matchId)
  const selectedSeries = selectedMatch ? series.find(s => s.id === selectedMatch.seriesId) : null
  const potentialProfit = formData.betAmount && formData.odds
    ? (parseFloat(formData.betAmount) * parseFloat(formData.odds) - parseFloat(formData.betAmount)).toFixed(2)
    : null

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-100">Create New Bet</h1>
            <p className="text-xs text-slate-500">Add a new betting entry to your ledger</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Match Selection */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 pb-2 border-b border-slate-700/60">
              Match Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="matchId" className="label">
                  Select Match <span className="text-red-400">*</span>
                </label>
                <select
                  id="matchId"
                  name="matchId"
                  value={formData.matchId}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="">Choose a match...</option>
                  {matches.map(match => (
                    <option key={match.id} value={match.id}>
                      {match.teamA} vs {match.teamB} — {new Date(match.matchDate).toLocaleDateString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMatch && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <TrendingUp size={13} className="text-violet-400" />
                    <span className="font-medium text-violet-300">{selectedSeries?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={13} />
                    {selectedMatch.venue}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar size={13} />
                    {new Date(selectedMatch.matchDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <span className={`inline-flex mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedMatch.status === 'live' ? 'bg-emerald-500/15 text-emerald-400' :
                    selectedMatch.status === 'completed' ? 'bg-slate-600/50 text-slate-400' :
                    'bg-amber-500/15 text-amber-400'
                  }`}>
                    {selectedMatch.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Client & Bet Info */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 pb-2 border-b border-slate-700/60">
              Bet Details
            </h2>

            <div>
              <label htmlFor="clientName" className="label">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                id="clientName"
                type="text"
                name="clientName"
                placeholder="e.g., Raj Kumar"
                value={formData.clientName}
                onChange={handleChange}
                className="input"
                required
              />
              <p className="text-xs text-slate-500 mt-1">The person you&apos;re betting with</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="betOnTeam" className="label">
                  Bet On Team <span className="text-red-400">*</span>
                </label>
                <select
                  id="betOnTeam"
                  name="betOnTeam"
                  value={formData.betOnTeam}
                  onChange={handleChange}
                  className="input"
                  required
                >
                  <option value="">Select team...</option>
                  {selectedMatch && (
                    <>
                      <option value="teamA">{selectedMatch.teamA}</option>
                      <option value="teamB">{selectedMatch.teamB}</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="betAmount" className="label">
                  Bet Amount (₹) <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { amount: 500, label: '₹500' },
                    { amount: 1000, label: '₹1K' },
                    { amount: 2000, label: '₹2K' },
                    { amount: 5000, label: '₹5K' },
                    { amount: 10000, label: '₹10K' },
                    { amount: 25000, label: '₹25K' },
                  ].map(({ amount, label }) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handlePreset(amount)}
                      className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                        selectedPreset === amount
                          ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  id="betAmount"
                  type="number"
                  name="betAmount"
                  placeholder="10000"
                  value={formData.betAmount}
                  onChange={handleChange}
                  className="input"
                  step="100"
                  min="0"
                  inputMode="numeric"
                  required
                />
              </div>

              <div>
                <label htmlFor="odds" className="label">
                  Odds <span className="text-red-400">*</span>
                </label>
                <input
                  id="odds"
                  type="number"
                  name="odds"
                  placeholder="1.50"
                  value={formData.odds}
                  onChange={handleChange}
                  className="input"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="betType" className="label">Bet Type</label>
              <select
                id="betType"
                name="betType"
                value={formData.betType}
                onChange={handleChange}
                className="input"
              >
                <option value="toss_winner">Toss Winner</option>
                <option value="match_winner">Match Winner</option>
                <option value="session_runs">Session Runs</option>
                <option value="top_batsman">Top Batsman</option>
                <option value="top_bowler">Top Bowler</option>
                <option value="player_performance">Player Performance</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="label">
                Notes <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Any notes about this bet..."
                value={formData.notes}
                onChange={handleChange}
                className="input resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Potential Profit Preview */}
          {potentialProfit !== null && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Potential profit if win</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">
                  +{formatINR(parseFloat(potentialProfit))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Gross payout</p>
                <p className="text-sm font-medium text-slate-300 tabular-nums">
                  {formatINR(parseFloat(formData.betAmount) * parseFloat(formData.odds))}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <Link href="/dashboard" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={isSubmitting} className="btn-primary min-w-[120px]">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating...
                </span>
              ) : 'Create Bet'}
            </button>
          </div>
        </form>
      </main>
      <BottomNav role="USER" />
    </div>
  )
}
