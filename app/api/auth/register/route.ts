import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { registerSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { ConflictError, ValidationError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { name, phone, password, email } = parsed.data

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phone }, { email: email && email.length > 0 ? email : undefined }],
      },
    })

    if (existingUser) {
      throw new ConflictError('User with this phone or email already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email && email.length > 0 ? email : null,
        password: hashedPassword,
        role: 'FRIEND',
      },
    })

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
      message: 'User registered successfully',
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
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
