'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { LogOut, Plus, TrendingUp, TrendingDown, Loader, IndianRupee, Target, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { buildBetSlipMessage, openWhatsApp } from '@/lib/whatsapp'
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
  match: {
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate: string
    series: { name: string }
  }
}

interface PnLData { series: string; pnl: number }
interface ClientData { name: string; total: number }

const CHART_COLORS = {
  win: '#10b981',
  loss: '#ef4444',
  pending: '#f59e0b',
  bar: '#8b5cf6',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className={`font-semibold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin text-amber-400" size={32} />
          <p className="text-slate-500 text-sm">Loading your dashboard...</p>
        </div>
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

  const pieColors = [CHART_COLORS.win, CHART_COLORS.loss, CHART_COLORS.pending]

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-amber-400" size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">My Dashboard</h1>
              <p className="text-xs text-slate-500">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/new-bet" className="hidden sm:inline-flex btn-primary text-xs px-3 py-2">
              <Plus size={15} />
              <span>New Bet</span>
            </Link>
            <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-2">
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total P&L */}
          <div className={`card col-span-2 lg:col-span-1 border ${totalPnL >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Total P&L</p>
                <p className={`text-3xl font-bold tabular-nums mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatINR(totalPnL, true)}
                </p>
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
                <p className="stat-label">Total Bets</p>
                <p className="stat-value mt-1">{bets.length}</p>
              </div>
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Target className="text-violet-400" size={20} />
              </div>
            </div>
          </div>

          {/* Wins */}
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Wins</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1 tabular-nums">{winCount}</p>
                <p className="text-xs text-slate-500 mt-1">{winRate}% win rate</p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="text-emerald-400" size={20} />
              </div>
            </div>
          </div>

          {/* Losses */}
          <div className="card">
            <div className="flex justify-between items-start">
              <div>
                <p className="stat-label">Losses</p>
                <p className="text-3xl font-bold text-red-400 mt-1 tabular-nums">{lossCount}</p>
                {pendingCount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">{pendingCount} pending</p>
                )}
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="text-red-400" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* P&L by Series */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">P&L by Series</h2>
            {pnlData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={pnlData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="series" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                  <Bar dataKey="pnl" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {pnlData.map((entry, index) => (
                      <Cell key={index} fill={entry.pnl >= 0 ? '#8b5cf6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-500 text-sm">
                No bet data yet
              </div>
            )}
          </div>

          {/* Results Pie */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Bet Results</h2>
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
                    formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-slate-500 text-sm">
                No bet data yet
              </div>
            )}
          </div>
        </div>

        {/* Bets Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-300">My Bets</h2>
            <span className="text-xs text-slate-500">{bets.length} records</span>
          </div>
          <div className="overflow-x-auto">
            {bets.length > 0 ? (
              <table className="table">
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
                      <td className="text-slate-400">{bet.match.series.name}</td>
                      <td>
                        <div className="font-medium">{bet.match.teamA} vs {bet.match.teamB}</div>
                        <div className="text-xs text-slate-500 capitalize">{bet.match.status}</div>
                      </td>
                      <td className="font-medium">{bet.clientName}</td>
                      <td className="text-slate-300">
                        {bet.betOnTeam === 'teamA' ? bet.match.teamA : bet.match.teamB}
                      </td>
                      <td className="font-medium tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                      <td className="text-slate-400 tabular-nums">{bet.odds}×</td>
                      <td>
                        <span className={
                          bet.result === 'win' ? 'badge-success' :
                          bet.result === 'loss' ? 'badge-danger' : 'badge-warning'
                        }>
                          {bet.result}
                        </span>
                      </td>
                      <td className={`font-semibold tabular-nums ${bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {bet.profitLoss >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
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
                <p className="text-slate-400 font-medium">No bets yet</p>
                <p className="text-slate-500 text-sm mt-1">Create your first bet to get started</p>
                <Link href="/dashboard/new-bet" className="btn-primary inline-flex mt-4">
                  <Plus size={16} />
                  New Bet
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
