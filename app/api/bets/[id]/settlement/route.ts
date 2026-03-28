import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { settlementSchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

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
    if (user.role === 'USER' && existingBet.userId !== user.userId) {
      throw new AuthorizationError('You can only update your own bets')
    }

    // Validate input
    const parsed = settlementSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { settlementStatus, linkedMatchId, paymentMethod, upiTransactionId, paymentNote } = parsed.data

    // If settlement is "lost_in_another_match", verify the linked match exists
    if (settlementStatus === 'lost_in_another_match' && linkedMatchId) {
      const linkedMatch = await prisma.match.findUnique({
        where: { id: linkedMatchId },
      })

      if (!linkedMatch) {
        throw new NotFoundError('Linked match not found')
      }
    }

    const updateData: any = {
      settlementStatus,
    }

    if (linkedMatchId !== undefined) {
      updateData.linkedMatchId = linkedMatchId
    }

    if (settlementStatus === 'collected' || settlementStatus === 'settled') {
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
      if (upiTransactionId !== undefined) updateData.upiTransactionId = upiTransactionId
      if (paymentNote !== undefined) updateData.paymentNote = paymentNote
    } else {
      updateData.paymentMethod = null
      updateData.upiTransactionId = null
      updateData.paymentNote = null
    }

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

    // Notify the friend of the settlement update (non-critical)
    if (bet.clientUserId) {
      const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
      const statusLabel =
        settlementStatus === 'settled' ? 'settled'
        : settlementStatus === 'collected' ? 'collected'
        : settlementStatus === 'lost_in_another_match' ? 'moved to another match'
        : 'pending'
      try {
        await createNotification(
          bet.clientUserId,
          'Bet settlement updated',
          `${matchLabel} bet marked as ${statusLabel}`,
          `/friend/bets`
        )
      } catch {
        // Non-critical — notification failure should not fail settlement update
      }
    }

    return jsonResponse({
      message: 'Bet settlement updated successfully',
      bet,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
