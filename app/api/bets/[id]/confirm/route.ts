import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['FRIEND'])(user)

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: { match: true },
    })
    if (!bet) throw new NotFoundError('Bet not found')
    if (bet.clientUserId !== user.userId) {
      throw new AuthorizationError('This is not your bet')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: { confirmedByFriend: true },
    })

    // Notify the owner (non-critical)
    const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
    try {
      await createNotification(
        bet.userId,
        'Settlement confirmed',
        `Your friend confirmed the ${matchLabel} bet settlement`,
        `/dashboard`
      )
    } catch {
      // Non-critical
    }

    return jsonResponse({ message: 'Settlement confirmed', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
