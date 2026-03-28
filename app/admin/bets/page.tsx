'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal, ConfirmModal } from '@/components/Modal'
import { LogOut, ArrowLeft, Edit2, Trash2, Loader, Link as LinkIcon, SlidersHorizontal, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { formatINR } from '@/lib/format'
import { buildBetSlipMessage, openWhatsApp } from '@/lib/whatsapp'
import { BottomNav } from '@/components/BottomNav'

interface Bet {
  id: string
  matchId: string
  clientName: string
  clientUserId?: string
  betOnTeam: string
  betAmount: number
  odds: number
  betType?: string
  result: string
  profitLoss: number
  settlementStatus: string
  linkedMatchId?: string
  notes?: string
  paymentMethod?: string | null
  upiTransactionId?: string | null
  paymentNote?: string | null
  match: {
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate: string
    series: { id: string; name: string }
  }
  user: { id: string; name: string; phone: string }
  linkedMatch?: { id: string; teamA: string; teamB: string }
}

interface Match {
  id: string
  teamA: string
  teamB: string
  status: string
  matchDate: string
}

export default function AdminBetsPage() {
  const router = useRouter()
  const { user, logout, accessToken } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([])
  const [filteredBets, setFilteredBets] = useState<Bet[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null)

  const [filters, setFilters] = useState({ settlementStatus: '', result: '' })
  const [editForm, setEditForm] = useState({ result: 'pending', settlementStatus: 'pending', linkedMatchId: '', paymentMethod: '', upiTransactionId: '', paymentNote: '' })

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') { router.push('/login'); return }
    fetchData()
  }, [user, router])

  useEffect(() => { applyFilters() }, [filters, bets])

  const fetchData = async () => {
    try {
      const [betsRes, matchesRes] = await Promise.all([
        fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/matches', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      if (!betsRes.ok || !matchesRes.ok) throw new Error('Failed to fetch data')
      const betsData = await betsRes.json()
      const matchesData = await matchesRes.json()
      setBets(betsData.bets)
      setAllMatches(matchesData.matches)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = bets
    if (filters.settlementStatus) filtered = filtered.filter(b => b.settlementStatus === filters.settlementStatus)
    if (filters.result) filtered = filtered.filter(b => b.result === filters.result)
    setFilteredBets(filtered)
  }

  const handleEditBet = (bet: Bet) => {
    setSelectedBet(bet)
    setEditForm({ result: bet.result, settlementStatus: bet.settlementStatus, linkedMatchId: bet.linkedMatchId || '', paymentMethod: bet.paymentMethod || '', upiTransactionId: bet.upiTransactionId || '', paymentNote: bet.paymentNote || '' })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedBet) return
    try {
      const settlementRes = await fetch(`/api/bets/${selectedBet.id}/settlement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ settlementStatus: editForm.settlementStatus, linkedMatchId: editForm.linkedMatchId || null, paymentMethod: editForm.paymentMethod || null, upiTransactionId: editForm.upiTransactionId || null, paymentNote: editForm.paymentNote || null }),
      })
      if (!settlementRes.ok) throw new Error('Failed to update settlement')

      if (editForm.result !== selectedBet.result) {
        const updateRes = await fetch(`/api/bets/${selectedBet.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ result: editForm.result }),
        })
        if (!updateRes.ok) throw new Error('Failed to update bet')
      }

      toast.success('Bet updated successfully')
      setIsEditModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update bet')
    }
  }

  const handleDeleteBet = async () => {
    if (!selectedBet) return
    try {
      const response = await fetch(`/api/bets/${selectedBet.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) throw new Error('Failed to delete bet')
      toast.success('Bet deleted successfully')
      setIsDeleteModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete bet')
    }
  }

  const handleLogout = () => { logout(); router.push('/login') }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <Loader className="animate-spin text-amber-400" size={32} />
      </div>
    )
  }

  const hasFilters = filters.settlementStatus || filters.result

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
              aria-label="Back to admin"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-100">All Bets</h1>
              <p className="text-xs text-slate-500">Manage and track all betting records</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-2">
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Filters */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300">Filters</h2>
            {hasFilters && (
              <button
                onClick={() => setFilters({ settlementStatus: '', result: '' })}
                className="ml-auto text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Settlement Status</label>
              <select
                value={filters.settlementStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, settlementStatus: e.target.value }))}
                className="input"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="collected">Collected</option>
                <option value="settled">Settled</option>
                <option value="lost_in_another_match">Lost in Another Match</option>
              </select>
            </div>
            <div>
              <label className="label">Result</label>
              <select
                value={filters.result}
                onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
                className="input"
              >
                <option value="">All results</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-300">Bets</h2>
            <span className="text-xs text-slate-500">
              {filteredBets.length} of {bets.length} records
            </span>
          </div>
          <div className="overflow-x-auto">
            {filteredBets.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Bookmaker</th>
                    <th>Series</th>
                    <th>Match</th>
                    <th>Client</th>
                    <th>Amount</th>
                    <th>Odds</th>
                    <th>Result</th>
                    <th>P&L</th>
                    <th>Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBets.map(bet => (
                    <tr key={bet.id}>
                      <td>
                        <div className="font-medium text-slate-200">{bet.user.name}</div>
                        <div className="text-xs text-slate-500">{bet.user.phone}</div>
                      </td>
                      <td className="text-slate-400">{bet.match.series.name}</td>
                      <td>
                        <div className="font-medium">{bet.match.teamA} vs {bet.match.teamB}</div>
                        <div className="text-xs text-slate-500 capitalize">{bet.match.status}</div>
                      </td>
                      <td>{bet.clientName}</td>
                      <td className="tabular-nums font-medium">{formatINR(Number(bet.betAmount))}</td>
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
                        <div className="space-y-1">
                          <span className={
                            bet.settlementStatus === 'settled' ? 'badge-success' :
                            bet.settlementStatus === 'collected' ? 'badge-info' :
                            bet.settlementStatus === 'lost_in_another_match' ? 'badge-danger' :
                            'badge-warning'
                          }>
                            {bet.settlementStatus.replace(/_/g, ' ')}
                          </span>
                          {bet.linkedMatchId && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <LinkIcon size={10} />
                              Linked
                            </div>
                          )}
                          {bet.paymentMethod && bet.paymentMethod !== 'pending' && (
                            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                              bet.paymentMethod === 'upi'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-slate-600/50 text-slate-400'
                            }`}>
                              {bet.paymentMethod === 'upi' ? 'UPI ✓' : 'Cash'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditBet(bet)}
                            className="p-1.5 rounded-lg hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 transition-colors"
                            aria-label="Edit bet"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => { setSelectedBet(bet); setIsDeleteModalOpen(true) }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                            aria-label="Delete bet"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const msg = buildBetSlipMessage({
                                clientName: bet.clientName,
                                betOnTeam: bet.betOnTeam,
                                betAmount: Number(bet.betAmount),
                                odds: Number(bet.odds),
                                betType: bet.betType || 'match_winner',
                                result: bet.result,
                                profitLoss: Number(bet.profitLoss),
                                settlementStatus: bet.settlementStatus,
                                paymentMethod: bet.paymentMethod,
                                match: {
                                  teamA: bet.match.teamA,
                                  teamB: bet.match.teamB,
                                  matchDate: bet.match.matchDate,
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-slate-500 text-sm">
                {hasFilters ? 'No bets match the selected filters' : 'No bets found'}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Bet">
        <div className="space-y-4">
          {selectedBet && (
            <div className="bg-slate-700/30 rounded-lg px-4 py-3 text-sm text-slate-400">
              <span className="font-medium text-slate-300">{selectedBet.clientName}</span>
              {' — '}{selectedBet.match.teamA} vs {selectedBet.match.teamB}
            </div>
          )}
          <div>
            <label className="label">Result</label>
            <select
              value={editForm.result}
              onChange={(e) => setEditForm(prev => ({ ...prev, result: e.target.value }))}
              className="input"
            >
              <option value="pending">Pending</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>
          </div>
          <div>
            <label className="label">Settlement Status</label>
            <select
              value={editForm.settlementStatus}
              onChange={(e) => setEditForm(prev => ({ ...prev, settlementStatus: e.target.value }))}
              className="input"
            >
              <option value="pending">Pending</option>
              <option value="collected">Collected</option>
              <option value="settled">Settled</option>
              <option value="lost_in_another_match">Lost in Another Match</option>
            </select>
          </div>
          {editForm.settlementStatus === 'lost_in_another_match' && (
            <div>
              <label className="label">Link to Match</label>
              <select
                value={editForm.linkedMatchId}
                onChange={(e) => setEditForm(prev => ({ ...prev, linkedMatchId: e.target.value }))}
                className="input"
              >
                <option value="">Select a match...</option>
                {allMatches.map(match => (
                  <option key={match.id} value={match.id}>
                    {match.teamA} vs {match.teamB}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(editForm.settlementStatus === 'collected' || editForm.settlementStatus === 'settled') && (
            <div className="space-y-3 pt-2 border-t border-slate-700/60">
              <p className="text-xs font-medium text-slate-400">Payment Details</p>

              {/* Payment Method */}
              <div>
                <label className="label">Payment Method</label>
                <div className="flex gap-2">
                  {['upi', 'cash', 'pending'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, paymentMethod: m }))}
                      className={`flex-1 py-1.5 text-xs rounded-md border font-medium capitalize transition-colors ${
                        editForm.paymentMethod === m
                          ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI Transaction ID — only if UPI selected */}
              {editForm.paymentMethod === 'upi' && (
                <div>
                  <label className="label">UPI Transaction ID</label>
                  <input
                    type="text"
                    placeholder="T2506271234567"
                    value={editForm.upiTransactionId}
                    onChange={e => setEditForm(prev => ({ ...prev, upiTransactionId: e.target.value }))}
                    className="input"
                  />
                  <p className="text-xs text-slate-500 mt-1">Find this in your UPI app&apos;s transaction history</p>
                </div>
              )}

              {/* Payment Note */}
              <div>
                <label className="label">Payment Note <span className="text-slate-500 font-normal">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Paid via PhonePe"
                  value={editForm.paymentNote}
                  onChange={e => setEditForm(prev => ({ ...prev, paymentNote: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveEdit} className="btn-primary">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onConfirm={handleDeleteBet}
        onCancel={() => setIsDeleteModalOpen(false)}
        title="Delete Bet"
        message="Are you sure you want to delete this bet? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
      />

      <BottomNav role="ADMIN" />
    </div>
  )
}
