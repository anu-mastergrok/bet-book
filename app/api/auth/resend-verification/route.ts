import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { resendVerificationSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { ValidationError, NotFoundError, handleError } from '@/lib/errors'
import { generateOtp, hashOtp } from '@/lib/otp'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = resendVerificationSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { email } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new NotFoundError('No account found with this email')
    }

    if (user.emailVerified) {
      throw new ValidationError('This email is already verified.')
    }

    // Rate limit: only allow resend if last OTP was sent more than 60 seconds ago
    if (user.verificationExpiry) {
      const otpAge = Date.now() - (user.verificationExpiry.getTime() - 10 * 60 * 1000)
      if (otpAge < 60 * 1000) {
        throw new ValidationError('Please wait before requesting a new code.')
      }
    }

    const otp = generateOtp()
    const tokenHash = await hashOtp(otp)
    const expiry = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: tokenHash, verificationExpiry: expiry },
    })

    await sendVerificationEmail(email, otp)

    return jsonResponse({ success: true, message: 'Verification code sent' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
