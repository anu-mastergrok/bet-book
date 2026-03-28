'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { LogOut, Plus, TrendingUp, TrendingDown, IndianRupee, Target, CheckCircle2, XCircle, MessageCircle, Sun, Moon } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { buildBetSlipMessage, openWhatsApp } from '@/lib/whatsapp'
import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'
import { useTheme } from '@/components/ThemeProvider'

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
  match: {
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate: string
    liveScore?: string
    result?: string
    series: { id: string; name: string }
  }
}

interface PnLData { series: string; pnl: number }

function useDaisyUIColors() {
  const [colors, setColors] = useState({
    primary: '#570df8',
    success: '#00a96e',
    error: '#ff5861',
    warning: '#ffbe00',
    baseContent: '#d1d5db',
    base200: '#1d232a',
    base300: '#191e24',
  })
  useEffect(() => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    const resolve = (v: string) => {
      const val = style.getPropertyValue(v).trim()
      return val ? `oklch(${val})` : undefined
    }
    setColors(prev => ({
      primary: resolve('--p') ?? prev.primary,
      success: resolve('--su') ?? prev.success,
      error: resolve('--er') ?? prev.error,
      warning: resolve('--wa') ?? prev.warning,
      baseContent: resolve('--bc') ?? prev.baseContent,
      base200: resolve('--b2') ?? prev.base200,
      base300: resolve('--b3') ?? prev.base300,
    }))
  }, [])
  return colors
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div className="bg-base-200 border border-base-300 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-base-content/50 mb-1">{label}</p>
        <p className={`font-semibold ${val >= 0 ? 'text-success' : 'text-error'}`}>
          {formatINR(val)}
        </p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, accessToken } = useAuth()
  const toast = useToast()
  const { theme, toggle } = useTheme()
  const chartColors = useDaisyUIColors()
  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([])
  const [pnlData, setPnlData] = useState<PnLData[]>([])
  const [totalPnL, setTotalPnL] = useState(0)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role === 'ADMIN') { router.push('/admin'); return }
    fetchData()
  }, [user, router])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/bets', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error('Failed to fetch bets')

      const { bets } = await response.json()
      setBets(bets)

      const seriesPnL: { [k: string]: number } = {}
      let total = 0
      bets.forEach((bet: Bet) => {
        seriesPnL[bet.match.series.name] = (seriesPnL[bet.match.series.name] || 0) + bet.profitLoss
        total += bet.profitLoss
      })

      setPnlData(Object.entries(seriesPnL).map(([series, pnl]) => ({
        series,
        pnl: Math.round(pnl * 100) / 100,
      })))
      setTotalPnL(Math.round(total * 100) / 100)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!user || isLoading) {
    return (
      <div className="min-h-dvh bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const winCount = bets.filter(b => b.result === 'win').length
  const lossCount = bets.filter(b => b.result === 'loss').length
  const pendingCount = bets.filter(b => b.result === 'pending').length
  const winRate = bets.length > 0 ? Math.round((winCount / bets.length) * 100) : 0

  const pieData = [
    { name: 'Wins', value: winCount },
    { name: 'Losses', value: lossCount },
    { name: 'Pending', value: pendingCount },
  ].filter(d => d.value > 0)

  const pieColors = [chartColors.success, chartColors.error, chartColors.warning]

  return (
    <div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-primary" size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold">My Dashboard</h1>
              <p className="text-xs text-base-content/40">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/new-bet" className="hidden sm:inline-flex btn btn-primary btn-sm gap-1">
              <Plus size={15} /><span>New Bet</span>
            </Link>
            <button onClick={toggle} className="btn btn-ghost btn-sm btn-circle">
              {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-1">
              <LogOut size={15} /><span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats Row */}
        <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-200 w-full">
          <div className="stat">
            <div className="stat-figure">
              {totalPnL >= 0
                ? <TrendingUp className="text-success" size={24} />
                : <TrendingDown className="text-error" size={24} />}
            </div>
            <div className="stat-title">Total P&L</div>
            <div className={`stat-value text-2xl ${totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatINR(totalPnL, true)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-figure text-secondary"><Target size={24} /></div>
            <div className="stat-title">Total Bets</div>
            <div className="stat-value text-2xl">{bets.length}</div>
          </div>
          <div className="stat">
            <div className="stat-figure text-success"><CheckCircle2 size={24} /></div>
            <div className="stat-title">Wins</div>
            <div className="stat-value text-2xl text-success">{winCount}</div>
            <div className="stat-desc">{winRate}% win rate</div>
          </div>
          <div className="stat">
            <div className="stat-figure text-error"><XCircle size={24} /></div>
            <div className="stat-title">Losses</div>
            <div className="stat-value text-2xl text-error">{lossCount}</div>
            {pendingCount > 0 && <div className="stat-desc">{pendingCount} pending</div>}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* P&L by Series */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h2 className="text-sm font-semibold mb-4">P&L by Series</h2>
              {pnlData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pnlData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.base300} vertical={false} />
                    <XAxis dataKey="series" tick={{ fill: chartColors.baseContent, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartColors.baseContent, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                    <Bar dataKey="pnl" fill={chartColors.primary} radius={[4, 4, 0, 0]}>
                      {pnlData.map((entry, index) => (
                        <Cell key={index} fill={entry.pnl >= 0 ? chartColors.primary : chartColors.error} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-base-content/40 text-sm">
                  No bet data yet
                </div>
              )}
            </div>
          </div>

          {/* Results Pie */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body">
              <h2 className="text-sm font-semibold mb-4">Bet Results</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={pieColors[index]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => <span style={{ color: chartColors.baseContent, fontSize: 12 }}>{value}</span>}
                    />
                    <Tooltip
                      contentStyle={{ background: chartColors.base200, border: `1px solid ${chartColors.base300}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: chartColors.baseContent }}
                      itemStyle={{ color: chartColors.baseContent }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-base-content/40 text-sm">
                  No bet data yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="card bg-base-200 shadow-sm p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
            <h2 className="font-semibold text-sm">My Bets</h2>
            <span className="text-xs text-base-content/40">{bets.length} records</span>
          </div>
          <div className="overflow-x-auto">
            {bets.length > 0 ? (
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Match</th>
                    <th>Client</th>
                    <th>Team</th>
                    <th>Amount</th>
                    <th>Odds</th>
                    <th>Result</th>
                    <th>P&L</th>
                    <th>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map(bet => (
                    <tr key={bet.id}>
                      <td className="text-base-content/60">
                        <Link href={`/dashboard/series/${bet.match.series.id}`} className="hover:text-primary underline-offset-2 hover:underline">
                          {bet.match.series.name}
                        </Link>
                      </td>
                      <td>
                        <div className="font-medium flex items-center gap-1.5">
                          {bet.match.teamA} vs {bet.match.teamB}
                          {bet.match.status === 'live' && (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-base-content/40 capitalize">{bet.match.status}</div>
                        {bet.match.status === 'completed' && bet.match.result && (
                          <div className="text-xs text-base-content/60 mt-0.5 truncate max-w-[200px]">{bet.match.result}</div>
                        )}
                      </td>
                      <td className="font-medium">{bet.clientName}</td>
                      <td className="text-base-content/80">
                        {bet.betOnTeam === 'teamA' ? bet.match.teamA : bet.match.teamB}
                      </td>
                      <td className="font-medium tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                      <td className="text-base-content/60 tabular-nums">{bet.odds}×</td>
                      <td>
                        <span className={
                          bet.result === 'win' ? 'badge badge-success' :
                          bet.result === 'loss' ? 'badge badge-error' : 'badge badge-warning'
                        }>
                          {bet.result}
                        </span>
                      </td>
                      <td className={`font-semibold tabular-nums ${bet.profitLoss >= 0 ? 'text-success' : 'text-error'}`}>
                        {bet.profitLoss >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
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
                              match: {
                                teamA: bet.match.teamA,
                                teamB: bet.match.teamB,
                                matchDate: bet.match.matchDate || new Date().toISOString(),
                                series: { name: bet.match.series.name },
                              },
                            })
                            openWhatsApp(msg)
                          }}
                          className="p-1.5 text-base-content/40 hover:text-success hover:bg-success/10 rounded transition-colors"
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
                <IndianRupee className="mx-auto text-base-content/20 mb-3" size={32} />
                <p className="font-medium">No bets yet</p>
                <p className="text-base-content/40 text-sm mt-1">Create your first bet to get started</p>
                <Link href="/dashboard/new-bet" className="btn btn-primary btn-sm mt-4 gap-1">
                  <Plus size={16} />New Bet
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav role="USER" />
    </div>
  )
}
