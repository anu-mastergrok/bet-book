import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { resolveDisputeSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = resolveDisputeSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: { match: true },
    })
    if (!bet) throw new NotFoundError('Bet not found')
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only resolve disputes on your own bets')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: {
        disputeStatus: 'resolved',
        disputeResolvedAt: new Date(),
      },
    })

    // Notify the friend (non-critical)
    if (bet.clientUserId) {
      const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
      try {
        await createNotification(
          bet.clientUserId,
          'Dispute resolved',
          `The ${matchLabel} bet dispute has been resolved: "${parsed.data.note}"`,
          `/friend/bets`
        )
      } catch {
        // Non-critical
      }
    }

    return jsonResponse({ message: 'Dispute resolved', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
