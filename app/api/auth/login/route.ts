import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { loginSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { AuthenticationError, AuthorizationError, ValidationError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { identifier, password } = parsed.data

    // Determine lookup strategy: 10-digit string = phone, otherwise = email
    const isPhone = /^\d{10}$/.test(identifier)
    const user = isPhone
      ? await prisma.user.findUnique({ where: { phone: identifier } })
      : await prisma.user.findUnique({ where: { email: identifier } })

    if (!user) {
      throw new AuthenticationError('Invalid credentials')
    }

    // Google-only accounts have no password — reject password login
    if (!user.password) {
      throw new AuthenticationError('This account uses Google Sign-In. Please use the Google button to log in.')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials')
    }

    if (!user.isActive) {
      throw new AuthenticationError('This account is inactive')
    }

    // Email-registered users must verify before logging in
    if (user.email && !user.googleId && !user.emailVerified) {
      throw new AuthorizationError('Please verify your email before logging in.')
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role, phone: user.phone })
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role, phone: user.phone })

    return jsonResponse({
      message: 'Login successful',
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
      tokens: { accessToken, refreshToken },
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
