import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { markNotificationsReadSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    const notifications = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: user.userId, read: false },
    })

    return jsonResponse({ notifications, unreadCount })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()

    const parsed = markNotificationsReadSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const where: any = { userId: user.userId, read: false }
    if (parsed.data.ids && parsed.data.ids.length > 0) {
      where.id = { in: parsed.data.ids }
    }

    await prisma.notification.updateMany({ where, data: { read: true } })

    return jsonResponse({ message: 'Notifications marked as read' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
