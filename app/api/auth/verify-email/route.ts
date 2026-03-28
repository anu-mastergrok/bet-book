import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { verifyEmailSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { ValidationError, NotFoundError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { verifyOtp } from '@/lib/otp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = verifyEmailSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { email, otp } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new NotFoundError('No account found with this email')
    }

    if (user.emailVerified) {
      // Already verified — just return tokens so the UI can redirect
      const accessToken = generateAccessToken({ userId: user.id, role: user.role, phone: user.phone })
      const refreshToken = generateRefreshToken({ userId: user.id, role: user.role, phone: user.phone })
      return jsonResponse({
        message: 'Email already verified',
        user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
        tokens: { accessToken, refreshToken },
      })
    }

    if (!user.verificationToken || !user.verificationExpiry) {
      throw new ValidationError('No verification code found. Please request a new one.')
    }

    if (new Date() > user.verificationExpiry) {
      throw new ValidationError('Code expired. Please request a new one.')
    }

    const isValid = await verifyOtp(otp, user.verificationToken)
    if (!isValid) {
      throw new ValidationError('Invalid code. Please try again.')
    }

    // Mark verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationExpiry: null },
    })

    const accessToken = generateAccessToken({ userId: user.id, role: user.role, phone: user.phone })
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role, phone: user.phone })

    return jsonResponse({
      message: 'Email verified successfully',
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
      tokens: { accessToken, refreshToken },
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
