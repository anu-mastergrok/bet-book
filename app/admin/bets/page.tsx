'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal, ConfirmModal } from '@/components/Modal'
import { LogOut, ArrowLeft, Edit2, Trash2, Link as LinkIcon, SlidersHorizontal, MessageCircle } from 'lucide-react'
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
    if (!accessToken) return
    fetchData()
  }, [user, router, accessToken])

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
      <div className="flex items-center justify-center min-h-dvh bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const hasFilters = filters.settlementStatus || filters.result

  return (
    <div className="min-h-dvh bg-base-100 pb-20 sm:pb-0">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-base-200/80 backdrop-blur-md border-b border-base-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Back to admin"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-base-content">All Bets</h1>
              <p className="text-xs text-base-content/40">Manage and track all betting records</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm gap-1">
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Breadcrumb */}
        <div className="breadcrumbs text-sm mb-4">
          <ul>
            <li><Link href="/admin">Admin</Link></li>
            <li>All Bets</li>
          </ul>
        </div>

        {/* Filters */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={15} className="text-base-content/60" />
              <h2 className="text-sm font-semibold text-base-content/80">Filters</h2>
              {hasFilters && (
                <button
                  onClick={() => setFilters({ settlementStatus: '', result: '' })}
                  className="ml-auto btn btn-neutral btn-sm gap-1"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="filter-settlement" className="label"><span className="label-text">Settlement Status</span></label>
                <select
                  id="filter-settlement"
                  value={filters.settlementStatus}
                  onChange={(e) => setFilters(prev => ({ ...prev, settlementStatus: e.target.value }))}
                  className="select select-bordered w-full"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="collected">Collected</option>
                  <option value="settled">Settled</option>
                  <option value="lost_in_another_match">Lost in Another Match</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-result" className="label"><span className="label-text">Result</span></label>
                <select
                  id="filter-result"
                  value={filters.result}
                  onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
                  className="select select-bordered w-full"
                >
                  <option value="">All results</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-0">
            <div className="px-6 py-4 border-b border-base-300 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-base-content/80">Bets</h2>
              <span className="text-xs text-base-content/40">
                {filteredBets.length} of {bets.length} records
              </span>
            </div>
            <div className="overflow-x-auto">
              {filteredBets.length > 0 ? (
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Bookmaker</th>
                      <th>Series</th>
                      <th>Match</th>
                      <th>Client</th>
                      <th>Amount</th>
                      <th>Odds</th>
                      <th>Result</th>
                      <th>P&amp;L</th>
                      <th>Settlement</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBets.map(bet => (
                      <tr key={bet.id}>
                        <td>
                          <div className="font-medium text-base-content">{bet.user.name}</div>
                          <div className="text-xs text-base-content/40">{bet.user.phone}</div>
                        </td>
                        <td className="text-base-content/60">{bet.match.series.name}</td>
                        <td>
                          <div className="font-medium">{bet.match.teamA} vs {bet.match.teamB}</div>
                          <div className="text-xs text-base-content/40 capitalize">{bet.match.status}</div>
                        </td>
                        <td>{bet.clientName}</td>
                        <td className="tabular-nums font-medium">{formatINR(Number(bet.betAmount))}</td>
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
                          <div className="space-y-1">
                            <span className={
                              bet.settlementStatus === 'settled' ? 'badge badge-success' :
                              bet.settlementStatus === 'collected' ? 'badge badge-info' :
                              bet.settlementStatus === 'lost_in_another_match' ? 'badge badge-error' :
                              'badge badge-warning'
                            }>
                              {bet.settlementStatus.replace(/_/g, ' ')}
                            </span>
                            {bet.linkedMatchId && (
                              <div className="flex items-center gap-1 text-xs text-base-content/40">
                                <LinkIcon size={10} />
                                Linked
                              </div>
                            )}
                            {bet.paymentMethod && bet.paymentMethod !== 'pending' && (
                              <span className={bet.paymentMethod === 'upi' ? 'badge badge-success badge-sm' : 'badge badge-ghost badge-sm'}>
                                {bet.paymentMethod === 'upi' ? 'UPI ✓' : 'Cash'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditBet(bet)}
                              className="btn btn-ghost btn-xs"
                              aria-label="Edit bet"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => { setSelectedBet(bet); setIsDeleteModalOpen(true) }}
                              className="btn btn-error btn-xs"
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
                              className="btn btn-ghost btn-xs"
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
                <div className="py-16 text-center text-base-content/40 text-sm">
                  {hasFilters ? 'No bets match the selected filters' : 'No bets found'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Bet">
        <div className="space-y-4">
          {selectedBet && (
            <div className="bg-base-300 rounded-lg px-4 py-3 text-sm text-base-content/60">
              <span className="font-medium text-base-content/80">{selectedBet.clientName}</span>
              {' — '}{selectedBet.match.teamA} vs {selectedBet.match.teamB}
            </div>
          )}
          <div>
            <label htmlFor="edit-result" className="label"><span className="label-text">Result</span></label>
            <select
              id="edit-result"
              value={editForm.result}
              onChange={(e) => setEditForm(prev => ({ ...prev, result: e.target.value }))}
              className="select select-bordered w-full"
            >
              <option value="pending">Pending</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-settlement" className="label"><span className="label-text">Settlement Status</span></label>
            <select
              id="edit-settlement"
              value={editForm.settlementStatus}
              onChange={(e) => setEditForm(prev => ({ ...prev, settlementStatus: e.target.value }))}
              className="select select-bordered w-full"
            >
              <option value="pending">Pending</option>
              <option value="collected">Collected</option>
              <option value="settled">Settled</option>
              <option value="lost_in_another_match">Lost in Another Match</option>
            </select>
          </div>
          {editForm.settlementStatus === 'lost_in_another_match' && (
            <div>
              <label htmlFor="edit-linked-match" className="label"><span className="label-text">Link to Match</span></label>
              <select
                id="edit-linked-match"
                value={editForm.linkedMatchId}
                onChange={(e) => setEditForm(prev => ({ ...prev, linkedMatchId: e.target.value }))}
                className="select select-bordered w-full"
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
            <div className="space-y-3 pt-2 border-t border-base-300">
              <p className="text-xs font-medium text-base-content/60">Payment Details</p>

              {/* Payment Method */}
              <div role="group" aria-labelledby="payment-method-label">
                <div className="label">
                  <span id="payment-method-label" className="label-text">Payment Method</span>
                </div>
                <div className="flex gap-2">
                  {['upi', 'cash', 'pending'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, paymentMethod: m }))}
                      className={`flex-1 py-1.5 text-xs rounded-md border font-medium capitalize transition-colors ${
                        editForm.paymentMethod === m
                          ? 'border-primary text-primary bg-primary/10'
                          : 'border-base-300 text-base-content/60 hover:border-base-content/40'
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
                  <label htmlFor="edit-upi-txn" className="label"><span className="label-text">UPI Transaction ID</span></label>
                  <input
                    id="edit-upi-txn"
                    type="text"
                    placeholder="T2506271234567"
                    value={editForm.upiTransactionId}
                    onChange={e => setEditForm(prev => ({ ...prev, upiTransactionId: e.target.value }))}
                    className="input input-bordered w-full"
                  />
                  <p className="text-xs text-base-content/40 mt-1">Find this in your UPI app&apos;s transaction history</p>
                </div>
              )}

              {/* Payment Note */}
              <div>
                <label htmlFor="edit-payment-note" className="label"><span className="label-text">Payment Note <span className="text-base-content/40 font-normal">(optional)</span></span></label>
                <input
                  id="edit-payment-note"
                  type="text"
                  placeholder="e.g. Paid via PhonePe"
                  value={editForm.paymentNote}
                  onChange={e => setEditForm(prev => ({ ...prev, paymentNote: e.target.value }))}
                  className="input input-bordered w-full"
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setIsEditModalOpen(false)} className="btn btn-neutral">Cancel</button>
            <button onClick={handleSaveEdit} className="btn btn-primary">Save Changes</button>
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
