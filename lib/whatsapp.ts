import { formatINR } from '@/lib/format'

export interface BetForWhatsApp {
  clientName: string
  betOnTeam: string
  betAmount: number
  odds: number
  betType: string
  result: string
  profitLoss: number
  settlementStatus: string
  paymentMethod?: string | null
  notes?: string | null
  match: {
    teamA: string
    teamB: string
    matchDate: string
    venue?: string
    series: { name: string }
    matchType?: string
  }
}

export function buildBetSlipMessage(bet: BetForWhatsApp): string {
  const { match } = bet

  const teamLabel = bet.betOnTeam === 'teamA' ? match.teamA : match.teamB
  const matchup = `${match.teamA} vs ${match.teamB}`

  const seriesAndType = match.matchType
    ? `${match.series.name} · ${match.matchType}`
    : match.series.name

  const matchDate = new Date(match.matchDate).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const venueStr = match.venue ? `\n🏟 ${match.venue}` : ''

  const potentialWin = (bet.betAmount * bet.odds) - bet.betAmount

  const isSettled = bet.settlementStatus === 'collected' || bet.settlementStatus === 'settled'
  const isPending = bet.result === 'pending'

  let resultLine: string
  if (isPending && !isSettled) {
    const winStr = bet.profitLoss >= 0
      ? `+${formatINR(potentialWin)}`
      : formatINR(potentialWin)
    resultLine = `\n💵 Potential Win: ${winStr}`
  } else {
    const pnlStr = bet.profitLoss >= 0
      ? `+${formatINR(bet.profitLoss)}`
      : formatINR(bet.profitLoss)
    const resultLabel = bet.result === 'win' ? 'Win' : bet.result === 'loss' ? 'Loss' : 'Pending'

    let settlementLabel = 'Settled'
    if (bet.settlementStatus === 'collected') {
      settlementLabel = bet.paymentMethod === 'upi'
        ? 'Collected via UPI'
        : bet.paymentMethod === 'cash'
        ? 'Collected via Cash'
        : 'Collected'
    } else if (bet.settlementStatus === 'settled') {
      settlementLabel = bet.paymentMethod === 'upi'
        ? 'Settled via UPI'
        : bet.paymentMethod === 'cash'
        ? 'Settled via Cash'
        : 'Settled'
    } else if (bet.settlementStatus === 'lost_in_another_match') {
      settlementLabel = 'Lost in Another Match'
    } else {
      settlementLabel = 'Pending'
    }

    resultLine = `\n📊 Result: ${resultLabel}  |  P&L: ${pnlStr}\n✅ Settlement: ${settlementLabel}`
  }

  return [
    `📋 *Bet Slip — Bet Book*`,
    ``,
    `🏏 ${matchup} (${seriesAndType})`,
    `📅 ${matchDate}${venueStr}`,
    ``,
    `👤 Client: ${bet.clientName}`,
    `🎯 Bet On: ${teamLabel}`,
    `💰 Amount: ${formatINR(bet.betAmount)}`,
    `📊 Odds: ${bet.odds}×`,
    `🏷 Type: ${bet.betType}`,
    resultLine,
    ``,
    `_Powered by Bet Book_`,
  ].join('\n')
}

export function openWhatsApp(message: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}
