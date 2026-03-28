import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, NotFoundError, AuthorizationError } from '@/lib/errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)

    const existing = await prisma.clientPayment.findUnique({ where: { id: params.id } })
    if (!existing) {
      throw new NotFoundError('Payment not found')
    }

    if (existing.userId !== user.userId) {
      throw new AuthorizationError('You can only delete your own payment records')
    }

    await prisma.clientPayment.delete({ where: { id: params.id } })

    return jsonResponse({ message: 'Payment deleted successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
