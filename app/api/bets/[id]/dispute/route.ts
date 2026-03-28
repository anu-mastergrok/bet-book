import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { disputeSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['FRIEND'])(user)

    const body = await request.json()
    const parsed = disputeSchema.safeParse(body)
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
    if (bet.clientUserId !== user.userId) {
      throw new AuthorizationError('This is not your bet')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: { disputeStatus: 'open', disputeNote: parsed.data.note },
    })

    // Notify the owner (non-critical)
    const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
    try {
      await createNotification(
        bet.userId,
        'Bet disputed',
        `Your friend disputed the ${matchLabel} bet: "${parsed.data.note}"`,
        `/dashboard`
      )
    } catch {
      // Non-critical
    }

    return jsonResponse({ message: 'Dispute raised', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
