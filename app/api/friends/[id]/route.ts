import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, NotFoundError, AuthorizationError } from '@/lib/errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const link = await prisma.friendLink.findUnique({ where: { id: params.id } })
    if (!link) throw new NotFoundError('Friend link not found')
    if (link.userId !== user.userId) throw new AuthorizationError('Not your friend link')

    await prisma.friendLink.delete({ where: { id: params.id } })

    return jsonResponse({ message: 'Friend unlinked successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
