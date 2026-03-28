# Auth Enhancements — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

Extend the existing custom JWT/bcrypt authentication system with three additions:
1. Login accepts email **or** phone as the identifier
2. Google OAuth ("Sign in with Google") via ID token verification
3. Email OTP verification for email+password registrations

All existing auth infrastructure (`lib/auth.ts`, `lib/middleware.ts`, `authenticateRequest()`, `AuthContext`, all API route auth checks) is preserved unchanged. Only the login/register routes, UI pages, and data model are extended.

---

## 1. Data Model Changes

### `User` — add four fields

```prisma
googleId           String?   @unique   // Google account link; null for password-only users
emailVerified      Boolean   @default(false)  // true after OTP confirmed or Google sign-in
verificationToken  String?   // bcrypt hash of the 6-digit OTP (cleared after use)
verificationExpiry DateTime? // OTP expires 10 minutes after generation
```

**Migration behaviour:**
- All existing rows get `emailVerified = true` via `updateMany({ where: {}, data: { emailVerified: true } })` in a seed/migration step — no existing user is locked out.
- `googleId`, `verificationToken`, `verificationExpiry` default to `null` for all existing rows.
- Phone-only users (`email = null`) are never subject to the `emailVerified` check — the login route only enforces verification for users whose `email` is set and who have no `googleId`.

---

## 2. New Library Files

### `lib/email.ts`
Thin nodemailer wrapper. Reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` from environment. Exports one function:

```ts
sendVerificationEmail(to: string, otp: string): Promise<void>
```

Throws if SMTP env vars are missing. The OTP email is plain-text with subject "Your verification code" and body "Your code is: XXXXXX — expires in 10 minutes."

### `lib/otp.ts`
Exports two functions:

```ts
generateOtp(): string           // returns a random 6-digit string e.g. "482913"
hashOtp(otp: string): Promise<string>   // bcrypt hash with 10 rounds
verifyOtp(otp: string, hash: string): Promise<boolean>  // bcrypt compare
```

---

## 3. Modified API Routes

### `POST /api/auth/register` (modified)

New behaviour when `email` is provided:
1. Create user with `emailVerified: false`
2. Generate OTP via `generateOtp()`, hash via `hashOtp()`
3. Store `verificationToken` (hash) and `verificationExpiry` (now + 10 min) on the user
4. Send email via `sendVerificationEmail()`
5. Return `{ requiresVerification: true, email }` — **no tokens yet**

Existing behaviour when no email (phone-only registration): unchanged — returns tokens immediately.

If SMTP is not configured and email was provided: return a 500 with a clear server-side log. Do not silently skip verification.

### `POST /api/auth/login` (modified)

Input schema changes: `phone` field renamed to `identifier` (accepts phone number or email).

```ts
loginSchema = z.object({
  identifier: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
})
```

Lookup logic:
- If `identifier` matches `/^\d{10}$/` → find user by `phone`
- Otherwise → find user by `email`

Additional check after password validation:
- If `user.email` is set AND `user.googleId` is null AND `user.emailVerified === false` → return 403 `{ error: 'Please verify your email before logging in.' }`

All other login behaviour unchanged.

---

## 4. New API Routes

### `POST /api/auth/verify-email`

Request body: `{ email: string, otp: string }`

1. Find user by email
2. Check `verificationExpiry` — if expired, return 400 `{ error: 'Code expired. Please request a new one.' }`
3. Verify OTP via `verifyOtp(otp, user.verificationToken)`  — if wrong, return 400 `{ error: 'Invalid code.' }`
4. Update user: `emailVerified: true`, `verificationToken: null`, `verificationExpiry: null`
5. Return JWT access + refresh tokens (same shape as login success)

### `POST /api/auth/resend-verification`

Request body: `{ email: string }`

1. Find user by email
2. If `emailVerified === true` → return 400 `{ error: 'Email already verified.' }`
3. If `verificationExpiry` is set and is less than 60 seconds ago → return 429 `{ error: 'Please wait before requesting a new code.' }`
4. Generate new OTP, hash, store, send email
5. Return `{ success: true }`

### `POST /api/auth/google`

Request body: `{ idToken: string }`

Uses `google-auth-library` (`OAuth2Client.verifyIdToken()`) to verify the token against `GOOGLE_CLIENT_ID`.

Extracted from verified token: `sub` (Google user ID), `email`, `name`, `email_verified`.

Lookup logic:
1. Find user by `googleId = sub` — if found, return JWT tokens
2. Find user by `email` — if found, update `googleId = sub`, set `emailVerified: true`, return JWT tokens
3. Neither found → create new user: `name`, `email`, `googleId`, `emailVerified: true`, `password = ""` (empty string — can never be used to log in via password route), `phone` set to empty string temporarily...

**Note on `phone` uniqueness:** The `phone` field is `String @unique` and required in the schema. For Google-only users who have no phone, store a placeholder: `google_<googleId>`. This keeps the unique constraint satisfied without requiring a schema change. A future improvement can make `phone` optional.

Returns JWT access + refresh tokens.

---

## 5. New UI Pages & Modified Pages

### `app/verify-email/page.tsx` (new)

- Reads `email` from query param (`?email=...`)
- Shows: "We sent a 6-digit code to `email`"
- OTP input (single 6-digit field or 6 individual digit inputs)
- Submit button calls `POST /api/auth/verify-email`
- "Resend code" link — disabled for 60s after page load / last send, then calls `POST /api/auth/resend-verification`
- On success: redirects to `/dashboard` (role determined from returned JWT)
- On error: shows toast with the error message

### `app/login/page.tsx` (modified)

- "Phone" label/input → "Phone or Email" (type `text`, not `tel`)
- Add "Continue with Google" button above the form
- Add divider ("— or —") between Google button and form
- Google button uses `@react-oauth/google`'s `GoogleLogin` component with `onSuccess` callback that sends `credentialResponse.credential` (the ID token) to `POST /api/auth/google`
- Wrap app root (or just auth pages) with `GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}`

### `app/register/page.tsx` (modified)

- Add "Continue with Google" button + divider (same as login)
- After successful form submission when `requiresVerification: true`: redirect to `/verify-email?email=<email>`
- When `requiresVerification: false` (phone-only): existing redirect behaviour unchanged

### `context/AuthContext.tsx` (check only)

No changes needed — `login()` stores tokens and user data; the Google flow returns the same shape.

---

## 6. Environment Variables

Added to `.env.example`:

```
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here

# Email (SMTP) — for OTP verification emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Bet Book <your-sender@gmail.com>"
```

App behaviour when vars are missing:
- `GOOGLE_CLIENT_ID` missing: `POST /api/auth/google` returns 500 with log
- SMTP vars missing: `POST /api/auth/register` (with email) returns 500 with log

---

## 7. New Packages

| Package | Purpose |
|---------|---------|
| `google-auth-library` | Server-side Google ID token verification |
| `@react-oauth/google` | Frontend Google Sign-In button component |
| `nodemailer` | SMTP email sending |
| `@types/nodemailer` | TypeScript types |

All are open source (MIT/Apache).

---

## 8. Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `googleId`, `emailVerified`, `verificationToken`, `verificationExpiry` to User |
| `lib/email.ts` | New — nodemailer wrapper |
| `lib/otp.ts` | New — OTP generate/hash/verify |
| `lib/validators.ts` | Update `loginSchema` (identifier instead of phone) |
| `app/api/auth/register/route.ts` | Modified — email verification flow |
| `app/api/auth/login/route.ts` | Modified — email/phone identifier, emailVerified check |
| `app/api/auth/verify-email/route.ts` | New |
| `app/api/auth/resend-verification/route.ts` | New |
| `app/api/auth/google/route.ts` | New |
| `app/login/page.tsx` | Modified — Google button, identifier field |
| `app/register/page.tsx` | Modified — Google button, verification redirect |
| `app/verify-email/page.tsx` | New |
| `.env.example` | Add GOOGLE_CLIENT_ID, SMTP_* vars |

---

## 9. Implementation Order

1. Schema — add fields, migration sets `emailVerified = true` for existing rows
2. `lib/otp.ts` + `lib/email.ts` — utility functions
3. Modified `register` + `login` routes
4. New `verify-email` + `resend-verification` routes
5. New `google` route
6. UI — `app/verify-email/page.tsx` (new), update `login` + `register` pages
