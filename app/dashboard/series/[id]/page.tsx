'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatINR } from '@/lib/format'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface MatchBet {
  id: string
  clientName: string
  betAmount: number
  result: string
  profitLoss: number
  settlementStatus: string
  confirmedByFriend: boolean
  disputeStatus: string | null
  clientUser: { id: string; name: string } | null
}

interface MatchBreakdown {
  matchId: string
  label: string
  matchType: string
  matchDate: string
  status?: string
  liveScore?: string
  result?: string
  totalBets: number
  wins: number
  losses: number
  matchPnl: number
  collected: number
  pending: number
  bets: MatchBet[]
}

interface FriendSummary {
  clientName: string
  clientUserId: string | null
  bets: number
  wins: number
  losses: number
  seriesPnl: number
  outstanding: number
}

interface Payment {
  id: string
  clientName: string
  amount: number
  method: string
  upiRef: string | null
  note: string | null
  createdAt: string
}

interface Summary {
  series: { id: string; name: string; status: string; startDate: string; endDate: string }
  totals: { totalMatches: number; totalBets: number; winRate: number; totalPnl: number; outstanding: number }
  matchBreakdown: MatchBreakdown[]
  byFriend: FriendSummary[]
  paymentHistory: Payment[]
}

type Tab = 'matches' | 'payments' | 'friends'

export default function SeriesSummaryPage() {
  const { accessToken } = useAuth()
  const params = useParams()
  const seriesId = params.id as string
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('matches')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!accessToken || !seriesId) return
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch(`/api/series/${seriesId}/summary`, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!r.ok || cancelled) return
        const data = await r.json()
        if (!cancelled) setSummary(data)
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [accessToken, seriesId])

  const toggleExpand = (matchId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(matchId) ? next.delete(matchId) : next.add(matchId)
      return next
    })
  }

  if (isLoading) return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
  if (!summary) return (
    <div className="min-h-dvh bg-base-100 flex items-center justify-center">
      <div className="text-center text-error">Series not found</div>
    </div>
  )

  const { series, totals, matchBreakdown, byFriend, paymentHistory } = summary

  return (
    <div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300 px-4 sm:px-6 py-3">
        <h1 className="text-base font-semibold text-base-content">{series.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <div className="breadcrumbs text-sm mb-4">
          <ul>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li>Series</li>
            <li>{series?.name}</li>
          </ul>
        </div>

        {/* Series header card */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-base-content">{series.name}</h2>
                <p className="text-xs text-base-content/60 mt-1">
                  {new Date(series.startDate).toLocaleDateString('en-IN')} – {new Date(series.endDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <span className={`badge capitalize ${series.status === 'active' ? 'badge badge-success' : 'badge badge-ghost'}`}>
                {series.status}
              </span>
            </div>
          </div>
        </div>

        {/* Totals grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-3 text-center">
              <p className="text-xs text-base-content/60">Matches</p>
              <p className="text-2xl font-bold text-base-content">{totals.totalMatches}</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-3 text-center">
              <p className="text-xs text-base-content/60">Win Rate</p>
              <p className="text-2xl font-bold text-success">{totals.winRate}%</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-3 text-center">
              <p className="text-xs text-base-content/60">Total P&L</p>
              <p className={`text-2xl font-bold ${totals.totalPnl >= 0 ? 'text-success' : 'text-error'}`}>
                {totals.totalPnl >= 0 ? '+' : ''}{formatINR(totals.totalPnl)}
              </p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-3 text-center">
              <p className="text-xs text-base-content/60">Outstanding</p>
              <p className="text-2xl font-bold text-primary">{formatINR(totals.outstanding)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-base-200 p-1 rounded-xl border border-base-300">
          {(['matches', 'payments', 'friends'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-lg capitalize font-medium ${tab === t ? 'btn btn-primary' : 'text-base-content/60 hover:text-base-content'}`}
            >
              {t === 'friends' ? 'By Friend' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Matches */}
        {tab === 'matches' && (
          <div className="space-y-3">
            {matchBreakdown.map(m => (
              <div key={m.matchId} className="card bg-base-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(m.matchId)}
                  className="w-full px-4 py-3 flex justify-between items-center text-left"
                >
                  <div>
                    <p className="font-medium text-base-content text-sm">{m.label} · {m.matchType}</p>
                    <p className="text-xs text-base-content/60">{new Date(m.matchDate).toLocaleDateString('en-IN')} · {m.wins}W {m.losses}L</p>
                    {m.status === 'live' && m.liveScore && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                        </span>
                        <span className="text-xs text-success truncate">{m.liveScore}</span>
                      </div>
                    )}
                    {m.status === 'completed' && m.result && (
                      <p className="text-xs text-base-content/40 mt-1 truncate">{m.result}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${m.matchPnl >= 0 ? 'text-success' : 'text-error'}`}>
                      {m.matchPnl >= 0 ? '+' : ''}{formatINR(m.matchPnl)}
                    </p>
                    <p className="text-xs text-base-content/40">{expanded.has(m.matchId) ? '▲' : '▼'}</p>
                  </div>
                </button>

                {expanded.has(m.matchId) && (
                  <div className="border-t border-base-300">
                    <div className="px-4 py-2 flex justify-between text-xs text-base-content/60">
                      <span>Collected: {formatINR(m.collected)}</span>
                      <span>Pending: {formatINR(m.pending)}</span>
                    </div>
                    {m.bets.map(bet => (
                      <div key={bet.id} className="px-4 py-2 flex justify-between items-center border-t border-base-300/50 text-sm">
                        <div>
                          <p className="text-base-content">{bet.clientUser?.name ?? bet.clientName}</p>
                          <p className="text-xs text-base-content/40 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-base-content/60">{formatINR(bet.betAmount)}</p>
                          <p className={`font-semibold ${bet.profitLoss >= 0 ? 'text-success' : 'text-error'}`}>
                            {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {matchBreakdown.length === 0 && <p className="text-center text-base-content/40 py-10">No matches yet.</p>}
          </div>
        )}

        {/* Tab: Payments */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {paymentHistory.map(p => (
              <div key={p.id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4 flex flex-row justify-between items-center">
                  <div>
                    <p className="text-base-content text-sm font-medium">{p.clientName}</p>
                    <p className="text-xs text-base-content/60 capitalize">{p.method}{p.upiRef ? ` · ${p.upiRef}` : ''}</p>
                    <p className="text-xs text-base-content/40">{new Date(p.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <p className="text-success font-semibold">{formatINR(Number(p.amount))}</p>
                </div>
              </div>
            ))}
            {paymentHistory.length === 0 && <p className="text-center text-base-content/40 py-10">No payments recorded yet.</p>}
          </div>
        )}

        {/* Tab: By Friend */}
        {tab === 'friends' && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2 text-xs text-base-content/40 px-1">
              <span className="col-span-2">Friend</span>
              <span className="text-center">W/L</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Due</span>
            </div>
            {byFriend.map(f => (
              <div key={f.clientUserId ?? f.clientName} className="card bg-base-200 shadow-sm">
                <div className="card-body p-3">
                  <div className="grid grid-cols-5 gap-2 items-center text-sm">
                    <span className="col-span-2 text-base-content font-medium truncate">{f.clientName}</span>
                    <span className="text-center text-base-content/60 text-xs">{f.wins}W/{f.losses}L</span>
                    <span className={`text-right font-semibold text-xs ${f.seriesPnl >= 0 ? 'text-success' : 'text-error'}`}>
                      {f.seriesPnl >= 0 ? '+' : ''}{formatINR(f.seriesPnl)}
                    </span>
                    <span className={`text-right text-xs ${f.outstanding > 0 ? 'text-primary' : 'text-base-content/60'}`}>
                      {formatINR(Math.abs(f.outstanding))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {byFriend.length === 0 && <p className="text-center text-base-content/40 py-10">No bet data yet.</p>}
          </div>
        )}
      </main>
    </div>
  )
}
