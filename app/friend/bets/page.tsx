'use client'

import { useEffect, useState } from 'react'
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

  const loadBets = () => {
    if (!accessToken) return
    fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setBets(data.bets ?? []))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { loadBets() }, [accessToken])

  const handleConfirm = async (betId: string) => {
    setActionLoading(betId)
    try {
      const res = await fetch(`/api/bets/${betId}/confirm`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
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
    if (!disputeModal) return
    setActionLoading(disputeModal.betId)
    try {
      const res = await fetch(`/api/bets/${disputeModal.betId}/dispute`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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

  if (isLoading) return <div className="text-center text-slate-400 py-20">Loading...</div>

  return (
    <div className="space-y-4">
      <ToastContainer />
      <h1 className="text-xl font-bold text-white">My Bets</h1>

      {bets.map(bet => (
        <div key={bet.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-white">{bet.match.teamA} vs {bet.match.teamB}</p>
              <p className="text-xs text-slate-400">{bet.match.series.name} · {bet.match.matchType} · {new Date(bet.match.matchDate).toLocaleDateString('en-IN')}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              bet.result === 'win' ? 'bg-emerald-900 text-emerald-300'
              : bet.result === 'loss' ? 'bg-red-900 text-red-300'
              : 'bg-amber-900 text-amber-300'
            }`}>{bet.result}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Bet: {formatINR(bet.betAmount)} · Odds {bet.odds}× · {bet.betType}</span>
            <span className={bet.profitLoss >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</span>
            <div className="flex gap-2">
              {bet.disputeStatus === 'open' && (
                <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded-full">Disputed</span>
              )}
              {bet.confirmedByFriend && (
                <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded-full">Confirmed</span>
              )}
              {!bet.confirmedByFriend && bet.settlementStatus !== 'pending' && bet.disputeStatus !== 'open' && (
                <button
                  onClick={() => handleConfirm(bet.id)}
                  disabled={actionLoading === bet.id}
                  className="flex items-center gap-1 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-3 py-1 rounded-full disabled:opacity-50"
                >
                  <CheckCircle2 size={12} />
                  Confirm
                </button>
              )}
              {!bet.disputeStatus && (
                <button
                  onClick={() => setDisputeModal({ betId: bet.id })}
                  className="flex items-center gap-1 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1 rounded-full"
                >
                  <AlertTriangle size={12} />
                  Dispute
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {bets.length === 0 && <div className="text-center text-slate-500 py-20">No bets yet.</div>}

      {/* Dispute modal */}
      {disputeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700 space-y-4">
            <h2 className="text-white font-semibold text-lg">Raise a Dispute</h2>
            <textarea
              value={disputeNote}
              onChange={e => setDisputeNote(e.target.value)}
              placeholder="Describe why you're disputing this bet..."
              className="w-full bg-slate-800 text-white rounded-lg p-3 text-sm border border-slate-700 focus:outline-none focus:border-amber-400 resize-none h-24"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDisputeModal(null); setDisputeNote('') }}
                className="text-slate-400 hover:text-white text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={!disputeNote.trim() || actionLoading === disputeModal.betId}
                className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Raise Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
