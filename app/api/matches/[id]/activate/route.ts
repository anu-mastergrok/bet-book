import { NextRequest } from 'next/server'
import { authenticateRequest, requireRole, jsonResponse, errorResponse } from '@/lib/middleware'
import prisma from '@/lib/db'
import { handleError, NotFoundError } from '@/lib/errors'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const match = await prisma.match.findUnique({ where: { id: params.id } })
    if (!match) throw new NotFoundError('Match not found')

    const updated = await prisma.match.update({
      where: { id: params.id },
      data: { isActivated: true },
    })

    return jsonResponse({ match: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
