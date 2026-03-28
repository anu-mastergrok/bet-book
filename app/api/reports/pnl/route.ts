import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { errorResponse, jsonResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, AuthorizationError } from '@/lib/errors'
import { calculateBetProfitLoss, calculatePnLBreakdown } from '@/lib/pnl'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)

    const matchId = searchParams.get('matchId')
    const seriesId = searchParams.get('seriesId')
    const userId = searchParams.get('userId')

    // Users can only query their own P&L
    if (user.role === 'USER' && userId && userId !== user.userId) {
      throw new AuthorizationError('You can only view your own P&L')
    }

    const actualUserId = user.role === 'USER' ? user.userId : userId

    let bets: any[] = []

    if (matchId) {
      // P&L for a specific match
      bets = await prisma.betEntry.findMany({
        where: {
          matchId,
          ...(actualUserId && { userId: actualUserId }),
        },
        include: {
          match: {
            include: { series: true },
          },
          user: true,
          clientUser: true,
        },
      })
    } else if (seriesId) {
      // P&L for a series
      bets = await prisma.betEntry.findMany({
        where: {
          match: {
            seriesId,
          },
          ...(actualUserId && { userId: actualUserId }),
        },
        include: {
          match: {
            include: { series: true },
          },
          user: true,
          clientUser: true,
        },
      })
    } else if (actualUserId) {
      // P&L for a user across all matches
      bets = await prisma.betEntry.findMany({
        where: {
          userId: actualUserId,
        },
        include: {
          match: {
            include: { series: true },
          },
          user: true,
          clientUser: true,
        },
      })
    } else {
      throw new Error('Must specify matchId, seriesId, or userId')
    }

    // Calculate P&L
    const breakdown = calculatePnLBreakdown(bets as any)

    // Group by client if needed
    const byClient: { [key: string]: any } = {}
    bets.forEach(bet => {
      const clientKey = bet.clientUserId || bet.clientName
      if (!byClient[clientKey]) {
        byClient[clientKey] = []
      }
      byClient[clientKey].push(bet)
    })

    const clientPnL = Object.entries(byClient).map(([key, clientBets]) => ({
      client: key,
      pnl: calculatePnLBreakdown(clientBets as any),
      bets: clientBets,
    }))

    return jsonResponse({
      summary: breakdown,
      byClient: clientPnL,
      totalBets: bets.length,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
