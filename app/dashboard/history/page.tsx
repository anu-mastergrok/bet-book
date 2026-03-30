'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { buildBetSlipMessage, openWhatsApp } from '@/lib/whatsapp'
import { ArrowLeft, SlidersHorizontal, MessageCircle, TrendingUp, TrendingDown, IndianRupee, X, ChevronUp, ChevronDown } from 'lucide-react'
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
    if (!accessToken) return
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
    if (sortKey !== col) return <ChevronDown size={12} className="text-base-content/40 inline ml-1" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary inline ml-1" />
      : <ChevronDown size={12} className="text-primary inline ml-1" />
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-base-100">
        <div className="flex flex-col items-center gap-3">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/40 text-sm">Loading bet history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 text-base-content/60 hover:text-base-content/80 hover:bg-base-300 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-base-content">Bet History</h1>
              <p className="text-xs text-base-content/40">All your bets</p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn btn-neutral btn-sm gap-1 ${isFiltersActive ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
          >
            <SlidersHorizontal size={14} />
            <span>Filters{isFiltersActive ? ' •' : ''}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Breadcrumb */}
        <div className="breadcrumbs text-sm mb-4">
          <ul>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li>History</li>
          </ul>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-base-content/80 flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-primary" />
                  Filters &amp; Sort
                </h2>
                {isFiltersActive && (
                  <button
                    onClick={clearFilters}
                    className="btn btn-ghost btn-xs flex items-center gap-1"
                  >
                    <X size={12} />
                    Clear filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Result filter */}
                <div>
                  <label className="block text-xs text-base-content/40 mb-1.5">Result</label>
                  <select
                    value={filters.result}
                    onChange={e => setFilters(f => ({ ...f, result: e.target.value }))}
                    className="select select-bordered w-full"
                  >
                    <option value="">All Results</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {/* Settlement filter */}
                <div>
                  <label className="block text-xs text-base-content/40 mb-1.5">Settlement</label>
                  <select
                    value={filters.settlement}
                    onChange={e => setFilters(f => ({ ...f, settlement: e.target.value }))}
                    className="select select-bordered w-full"
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
                  <label className="block text-xs text-base-content/40 mb-1.5">Date From</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                    className="input input-bordered w-full"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs text-base-content/40 mb-1.5">Date To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                    className="input input-bordered w-full"
                  />
                </div>
              </div>

              {/* Sort controls */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-base-300">
                <span className="text-xs text-base-content/40">Sort by:</span>
                {(['date', 'amount', 'pnl'] as SortKey[]).map(key => (
                  <button
                    key={key}
                    onClick={() => handleSortClick(key)}
                    className={`btn btn-ghost btn-xs flex items-center gap-1 ${sortKey === key ? 'text-primary border-primary/40 bg-primary/10' : ''}`}
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
          </div>
        )}

        {/* Stats Row */}
        <div className="stats shadow bg-base-200 w-full stats-vertical sm:stats-horizontal">
          {/* Total P&L */}
          <div className="stat">
            <div className="stat-figure">
              <div className={`p-2 rounded-lg ${totalPnL >= 0 ? 'bg-success/10' : 'bg-error/10'}`}>
                {totalPnL >= 0
                  ? <TrendingUp className="text-success" size={20} />
                  : <TrendingDown className="text-error" size={20} />
                }
              </div>
            </div>
            <div className="stat-title">Total P&L{isFiltersActive ? ' (filtered)' : ''}</div>
            <div className={`stat-value text-2xl tabular-nums ${totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatINR(Math.round(totalPnL * 100) / 100, true)}
            </div>
          </div>

          {/* Total Bets */}
          <div className="stat">
            <div className="stat-figure">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <IndianRupee className="text-violet-400" size={20} />
              </div>
            </div>
            <div className="stat-title">Showing</div>
            <div className="stat-value text-2xl tabular-nums">{filtered.length}</div>
            {isFiltersActive && bets.length !== filtered.length && (
              <div className="stat-desc">of {bets.length} total</div>
            )}
          </div>

          {/* Wins */}
          <div className="stat">
            <div className="stat-figure">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="text-success" size={20} />
              </div>
            </div>
            <div className="stat-title">Wins</div>
            <div className="stat-value text-2xl text-success tabular-nums">{winCount}</div>
            <div className="stat-desc">
              {filtered.length > 0 ? Math.round((winCount / filtered.length) * 100) : 0}% win rate
            </div>
          </div>

          {/* Losses */}
          <div className="stat">
            <div className="stat-figure">
              <div className="p-2 bg-error/10 rounded-lg">
                <TrendingDown className="text-error" size={20} />
              </div>
            </div>
            <div className="stat-title">Losses</div>
            <div className="stat-value text-2xl text-error tabular-nums">{lossCount}</div>
            <div className="stat-desc">
              {filtered.length - winCount - lossCount > 0 && `${filtered.length - winCount - lossCount} pending`}
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="card bg-base-200 shadow-sm p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-base-content/80">
              {isFiltersActive ? 'Filtered Bets' : 'All Bets'}
            </h2>
            <div className="flex items-center gap-3">
              {/* Inline sort for non-filter-panel view */}
              {!showFilters && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-xs text-base-content/40">Sort:</span>
                  {(['date', 'amount', 'pnl'] as SortKey[]).map(key => (
                    <button
                      key={key}
                      onClick={() => handleSortClick(key)}
                      className={`btn btn-ghost btn-xs ${sortKey === key ? 'text-primary border-primary/40 bg-primary/10' : ''}`}
                    >
                      {key === 'date' ? 'Date' : key === 'amount' ? 'Amount' : 'P&L'}
                      {sortKey === key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-xs text-base-content/40">{filtered.length} records</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filtered.length > 0 ? (
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>
                      <button onClick={() => handleSortClick('amount')} className="flex items-center gap-1 hover:text-base-content transition-colors">
                        Amount <SortIcon col="amount" />
                      </button>
                    </th>
                    <th>Odds</th>
                    <th>
                      <button onClick={() => handleSortClick('pnl')} className="flex items-center gap-1 hover:text-base-content transition-colors">
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
                        <div className="text-xs text-base-content/40">{bet.match.series.name}</div>
                      </td>
                      <td className="font-medium">{bet.clientName}</td>
                      <td className="text-base-content/60 capitalize">{bet.betType}</td>
                      <td className="font-medium tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                      <td className="text-base-content/60 tabular-nums">{bet.odds}×</td>
                      <td className={`font-semibold tabular-nums ${Number(bet.profitLoss) >= 0 ? 'text-success' : 'text-error'}`}>
                        {Number(bet.profitLoss) >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
                      </td>
                      <td>
                        <span className={
                          bet.result === 'win' ? 'badge badge-success' :
                          bet.result === 'loss' ? 'badge badge-error' : 'badge badge-warning'
                        }>
                          {bet.result}
                        </span>
                      </td>
                      <td>
                        <span className={
                          bet.settlementStatus === 'settled' ? 'badge badge-success' :
                          bet.settlementStatus === 'collected' ? 'badge badge-info' :
                          bet.settlementStatus === 'lost_in_another_match' ? 'badge badge-error' :
                          'badge badge-warning'
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
                          className="btn btn-ghost btn-xs p-1.5"
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
                <IndianRupee className="mx-auto text-base-content/40 mb-3" size={32} />
                {isFiltersActive ? (
                  <>
                    <p className="text-base-content/60 font-medium">No bets match your filters</p>
                    <p className="text-base-content/40 text-sm mt-1">Try adjusting or clearing your filters</p>
                    <button
                      onClick={clearFilters}
                      className="btn btn-ghost btn-xs mt-4 inline-flex items-center gap-1.5"
                    >
                      <X size={14} />
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-base-content/60 font-medium">No bets yet</p>
                    <p className="text-base-content/40 text-sm mt-1">Create your first bet from the dashboard</p>
                    <Link href="/dashboard/new-bet" className="btn btn-primary inline-flex mt-4">
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
