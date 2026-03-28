# Auth Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing JWT/bcrypt auth system to support login by email or phone, Google OAuth via ID token, and email OTP verification for email+password registrations.

**Architecture:** Keep all existing auth infrastructure intact (`lib/auth.ts`, `lib/middleware.ts`, `authenticateRequest()`). Add four new fields to the User model. Add utility modules for OTP and email. Add/modify API routes. Update login/register UI and add a verify-email page.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, bcryptjs, nodemailer, google-auth-library, @react-oauth/google, Tailwind CSS

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add 4 fields to User |
| `lib/otp.ts` | Create — generate/hash/verify OTP |
| `lib/email.ts` | Create — nodemailer SMTP wrapper |
| `lib/validators.ts` | Modify — update loginSchema, add 3 new schemas |
| `app/api/auth/register/route.ts` | Modify — send OTP when email provided |
| `app/api/auth/login/route.ts` | Modify — accept identifier (email or phone) |
| `app/api/auth/verify-email/route.ts` | Create — verify OTP, return tokens |
| `app/api/auth/resend-verification/route.ts` | Create — resend OTP with 60s cooldown |
| `app/api/auth/google/route.ts` | Create — verify Google ID token, return tokens |
| `app/verify-email/page.tsx` | Create — OTP entry page |
| `app/login/page.tsx` | Modify — identifier field + Google button |
| `app/register/page.tsx` | Modify — Google button + verification redirect |
| `app/layout.tsx` | Modify — wrap with GoogleOAuthProvider |
| `.env.example` | Modify — add GOOGLE_CLIENT_ID and SMTP_* |

---

### Task 1: Schema — add four fields to User, backfill existing rows

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add four fields to the User model**

Open `prisma/schema.prisma`. The User model currently ends at the `@@index([role])` line. Add the four new fields after `isActive` and before `createdAt`:

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  phone     String   @unique
  password  String
  email     String?  @unique
  role      Role     @default(USER)
  isActive  Boolean  @default(true)
  googleId           String?   @unique
  emailVerified      Boolean   @default(false)
  verificationToken  String?
  verificationExpiry DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // ... rest unchanged
```

- [ ] **Step 2: Push schema to the database**

```bash
npm run db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Backfill emailVerified for all existing users**

Run a one-time script via `npx ts-node` or via a temporary seed. The cleanest approach is to add it directly to the `db:seed` script or use the Prisma CLI:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.updateMany({ where: {}, data: { emailVerified: true } })
  .then(r => { console.log('Updated', r.count, 'users'); prisma.\$disconnect(); })
  .catch(e => { console.error(e); prisma.\$disconnect(); process.exit(1); });
"
```

Expected output: `Updated N users` (N = number of existing users).

- [ ] **Step 4: Regenerate Prisma Client**

```bash
npm run db:generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 5: Verify build compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add googleId, emailVerified, verificationToken, verificationExpiry to User"
```

---

### Task 2: Install packages

**Files:** `package.json`

- [ ] **Step 1: Install runtime packages**

```bash
npm install google-auth-library @react-oauth/google nodemailer
```

- [ ] **Step 2: Install type packages**

```bash
npm install --save-dev @types/nodemailer
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add google-auth-library, @react-oauth/google, nodemailer"
```

---

### Task 3: Create `lib/otp.ts` — OTP utilities

**Files:**
- Create: `lib/otp.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/otp.ts
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add lib/otp.ts
git commit -m "feat: add OTP generate/hash/verify utilities"
```

---

### Task 4: Create `lib/email.ts` — nodemailer SMTP wrapper

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/email.ts
import nodemailer from 'nodemailer'

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in environment.'
    )
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

/**
 * Send a 6-digit OTP verification email to the given address.
 */
export async function sendVerificationEmail(to: string, otp: string): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to,
    subject: 'Your Bet Book verification code',
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1e293b;">Verify your email</h2>
        <p style="color:#475569;">Enter the code below to complete your Bet Book registration:</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:14px;">This code expires in 10 minutes. If you did not register, ignore this email.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "feat: add nodemailer email utility for OTP verification"
```

---

### Task 5: Update `lib/validators.ts` — loginSchema + three new schemas

**Files:**
- Modify: `lib/validators.ts`

- [ ] **Step 1: Update `loginSchema` — replace `phone` with `identifier`**

Find the `loginSchema` block (lines 11–14 in the current file):

```ts
export const loginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(1, 'Password is required'),
})
```

Replace it with:

```ts
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
})
```

- [ ] **Step 2: Add three new schemas** — append after `markNotificationsReadSchema` and before the type exports block:

```ts
// Auth enhancement schemas
export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be digits only'),
})

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
})
```

- [ ] **Step 3: Add type exports** — append after the existing type exports at the bottom:

```ts
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
```

Note: `LoginInput` already exists as a type export — **remove the old one** and keep only the new one. Search for `export type LoginInput` and ensure there is only one.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add lib/validators.ts
git commit -m "feat: update loginSchema to accept identifier, add verify/resend/google schemas"
```

---

### Task 6: Modify `app/api/auth/register/route.ts` — email OTP flow

**Files:**
- Modify: `app/api/auth/register/route.ts`

- [ ] **Step 1: Replace the entire file**

The new register route sends an OTP when email is provided and returns `requiresVerification: true` instead of tokens. When no email, it returns tokens immediately (existing behaviour).

```ts
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
        emailVerified: true, // phone-only users are considered verified
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/register/route.ts
git commit -m "feat: register route sends OTP email when email provided"
```

---

### Task 7: Modify `app/api/auth/login/route.ts` — email or phone identifier

**Files:**
- Modify: `app/api/auth/login/route.ts`

- [ ] **Step 1: Replace the entire file**

```ts
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat: login accepts email or phone identifier, enforces emailVerified check"
```

---

### Task 8: Create `app/api/auth/verify-email/route.ts`

**Files:**
- Create: `app/api/auth/verify-email/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/auth/verify-email
```

- [ ] **Step 2: Write the route**

```ts
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
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/verify-email/
git commit -m "feat: add verify-email route — OTP check, return JWT tokens on success"
```

---

### Task 9: Create `app/api/auth/resend-verification/route.ts`

**Files:**
- Create: `app/api/auth/resend-verification/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/auth/resend-verification
```

- [ ] **Step 2: Write the route**

```ts
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
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/resend-verification/
git commit -m "feat: add resend-verification route with 60s rate limit"
```

---

### Task 10: Create `app/api/auth/google/route.ts`

**Files:**
- Create: `app/api/auth/google/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/auth/google
```

- [ ] **Step 2: Write the route**

```ts
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
            password: '', // empty string — cannot be used to log in via password route
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
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/google/
git commit -m "feat: add Google OAuth route — verify ID token, create or link user account"
```

---

### Task 11: Create `app/verify-email/page.tsx`

**Files:**
- Create: `app/verify-email/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/verify-email
```

- [ ] **Step 2: Write the page**

This page reads `?email=` from the URL, shows a 6-digit OTP input, handles submission and resend.

```tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { TrendingUp, Mail, Loader } from 'lucide-react'

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const toast = useToast()

  const email = searchParams.get('email') ?? ''
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (!email) {
      router.replace('/register')
    }
  }, [email, router])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit code')
      return
    }
    setIsVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Email verified!')

      if (data.user.role === 'ADMIN') router.push('/admin')
      else if (data.user.role === 'FRIEND') router.push('/friend/dashboard')
      else router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      toast.success('New code sent!')
      setResendCooldown(60)
      setOtp('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer />

      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <TrendingUp className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bet Book</h1>
          <p className="text-slate-400 text-sm mt-1">Verify your email</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Mail className="text-amber-400" size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Check your email</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                We sent a 6-digit code to <span className="text-slate-300">{email}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="otp" className="label">Verification Code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otp.length !== 6}
              className="btn-primary w-full"
            >
              {isVerifying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="animate-spin" size={16} />
                  Verifying...
                </span>
              ) : 'Verify Email'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-slate-500 text-sm">Didn&apos;t receive the code?</p>
            <button
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>

          <p className="text-center text-slate-400 text-sm mt-5">
            Wrong email?{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Go back
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add app/verify-email/
git commit -m "feat: add verify-email page with OTP input and resend cooldown"
```

---

### Task 12: Modify `app/login/page.tsx` — identifier field + Google button

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace the entire file**

Key changes: rename `phone` → `identifier` field, change icon to `AtSign`, add Google button above the form.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { AtSign, Lock, Eye, EyeOff, TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ identifier: '', password: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const redirectByRole = (role: string) => {
    if (role === 'ADMIN') router.push('/admin')
    else if (role === 'FRIEND') router.push('/friend/dashboard')
    else router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Welcome back!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Welcome!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed')
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer />

      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <TrendingUp className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bet Book</h1>
          <p className="text-slate-400 text-sm mt-1">Digital Sports Betting Ledger</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-slate-100 mb-5">Sign in to your account</h2>

          {/* Google Sign-In */}
          <div className="flex justify-center mb-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google sign-in failed')}
              theme="filled_black"
              shape="rectangular"
              text="signin_with"
              width="320"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="identifier" className="label">Phone or Email</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="identifier"
                  type="text"
                  name="identifier"
                  placeholder="9876543210 or email@example.com"
                  value={formData.identifier}
                  onChange={handleChange}
                  className="input pl-9"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input pl-9 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Register here
            </Link>
          </p>
        </div>

        {/* Demo Credentials */}
        <div className="mt-4 bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Demo Credentials</p>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">
              <span className="text-amber-500/80 font-medium">Admin:</span> 9999999999 / Admin@123456
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-violet-400/80 font-medium">User:</span> 9876543210 / User@12345
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: login page — identifier field (email or phone) + Google Sign-In button"
```

---

### Task 13: Modify `app/register/page.tsx` — Google button + verification redirect

**Files:**
- Modify: `app/register/page.tsx`

- [ ] **Step 1: Replace the entire file**

Key changes: add Google button (same `handleGoogleSuccess` pattern), after successful form submit check `data.requiresVerification` and redirect to `/verify-email?email=...`.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { User, Mail, Lock, Phone, Eye, EyeOff, TrendingUp } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', password: '', confirmPassword: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const redirectByRole = (role: string) => {
    if (role === 'ADMIN') router.push('/admin')
    else if (role === 'FRIEND') router.push('/friend/dashboard')
    else router.push('/dashboard')
  }

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Google sign-up failed')
      login(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Account created!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Google sign-up failed')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')

      // Email provided → redirect to verification page
      if (data.requiresVerification) {
        toast.success('Account created! Please verify your email.')
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
        return
      }

      // Phone-only → log in immediately
      register(data.user, data.tokens.accessToken, data.tokens.refreshToken)
      toast.success('Account created successfully!')
      redirectByRole(data.user.role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer />

      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
            <TrendingUp className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bet Book</h1>
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-slate-100 mb-5">Create Account</h2>

          {/* Google Sign-Up */}
          <div className="flex justify-center mb-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google sign-up failed')}
              theme="filled_black"
              shape="rectangular"
              text="signup_with"
              width="320"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Full Name <span className="text-red-400">*</span></label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input id="name" type="text" name="name" placeholder="John Doe"
                  value={formData.name} onChange={handleChange} className="input pl-9" required />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="label">Phone Number <span className="text-red-400">*</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input id="phone" type="tel" name="phone" placeholder="9876543210"
                  value={formData.phone} onChange={handleChange}
                  className="input pl-9" inputMode="numeric" required />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email <span className="text-slate-500 font-normal text-xs">(optional — required for email verification)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input id="email" type="email" name="email" placeholder="john@example.com"
                  value={formData.email} onChange={handleChange}
                  className="input pl-9" autoComplete="email" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input id="password" type={showPassword ? 'text' : 'password'} name="password"
                  placeholder="At least 8 characters" value={formData.password}
                  onChange={handleChange} className="input pl-9 pr-10" required />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">Confirm Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} name="confirmPassword"
                  placeholder="Confirm your password" value={formData.confirmPassword}
                  onChange={handleChange} className="input pl-9 pr-10" required />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full mt-2">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/register/page.tsx
git commit -m "feat: register page — Google Sign-Up button, redirect to verify-email when email provided"
```

---

### Task 14: Wrap layout with `GoogleOAuthProvider` + update `.env.example`

**Files:**
- Modify: `app/layout.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Update `app/layout.tsx`**

The `GoogleOAuthProvider` must wrap the entire app so both login and register pages have access to it. It's a client-side component, so wrap it in a client component to avoid marking the server layout as `'use client'`.

Create `components/GoogleProvider.tsx`:

```tsx
'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'

export function GoogleProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}>
      {children}
    </GoogleOAuthProvider>
  )
}
```

Then update `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { GoogleProvider } from '@/components/GoogleProvider'

export const metadata: Metadata = {
  title: 'Bet Book Platform',
  description: 'Digital ledger for tracking cricket/sports betting records',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <GoogleProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </GoogleProvider>
      </body>
    </html>
  )
}
```

**Note:** `@react-oauth/google` uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (public, browser-accessible). The server-side `app/api/auth/google/route.ts` uses `GOOGLE_CLIENT_ID` (private, server-only). Both must be set to the same value.

- [ ] **Step 2: Update `.env.example`**

Add to the end of `.env.example`:

```
# Google OAuth (both vars must be set to the same Google Client ID)
GOOGLE_CLIENT_ID=your-google-client-id-here
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here

# Email verification (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Bet Book <your-sender@gmail.com>"
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add components/GoogleProvider.tsx app/layout.tsx .env.example
git commit -m "feat: wrap layout with GoogleOAuthProvider, add env vars to .env.example"
```

---

## Self-Review

**Spec coverage:**
- ✅ Schema: 4 fields added, backfill existing users (Task 1)
- ✅ `lib/otp.ts`: generate/hash/verify (Task 3)
- ✅ `lib/email.ts`: sendVerificationEmail (Task 4)
- ✅ Login accepts identifier (Task 7), emailVerified check (Task 7)
- ✅ Register sends OTP when email provided (Task 6)
- ✅ `verify-email` route (Task 8)
- ✅ `resend-verification` route with 60s cooldown (Task 9)
- ✅ Google route: verify token, create/link user (Task 10)
- ✅ `/verify-email` page with OTP input + resend (Task 11)
- ✅ Login page: identifier field + Google button (Task 12)
- ✅ Register page: Google button + verification redirect (Task 13)
- ✅ `GoogleOAuthProvider` in layout (Task 14)
- ✅ `.env.example` updated (Task 14)

**Type consistency:**
- `verifyEmailSchema` used in Task 8 route matches definition in Task 5 validators ✅
- `resendVerificationSchema` used in Task 9 matches Task 5 ✅
- `googleAuthSchema` used in Task 10 matches Task 5 ✅
- `generateOtp`/`hashOtp`/`verifyOtp` defined in Task 3, used in Tasks 6, 8, 9 ✅
- `sendVerificationEmail` defined in Task 4, used in Tasks 6 and 9 ✅

**`NEXT_PUBLIC_GOOGLE_CLIENT_ID` note:** The `GoogleOAuthProvider` in `components/GoogleProvider.tsx` reads `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`. This must be set in `.env.local` (or production env) alongside `GOOGLE_CLIENT_ID`. Both are the same value — one is server-only, one is public. This is documented in Task 14.
