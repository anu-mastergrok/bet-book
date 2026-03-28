import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { clientPaymentSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    const { searchParams } = new URL(request.url)
    const clientName = searchParams.get('clientName')

    const where: any = { userId: user.userId }
    if (clientName) {
      where.clientName = clientName
    }

    const payments = await prisma.clientPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse({ payments })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    const body = await request.json()

    const parsed = clientPaymentSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const payment = await prisma.clientPayment.create({
      data: {
        userId: user.userId,
        clientName: parsed.data.clientName,
        amount: parsed.data.amount,
        method: parsed.data.method,
        upiRef: parsed.data.upiRef ?? null,
        note: parsed.data.note ?? null,
      },
    })

    return jsonResponse({ message: 'Payment recorded successfully', payment }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
