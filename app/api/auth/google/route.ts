import { NextRequest } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import prisma from '@/lib/db'
import { googleAuthSchema } from '@/lib/validators'
import { errorResponse, jsonResponse } from '@/lib/middleware'
import { ValidationError, AuthenticationError, handleError } from '@/lib/errors'
import { generateAccessToken, generateRefreshToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      console.error('[google-auth] GOOGLE_CLIENT_ID is not set')
      throw new Error('Google authentication is not configured')
    }

    const body = await request.json()

    const parsed = googleAuthSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { idToken } = parsed.data

    // Verify the Google ID token
    const client = new OAuth2Client(clientId)
    let ticket
    try {
      ticket = await client.verifyIdToken({ idToken, audience: clientId })
    } catch {
      throw new AuthenticationError('Invalid Google token. Please try again.')
    }

    const payload = ticket.getPayload()
    if (!payload || !payload.sub || !payload.email) {
      throw new AuthenticationError('Could not retrieve account details from Google.')
    }

    const { sub: googleId, email, name, email_verified } = payload
    if (!email_verified) {
      throw new AuthenticationError('Google account email is not verified.')
    }

    // 1. Existing user with this googleId
    let user = await prisma.user.findUnique({ where: { googleId } })

    if (user) {
      // Update email if it changed
      if (user.email !== email) {
        user = await prisma.user.update({ where: { id: user.id }, data: { email } })
      }
    } else {
      // 2. Existing user with this email — link the Google account
      user = await prisma.user.findUnique({ where: { email } })
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, emailVerified: true },
        })
      } else {
        // 3. New user — create account
        // phone is required and unique in schema; use placeholder for Google-only accounts
        const phonePlaceholder = `google_${googleId}`
        user = await prisma.user.create({
          data: {
            name: name ?? email.split('@')[0],
            email,
            phone: phonePlaceholder,
            password: '', // empty — cannot be used to log in via password route
            role: 'FRIEND',
            googleId,
            emailVerified: true,
          },
        })
      }
    }

    if (!user.isActive) {
      throw new AuthenticationError('This account is inactive.')
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
