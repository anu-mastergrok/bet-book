'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatINR } from '@/lib/format'
import { Clock } from 'lucide-react'

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
  confirmedByFriend: boolean
  disputeStatus: string | null
  match: {
    id: string
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    status?: string
    liveScore?: string
    result?: string
    series: { id: string; name: string }
  }
}

export default function FriendDashboard() {
  const { accessToken } = useAuth()
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } })
        if (!r.ok) throw new Error('Failed to load bets')
        const data = await r.json()
        if (!cancelled) setBets(data.bets ?? [])
      } catch {
        // silently fail — layout guard ensures user is authenticated
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [accessToken])

  const totalOwed = bets
    .filter(b => b.profitLoss > 0 && b.settlementStatus === 'pending')
    .reduce((sum, b) => sum + b.profitLoss, 0)

  const totalOwedToMe = bets
    .filter(b => b.profitLoss < 0 && b.settlementStatus === 'pending')
    .reduce((sum, b) => sum + Math.abs(b.profitLoss), 0)

  const net = totalOwed - totalOwedToMe

  if (isLoading) {
    return <div className="text-center text-slate-400 py-20">Loading...</div>
  }

  // Group bets by series
  const bySeries = bets.reduce<Record<string, { seriesName: string; bets: Bet[] }>>(
    (acc, bet) => {
      const sid = bet.match.series.id
      if (!acc[sid]) acc[sid] = { seriesName: bet.match.series.name, bets: [] }
      acc[sid].bets.push(bet)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-slate-400">Total You Owe</p>
            <p className="text-red-400 font-semibold text-lg">{formatINR(totalOwed)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Owed to You</p>
            <p className="text-emerald-400 font-semibold text-lg">{formatINR(totalOwedToMe)}</p>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
          <p className="text-slate-400 text-sm">Net Balance</p>
          <p className={`font-bold text-xl ${net > 0 ? 'text-red-400' : net < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {net > 0 ? `You owe ${formatINR(net)}` : net < 0 ? `Owed ${formatINR(Math.abs(net))}` : 'Settled up'}
          </p>
        </div>
      </div>

      {/* Bets by series */}
      {Object.entries(bySeries).map(([sid, { seriesName, bets: seriesBets }]) => (
        <div key={sid} className="space-y-3">
          <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wider">{seriesName}</h2>
          {seriesBets.slice(0, 5).map(bet => (
            <div key={bet.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">
                    {bet.match.teamA} vs {bet.match.teamB}
                    {bet.match.status === 'live' && (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{bet.match.matchType} · {new Date(bet.match.matchDate).toLocaleDateString('en-IN')}</p>
                  {bet.match.status === 'completed' && bet.match.result && (
                    <p className="text-xs text-slate-500 truncate">{bet.match.result}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  bet.result === 'win' ? 'bg-emerald-900 text-emerald-300'
                  : bet.result === 'loss' ? 'bg-red-900 text-red-300'
                  : 'bg-amber-900 text-amber-300'
                }`}>
                  {bet.result}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bet: {formatINR(bet.betAmount)} · {bet.odds}×</span>
                <span className={bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={12} />
                <span className="capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</span>
                {bet.disputeStatus === 'open' && (
                  <span className="bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Disputed</span>
                )}
                {bet.confirmedByFriend && (
                  <span className="bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Confirmed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {bets.length === 0 && (
        <div className="text-center text-slate-500 py-20">No bets yet.</div>
      )}
    </div>
  )
}
