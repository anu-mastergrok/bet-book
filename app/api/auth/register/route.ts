import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { registerSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { ConflictError, ValidationError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { generateOtp, hashOtp } from '@/lib/otp'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { name, phone, password, email } = parsed.data
    const normalizedEmail = email && email.length > 0 ? email : null

    // Check for duplicate phone or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phone }, { email: normalizedEmail ?? undefined }],
      },
    })
    if (existingUser) {
      throw new ConflictError('User with this phone or email already exists')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // If email provided: create with emailVerified=false, send OTP
    if (normalizedEmail) {
      const otp = generateOtp()
      const tokenHash = await hashOtp(otp)
      const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

      await prisma.user.create({
        data: {
          name,
          phone,
          email: normalizedEmail,
          password: hashedPassword,
          role: 'FRIEND',
          emailVerified: false,
          verificationToken: tokenHash,
          verificationExpiry: expiry,
        },
      })

      await sendVerificationEmail(normalizedEmail, otp)

      return jsonResponse({ requiresVerification: true, email: normalizedEmail }, 201)
    }

    // No email: register immediately, return tokens (existing behaviour)
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: null,
        password: hashedPassword,
        role: 'FRIEND',
        emailVerified: true,
      },
    })

    const accessToken = generateAccessToken({ userId: user.id, role: user.role, phone: user.phone })
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role, phone: user.phone })

    return jsonResponse({
      message: 'User registered successfully',
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
      tokens: { accessToken, refreshToken },
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
