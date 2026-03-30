'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal, ConfirmModal } from '@/components/Modal'
import { useTheme } from '@/components/ThemeProvider'
import {
  LogOut, Plus, TrendingUp, TrendingDown, Users, Zap,
  BarChart3, Calendar, Clock, Shield, Edit2, Trash2, RefreshCw, Sun, Moon,
} from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'
import { BottomNav } from '@/components/BottomNav'

interface ImportedMatch {
  id: string
  teamA: string
  teamB: string
  matchDate: string
  venue: string
  matchType: string
  series: { id: string; name: string }
}

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
    liveScore?: string
    result?: string
    isActivated?: boolean
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
  const { theme, toggle } = useTheme()
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
  const [importedMatches, setImportedMatches] = useState<ImportedMatch[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { router.push('/login'); return }
    if (!accessToken) return
    fetchData()
  }, [user, router, accessToken])

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

      const matchesRes = await fetch('/api/matches?activated=false', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (matchesRes.ok) {
        const { matches } = await matchesRes.json()
        setImportedMatches(matches)
      } else {
        toast.error('Failed to load imported matches')
      }
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

  const handleSyncNow = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/cricket/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Sync failed')
      toast.success('Sync completed')
      fetchData()
    } catch {
      toast.error('Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleActivateMatch = async (matchId: string) => {
    setActivatingId(matchId)
    try {
      const res = await fetch(`/api/matches/${matchId}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to activate')
      toast.success('Match activated')
      setImportedMatches(prev => prev.filter(m => m.id !== matchId))
    } catch {
      toast.error('Failed to activate match')
    } finally {
      setActivatingId(null)
    }
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-base-100">
        <div className="flex flex-col items-center gap-3">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/40 text-sm">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!stats) return <div className="min-h-dvh bg-base-100 flex items-center justify-center text-base-content/60">Error loading data</div>

  const matchTypes = ['T20', 'ODI', 'Test', 'IPL', 'Domestic']

  return (
    <div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="text-primary" size={15} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-base-content">Admin Dashboard <span className="badge badge-warning badge-sm align-middle ml-1">ADMIN</span></h1>
              <p className="text-xs text-base-content/40">Welcome, {user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/bets" className="hidden sm:inline-flex btn btn-primary btn-sm gap-1">
              <Zap size={14} />
              <span>All Bets</span>
            </Link>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="btn btn-neutral btn-sm gap-1"
            >
              {isSyncing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />}
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button onClick={toggle} className="btn btn-ghost btn-sm btn-circle" aria-label="Toggle theme">
              {theme === 'night' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-1">
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Stats */}
        <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-200 w-full">
          <div className="stat">
            <div className="stat-figure text-secondary">
              <Users size={24} className="text-base-content/60" />
            </div>
            <div className="stat-title">Total Users</div>
            <div className="stat-value">{stats.totalUsers}</div>
          </div>
          <div className="stat">
            <div className="stat-figure">
              <BarChart3 size={24} className="text-base-content/60" />
            </div>
            <div className="stat-title">Series</div>
            <div className="stat-value">{stats.totalSeries}</div>
          </div>
          <div className="stat">
            <div className="stat-figure">
              <Calendar size={24} className="text-base-content/60" />
            </div>
            <div className="stat-title">Matches</div>
            <div className="stat-value">{stats.totalMatches}</div>
          </div>
          <div className="stat">
            <div className="stat-figure">
              <Zap size={24} className="text-base-content/60" />
            </div>
            <div className="stat-title">Total Bets</div>
            <div className="stat-value">{stats.totalBets}</div>
          </div>
          <div className="stat">
            <div className="stat-figure">
              <Clock size={24} className="text-base-content/60" />
            </div>
            <div className="stat-title">Pending Settlements</div>
            <div className="stat-value">{stats.pendingSettlements}</div>
          </div>
          <div className="stat">
            <div className="stat-figure">
              {stats.totalPnL >= 0
                ? <TrendingUp size={24} className="text-success" />
                : <TrendingDown size={24} className="text-error" />
              }
            </div>
            <div className="stat-title">Total P&L</div>
            <div className={`stat-value text-2xl ${stats.totalPnL >= 0 ? 'text-success' : 'text-error'}`}>
              {formatINR(Number(stats.totalPnL), true)}
            </div>
          </div>
        </div>

        {/* Series & Matches */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-0">
            <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-base-content/80">Series &amp; Matches</h2>
              <button
                onClick={() => setIsSeriesModalOpen(true)}
                className="btn btn-primary btn-sm gap-1"
              >
                <Plus size={14} />
                New Series
              </button>
            </div>

            <div className="divide-y divide-base-300">
              {seriesData.length === 0 ? (
                <div className="py-12 text-center text-base-content/40 text-sm">No series created yet</div>
              ) : (
                seriesData.map(s => (
                  <div key={s.id} className="px-6 py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-base-content">{s.name}</h3>
                        <p className="text-xs text-base-content/40 mt-0.5">
                          {new Date(s.startDate).toLocaleDateString('en-IN')} — {new Date(s.endDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={s.status === 'active' ? 'badge badge-success' : 'badge badge-ghost'}>
                          {s.status}
                        </span>
                        <button
                          onClick={() => handleEditSeries(s)}
                          className="btn btn-ghost btn-xs"
                          title="Edit series"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => { setDeletingSeriesId(s.id); setIsDeleteSeriesModalOpen(true) }}
                          className="btn btn-error btn-xs"
                          title="Delete series"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setMatchForm(prev => ({ ...prev, seriesId: s.id }))
                            setIsMatchModalOpen(true)
                          }}
                          className="btn btn-neutral btn-sm gap-1"
                        >
                          <Plus size={12} />
                          Add Match
                        </button>
                      </div>
                    </div>

                    {s.matches.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {s.matches.map(match => (
                          <div key={match.id} className="card bg-base-300 shadow-sm">
                            <div className="card-body p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-base-content">
                                  {match.teamA} <span className="text-base-content/40 font-normal">vs</span> {match.teamB}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditMatch(match, s.id)}
                                    className="btn btn-ghost btn-xs"
                                    title="Edit match"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => { setDeletingMatchId(match.id); setIsDeleteMatchModalOpen(true) }}
                                    className="btn btn-error btn-xs"
                                    title="Delete match"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {match.status === 'live' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                    </span>
                                    <span className="text-success text-xs font-medium">LIVE</span>
                                  </span>
                                ) : (
                                  <span className={`text-xs ${
                                    match.status === 'completed' ? 'text-base-content/40' : 'text-primary'
                                  }`}>
                                    {match.status}
                                  </span>
                                )}
                                {match.matchType && (
                                  <>
                                    <span className="text-base-content/20">·</span>
                                    <span className="text-xs text-base-content/40">{match.matchType}</span>
                                  </>
                                )}
                                <span className="text-base-content/20">·</span>
                                <span className="text-xs text-base-content/40">{match._count?.betEntries || 0} bets</span>
                              </div>
                              {match.liveScore && match.status === 'live' && (
                                <div className="text-xs text-success mt-1 truncate">{match.liveScore}</div>
                              )}
                              {match.result && match.status === 'completed' && (
                                <div className="text-xs text-base-content/60 mt-1 truncate">{match.result}</div>
                              )}
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
        </div>

        {/* Imported Matches */}
        {importedMatches.length > 0 && (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body p-0">
              <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-base-content/80">Imported Matches</h2>
                <span className="text-xs text-base-content/40">{importedMatches.length} pending activation</span>
              </div>
              <div className="divide-y divide-base-300">
                {importedMatches.map(match => (
                  <div key={match.id} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-base-content truncate">
                        {match.teamA} vs {match.teamB}
                      </div>
                      <div className="text-xs text-base-content/40 mt-0.5">
                        {match.series.name} · {match.matchType} · {new Date(match.matchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {match.venue && ` · ${match.venue}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleActivateMatch(match.id)}
                      disabled={activatingId === match.id}
                      className="btn btn-success btn-xs shrink-0"
                    >
                      {activatingId === match.id ? <span className="loading loading-spinner loading-xs" /> : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Bets */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-0">
            <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-base-content/80">Recent Bets</h2>
              <Link href="/admin/bets" className="text-xs text-primary hover:text-primary/80 transition-colors">
                View all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Match</th>
                    <th>Client</th>
                    <th>Amount</th>
                    <th>P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBets.map(bet => (
                    <tr key={bet.id}>
                      <td className="text-base-content/60">{bet.match.series.name}</td>
                      <td>{bet.match.teamA} vs {bet.match.teamB}</td>
                      <td>{bet.clientName}</td>
                      <td className="tabular-nums">{formatINR(Number(bet.betAmount))}</td>
                      <td className={`font-semibold tabular-nums ${bet.profitLoss >= 0 ? 'text-success' : 'text-error'}`}>
                        {bet.profitLoss >= 0 ? '+' : ''}{formatINR(Number(bet.profitLoss))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Create Series Modal */}
      <Modal isOpen={isSeriesModalOpen} onClose={() => setIsSeriesModalOpen(false)} title="Create New Series">
        <form onSubmit={handleAddSeries} className="space-y-4">
          <div>
            <label htmlFor="series-name" className="label"><span className="label-text">Series Name <span className="text-error">*</span></span></label>
            <input
              id="series-name"
              type="text"
              value={seriesForm.name}
              onChange={(e) => setSeriesForm(prev => ({ ...prev, name: e.target.value }))}
              className="input input-bordered w-full"
              placeholder="e.g., IPL 2025"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="series-start-date" className="label"><span className="label-text">Start Date <span className="text-error">*</span></span></label>
              <input
                id="series-start-date"
                type="date"
                value={seriesForm.startDate}
                onChange={(e) => setSeriesForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="input input-bordered w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="series-end-date" className="label"><span className="label-text">End Date <span className="text-error">*</span></span></label>
              <input
                id="series-end-date"
                type="date"
                value={seriesForm.endDate}
                onChange={(e) => setSeriesForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="input input-bordered w-full"
                required
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsSeriesModalOpen(false)} className="btn btn-neutral">Cancel</button>
            <button type="submit" className="btn btn-primary">Create Series</button>
          </div>
        </form>
      </Modal>

      {/* Edit Series Modal */}
      <Modal isOpen={isEditSeriesModalOpen} onClose={() => setIsEditSeriesModalOpen(false)} title="Edit Series">
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-series-name" className="label"><span className="label-text">Series Name <span className="text-error">*</span></span></label>
            <input
              id="edit-series-name"
              type="text"
              value={editingSeries.name}
              onChange={(e) => setEditingSeries(prev => ({ ...prev, name: e.target.value }))}
              className="input input-bordered w-full"
              placeholder="e.g., IPL 2025"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-series-start" className="label"><span className="label-text">Start Date <span className="text-error">*</span></span></label>
              <input
                id="edit-series-start"
                type="date"
                value={editingSeries.startDate}
                onChange={(e) => setEditingSeries(prev => ({ ...prev, startDate: e.target.value }))}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label htmlFor="edit-series-end" className="label"><span className="label-text">End Date <span className="text-error">*</span></span></label>
              <input
                id="edit-series-end"
                type="date"
                value={editingSeries.endDate}
                onChange={(e) => setEditingSeries(prev => ({ ...prev, endDate: e.target.value }))}
                className="input input-bordered w-full"
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-series-status" className="label"><span className="label-text">Status</span></label>
            <select
              id="edit-series-status"
              value={editingSeries.status}
              onChange={(e) => setEditingSeries(prev => ({ ...prev, status: e.target.value }))}
              className="select select-bordered w-full"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsEditSeriesModalOpen(false)} className="btn btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdateSeries} className="btn btn-primary">Save Changes</button>
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
            <label htmlFor="match-series" className="label"><span className="label-text">Series <span className="text-error">*</span></span></label>
            <select
              id="match-series"
              name="seriesId"
              value={matchForm.seriesId}
              onChange={handleMatchFormChange}
              className="select select-bordered w-full"
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
              <label htmlFor="match-team-a" className="label"><span className="label-text">Team A <span className="text-error">*</span></span></label>
              <input
                id="match-team-a"
                type="text"
                name="teamA"
                value={matchForm.teamA}
                onChange={handleMatchFormChange}
                className="input input-bordered w-full"
                placeholder="e.g., MI"
                required
              />
            </div>
            <div>
              <label htmlFor="match-team-b" className="label"><span className="label-text">Team B <span className="text-error">*</span></span></label>
              <input
                id="match-team-b"
                type="text"
                name="teamB"
                value={matchForm.teamB}
                onChange={handleMatchFormChange}
                className="input input-bordered w-full"
                placeholder="e.g., CSK"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="match-date" className="label"><span className="label-text">Match Date &amp; Time <span className="text-error">*</span></span></label>
            <input
              id="match-date"
              type="datetime-local"
              name="matchDate"
              value={matchForm.matchDate}
              onChange={handleMatchFormChange}
              className="input input-bordered w-full"
              required
            />
          </div>
          <div>
            <label htmlFor="match-venue" className="label"><span className="label-text">Venue <span className="text-error">*</span></span></label>
            <input
              id="match-venue"
              type="text"
              name="venue"
              value={matchForm.venue}
              onChange={handleMatchFormChange}
              className="input input-bordered w-full"
              placeholder="e.g., Wankhede Stadium, Mumbai"
              required
            />
          </div>
          <div>
            <label htmlFor="match-type" className="label"><span className="label-text">Match Type</span></label>
            <select id="match-type" name="matchType" value={matchForm.matchType} onChange={handleMatchFormChange} className="select select-bordered w-full">
              {matchTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsMatchModalOpen(false)} className="btn btn-neutral">Cancel</button>
            <button type="submit" className="btn btn-primary">Create Match</button>
          </div>
        </form>
      </Modal>

      {/* Edit Match Modal */}
      <Modal isOpen={isEditMatchModalOpen} onClose={() => setIsEditMatchModalOpen(false)} title="Edit Match">
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-match-series" className="label"><span className="label-text">Series <span className="text-error">*</span></span></label>
            <select
              id="edit-match-series"
              value={editingMatch.seriesId}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, seriesId: e.target.value }))}
              className="select select-bordered w-full"
            >
              <option value="">Select a series...</option>
              {seriesData.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-match-team-a" className="label"><span className="label-text">Team A <span className="text-error">*</span></span></label>
              <input
                id="edit-match-team-a"
                type="text"
                value={editingMatch.teamA}
                onChange={(e) => setEditingMatch(prev => ({ ...prev, teamA: e.target.value }))}
                className="input input-bordered w-full"
                placeholder="e.g., MI"
              />
            </div>
            <div>
              <label htmlFor="edit-match-team-b" className="label"><span className="label-text">Team B <span className="text-error">*</span></span></label>
              <input
                id="edit-match-team-b"
                type="text"
                value={editingMatch.teamB}
                onChange={(e) => setEditingMatch(prev => ({ ...prev, teamB: e.target.value }))}
                className="input input-bordered w-full"
                placeholder="e.g., CSK"
              />
            </div>
          </div>
          <div>
            <label htmlFor="edit-match-date" className="label"><span className="label-text">Match Date &amp; Time <span className="text-error">*</span></span></label>
            <input
              id="edit-match-date"
              type="datetime-local"
              value={editingMatch.matchDate}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, matchDate: e.target.value }))}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label htmlFor="edit-match-venue" className="label"><span className="label-text">Venue <span className="text-error">*</span></span></label>
            <input
              id="edit-match-venue"
              type="text"
              value={editingMatch.venue}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, venue: e.target.value }))}
              className="input input-bordered w-full"
              placeholder="e.g., Wankhede Stadium, Mumbai"
            />
          </div>
          <div>
            <label htmlFor="edit-match-type" className="label"><span className="label-text">Match Type</span></label>
            <select
              id="edit-match-type"
              value={editingMatch.matchType}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, matchType: e.target.value }))}
              className="select select-bordered w-full"
            >
              {matchTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-match-status" className="label"><span className="label-text">Status</span></label>
            <select
              id="edit-match-status"
              value={editingMatch.status}
              onChange={(e) => setEditingMatch(prev => ({ ...prev, status: e.target.value }))}
              className="select select-bordered w-full"
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setIsEditMatchModalOpen(false)} className="btn btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdateMatch} className="btn btn-primary">Save Changes</button>
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
