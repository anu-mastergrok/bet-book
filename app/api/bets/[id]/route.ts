import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { updateBetEntrySchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { calculateBetProfitLoss } from '@/lib/pnl'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: {
        match: {
          include: { series: true },
        },
        user: true,
        clientUser: true,
        linkedMatch: true,
      },
    })

    if (!bet) {
      throw new NotFoundError('Bet not found')
    }

    // Check authorization
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only view your own bets')
    }
    if (user.role === 'FRIEND' && bet.clientUserId !== user.userId) {
      throw new AuthorizationError('You can only view your own bets')
    }

    return jsonResponse({ bet })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()

    // Find existing bet
    const existingBet = await prisma.betEntry.findUnique({
      where: { id: params.id },
    })

    if (!existingBet) {
      throw new NotFoundError('Bet not found')
    }

    // Check authorization
    if (user.role === 'FRIEND') {
      throw new AuthorizationError('Friends cannot modify bets')
    }
    if (user.role === 'USER' && existingBet.userId !== user.userId) {
      throw new AuthorizationError('You can only update your own bets')
    }

    // Validate input
    const parsed = updateBetEntrySchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    // Prepare update data
    const updateData: any = {}

    if (parsed.data.matchId) updateData.matchId = parsed.data.matchId
    if (parsed.data.clientName) updateData.clientName = parsed.data.clientName
    if (parsed.data.clientUserId !== undefined) updateData.clientUserId = parsed.data.clientUserId
    if (parsed.data.betOnTeam) updateData.betOnTeam = parsed.data.betOnTeam
    if (parsed.data.betAmount) updateData.betAmount = parsed.data.betAmount
    if (parsed.data.odds) updateData.odds = parsed.data.odds
    if (parsed.data.betType) updateData.betType = parsed.data.betType
    if (parsed.data.result) updateData.result = parsed.data.result
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes
    if (parsed.data.settlementStatus) updateData.settlementStatus = parsed.data.settlementStatus
    if (parsed.data.linkedMatchId !== undefined) updateData.linkedMatchId = parsed.data.linkedMatchId

    const bet = await prisma.betEntry.update({
      where: { id: params.id },
      data: updateData,
      include: {
        match: {
          include: { series: true },
        },
        user: true,
        clientUser: true,
        linkedMatch: true,
      },
    })

    // Recalculate profit/loss
    const profitLoss = calculateBetProfitLoss(bet as any)
    const finalBet = await prisma.betEntry.update({
      where: { id: params.id },
      data: { profitLoss: profitLoss.toString() },
      include: {
        match: {
          include: { series: true },
        },
        user: true,
        clientUser: true,
        linkedMatch: true,
      },
    })

    return jsonResponse({
      message: 'Bet updated successfully',
      bet: finalBet,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
    })

    if (!bet) {
      throw new NotFoundError('Bet not found')
    }

    // Check authorization
    if (user.role === 'FRIEND') {
      throw new AuthorizationError('Friends cannot modify bets')
    }
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only delete your own bets')
    }

    await prisma.betEntry.delete({
      where: { id: params.id },
    })

    return jsonResponse({ message: 'Bet deleted successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
