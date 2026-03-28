'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal, ConfirmModal } from '@/components/Modal'
import {
  LogOut, Plus, TrendingUp, TrendingDown, Users, Zap,
  Loader, BarChart3, Calendar, Clock, Shield, Edit2, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'
import { BottomNav } from '@/components/BottomNav'

interface SummaryStats {
  totalUsers: number
  totalMatches: number
  totalBets: number
  totalSeries: number
  pendingSettlements: number
  totalPnL: number
}

interface SeriesData {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  matches: Array<{
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate?: string
    venue?: string
    matchType?: string
    _count?: { betEntries: number }
  }>
}

interface RecentBet {
  id: string
  clientName: string
  betAmount: number
  profitLoss: number
  match: {
    teamA: string
    teamB: string
    series: { name: string }
  }
}

export default function AdminPage() {
  const router = useRouter()
  const { user, logout, accessToken } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const [seriesData, setSeriesData] = useState<SeriesData[]>([])
  const [recentBets, setRecentBets] = useState<RecentBet[]>([])
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)

  const [seriesForm, setSeriesForm] = useState({ name: '', startDate: '', endDate: '' })
  const [matchForm, setMatchForm] = useState({
    seriesId: '', teamA: '', teamB: '', matchDate: '', venue: '', matchType: 'T20',
  })

  // Edit/Delete Series state
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null)
  const [editingSeries, setEditingSeries] = useState({ name: '', startDate: '', endDate: '', status: 'active' })
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false)
  const [deletingSeriesId, setDeletingSeriesId] = useState<string | null>(null)
  const [isDeleteSeriesModalOpen, setIsDeleteSeriesModalOpen] = useState(false)

  // Edit/Delete Match state
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editingMatch, setEditingMatch] = useState({
    seriesId: '', teamA: '', teamB: '', matchDate: '', venue: '', matchType: 'T20', status: 'upcoming',
  })
  const [isEditMatchModalOpen, setIsEditMatchModalOpen] = useState(false)
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null)
  const [isDeleteMatchModalOpen, setIsDeleteMatchModalOpen] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { router.push('/login'); return }
    fetchData()
  }, [user, router])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/summary', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error('Failed to fetch admin data')
      const data = await response.json()
      setStats(data.stats)
      setSeriesData(data.seriesOverview)
      setRecentBets(data.recentBets)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(seriesForm),
      })
      if (!response.ok) throw new Error('Failed to create series')
      toast.success('Series created successfully')
      setSeriesForm({ name: '', startDate: '', endDate: '' })
      setIsSeriesModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create series')
    }
  }

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(matchForm),
      })
      if (!response.ok) throw new Error('Failed to create match')
      toast.success('Match created successfully')
      setMatchForm({ seriesId: '', teamA: '', teamB: '', matchDate: '', venue: '', matchType: 'T20' })
      setIsMatchModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create match')
    }
  }

  const handleMatchFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setMatchForm(prev => ({ ...prev, [name]: value }))
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Series edit/delete handlers
  const handleEditSeries = (s: SeriesData) => {
    setEditingSeriesId(s.id)
    setEditingSeries({
      name: s.name,
      startDate: s.startDate.slice(0, 10),
      endDate: s.endDate.slice(0, 10),
      status: s.status,
    })
    setIsEditSeriesModalOpen(true)
  }

  const handleUpdateSeries = async () => {
    if (!editingSeriesId) return
    try {
      const res = await fetch(`/api/series/${editingSeriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editingSeries),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update series')
      toast.success('Series updated')
      setIsEditSeriesModalOpen(false)
      fetchData()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleDeleteSeries = async () => {
    if (!deletingSeriesId) return
    try {
      const res = await fetch(`/api/series/${deletingSeriesId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete series')
      toast.success('Series deleted')
      setIsDeleteSeriesModalOpen(false)
      fetchData()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  // Match edit/delete handlers
  const handleEditMatch = (match: SeriesData['matches'][0], seriesId: string) => {
    setEditingMatchId(match.id)
    setEditingMatch({
      seriesId,
      teamA: match.teamA,
      teamB: match.teamB,
      matchDate: match.matchDate ? new Date(match.matchDate).toISOString().slice(0, 16) : '',
      venue: match.venue || '',
      matchType: match.matchType || 'T20',
      status: match.status,
    })
    setIsEditMatchModalOpen(true)
  }

  const handleUpdateMatch = async () => {
    if (!editingMatchId) return
    try {
      const res = await fetch(`/api/matches/${editingMatchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(editingMatch),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update match')
      toast.success('Match updated')
      setIsEditMatchModalOpen(false)
      fetchData()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleDeleteMatch = async () => {
    if (!deletingMatchId) return
    try {
      const res = await fetch(`/api/matches/${deletingMatchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete match')
      toast.success('Match deleted')
      setIsDeleteMatchModalOpen(false)
      fetchData()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin text-amber-400" size={32} />
          <p className="text-slate-500 text-sm">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!stats) return <div className="min-h-dvh bg-slate-950 flex items-center justify-center text-slate-400">Error loading data</div>

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Series', value: stats.totalSeries, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Matches', value: stats.totalMatches, icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Total Bets', value: stats.totalBets, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Pending Settlements', value: stats.pendingSettlements, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ]

  const matchTypes = ['T20', 'ODI', 'Test', 'IPL', 'Domestic']

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
              <Shield className="text-amber-400" size={15} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">Admin Dashboard</h1>
              <p className="text-xs text-slate-500">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/bets" className="hidden sm:inline-flex btn-primary text-xs px-3 py-2">
              <Zap size={14} />
              <span>All Bets</span>
            </Link>
            <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-2">
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                <Icon className={color} size={18} />
              </div>
              <p className="text-2xl font-bold text-slate-100 tabular-nums">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}

          {/* P&L Card */}
          <div className={`card border ${stats.totalPnL >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
            <div className={`inline-flex p-2 rounded-lg mb-3 ${stats.totalPnL >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {stats.totalPnL >= 0
                ? <TrendingUp className="text-emerald-400" size={18} />
                : <TrendingDown className="text-red-400" size={18} />
              }
            </div>
            <p className={`text-2xl font-bold tabular-nums ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatINR(Number(stats.totalPnL), true)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Total P&L</p>
          </div>
        </div>

        {/* Series & Matches */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-300">Series & Matches</h2>
            <button
              onClick={() => setIsSeriesModalOpen(true)}
              className="btn-primary text-xs px-3 py-2"
            >
              <Plus size={14} />
              New Series
            </button>
          </div>

          <div className="divide-y divide-slate-700/40">
            {seriesData.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No series created yet</div>
            ) : (
              seriesData.map(s => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-200">{s.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(s.startDate).toLocaleDateString('en-IN')} — {new Date(s.endDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={s.status === 'active' ? 'badge-success' : 'badge-muted'}>
                        {s.status}
                      </span>
                      <button
                        onClick={() => handleEditSeries(s)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Edit series"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => { setDeletingSeriesId(s.id); setIsDeleteSeriesModalOpen(true) }}
                        className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete series"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setMatchForm(prev => ({ ...prev, seriesId: s.id }))
                          setIsMatchModalOpen(true)
                        }}
                        className="btn-secondary text-xs px-2.5 py-1.5"
                      >
                        <Plus size={12} />
                        Add Match
                      </button>
                    </div>
                  </div>

                  {s.matches.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {s.matches.map(match => (
                        <div key={match.id} className="bg-slate-700/30 border border-slate-700/50 rounded-lg px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-200">
                              {match.teamA} <span className="text-slate-500 font-normal">vs</span> {match.teamB}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleEditMatch(match, s.id)}
                                className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                                title="Edit match"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => { setDeletingMatchId(match.id); setIsDeleteMatchModalOpen(true) }}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                title="Delete match"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${
                              match.status === 'live' ? 'text-emerald-400' :
                              match.status === 'completed' ? 'text-slate-500' : 'text-amber-400'
                            }`}>
                              {match.status}
                            </span>
                            {match.matchType && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-xs text-slate-500">{match.matchType}</span>
                              </>
                            )}
                            <span className="text-slate-600">·</span>
                            <span className="text-xs text-slate-500">{match._count?.betEntries || 0} bets</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Bets */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-300">Recent Bets</h2>
            <Link href="/admin/bets" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Series</th>
                  <th>Match</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {recentBets.map(bet => (
                  <tr key={bet.id}>
                    <td className="text-slate-400">{bet.match.series.name}</td>
                    <td>{bet.match.teamA} vs {bet.match.teamB}</td>
                    <td>{bet.clientName}</td>
                    <td className="tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                    <td className={`font-semibold tabular-nums ${bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bet.profitLoss >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Series Modal */}
      <Modal isOpen={isSeriesModalOpen} onClose={() => setIsSeriesModalOpen(false)} title="Create New Series">
        <form onSubmit={handleAddSeries} className="space-y-4">
          <div>
            <label className="label">Series Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={seriesForm.name}
              onChange={(e) => setSeriesForm(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="e.g., IPL 2025"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={seriesForm.startDate}
                onChange={(e) => setSeriesForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">End Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={seriesForm.endDate}
                onChange={(e) => setSeriesForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="input"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsSeriesModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Series</button>
          </div>
        </form>
      </Modal>

      {/* Edit Series Modal */}
      <Modal isOpen={isEditSeriesModalOpen} onClose={() => setIsEditSeriesModalOpen(false)} title="Edit Series">
        <div className="space-y-4">
          <div>
            <label className="label">Series Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={editingSeries.name}
              onChange={(e) => setEditingSeries(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="e.g., IPL 2025"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={editingSeries.startDate}
                onChange={(e) => setEditingSeries(prev => ({ ...prev, startDate: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={editingSeries.endDate}
                onChange={(e) => setEditingSeries(prev => ({ ...prev, endDate: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={editingSeries.status}
              onChange={(e) => setEditingSeries(prev => ({ ...prev, status: e.target.value }))}
              className="input"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsEditSeriesModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleUpdateSeries} className="btn-primary">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Delete Series ConfirmModal */}
      <ConfirmModal
        isOpen={isDeleteSeriesModalOpen}
        onConfirm={handleDeleteSeries}
        onCancel={() => setIsDeleteSeriesModalOpen(false)}
        title="Delete Series"
        message="Are you sure you want to delete this series? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
      />

      {/* Create Match Modal */}
      <Modal isOpen={isMatchModalOpen} onClose={() => setIsMatchModalOpen(false)} title="Add New Match">
        <form onSubmit={handleAddMatch} className="space-y-4">
          <div>
            <label className="label">Series <span className="text-red-400">*</span></label>
            <select
              name="seriesId"
              value={matchForm.seriesId}
              onChange={handleMatchFormChange}
              className="input"
              required
            >
              <option value="">Select a series...</option>
              {seriesData.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Team A <span className="text-red-400">*</span></label>
              <input
                type="text"
                name="teamA"
                value={matchForm.teamA}
                onChange={handleMatchFormChange}
                className="input"
                placeholder="e.g., MI"
                required
              />
            </div>
            <div>
              <label className="label">Team B <span className="text-red-400">*</span></label>
              <input
                type="text"
                name="teamB"
                value={matchForm.teamB}
                onChange={handleMatchFormChange}
                className="input"
                placeholder="e.g., CSK"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Match Date & Time <span className="text-red-400">*</span></label>
            <input
              type="datetime-local"
              name="matchDate"
              value={matchForm.matchDate}
              onChange={handleMatchFormChange}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Venue <span className="text-red-400">*</span></label>
            <input
              type="text"
              name="venue"
              value={matchForm.venue}
              onChange={handleMatchFormChange}
              className="input"
              placeholder="e.g., Wankhede Stadium, Mumbai"
              required
            />
          </div>
          <div>
            <label className="label">Match Type</label>
            <select name="matchType" value={matchForm.matchType} onChange={handleMatchFormChange} className="input">
              {matchTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsMatchModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Match</button>
          </div>
        </form>
      </Modal>

      {/* Edit Match Modal */}
      <Modal isOpen={isEditMatchModalOpen} onClose={() => setIsEditMatchModalOpen(false)} title="Edit Match">
        <div className="space-y-4">
          <div>
            <label className="label">Series <span className="text-red-400">*</span></label>
            <select
              value={editingMatch.seriesId}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, seriesId: e.target.value }))}
              className="input"
            >
              <option value="">Select a series...</option>
              {seriesData.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Team A <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={editingMatch.teamA}
                onChange={(e) => setEditingMatch(prev => ({ ...prev, teamA: e.target.value }))}
                className="input"
                placeholder="e.g., MI"
              />
            </div>
            <div>
              <label className="label">Team B <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={editingMatch.teamB}
                onChange={(e) => setEditingMatch(prev => ({ ...prev, teamB: e.target.value }))}
                className="input"
                placeholder="e.g., CSK"
              />
            </div>
          </div>
          <div>
            <label className="label">Match Date & Time <span className="text-red-400">*</span></label>
            <input
              type="datetime-local"
              value={editingMatch.matchDate}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, matchDate: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="label">Venue <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={editingMatch.venue}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, venue: e.target.value }))}
              className="input"
              placeholder="e.g., Wankhede Stadium, Mumbai"
            />
          </div>
          <div>
            <label className="label">Match Type</label>
            <select
              value={editingMatch.matchType}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, matchType: e.target.value }))}
              className="input"
            >
              {matchTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              value={editingMatch.status}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, status: e.target.value }))}
              className="input"
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsEditMatchModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleUpdateMatch} className="btn-primary">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Delete Match ConfirmModal */}
      <ConfirmModal
        isOpen={isDeleteMatchModalOpen}
        onConfirm={handleDeleteMatch}
        onCancel={() => setIsDeleteMatchModalOpen(false)}
        title="Delete Match"
        message="Are you sure you want to delete this match? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
      />

      <BottomNav role="ADMIN" />
    </div>
  )
}
