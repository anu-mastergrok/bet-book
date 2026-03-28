import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { errorResponse, jsonResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    // Count stats
    const [totalUsers, totalMatches, totalBets, totalSeries] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.match.count(),
      prisma.betEntry.count(),
      prisma.series.count(),
    ])

    // Count pending settlements
    const pendingSettlements = await prisma.betEntry.count({
      where: { settlementStatus: 'pending' },
    })

    // Get recent activity
    const recentBets = await prisma.betEntry.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        match: { include: { series: true } },
        user: true,
        clientUser: true,
      },
    })

    // Get series overview
    const seriesOverview = await prisma.series.findMany({
      include: {
        matches: {
          include: {
            _count: { select: { betEntries: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    // Calculate total P&L
    const allBets = await prisma.betEntry.findMany()
    const totalPnL = allBets.reduce((sum, bet) => {
      const amount = typeof bet.profitLoss === 'string' ? parseFloat(bet.profitLoss) : Number(bet.profitLoss)
      return sum + amount
    }, 0)

    return jsonResponse({
      stats: {
        totalUsers,
        totalMatches,
        totalBets,
        totalSeries,
        pendingSettlements,
        totalPnL,
      },
      recentBets,
      seriesOverview,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
