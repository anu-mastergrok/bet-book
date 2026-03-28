import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { matchSchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    await authenticateRequest(request)

    const { searchParams } = new URL(request.url)
    const seriesId = searchParams.get('seriesId')
    const activated = searchParams.get('activated')

    const where: Record<string, unknown> = {}
    if (seriesId) where.seriesId = seriesId
    if (activated === 'true') where.isActivated = true
    else if (activated === 'false') where.isActivated = false

    const matches = await prisma.match.findMany({
      where,
      orderBy: { matchDate: 'desc' },
      include: {
        series: true,
      },
    })

    return jsonResponse({ matches })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const body = await request.json()

    // Validate input
    const parsed = matchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const match = await prisma.match.create({
      data: { ...parsed.data, isActivated: true },
      include: {
        series: true,
      },
    })

    return jsonResponse({
      message: 'Match created successfully',
      match,
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
