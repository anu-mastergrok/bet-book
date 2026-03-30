'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

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
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    status?: string
    liveScore?: string
    result?: string
    series: { name: string }
  }
}

export default function FriendBetsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [disputeModal, setDisputeModal] = useState<{ betId: string } | null>(null)
  const [disputeNote, setDisputeNote] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadBets = useCallback(async () => {
    if (!accessToken) return
    const token = accessToken
    try {
      const r = await fetch('/api/bets', { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const data = await r.json()
      setBets(data.bets ?? [])
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadBets()
  }, [loadBets])

  const handleConfirm = async (betId: string) => {
    if (!accessToken) return
    const token = accessToken
    setActionLoading(betId)
    try {
      const res = await fetch(`/api/bets/${betId}/confirm`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Settlement confirmed')
      loadBets()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDispute = async () => {
    if (!accessToken) return
    if (!disputeModal) return
    const token = accessToken
    setActionLoading(disputeModal.betId)
    try {
      const res = await fetch(`/api/bets/${disputeModal.betId}/dispute`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: disputeNote }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Dispute raised')
      setDisputeModal(null)
      setDisputeNote('')
      loadBets()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )

  return (
    <div className="space-y-4">
      <ToastContainer />
      <h1 className="text-xl font-bold text-base-content">My Bets</h1>

      {bets.map(bet => (
        <div key={bet.id} className="card bg-base-200 shadow-sm">
          <div className="card-body space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-base-content">
                  {bet.match.teamA} vs {bet.match.teamB}
                  {bet.match.status === 'live' && (
                    <span className="inline-flex items-center gap-1 ml-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                    </span>
                  )}
                </p>
                <p className="text-xs text-base-content/60">{bet.match.series.name} · {bet.match.matchType} · {new Date(bet.match.matchDate).toLocaleDateString('en-IN')}</p>
                {bet.match.status === 'completed' && bet.match.result && (
                  <p className="text-xs text-base-content/40 truncate">{bet.match.result}</p>
                )}
              </div>
              <span className={`badge ${
                bet.result === 'win' ? 'badge-success'
                : bet.result === 'loss' ? 'badge-error'
                : 'badge-warning'
              }`}>{bet.result}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">Bet: {formatINR(bet.betAmount)} · Odds {bet.odds}× · {bet.betType}</span>
              <span className={bet.profitLoss >= 0 ? 'text-success font-semibold' : 'text-error font-semibold'}>
                {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-base-content/40 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</span>
              <div className="flex gap-2">
                {bet.disputeStatus === 'open' && (
                  <span className="badge badge-error badge-sm">Disputed</span>
                )}
                {bet.confirmedByFriend && (
                  <span className="badge badge-success badge-sm">Confirmed</span>
                )}
                {!bet.confirmedByFriend && bet.settlementStatus !== 'pending' && bet.disputeStatus !== 'open' && (
                  <button
                    onClick={() => handleConfirm(bet.id)}
                    disabled={actionLoading === bet.id}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircle2 size={12} />
                    Confirm
                  </button>
                )}
                {!bet.disputeStatus && (
                  <button
                    onClick={() => setDisputeModal({ betId: bet.id })}
                    className="btn btn-error btn-sm"
                  >
                    <AlertTriangle size={12} />
                    Dispute
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {bets.length === 0 && <div className="text-center text-base-content/40 py-20">No bets yet.</div>}

      {/* Dispute modal */}
      {disputeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-200 shadow-sm w-full max-w-md">
            <div className="card-body space-y-4">
              <h2 className="text-base-content font-semibold text-lg">Raise a Dispute</h2>
              <label htmlFor="dispute-note" className="label">
                <span className="label-text">Dispute Reason</span>
              </label>
              <textarea
                id="dispute-note"
                value={disputeNote}
                onChange={e => setDisputeNote(e.target.value)}
                placeholder="Describe why you're disputing this bet..."
                className="textarea textarea-bordered w-full text-sm resize-none h-24"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setDisputeModal(null); setDisputeNote('') }}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispute}
                  disabled={!disputeNote.trim() || actionLoading === disputeModal.betId}
                  className="btn btn-error btn-sm"
                >
                  Raise Dispute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
