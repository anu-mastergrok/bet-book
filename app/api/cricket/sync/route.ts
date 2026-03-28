import { NextRequest } from 'next/server'
import { authenticateRequest, requireRole, jsonResponse, errorResponse } from '@/lib/middleware'
import { runFullSync } from '@/lib/cricket-sync'
import { handleError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)
    // Fire and forget — sync runs in background
    runFullSync().catch(err => console.error('[cricket-sync] manual sync failed:', err))
    return jsonResponse({ success: true, message: 'Sync started' }, 202)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
