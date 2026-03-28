import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { seriesSchema } from '@/lib/validators'
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

    const parsed = seriesSchema.partial().safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const existing = await prisma.series.findUnique({ where: { id: params.id } })
    if (!existing) {
      throw new NotFoundError('Series not found')
    }

    const series = await prisma.series.update({
      where: { id: params.id },
      data: parsed.data,
      include: { matches: true },
    })

    return jsonResponse({ message: 'Series updated successfully', series })
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

    const existing = await prisma.series.findUnique({ where: { id: params.id } })
    if (!existing) {
      throw new NotFoundError('Series not found')
    }

    await prisma.series.delete({ where: { id: params.id } })

    return jsonResponse({ message: 'Series deleted successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
