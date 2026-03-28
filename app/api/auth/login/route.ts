import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { loginSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { AuthenticationError, ValidationError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { phone, password } = parsed.data

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone },
    })

    if (!user) {
      throw new AuthenticationError('Invalid phone or password')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid phone or password')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError('This account is inactive')
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
      phone: user.phone,
    })

    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
      phone: user.phone,
    })

    return jsonResponse({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
