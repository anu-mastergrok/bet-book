import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { matchSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, NotFoundError, ValidationError } from '@/lib/errors'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const body = await request.json()

    const parsed = matchSchema.partial().safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const existing = await prisma.match.findUnique({ where: { id: params.id } })
    if (!existing) {
      throw new NotFoundError('Match not found')
    }

    const match = await prisma.match.update({
      where: { id: params.id },
      data: parsed.data,
      include: { series: true },
    })

    return jsonResponse({ message: 'Match updated successfully', match })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const existing = await prisma.match.findUnique({ where: { id: params.id } })
    if (!existing) {
      throw new NotFoundError('Match not found')
    }

    await prisma.match.delete({ where: { id: params.id } })

    return jsonResponse({ message: 'Match deleted successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
