import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { betEntrySchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { calculateBetProfitLoss } from '@/lib/pnl'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)
    
    const seriesId = searchParams.get('seriesId')
    const matchId = searchParams.get('matchId')
    const clientUserId = searchParams.get('clientUserId')
    const settlementStatus = searchParams.get('settlementStatus')

    const where: any = {}

    if (user.role === 'USER') {
      // Users can only see their own bets
      where.userId = user.userId
    } else if (user.role === 'ADMIN') {
      // Admins can filter by various criteria
      if (seriesId) where.match = { seriesId }
      if (matchId) where.matchId = matchId
      if (clientUserId) where.clientUserId = clientUserId
      if (settlementStatus) where.settlementStatus = settlementStatus
    }

    const bets = await prisma.betEntry.findMany({
      where,
      include: {
        match: {
          include: { series: true },
        },
        user: true,
        clientUser: true,
        linkedMatch: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse({ bets })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()

    // Validate input
    const parsed = betEntrySchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    // Verify match exists
    const match = await prisma.match.findUnique({
      where: { id: parsed.data.matchId },
    })

    if (!match) {
      throw new NotFoundError('Match not found')
    }

    // Only admins and the user can create bets for themselves
    if (user.role === 'USER' && body.userId && body.userId !== user.userId) {
      throw new AuthorizationError('You can only create bets for yourself')
    }

    const betData = {
      ...parsed.data,
      userId: body.userId || user.userId,
      clientUserId: parsed.data.clientUserId || null,
      profitLoss: 0,
      result: parsed.data.result || 'pending',
    }

    const bet = await prisma.betEntry.create({
      data: betData as any,
      include: {
        match: {
          include: { series: true },
        },
        user: true,
        clientUser: true,
      },
    })

    // Calculate profit/loss after bet is created
    const profitLoss = calculateBetProfitLoss(bet as any)

    if (profitLoss !== 0) {
      const updatedBet = await prisma.betEntry.update({
        where: { id: bet.id },
        data: { profitLoss: profitLoss.toString() },
        include: {
          match: {
            include: { series: true },
          },
          user: true,
          clientUser: true,
        },
      })

      return jsonResponse({
        message: 'Bet created successfully',
        bet: updatedBet,
      }, 201)
    }

    return jsonResponse({
      message: 'Bet created successfully',
      bet,
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
