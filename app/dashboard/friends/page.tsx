'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { Search, UserPlus, UserMinus, MessageCircle, IndianRupee } from 'lucide-react'

interface Friend {
  linkId: string
  friend: { id: string; name: string; phone: string }
  outstanding: number
}

interface SearchUser {
  id: string
  name: string
  phone: string
}

export default function FriendsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [paymentModal, setPaymentModal] = useState<Friend | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', upiRef: '', note: '' })
  const [isLoading, setIsLoading] = useState(true)

  const loadFriends = useCallback(async () => {
    if (!accessToken) return
    try {
      const r = await fetch('/api/friends', { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!r.ok) return
      const data = await r.json()
      setFriends(data.friends ?? [])
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => { loadFriends() }, [loadFriends])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(r => { if (r.ok) return r.json() })
        .then(data => { if (data) setSearchResults(data.users ?? []) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, accessToken])

  const handleLink = async (friendId: string) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Friend linked!')
      setSearchQuery('')
      setSearchResults([])
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to link')
    }
  }

  const handleUnlink = async (linkId: string) => {
    if (!confirm('Unlink this friend? Bet history is preserved.')) return
    try {
      const res = await fetch(`/api/friends/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Friend unlinked')
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentModal) return
    try {
      const res = await fetch('/api/client-payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: paymentModal.friend.name,
          clientUserId: paymentModal.friend.id,
          amount: parseFloat(paymentForm.amount),
          method: paymentForm.method,
          upiRef: paymentForm.upiRef || null,
          note: paymentForm.note || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      toast.success(`Payment recorded. ${data.settledBets} bet(s) settled.`)
      setPaymentModal(null)
      setPaymentForm({ amount: '', method: 'cash', upiRef: '', note: '' })
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const sendWhatsApp = (friend: Friend) => {
    const msg = `Hi ${friend.friend.name}, your outstanding balance is ${formatINR(Math.abs(friend.outstanding))}.\nPlease settle at your earliest convenience.\n— Bet Book`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <h1 className="text-base font-semibold text-slate-100">Friends</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full bg-slate-800 text-white rounded-xl pl-9 pr-4 py-3 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-10">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-slate-400 text-xs">{u.phone}</p>
                  </div>
                  <button
                    onClick={() => handleLink(u.id)}
                    className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-1.5 rounded-full"
                  >
                    <UserPlus size={12} />
                    Link
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friends list */}
        {isLoading ? (
          <div className="text-center text-slate-400 py-10">Loading...</div>
        ) : friends.length === 0 ? (
          <div className="text-center text-slate-500 py-10">No friends linked yet. Search to add one.</div>
        ) : (
          <div className="space-y-3">
            {friends.map(f => (
              <div key={f.linkId} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-white">{f.friend.name}</p>
                    <p className="text-xs text-slate-400">{f.friend.phone}</p>
                  </div>
                  <div className={`text-lg font-bold ${f.outstanding > 0 ? 'text-emerald-400' : f.outstanding < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {f.outstanding > 0 ? '+' : ''}{formatINR(f.outstanding)}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setPaymentModal(f)}
                    className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-full"
                  >
                    <IndianRupee size={12} />
                    Record Payment
                  </button>
                  <button
                    onClick={() => sendWhatsApp(f)}
                    className="flex items-center gap-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 px-3 py-1.5 rounded-full"
                  >
                    <MessageCircle size={12} />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => handleUnlink(f.linkId)}
                    className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded-full"
                  >
                    <UserMinus size={12} />
                    Unlink
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Record Payment modal */}
        {paymentModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700 space-y-4">
              <h2 className="text-white font-semibold text-lg">Record Payment — {paymentModal.friend.name}</h2>

              <div>
                <label className="text-slate-400 text-xs block mb-1">Amount Received (₹) *</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="10000"
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs block mb-1">Payment Method *</label>
                <div className="flex gap-2">
                  {(['cash', 'upi'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentForm(p => ({ ...p, method: m }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border ${paymentForm.method === m ? 'bg-amber-500 text-slate-900 border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {paymentForm.method === 'upi' && (
                <div>
                  <label className="text-slate-400 text-xs block mb-1">UPI Reference</label>
                  <input
                    value={paymentForm.upiRef}
                    onChange={e => setPaymentForm(p => ({ ...p, upiRef: e.target.value }))}
                    placeholder="T2506271234567"
                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-400 text-xs block mb-1">Note (optional)</label>
                <input
                  value={paymentForm.note}
                  onChange={e => setPaymentForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Partial payment"
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setPaymentModal(null)}
                  className="text-slate-400 hover:text-white text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
