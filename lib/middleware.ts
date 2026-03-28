import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, extractTokenFromHeader } from './auth'
import { AuthenticationError, AuthorizationError } from './errors'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string
    role: string
    phone: string
  }
}

export async function authenticateRequest(request: NextRequest) {
  const token = extractTokenFromHeader(request.headers.get('authorization') ?? undefined)
  
  if (!token) {
    throw new AuthenticationError('Missing authorization token')
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token')
  }

  return payload
}

export function requireRole(allowedRoles: string[]) {
  return (user: any) => {
    if (!allowedRoles.includes(user.role)) {
      throw new AuthorizationError('You do not have permission to access this resource')
    }
  }
}

export function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, statusCode: number = 500) {
  return NextResponse.json({ error: message }, { status: statusCode })
}
