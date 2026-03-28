import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { seriesSchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    await authenticateRequest(request)

    const series = await prisma.series.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        matches: true,
      },
    })

    return jsonResponse({ series })
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
    const parsed = seriesSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const series = await prisma.series.create({
      data: parsed.data,
      include: {
        matches: true,
      },
    })

    return jsonResponse({ 
      message: 'Series created successfully',
      series 
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
