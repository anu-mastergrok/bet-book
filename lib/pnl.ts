import { Decimal } from '@prisma/client/runtime/library'

export interface BetData {
  id: string
  betAmount: number | Decimal
  odds: number | Decimal
  result: string
  settlementStatus: string
}

export function calculateBetProfitLoss(bet: BetData): number {
  const amount = typeof bet.betAmount === 'string' ? parseFloat(bet.betAmount) : Number(bet.betAmount)
  const odds = typeof bet.odds === 'string' ? parseFloat(bet.odds) : Number(bet.odds)

  if (bet.result === 'pending') {
    return 0
  }

  if (bet.result === 'win') {
    // Profit = (betAmount * odds) - betAmount
    return (amount * odds) - amount
  }

  if (bet.result === 'loss') {
    // Loss = -betAmount
    return -amount
  }

  return 0
}

export function calculateMatchPnL(bets: BetData[]): number {
  return bets.reduce((total, bet) => total + calculateBetProfitLoss(bet), 0)
}

export function calculateSeriesPnL(bets: BetData[]): number {
  return bets.reduce((total, bet) => total + calculateBetProfitLoss(bet), 0)
}

export function calculateUserClientPnL(clientBets: BetData[]): number {
  return clientBets.reduce((total, bet) => total + calculateBetProfitLoss(bet), 0)
}

export interface PnLBreakdown {
  totalPnL: number
  wins: number
  losses: number
  pending: number
  avgOdds: number
  totalBetAmount: number
}

export function calculatePnLBreakdown(bets: BetData[]): PnLBreakdown {
  const totalPnL = calculateMatchPnL(bets)
  const wins = bets.filter(b => b.result === 'win').length
  const losses = bets.filter(b => b.result === 'loss').length
  const pending = bets.filter(b => b.result === 'pending').length
  
  const totalOdds = bets.reduce((sum, bet) => {
    const odds = typeof bet.odds === 'string' ? parseFloat(bet.odds) : Number(bet.odds)
    return sum + odds
  }, 0)
  
  const avgOdds = bets.length > 0 ? totalOdds / bets.length : 0

  const totalBetAmount = bets.reduce((sum, bet) => {
    const amount = typeof bet.betAmount === 'string' ? parseFloat(bet.betAmount) : Number(bet.betAmount)
    return sum + amount
  }, 0)

  return {
    totalPnL,
    wins,
    losses,
    pending,
    avgOdds: Math.round(avgOdds * 100) / 100,
    totalBetAmount,
  }
}
