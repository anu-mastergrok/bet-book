import bcrypt from 'bcryptjs'

/**
 * Generate a cryptographically random 6-digit OTP string.
 * Pads with leading zeros to always be exactly 6 digits.
 */
export function generateOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000)
  return String(n).padStart(6, '0')
}

/**
 * Hash the OTP for safe storage in the database.
 * Uses bcrypt with 10 rounds — same as passwords in this codebase.
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

/**
 * Verify a plain OTP against a stored bcrypt hash.
 */
export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}
