'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { buildBetSlipMessage, openWhatsApp } from '@/lib/whatsapp'
import { ArrowLeft, SlidersHorizontal, MessageCircle, Loader, TrendingUp, TrendingDown, IndianRupee, X, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'

interface Bet {
  id: string
  clientName: string
  betOnTeam: string
  betAmount: number
  odds: number
  betType: string
  result: string
  profitLoss: number
  settlementStatus: string
  paymentMethod?: string | null
  createdAt: string
  match: {
    teamA: string
    teamB: string
    matchDate: string
    series: { name: string }
  }
}

interface Filters {
  result: string       // '' | 'win' | 'loss' | 'pending'
  settlement: string   // '' | 'pending' | 'collected' | 'settled' | 'lost_in_another_match'
  dateFrom: string
  dateTo: string
}

type SortKey = 'date' | 'amount' | 'pnl'
type SortDir = 'asc' | 'desc'

const DEFAULT_FILTERS: Filters = {
  result: '',
  settlement: '',
  dateFrom: '',
  dateTo: '',
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, accessToken } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role === 'ADMIN') { router.push('/admin'); return }
    fetchBets()
  }, [user, router])

  const fetchBets = async () => {
    try {
      const response = await fetch('/api/bets', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error('Failed to fetch bets')
      const { bets } = await response.json()
      setBets(bets)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load bets')
    } finally {
      setIsLoading(false)
    }
  }

  const isFiltersActive = filters.result !== '' || filters.settlement !== '' || filters.dateFrom !== '' || filters.dateTo !== ''

  const filtered = useMemo(() => {
    let list = [...bets]
    if (filters.result) list = list.filter(b => b.result === filters.result)
    if (filters.settlement) list = list.filter(b => b.settlementStatus === filters.settlement)
    if (filters.dateFrom) list = list.filter(b => new Date(b.match.matchDate) >= new Date(filters.dateFrom))
    if (filters.dateTo) list = list.filter(b => new Date(b.match.matchDate) <= new Date(filters.dateTo))

    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'date') diff = new Date(a.match.matchDate).getTime() - new Date(b.match.matchDate).getTime()
      if (sortKey === 'amount') diff = Number(a.betAmount) - Number(b.betAmount)
      if (sortKey === 'pnl') diff = Number(a.profitLoss) - Number(b.profitLoss)
      return sortDir === 'asc' ? diff : -diff
    })
    return list
  }, [bets, filters, sortKey, sortDir])

  const winCount = filtered.filter(b => b.result === 'win').length
  const lossCount = filtered.filter(b => b.result === 'loss').length
  const totalPnL = filtered.reduce((sum, b) => sum + Number(b.profitLoss), 0)

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const clearFilters = () => setFilters(DEFAULT_FILTERS)

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronDown size={12} className="text-slate-600 inline ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-amber-400 inline ml-1" />
      : <ChevronDown size={12} className="text-amber-400 inline ml-1" />
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin text-amber-400" size={32} />
          <p className="text-slate-500 text-sm">Loading bet history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-100">Bet History</h1>
              <p className="text-xs text-slate-500">All your bets</p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
              isFiltersActive
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filters{isFiltersActive ? ' •' : ''}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Filter Panel */}
        {showFilters && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-amber-400" />
                Filters &amp; Sort
              </h2>
              {isFiltersActive && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                  Clear filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Result filter */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Result</label>
                <select
                  value={filters.result}
                  onChange={e => setFilters(f => ({ ...f, result: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">All Results</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Settlement filter */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Settlement</label>
                <select
                  value={filters.settlement}
                  onChange={e => setFilters(f => ({ ...f, settlement: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="collected">Collected</option>
                  <option value="settled">Settled</option>
                  <option value="lost_in_another_match">Lost in Another Match</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-700/60">
              <span className="text-xs text-slate-500">Sort by:</span>
              {(['date', 'amount', 'pnl'] as SortKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => handleSortClick(key)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    sortKey === key
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {key === 'date' ? 'Date' : key === 'amount' ? 'Amount' : 'P&L'}
                  {sortKey === key && (
                    sortDir === 'asc'
                      ? <ChevronUp size={12} />
                      : <ChevronDown size={12} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total P&L */}
          <div className={`card col-span-2 lg:col-span-1 border ${totalPnL >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Total P&L</p>
                <p className={`text-3xl font-bold tabular-nums mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatINR(Math.round(totalPnL * 100) / 100, true)}
                </p>
                {isFiltersActive && (
                  <p className="text-xs text-slate-500 mt-1">filtered</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {totalPnL >= 0
                  ? <TrendingUp className="text-emerald-400" size={20} />
                  : <TrendingDown className="text-red-400" size={20} />
                }
              </div>
            </div>
          </div>

          {/* Total Bets */}
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Showing</p>
                <p className="stat-value mt-1">{filtered.length}</p>
                {isFiltersActive && bets.length !== filtered.length && (
                  <p className="text-xs text-slate-500 mt-1">of {bets.length} total</p>
                )}
              </div>
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <IndianRupee className="text-violet-400" size={20} />
              </div>
            </div>
          </div>

          {/* Wins */}
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Wins</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1 tabular-nums">{winCount}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {filtered.length > 0 ? Math.round((winCount / filtered.length) * 100) : 0}% win rate
                </p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="text-emerald-400" size={20} />
              </div>
            </div>
          </div>

          {/* Losses */}
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Losses</p>
                <p className="text-3xl font-bold text-red-400 mt-1 tabular-nums">{lossCount}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {filtered.length - winCount - lossCount > 0 && `${filtered.length - winCount - lossCount} pending`}
                </p>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="text-red-400" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-300">
              {isFiltersActive ? 'Filtered Bets' : 'All Bets'}
            </h2>
            <div className="flex items-center gap-3">
              {/* Inline sort for non-filter-panel view */}
              {!showFilters && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Sort:</span>
                  {(['date', 'amount', 'pnl'] as SortKey[]).map(key => (
                    <button
                      key={key}
                      onClick={() => handleSortClick(key)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        sortKey === key
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {key === 'date' ? 'Date' : key === 'amount' ? 'Amount' : 'P&L'}
                      {sortKey === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-xs text-slate-500">{filtered.length} records</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filtered.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>
                      <button onClick={() => handleSortClick('amount')} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                        Amount <SortIcon col="amount" />
                      </button>
                    </th>
                    <th>Odds</th>
                    <th>
                      <button onClick={() => handleSortClick('pnl')} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                        P&L <SortIcon col="pnl" />
                      </button>
                    </th>
                    <th>Result</th>
                    <th>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(bet => (
                    <tr key={bet.id}>
                      <td>
                        <div className="font-medium">{bet.match.teamA} vs {bet.match.teamB}</div>
                        <div className="text-xs text-slate-500">{bet.match.series.name}</div>
                      </td>
                      <td className="font-medium">{bet.clientName}</td>
                      <td className="text-slate-400 capitalize">{bet.betType}</td>
                      <td className="font-medium tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                      <td className="text-slate-400 tabular-nums">{bet.odds}×</td>
                      <td className={`font-semibold tabular-nums ${Number(bet.profitLoss) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {Number(bet.profitLoss) >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
                      </td>
                      <td>
                        <span className={
                          bet.result === 'win' ? 'badge-success' :
                          bet.result === 'loss' ? 'badge-danger' : 'badge-warning'
                        }>
                          {bet.result}
                        </span>
                      </td>
                      <td>
                        <span className={
                          bet.settlementStatus === 'settled' ? 'badge-success' :
                          bet.settlementStatus === 'collected' ? 'badge-info' :
                          bet.settlementStatus === 'lost_in_another_match' ? 'badge-danger' :
                          'badge-warning'
                        }>
                          {bet.settlementStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            const msg = buildBetSlipMessage({
                              clientName: bet.clientName,
                              betOnTeam: bet.betOnTeam,
                              betAmount: Number(bet.betAmount),
                              odds: Number(bet.odds),
                              betType: bet.betType,
                              result: bet.result,
                              profitLoss: Number(bet.profitLoss),
                              settlementStatus: bet.settlementStatus,
                              paymentMethod: bet.paymentMethod,
                              match: {
                                teamA: bet.match.teamA,
                                teamB: bet.match.teamB,
                                matchDate: bet.match.matchDate || new Date().toISOString(),
                                series: { name: bet.match.series.name },
                              },
                            })
                            openWhatsApp(msg)
                          }}
                          className="p-1.5 text-slate-400 hover:text-[#25D366] hover:bg-green-500/10 rounded transition-colors"
                          title="Share on WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center">
                <IndianRupee className="mx-auto text-slate-600 mb-3" size={32} />
                {isFiltersActive ? (
                  <>
                    <p className="text-slate-400 font-medium">No bets match your filters</p>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting or clearing your filters</p>
                    <button
                      onClick={clearFilters}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <X size={14} />
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 font-medium">No bets yet</p>
                    <p className="text-slate-500 text-sm mt-1">Create your first bet from the dashboard</p>
                    <Link href="/dashboard/new-bet" className="btn-primary inline-flex mt-4">
                      Back to Dashboard
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav role="USER" />
    </div>
  )
}
