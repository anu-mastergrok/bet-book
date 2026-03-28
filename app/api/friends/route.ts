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

    // Get all friend IDs
    const friendIds = links.map(l => l.friendId)

    // Batch fetch bets for all friends in one query
    const allBets = friendIds.length > 0
      ? await prisma.betEntry.findMany({
          where: { userId: user.userId, clientUserId: { in: friendIds } },
          select: { clientUserId: true, profitLoss: true },
        })
      : []

    // Batch fetch payments for all friends in one query
    const allPayments = friendIds.length > 0
      ? await prisma.clientPayment.findMany({
          where: { userId: user.userId, clientUserId: { in: friendIds } },
          select: { clientUserId: true, amount: true },
        })
      : []

    // Aggregate in memory
    const betPnlByFriend = new Map<string, number>()
    const paymentsByFriend = new Map<string, number>()

    for (const bet of allBets) {
      if (!bet.clientUserId) continue
      betPnlByFriend.set(bet.clientUserId, (betPnlByFriend.get(bet.clientUserId) ?? 0) + Number(bet.profitLoss))
    }
    for (const payment of allPayments) {
      if (!payment.clientUserId) continue
      paymentsByFriend.set(payment.clientUserId, (paymentsByFriend.get(payment.clientUserId) ?? 0) + Number(payment.amount))
    }

    const friendsWithBalance = links.map((link) => ({
      linkId: link.id,
      friend: link.friend,
      outstanding: (betPnlByFriend.get(link.friendId) ?? 0) - (paymentsByFriend.get(link.friendId) ?? 0),
    }))

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
