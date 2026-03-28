'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatINR } from '@/lib/format'
import { useParams } from 'next/navigation'

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
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
      <div className="text-center text-slate-400">Loading...</div>
    </div>
  )
  if (!summary) return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
      <div className="text-center text-red-400">Series not found</div>
    </div>
  )

  const { series, totals, matchBreakdown, byFriend, paymentHistory } = summary

  return (
    <div className="min-h-dvh bg-slate-950 pb-24">
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <h1 className="text-base font-semibold text-slate-100">{series.name}</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Series header card */}
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{series.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(series.startDate).toLocaleDateString('en-IN')} – {new Date(series.endDate).toLocaleDateString('en-IN')}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full capitalize ${series.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
              {series.status}
            </span>
          </div>
        </div>

        {/* Totals grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Matches</p>
            <p className="text-2xl font-bold text-white">{totals.totalMatches}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Win Rate</p>
            <p className="text-2xl font-bold text-emerald-400">{totals.winRate}%</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Total P&L</p>
            <p className={`text-2xl font-bold ${totals.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totals.totalPnl >= 0 ? '+' : ''}{formatINR(totals.totalPnl)}
            </p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">Outstanding</p>
            <p className="text-2xl font-bold text-amber-400">{formatINR(totals.outstanding)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(['matches', 'payments', 'friends'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm rounded-lg capitalize font-medium ${tab === t ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'friends' ? 'By Friend' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Matches */}
        {tab === 'matches' && (
          <div className="space-y-3">
            {matchBreakdown.map(m => (
              <div key={m.matchId} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <button
                  onClick={() => toggleExpand(m.matchId)}
                  className="w-full px-4 py-3 flex justify-between items-center text-left"
                >
                  <div>
                    <p className="font-medium text-white text-sm">{m.label} · {m.matchType}</p>
                    <p className="text-xs text-slate-400">{new Date(m.matchDate).toLocaleDateString('en-IN')} · {m.wins}W {m.losses}L</p>
                    {m.status === 'live' && m.liveScore && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs text-emerald-400 truncate">{m.liveScore}</span>
                      </div>
                    )}
                    {m.status === 'completed' && m.result && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{m.result}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${m.matchPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.matchPnl >= 0 ? '+' : ''}{formatINR(m.matchPnl)}
                    </p>
                    <p className="text-xs text-slate-500">{expanded.has(m.matchId) ? '▲' : '▼'}</p>
                  </div>
                </button>

                {expanded.has(m.matchId) && (
                  <div className="border-t border-slate-800">
                    <div className="px-4 py-2 flex justify-between text-xs text-slate-400">
                      <span>Collected: {formatINR(m.collected)}</span>
                      <span>Pending: {formatINR(m.pending)}</span>
                    </div>
                    {m.bets.map(bet => (
                      <div key={bet.id} className="px-4 py-2 flex justify-between items-center border-t border-slate-800/50 text-sm">
                        <div>
                          <p className="text-white">{bet.clientUser?.name ?? bet.clientName}</p>
                          <p className="text-xs text-slate-500 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{formatINR(bet.betAmount)}</p>
                          <p className={`font-semibold ${bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {matchBreakdown.length === 0 && <p className="text-center text-slate-500 py-10">No matches yet.</p>}
          </div>
        )}

        {/* Tab: Payments */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {paymentHistory.map(p => (
              <div key={p.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-white text-sm font-medium">{p.clientName}</p>
                  <p className="text-xs text-slate-400 capitalize">{p.method}{p.upiRef ? ` · ${p.upiRef}` : ''}</p>
                  <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <p className="text-emerald-400 font-semibold">{formatINR(Number(p.amount))}</p>
              </div>
            ))}
            {paymentHistory.length === 0 && <p className="text-center text-slate-500 py-10">No payments recorded yet.</p>}
          </div>
        )}

        {/* Tab: By Friend */}
        {tab === 'friends' && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-2 text-xs text-slate-500 px-1">
              <span className="col-span-2">Friend</span>
              <span className="text-center">W/L</span>
              <span className="text-right">P&L</span>
              <span className="text-right">Due</span>
            </div>
            {byFriend.map(f => (
              <div key={f.clientUserId ?? f.clientName} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                <div className="grid grid-cols-5 gap-2 items-center text-sm">
                  <span className="col-span-2 text-white font-medium truncate">{f.clientName}</span>
                  <span className="text-center text-slate-400 text-xs">{f.wins}W/{f.losses}L</span>
                  <span className={`text-right font-semibold text-xs ${f.seriesPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {f.seriesPnl >= 0 ? '+' : ''}{formatINR(f.seriesPnl)}
                  </span>
                  <span className={`text-right text-xs ${f.outstanding > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {formatINR(Math.abs(f.outstanding))}
                  </span>
                </div>
              </div>
            ))}
            {byFriend.length === 0 && <p className="text-center text-slate-500 py-10">No bet data yet.</p>}
          </div>
        )}
      </main>
    </div>
  )
}
