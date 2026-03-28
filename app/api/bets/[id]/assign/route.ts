import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { assignFriendSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = assignFriendSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const bet = await prisma.betEntry.findUnique({ where: { id: params.id } })
    if (!bet) throw new NotFoundError('Bet not found')
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only assign friends to your own bets')
    }

    const friend = await prisma.user.findUnique({ where: { id: parsed.data.clientUserId } })
    if (!friend || friend.role !== 'FRIEND') {
      throw new NotFoundError('Friend account not found')
    }

    const updatedBet = await prisma.betEntry.update({
      where: { id: params.id },
      data: { clientUserId: parsed.data.clientUserId },
    })

    return jsonResponse({ message: 'Friend assigned to bet', bet: updatedBet })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
