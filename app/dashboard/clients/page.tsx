'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal } from '@/components/Modal'
import { formatINR } from '@/lib/format'
import { openWhatsApp } from '@/lib/whatsapp'
import { MessageCircle, Loader, Plus, ChevronDown, ChevronUp, Trash2, Users, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/BottomNav'

interface Bet {
  id: string
  clientName: string
  result: string
  profitLoss: number
  settlementStatus: string
}

interface ClientPayment {
  id: string
  clientName: string
  amount: number
  method: string
  upiRef?: string | null
  note?: string | null
  createdAt: string
}

interface ClientData {
  clientName: string
  totalBets: number
  wins: number
  losses: number
  pending: number
  totalPnL: number
  outstanding: number
  settled: number
  payments: ClientPayment[]
  totalPaymentsReceived: number
  netOutstanding: number
}

interface PaymentFormState {
  amount: string
  method: 'cash' | 'upi'
  upiRef: string
  note: string
}

const DEFAULT_PAYMENT_FORM: PaymentFormState = {
  amount: '',
  method: 'cash',
  upiRef: '',
  note: '',
}

export default function ClientDuesPage() {
  const router = useRouter()
  const { user, accessToken } = useAuth()
  const toast = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [bets, setBets] = useState<Bet[]>([])
  const [payments, setPayments] = useState<ClientPayment[]>([])
  const [clients, setClients] = useState<ClientData[]>([])

  // Record payment modal state
  const [recordModalClient, setRecordModalClient] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(DEFAULT_PAYMENT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Collapsible payment history per client
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  // Deleting payment
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role === 'ADMIN') { router.push('/admin'); return }
    fetchData()
  }, [user, router])

  const fetchData = async () => {
    try {
      const [betsRes, paymentsRes] = await Promise.all([
        fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch('/api/client-payments', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])

      if (!betsRes.ok) throw new Error('Failed to fetch bets')
      if (!paymentsRes.ok) throw new Error('Failed to fetch payments')

      const { bets: fetchedBets } = await betsRes.json()
      const { payments: fetchedPayments } = await paymentsRes.json()

      setBets(fetchedBets)
      setPayments(fetchedPayments)
      computeClients(fetchedBets, fetchedPayments)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/client-payments', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to fetch payments')
      const { payments: fetchedPayments } = await res.json()
      setPayments(fetchedPayments)
      computeClients(bets, fetchedPayments)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh payments')
    }
  }

  const computeClients = (betList: Bet[], paymentList: ClientPayment[]) => {
    const map: Record<string, ClientData> = {}

    for (const bet of betList) {
      const name = bet.clientName
      if (!map[name]) {
        map[name] = {
          clientName: name,
          totalBets: 0,
          wins: 0,
          losses: 0,
          pending: 0,
          totalPnL: 0,
          outstanding: 0,
          settled: 0,
          payments: [],
          totalPaymentsReceived: 0,
          netOutstanding: 0,
        }
      }
      const c = map[name]
      c.totalBets++
      if (bet.result === 'win') c.wins++
      else if (bet.result === 'loss') c.losses++
      else c.pending++
      c.totalPnL += bet.profitLoss
      if (bet.settlementStatus === 'pending') {
        c.outstanding += bet.profitLoss
      } else if (bet.settlementStatus === 'collected' || bet.settlementStatus === 'settled') {
        c.settled += bet.profitLoss
      }
    }

    for (const payment of paymentList) {
      const name = payment.clientName
      if (map[name]) {
        map[name].payments.push(payment)
        map[name].totalPaymentsReceived += payment.amount
      }
    }

    for (const c of Object.values(map)) {
      c.netOutstanding = c.outstanding - c.totalPaymentsReceived
    }

    const sorted = Object.values(map).sort(
      (a, b) => Math.abs(b.netOutstanding) - Math.abs(a.netOutstanding)
    )

    setClients(sorted)
  }

  const toggleExpanded = (clientName: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      if (next.has(clientName)) next.delete(clientName)
      else next.add(clientName)
      return next
    })
  }

  const openRecordModal = (clientName: string) => {
    setRecordModalClient(clientName)
    setPaymentForm(DEFAULT_PAYMENT_FORM)
  }

  const closeRecordModal = () => {
    setRecordModalClient(null)
    setPaymentForm(DEFAULT_PAYMENT_FORM)
  }

  const handleRecordPayment = async () => {
    if (!recordModalClient) return
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid positive amount')
      return
    }
    if (paymentForm.method === 'upi' && !paymentForm.upiRef.trim()) {
      toast.error('Please enter a UPI reference')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/client-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clientName: recordModalClient,
          amount,
          method: paymentForm.method,
          upiRef: paymentForm.method === 'upi' ? paymentForm.upiRef.trim() : undefined,
          note: paymentForm.note.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to record payment')
      }
      toast.success('Payment recorded successfully')
      closeRecordModal()
      await fetchPayments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePayment = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/client-payments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete payment')
      }
      toast.success('Payment deleted')
      await fetchPayments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete payment')
    } finally {
      setDeletingId(null)
    }
  }

  const sendWhatsAppReminder = (client: ClientData) => {
    const amount = formatINR(Math.abs(client.netOutstanding))
    const msg = `Hi ${client.clientName}, your outstanding balance is ${amount}.\nPlease settle at your earliest convenience.\n— Bet Book`
    openWhatsApp(msg)
  }

  const getOutstandingColor = (client: ClientData) => {
    if (client.netOutstanding > 0) return 'text-emerald-400'
    if (client.netOutstanding < 0) return 'text-red-400'
    if (client.pending > 0) return 'text-amber-400'
    return 'text-slate-400'
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin text-amber-400" size={32} />
          <p className="text-slate-500 text-sm">Loading client dues...</p>
        </div>
      </div>
    )
  }

  const totalOutstanding = clients.reduce((sum, c) => sum + c.netOutstanding, 0)
  const clientCount = clients.length

  return (
    <div className="min-h-dvh bg-slate-950">
      <ToastContainer />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center">
              <Users className="text-amber-400" size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">Client Dues</h1>
              <p className="text-xs text-slate-500">Outstanding balances</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Summary Bar */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="stat-label">Total Outstanding</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${totalOutstanding > 0 ? 'text-emerald-400' : totalOutstanding < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {totalOutstanding >= 0 ? '+' : ''}{formatINR(totalOutstanding)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalOutstanding > 0 ? 'Clients owe you' : totalOutstanding < 0 ? 'You owe clients' : 'All settled'}
            </p>
          </div>
          <div className="card">
            <p className="stat-label">Total Clients</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-slate-100">{clientCount}</p>
            <p className="text-xs text-slate-500 mt-1">with recorded bets</p>
          </div>
        </div>

        {/* Client Cards */}
        {clients.length === 0 ? (
          <div className="card py-16 text-center">
            <Users className="mx-auto text-slate-600 mb-3" size={32} />
            <p className="text-slate-400 font-medium">No clients yet</p>
            <p className="text-slate-500 text-sm mt-1">Create bets with client names to see them here</p>
            <Link href="/dashboard/new-bet" className="btn-primary inline-flex mt-4">
              <Plus size={16} />
              New Bet
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map(client => {
              const isExpanded = expandedClients.has(client.clientName)
              const outstandingColor = getOutstandingColor(client)
              const netSign = client.netOutstanding > 0 ? '+' : ''

              return (
                <div key={client.clientName} className="card space-y-4">
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">{client.clientName}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {client.totalBets} bet{client.totalBets !== 1 ? 's' : ''}
                        {client.wins > 0 && <span className="text-emerald-400"> · {client.wins}W</span>}
                        {client.losses > 0 && <span className="text-red-400"> · {client.losses}L</span>}
                        {client.pending > 0 && <span className="text-amber-400"> · {client.pending} pending</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => sendWhatsAppReminder(client)}
                      className="p-2 text-slate-400 hover:text-[#25D366] hover:bg-green-500/10 rounded-lg transition-colors"
                      title="Send WhatsApp reminder"
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>

                  {/* P&L Breakdown */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Bet P&L</span>
                      <span className={`font-medium tabular-nums ${client.outstanding >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {client.outstanding >= 0 ? '+' : ''}{formatINR(client.outstanding)}
                      </span>
                    </div>
                    {client.totalPaymentsReceived > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Payments Rcvd</span>
                        <span className="font-medium tabular-nums text-slate-300">
                          -{formatINR(client.totalPaymentsReceived)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-700/60 pt-2 flex justify-between items-center">
                      <span className="text-slate-300 font-medium">Net Outstanding</span>
                      <span className={`text-lg font-bold tabular-nums ${outstandingColor}`}>
                        {netSign}{formatINR(client.netOutstanding)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => openRecordModal(client.clientName)}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      Record Payment
                    </button>

                    {client.payments.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(client.clientName)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {client.payments.length} payment{client.payments.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>

                  {/* Payment History */}
                  {isExpanded && client.payments.length > 0 && (
                    <div className="border-t border-slate-700/60 pt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment History</p>
                      {client.payments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-100 tabular-nums">
                                {formatINR(payment.amount)}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 capitalize">
                                {payment.method}
                              </span>
                              {payment.upiRef && (
                                <span className="text-xs text-slate-500 truncate">
                                  {payment.upiRef}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">
                                {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              {payment.note && (
                                <span className="text-xs text-slate-500 truncate">· {payment.note}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            disabled={deletingId === payment.id}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 ml-2 flex-shrink-0"
                            title="Delete payment"
                          >
                            {deletingId === payment.id
                              ? <Loader size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav role="USER" />

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordModalClient !== null}
        onClose={closeRecordModal}
        title={`Record Payment — ${recordModalClient}`}
        size="sm"
      >
        <div className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Amount (₹) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 5000"
              value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              className="input w-full"
            />
          </div>

          {/* Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Payment Method</label>
            <div className="flex gap-2">
              {(['cash', 'upi'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentForm(f => ({ ...f, method, upiRef: '' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize border ${
                    paymentForm.method === method
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {method === 'upi' ? 'UPI' : 'Cash'}
                </button>
              ))}
            </div>
          </div>

          {/* UPI Reference */}
          {paymentForm.method === 'upi' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                UPI Reference <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. UPI/123456789"
                value={paymentForm.upiRef}
                onChange={e => setPaymentForm(f => ({ ...f, upiRef: e.target.value }))}
                className="input w-full"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Partial settlement"
              value={paymentForm.note}
              onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))}
              className="input w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={closeRecordModal}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRecordPayment}
              className="btn-primary flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={14} className="animate-spin" />
                  Recording...
                </span>
              ) : (
                'Record Payment'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
