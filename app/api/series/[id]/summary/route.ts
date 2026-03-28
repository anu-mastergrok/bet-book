import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, NotFoundError } from '@/lib/errors'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)

    const series = await prisma.series.findUnique({
      where: { id: params.id },
      include: {
        matches: {
          include: {
            betEntries: {
              where: user.role === 'USER' ? { userId: user.userId } : undefined,
              include: { clientUser: { select: { id: true, name: true } } },
            },
          },
          orderBy: { matchDate: 'asc' },
        },
      },
    })

    if (!series) throw new NotFoundError('Series not found')

    // Per-match breakdown
    const matchBreakdown = series.matches.map((match) => {
      const bets = match.betEntries
      const matchPnl = bets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const collected = bets
        .filter(b => b.settlementStatus === 'collected' || b.settlementStatus === 'settled')
        .reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const pending = bets
        .filter(b => b.settlementStatus === 'pending')
        .reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const wins = bets.filter(b => b.result === 'win').length
      const losses = bets.filter(b => b.result === 'loss').length

      return {
        matchId: match.id,
        label: `${match.teamA} vs ${match.teamB}`,
        matchType: match.matchType,
        matchDate: match.matchDate,
        totalBets: bets.length,
        wins,
        losses,
        matchPnl,
        collected,
        pending,
        bets: bets.map(b => ({
          id: b.id,
          clientName: b.clientName,
          clientUser: b.clientUser,
          betAmount: Number(b.betAmount),
          result: b.result,
          profitLoss: Number(b.profitLoss),
          settlementStatus: b.settlementStatus,
          confirmedByFriend: b.confirmedByFriend,
          disputeStatus: b.disputeStatus,
        })),
      }
    })

    // Series totals
    const allBets = series.matches.flatMap(m => m.betEntries)
    const totalPnl = allBets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
    const outstanding = allBets
      .filter(b => b.settlementStatus === 'pending')
      .reduce((sum, b) => sum + Number(b.profitLoss), 0)
    const wins = allBets.filter(b => b.result === 'win').length
    const winRate = allBets.length > 0 ? Math.round((wins / allBets.length) * 100) : 0

    // By-friend breakdown
    const friendMap = new Map<string, {
      clientName: string
      clientUserId: string | null
      bets: number
      wins: number
      losses: number
      seriesPnl: number
      outstanding: number
    }>()

    for (const bet of allBets) {
      const key = bet.clientUserId ?? bet.clientName
      if (!friendMap.has(key)) {
        friendMap.set(key, {
          clientName: bet.clientName,
          clientUserId: bet.clientUserId,
          bets: 0,
          wins: 0,
          losses: 0,
          seriesPnl: 0,
          outstanding: 0,
        })
      }
      const entry = friendMap.get(key)!
      entry.bets++
      if (bet.result === 'win') entry.wins++
      if (bet.result === 'loss') entry.losses++
      entry.seriesPnl += Number(bet.profitLoss)
      if (bet.settlementStatus === 'pending') entry.outstanding += Number(bet.profitLoss)
    }

    // Payment history for this series (by series date range)
    const payments = await prisma.clientPayment.findMany({
      where: {
        userId: user.userId,
        createdAt: { gte: series.startDate, lte: series.endDate },
      },
      orderBy: { createdAt: 'asc' },
    })

    return jsonResponse({
      series: {
        id: series.id,
        name: series.name,
        status: series.status,
        startDate: series.startDate,
        endDate: series.endDate,
      },
      totals: {
        totalMatches: series.matches.length,
        totalBets: allBets.length,
        winRate,
        totalPnl,
        outstanding,
      },
      matchBreakdown,
      byFriend: Array.from(friendMap.values()),
      paymentHistory: payments,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
