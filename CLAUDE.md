# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint

# Database
npm run db:push      # Push schema to DB (no migration files)
npm run db:generate  # Regenerate Prisma Client after schema changes
npm run db:migrate   # Deploy migrations (production)
npm run db:seed      # Populate with test data

# Docker (full stack)
docker-compose up    # Starts PostgreSQL + app with auto db:push + seed
```

## Environment Variables

Required in `.env.local`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bet_book
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Architecture

**Stack:** Next.js 14 (App Router) + TypeScript + PostgreSQL + Prisma ORM + Tailwind CSS

**What it is:** A ledger platform for cricket/sports bookmakers to track bets with clients, calculate P&L, and manage settlements.

### Request Flow

1. Frontend uses `lib/api-client.ts` (singleton) — auto-attaches JWT from localStorage
2. API routes in `app/api/` call `authenticateRequest()` from `lib/middleware.ts` to validate JWT
3. Role check via `requireRole()` — ADMIN sees all data, USER sees only their own
4. Prisma queries via `lib/db.ts` (singleton to prevent hot-reload duplication)
5. Errors are thrown as typed classes from `lib/errors.ts` and handled centrally

### P&L Calculation

Core business logic in `lib/pnl.ts`:
- **Win:** `(betAmount × odds) - betAmount`
- **Loss:** `-betAmount`
- **Pending:** `0`

Settlement statuses: `pending` → `collected` | `settled` | `lost_in_another_match`

When `lost_in_another_match`, a `linkedMatchId` is required to track cross-match relationships.

### Auth Flow

- JWT access token (1hr) + refresh token (7d), both stored in localStorage
- Payload: `{ userId, role, phone }`
- `context/AuthContext.tsx` manages global auth state client-side
- Passwords hashed with bcryptjs

### Key Lib Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | JWT generation/verification |
| `lib/middleware.ts` | `authenticateRequest()`, `requireRole()` |
| `lib/validators.ts` | Zod schemas for all inputs |
| `lib/errors.ts` | `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError` |
| `lib/pnl.ts` | P&L calculation helpers |
| `lib/api-client.ts` | Frontend HTTP client |
| `lib/db.ts` | Prisma client singleton |

### Database Models

- **User** — phone (unique), role (ADMIN/USER), isActive
- **Series** — status: active/completed; has many Matches
- **Match** — teamA/teamB, status: upcoming/live/completed; belongs to Series
- **BetEntry** — core model; links Match + User (bookmaker) + optional client User; stores betAmount, odds, result, profitLoss, settlementStatus

### API Routes

All under `app/api/`. Protected routes require `Authorization: Bearer <token>` header.

- `POST /api/auth/register`, `POST /api/auth/login` — public
- `GET/POST /api/series`, `GET/POST /api/matches` — ADMIN write, authenticated read
- `GET/POST /api/bets` — authenticated; USER gets own bets only
- `PUT /api/bets/[id]/settlement` — update settlement status
- `GET /api/reports/pnl` — filtered P&L report
- `GET /api/admin/summary` — ADMIN only

### Frontend Pages

- `app/dashboard/` — User view: P&L overview with Recharts, bet list, new bet form
- `app/admin/` — Admin view: series/match management, all bets view
- `app/login/`, `app/register/` — Auth pages

### Demo Credentials (from seed)

- Admin: `9999999999` / `Admin@123456`
- User: `9876543210` / `User@12345`
