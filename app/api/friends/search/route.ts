import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    if (q.length < 2) {
      return jsonResponse({ users: [] })
    }

    const users = await prisma.user.findMany({
      where: {
        role: 'FRIEND',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, phone: true },
      take: 10,
    })

    return jsonResponse({ users })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
