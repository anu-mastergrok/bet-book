import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { clientPaymentSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

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

    const { clientName, clientUserId, amount, method, upiRef, note } = parsed.data

    // Save the payment record
    const payment = await prisma.clientPayment.create({
      data: {
        userId: user.userId,
        clientName,
        clientUserId: clientUserId ?? null,
        amount,
        method,
        upiRef: upiRef ?? null,
        note: note ?? null,
      },
    })

    // Bulk allocation: settle oldest pending bets for this friend
    const betWhere: any = {
      userId: user.userId,
      settlementStatus: 'pending',
    }
    if (clientUserId) {
      betWhere.clientUserId = clientUserId
    } else {
      betWhere.clientName = clientName
    }

    const pendingBets = await prisma.betEntry.findMany({
      where: betWhere,
      orderBy: { createdAt: 'asc' },
      include: { match: true },
    })

    let remaining = amount
    const settledBetIds: string[] = []

    for (const bet of pendingBets) {
      if (remaining <= 0) break

      await prisma.betEntry.update({
        where: { id: bet.id },
        data: { settlementStatus: 'settled', paymentMethod: method },
      })

      settledBetIds.push(bet.id)

      // Notify the friend for each settled bet (non-critical)
      if (bet.clientUserId) {
        const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
        try {
          await createNotification(
            bet.clientUserId,
            'Payment recorded',
            `A payment of ₹${amount.toLocaleString('en-IN')} has been recorded. ${matchLabel} bet marked as settled.`,
            `/friend/bets`
          )
        } catch {
          // Non-critical
        }
      }

      remaining -= Math.abs(Number(bet.profitLoss))
    }

    return jsonResponse({
      message: 'Payment recorded successfully',
      payment,
      settledBets: settledBetIds.length,
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
