import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { linkFriendSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, ConflictError, NotFoundError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const links = await prisma.friendLink.findMany({
      where: { userId: user.userId },
      include: {
        friend: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // For each friend compute outstanding balance from bets
    const friendsWithBalance = await Promise.all(
      links.map(async (link) => {
        const bets = await prisma.betEntry.findMany({
          where: { userId: user.userId, clientUserId: link.friendId },
          select: { profitLoss: true, settlementStatus: true },
        })

        const payments = await prisma.clientPayment.findMany({
          where: { userId: user.userId, clientUserId: link.friendId },
          select: { amount: true },
        })

        const betPnl = bets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
        const paymentsReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const outstanding = betPnl - paymentsReceived

        return {
          linkId: link.id,
          friend: link.friend,
          outstanding,
        }
      })
    )

    return jsonResponse({ friends: friendsWithBalance })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = linkFriendSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const friend = await prisma.user.findUnique({
      where: { id: parsed.data.friendId },
    })
    if (!friend) throw new NotFoundError('User not found')
    if (friend.role !== 'FRIEND') {
      throw new ValidationError('Only FRIEND-role users can be linked')
    }

    const existing = await prisma.friendLink.findUnique({
      where: { userId_friendId: { userId: user.userId, friendId: parsed.data.friendId } },
    })
    if (existing) throw new ConflictError('Already linked to this friend')

    const link = await prisma.friendLink.create({
      data: { userId: user.userId, friendId: parsed.data.friendId },
    })

    return jsonResponse({ message: 'Friend linked successfully', link }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
