# Personal Bet Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Bet Book from a bookmaker ledger into a personal cricket bet tracker where friends/family have their own accounts, can view bets, confirm settlements, dispute entries, and receive reminders.

**Architecture:** Add a `FRIEND` role to the existing USER/ADMIN system. New registrations default to FRIEND. Two new DB models (`FriendLink`, `Notification`) plus four new fields on `BetEntry` handle linking, notifications, and dispute tracking. Bulk payment allocation auto-settles oldest pending bets first. Friend-facing pages live under `/friend/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma ORM, PostgreSQL, Tailwind CSS, Zod, Lucide icons

> **Note on testing:** No test framework is configured in this repo. Each API task is verified with `curl`. Each UI task is verified by running the dev server and checking the browser.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add FRIEND role, FriendLink, Notification, BetEntry fields |
| `lib/validators.ts` | Modify | Add FriendLink, dispute, assign, notification schemas |
| `lib/notifications.ts` | Create | `createNotification()` helper |
| `app/api/auth/register/route.ts` | Modify | Default role to FRIEND |
| `app/api/auth/login/route.ts` | Read only | No change needed |
| `context/AuthContext.tsx` | Modify | Redirect FRIEND to /friend/dashboard |
| `app/login/page.tsx` | Modify | Redirect FRIEND to /friend/dashboard after login |
| `app/register/page.tsx` | Modify | Redirect FRIEND to /friend/dashboard after register |
| `app/api/friends/route.ts` | Create | GET list + POST link |
| `app/api/friends/search/route.ts` | Create | GET search FRIEND accounts |
| `app/api/friends/[id]/route.ts` | Create | DELETE unlink |
| `app/api/notifications/route.ts` | Create | GET list + PATCH mark read |
| `app/api/bets/route.ts` | Modify | FRIEND filter + notification on POST |
| `app/api/bets/[id]/settlement/route.ts` | Modify | Notification on settlement update |
| `app/api/bets/[id]/assign/route.ts` | Create | PATCH retroactive friend assignment |
| `app/api/bets/[id]/confirm/route.ts` | Create | PATCH friend confirms settlement |
| `app/api/bets/[id]/dispute/route.ts` | Create | PATCH friend opens dispute |
| `app/api/bets/[id]/resolve/route.ts` | Create | PATCH owner resolves dispute |
| `app/api/client-payments/route.ts` | Modify | Bulk allocation on POST |
| `app/api/series/[id]/summary/route.ts` | Create | GET series P&L summary |
| `app/friend/layout.tsx` | Create | FRIEND-protected layout with bottom nav |
| `app/friend/dashboard/page.tsx` | Create | Friend summary bar + bets grouped by series/match |
| `app/friend/bets/page.tsx` | Create | Full friend bet list with confirm/dispute |
| `app/friend/notifications/page.tsx` | Create | Friend notification list |
| `components/NotificationBell.tsx` | Create | Bell icon + unread badge |
| `app/dashboard/friends/page.tsx` | Create | Owner friends list, link, record payment |
| `app/dashboard/series/[id]/page.tsx` | Create | Series P&L: per-match, payments, by-friend tabs |

---

## Task 1: Schema — Add FRIEND role, FriendLink, Notification, BetEntry fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add FRIEND to Role enum**

In `prisma/schema.prisma`, change:
```prisma
enum Role {
  USER
  ADMIN
}
```
to:
```prisma
enum Role {
  USER
  FRIEND
  ADMIN
}
```

- [ ] **Step 2: Add FriendLink model after the User model**

```prisma
model FriendLink {
  id        String   @id @default(cuid())
  userId    String
  friendId  String
  createdAt DateTime @default(now())

  user   User @relation("UserFriends", fields: [userId], references: [id], onDelete: Cascade)
  friend User @relation("FriendOf", fields: [friendId], references: [id], onDelete: Cascade)

  @@unique([userId, friendId])
  @@index([userId])
  @@index([friendId])
}
```

- [ ] **Step 3: Add Notification model**

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  title     String
  body      String
  read      Boolean  @default(false)
  link      String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([read])
}
```

- [ ] **Step 4: Add new fields to BetEntry model**

Inside the `model BetEntry` block, add these four fields after `paymentNote`:
```prisma
  confirmedByFriend  Boolean   @default(false)
  disputeStatus      String?
  disputeNote        String?
  disputeResolvedAt  DateTime?
```

- [ ] **Step 5: Add relations to User model**

Inside `model User`, add after `clientPayments`:
```prisma
  friendLinks    FriendLink[]   @relation("UserFriends")
  friendOf       FriendLink[]   @relation("FriendOf")
  notifications  Notification[]
```

- [ ] **Step 6: Add `clientUserId` to `ClientPayment` model**

Inside `model ClientPayment`, add after `clientName`:
```prisma
  clientUserId  String?
```

This field is used by the friends list API to aggregate outstanding balances per linked friend.

- [ ] **Step 7: Push schema to DB**

```bash
npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add FRIEND role, FriendLink, Notification, BetEntry dispute fields, ClientPayment.clientUserId"
```

---

## Task 2: Auth — Register defaults to FRIEND, login redirects FRIEND correctly

**Files:**
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/login/page.tsx`
- Modify: `app/register/page.tsx`

- [ ] **Step 1: Change register route default role from USER to FRIEND**

In `app/api/auth/register/route.ts`, change the `prisma.user.create` call:
```ts
// Change this line:
        role: 'USER',
// To:
        role: 'FRIEND',
```

- [ ] **Step 2: Add FRIEND redirect in login page**

In `app/login/page.tsx`, find the role-based redirect block (around line 46):
```ts
      if (data.user.role === 'ADMIN') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
```
Replace with:
```ts
      if (data.user.role === 'ADMIN') {
        router.push('/admin')
      } else if (data.user.role === 'FRIEND') {
        router.push('/friend/dashboard')
      } else {
        router.push('/dashboard')
      }
```

- [ ] **Step 3: Read the register page to find its redirect**

Open `app/register/page.tsx` and locate the post-registration redirect. Apply the same FRIEND branch:
```ts
      if (data.user.role === 'ADMIN') {
        router.push('/admin')
      } else if (data.user.role === 'FRIEND') {
        router.push('/friend/dashboard')
      } else {
        router.push('/dashboard')
      }
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Register a new account. Confirm it redirects to `/friend/dashboard` (will 404 for now — that's fine).

Check DB:
```bash
# In another terminal, verify the new user has role=FRIEND
npx prisma studio
```

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/register/route.ts app/login/page.tsx app/register/page.tsx
git commit -m "feat: default new registrations to FRIEND role, redirect to /friend/dashboard"
```

---

## Task 3: Validators — Add new schemas

**Files:**
- Modify: `lib/validators.ts`

- [ ] **Step 1: Add schemas at the bottom of `lib/validators.ts`**

```ts
// Friend schemas
export const linkFriendSchema = z.object({
  friendId: z.string().min(1, 'Friend ID is required'),
})

// Bet assign schema
export const assignFriendSchema = z.object({
  clientUserId: z.string().min(1, 'Friend user ID is required'),
})

// Dispute schemas
export const disputeSchema = z.object({
  note: z.string().min(1, 'Dispute reason is required'),
})

export const resolveDisputeSchema = z.object({
  note: z.string().min(1, 'Resolution note is required'),
})

// Notification mark-read schema
export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string()).optional(), // if omitted, mark all as read
})
```

- [ ] **Step 2: Update clientPaymentSchema to accept optional clientUserId**

Replace the existing `clientPaymentSchema` with:
```ts
export const clientPaymentSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientUserId: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['upi', 'cash']).default('cash'),
  upiRef: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})
```

- [ ] **Step 3: Add type exports**

At the bottom of `lib/validators.ts`, add:
```ts
export type LinkFriendInput = z.infer<typeof linkFriendSchema>
export type AssignFriendInput = z.infer<typeof assignFriendSchema>
export type DisputeInput = z.infer<typeof disputeSchema>
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>
```

- [ ] **Step 4: Verify no TS errors**

```bash
npm run build 2>&1 | head -30
```

Expected: no new errors from validators.ts.

- [ ] **Step 5: Commit**

```bash
git add lib/validators.ts
git commit -m "feat: add FriendLink, dispute, assign, notification validators"
```

---

## Task 4: lib/notifications.ts — Notification creation helper

**Files:**
- Create: `lib/notifications.ts`

- [ ] **Step 1: Create the helper**

```ts
import prisma from '@/lib/db'

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  await prisma.notification.create({
    data: { userId, title, body, link: link ?? null },
  })
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build 2>&1 | grep 'notifications'
```

Expected: no errors mentioning notifications.ts.

- [ ] **Step 3: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add createNotification helper"
```

---

## Task 5: API — /api/notifications (GET + PATCH)

**Files:**
- Create: `app/api/notifications/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { markNotificationsReadSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    const notifications = await prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: user.userId, read: false },
    })

    return jsonResponse({ notifications, unreadCount })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()

    const parsed = markNotificationsReadSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const where: any = { userId: user.userId, read: false }
    if (parsed.data.ids && parsed.data.ids.length > 0) {
      where.id = { in: parsed.data.ids }
    }

    await prisma.notification.updateMany({ where, data: { read: true } })

    return jsonResponse({ message: 'Notifications marked as read' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Verify with curl (dev server must be running)**

```bash
# Get a token first — login as the seed user
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210","password":"User@12345"}' | jq -r '.tokens.accessToken')

# Fetch notifications (empty list is fine)
curl -s http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected:
```json
{ "notifications": [], "unreadCount": 0 }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "feat: add GET/PATCH /api/notifications endpoint"
```

---

## Task 6: API — /api/friends (list, link, search, unlink)

**Files:**
- Create: `app/api/friends/route.ts`
- Create: `app/api/friends/search/route.ts`
- Create: `app/api/friends/[id]/route.ts`

- [ ] **Step 1: Create `app/api/friends/route.ts` — GET list + POST link**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { linkFriendSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, ConflictError, NotFoundError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const links = await prisma.friendLink.findMany({
      where: { userId: user.userId },
      include: {
        friend: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // For each friend compute outstanding balance from bets
    const friendsWithBalance = await Promise.all(
      links.map(async (link) => {
        const bets = await prisma.betEntry.findMany({
          where: { userId: user.userId, clientUserId: link.friendId },
          select: { profitLoss: true, settlementStatus: true },
        })

        const payments = await prisma.clientPayment.findMany({
          where: { userId: user.userId, clientUserId: link.friendId },
          select: { amount: true },
        })

        const betPnl = bets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
        const paymentsReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
        const outstanding = betPnl - paymentsReceived

        return {
          linkId: link.id,
          friend: link.friend,
          outstanding,
        }
      })
    )

    return jsonResponse({ friends: friendsWithBalance })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = linkFriendSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const friend = await prisma.user.findUnique({
      where: { id: parsed.data.friendId },
    })
    if (!friend) throw new NotFoundError('User not found')
    if (friend.role !== 'FRIEND') {
      throw new ValidationError('Only FRIEND-role users can be linked')
    }

    const existing = await prisma.friendLink.findUnique({
      where: { userId_friendId: { userId: user.userId, friendId: parsed.data.friendId } },
    })
    if (existing) throw new ConflictError('Already linked to this friend')

    const link = await prisma.friendLink.create({
      data: { userId: user.userId, friendId: parsed.data.friendId },
    })

    return jsonResponse({ message: 'Friend linked successfully', link }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Create `app/api/friends/search/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''

    if (q.length < 2) {
      return jsonResponse({ users: [] })
    }

    const users = await prisma.user.findMany({
      where: {
        role: 'FRIEND',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, name: true, phone: true },
      take: 10,
    })

    return jsonResponse({ users })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 3: Create `app/api/friends/[id]/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, NotFoundError, AuthorizationError } from '@/lib/errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const link = await prisma.friendLink.findUnique({ where: { id: params.id } })
    if (!link) throw new NotFoundError('Friend link not found')
    if (link.userId !== user.userId) throw new AuthorizationError('Not your friend link')

    await prisma.friendLink.delete({ where: { id: params.id } })

    return jsonResponse({ message: 'Friend unlinked successfully' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 4: Verify list endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210","password":"User@12345"}' | jq -r '.tokens.accessToken')

curl -s http://localhost:3000/api/friends \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "friends": [] }`

- [ ] **Step 5: Commit**

```bash
git add app/api/friends/
git commit -m "feat: add /api/friends endpoints (list, link, search, unlink)"
```

---

## Task 7: API — Bets route: FRIEND filter + notification on POST

**Files:**
- Modify: `app/api/bets/route.ts`

- [ ] **Step 1: Add FRIEND filter in the GET handler**

In `app/api/bets/route.ts`, find the `where` building block:
```ts
    if (user.role === 'USER') {
      // Users can only see their own bets
      where.userId = user.userId
    } else if (user.role === 'ADMIN') {
```

Add a FRIEND branch before the USER branch:
```ts
    if (user.role === 'FRIEND') {
      // Friends see only bets where they are the client
      where.clientUserId = user.userId
    } else if (user.role === 'USER') {
      where.userId = user.userId
    } else if (user.role === 'ADMIN') {
      if (seriesId) where.match = { seriesId }
      if (matchId) where.matchId = matchId
      if (clientUserId) where.clientUserId = clientUserId
      if (settlementStatus) where.settlementStatus = settlementStatus
    }
```

- [ ] **Step 2: Add notification trigger on POST**

In the POST handler, add the import at the top of the file:
```ts
import { createNotification } from '@/lib/notifications'
```

After the final `return jsonResponse(...)` block (after calculating P&L), insert a notification trigger. Find the `return jsonResponse({ message: 'Bet created successfully', bet: updatedBet }, 201)` call and add the notification just before it:

```ts
    // Notify the friend if bet is linked to a registered friend
    const finalBet = profitLoss !== 0 ? updatedBet : bet
    if (finalBet.clientUserId) {
      const matchLabel = `${finalBet.match.teamA} vs ${finalBet.match.teamB}`
      await createNotification(
        finalBet.clientUserId,
        'New bet added',
        `${matchLabel} — ₹${Number(finalBet.betAmount).toLocaleString('en-IN')}`,
        `/friend/bets`
      )
    }
```

> Note: The POST handler currently has two return paths (profitLoss !== 0 and profitLoss === 0). Restructure to avoid duplication:

Replace the entire block from `// Calculate profit/loss` onward with:

```ts
    // Calculate profit/loss
    const profitLoss = calculateBetProfitLoss(bet as any)

    let finalBet = bet
    if (profitLoss !== 0) {
      finalBet = await prisma.betEntry.update({
        where: { id: bet.id },
        data: { profitLoss: profitLoss.toString() },
        include: {
          match: { include: { series: true } },
          user: true,
          clientUser: true,
        },
      })
    }

    // Notify friend if linked
    if (finalBet.clientUserId) {
      const matchLabel = `${finalBet.match.teamA} vs ${finalBet.match.teamB}`
      await createNotification(
        finalBet.clientUserId,
        'New bet added',
        `${matchLabel} — ₹${Number(finalBet.betAmount).toLocaleString('en-IN')}`,
        `/friend/bets`
      )
    }

    return jsonResponse({ message: 'Bet created successfully', bet: finalBet }, 201)
```

- [ ] **Step 3: Verify FRIEND filter**

```bash
# Register a friend account first
FRIEND_DATA=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Friend","phone":"9111111111","password":"Friend@12345"}')
echo $FRIEND_DATA | jq '.user.role'
# Expected: "FRIEND"

FRIEND_TOKEN=$(echo $FRIEND_DATA | jq -r '.tokens.accessToken')
curl -s http://localhost:3000/api/bets \
  -H "Authorization: Bearer $FRIEND_TOKEN" | jq '.bets | length'
# Expected: 0
```

- [ ] **Step 4: Commit**

```bash
git add app/api/bets/route.ts
git commit -m "feat: add FRIEND filter to GET /api/bets and notify friend on bet creation"
```

---

## Task 8: API — Settlement route: notify friend on update

**Files:**
- Modify: `app/api/bets/[id]/settlement/route.ts`

- [ ] **Step 1: Add notification import**

At the top of `app/api/bets/[id]/settlement/route.ts`, add:
```ts
import { createNotification } from '@/lib/notifications'
```

- [ ] **Step 2: Notify friend after settlement update**

After the `const bet = await prisma.betEntry.update(...)` call and before `return jsonResponse(...)`, add:

```ts
    // Notify the friend of the settlement update
    if (bet.clientUserId) {
      const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
      const statusLabel =
        settlementStatus === 'settled' ? 'settled'
        : settlementStatus === 'collected' ? 'collected'
        : settlementStatus === 'lost_in_another_match' ? 'moved to another match'
        : 'pending'
      await createNotification(
        bet.clientUserId,
        'Bet settlement updated',
        `${matchLabel} bet marked as ${statusLabel}`,
        `/friend/bets`
      )
    }
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | grep -E 'error|Error' | head -10
```

Expected: no errors in `settlement/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/bets/[id]/settlement/route.ts
git commit -m "feat: notify friend when settlement status is updated"
```

---

## Task 9: API — /api/bets/[id]/assign (retroactive friend assignment)

**Files:**
- Create: `app/api/bets/[id]/assign/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { assignFriendSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = assignFriendSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const bet = await prisma.betEntry.findUnique({ where: { id: params.id } })
    if (!bet) throw new NotFoundError('Bet not found')
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only assign friends to your own bets')
    }

    const friend = await prisma.user.findUnique({ where: { id: parsed.data.clientUserId } })
    if (!friend || friend.role !== 'FRIEND') {
      throw new NotFoundError('Friend account not found')
    }

    const updatedBet = await prisma.betEntry.update({
      where: { id: params.id },
      data: { clientUserId: parsed.data.clientUserId },
    })

    return jsonResponse({ message: 'Friend assigned to bet', bet: updatedBet })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/bets/[id]/assign/route.ts
git commit -m "feat: add PATCH /api/bets/[id]/assign for retroactive friend assignment"
```

---

## Task 10: API — Confirm, Dispute, Resolve routes

**Files:**
- Create: `app/api/bets/[id]/confirm/route.ts`
- Create: `app/api/bets/[id]/dispute/route.ts`
- Create: `app/api/bets/[id]/resolve/route.ts`

- [ ] **Step 1: Create `app/api/bets/[id]/confirm/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['FRIEND'])(user)

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: { match: true },
    })
    if (!bet) throw new NotFoundError('Bet not found')
    if (bet.clientUserId !== user.userId) {
      throw new AuthorizationError('This is not your bet')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: { confirmedByFriend: true },
    })

    // Notify the owner
    const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
    await createNotification(
      bet.userId,
      'Settlement confirmed',
      `Your friend confirmed the ${matchLabel} bet settlement`,
      `/dashboard`
    )

    return jsonResponse({ message: 'Settlement confirmed', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Create `app/api/bets/[id]/dispute/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { disputeSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['FRIEND'])(user)

    const body = await request.json()
    const parsed = disputeSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: { match: true },
    })
    if (!bet) throw new NotFoundError('Bet not found')
    if (bet.clientUserId !== user.userId) {
      throw new AuthorizationError('This is not your bet')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: { disputeStatus: 'open', disputeNote: parsed.data.note },
    })

    const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
    await createNotification(
      bet.userId,
      'Bet disputed',
      `Your friend disputed the ${matchLabel} bet: "${parsed.data.note}"`,
      `/dashboard`
    )

    return jsonResponse({ message: 'Dispute raised', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 3: Create `app/api/bets/[id]/resolve/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { resolveDisputeSchema } from '@/lib/validators'
import { jsonResponse, errorResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError, NotFoundError, AuthorizationError } from '@/lib/errors'
import { createNotification } from '@/lib/notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['USER', 'ADMIN'])(user)

    const body = await request.json()
    const parsed = resolveDisputeSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const bet = await prisma.betEntry.findUnique({
      where: { id: params.id },
      include: { match: true },
    })
    if (!bet) throw new NotFoundError('Bet not found')
    if (user.role === 'USER' && bet.userId !== user.userId) {
      throw new AuthorizationError('You can only resolve disputes on your own bets')
    }

    const updated = await prisma.betEntry.update({
      where: { id: params.id },
      data: {
        disputeStatus: 'resolved',
        disputeResolvedAt: new Date(),
      },
    })

    if (bet.clientUserId) {
      const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
      await createNotification(
        bet.clientUserId,
        'Dispute resolved',
        `The ${matchLabel} bet dispute has been resolved: "${parsed.data.note}"`,
        `/friend/bets`
      )
    }

    return jsonResponse({ message: 'Dispute resolved', bet: updated })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E 'error|Error' | head -10
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/bets/[id]/confirm/route.ts app/api/bets/[id]/dispute/route.ts app/api/bets/[id]/resolve/route.ts
git commit -m "feat: add confirm, dispute, and resolve bet routes"
```

---

## Task 11: API — Bulk payment allocation in /api/client-payments

**Files:**
- Modify: `app/api/client-payments/route.ts`

- [ ] **Step 1: Replace the POST handler with bulk allocation logic**

Replace the entire POST function in `app/api/client-payments/route.ts` with:

```ts
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)

    const body = await request.json()
    const parsed = clientPaymentSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const { clientName, clientUserId, amount, method, upiRef, note } = parsed.data

    // Save the payment record
    const payment = await prisma.clientPayment.create({
      data: {
        userId: user.userId,
        clientName,
        clientUserId: clientUserId ?? null,
        amount,
        method,
        upiRef: upiRef ?? null,
        note: note ?? null,
      },
    })

    // Bulk allocation: settle oldest pending bets for this friend
    const betWhere: any = {
      userId: user.userId,
      settlementStatus: 'pending',
    }
    if (clientUserId) {
      betWhere.clientUserId = clientUserId
    } else {
      betWhere.clientName = clientName
    }

    const pendingBets = await prisma.betEntry.findMany({
      where: betWhere,
      orderBy: { createdAt: 'asc' },
      include: { match: true },
    })

    let remaining = amount
    const settledBetIds: string[] = []

    for (const bet of pendingBets) {
      if (remaining <= 0) break

      await prisma.betEntry.update({
        where: { id: bet.id },
        data: { settlementStatus: 'settled', paymentMethod: method },
      })

      settledBetIds.push(bet.id)

      // Notify the friend for each settled bet
      if (bet.clientUserId) {
        const matchLabel = `${bet.match.teamA} vs ${bet.match.teamB}`
        await createNotification(
          bet.clientUserId,
          'Payment recorded',
          `A payment of ₹${amount.toLocaleString('en-IN')} has been recorded. ${matchLabel} bet marked as settled.`,
          `/friend/bets`
        )
      }

      remaining -= Math.abs(Number(bet.profitLoss))
    }

    return jsonResponse({
      message: 'Payment recorded successfully',
      payment,
      settledBets: settledBetIds.length,
    }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Add the createNotification import at the top of the file**

```ts
import { createNotification } from '@/lib/notifications'
```

- [ ] **Step 3: Verify**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210","password":"User@12345"}' | jq -r '.tokens.accessToken')

curl -s -X POST http://localhost:3000/api/client-payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"clientName":"Test","amount":1000,"method":"cash"}' | jq .
```

Expected:
```json
{ "message": "Payment recorded successfully", "settledBets": 0 }
```

- [ ] **Step 4: Commit**

```bash
git add app/api/client-payments/route.ts
git commit -m "feat: bulk payment allocation — auto-settle oldest pending bets on payment record"
```

---

## Task 12: API — /api/series/[id]/summary

**Files:**
- Create: `app/api/series/[id]/summary/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { jsonResponse, errorResponse, authenticateRequest } from '@/lib/middleware'
import { handleError, NotFoundError } from '@/lib/errors'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)

    const series = await prisma.series.findUnique({
      where: { id: params.id },
      include: {
        matches: {
          include: {
            betEntries: {
              where: user.role === 'USER' ? { userId: user.userId } : undefined,
              include: { clientUser: { select: { id: true, name: true } } },
            },
          },
          orderBy: { matchDate: 'asc' },
        },
      },
    })

    if (!series) throw new NotFoundError('Series not found')

    // Per-match breakdown
    const matchBreakdown = series.matches.map((match) => {
      const bets = match.betEntries
      const matchPnl = bets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const collected = bets
        .filter(b => b.settlementStatus === 'collected' || b.settlementStatus === 'settled')
        .reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const pending = bets
        .filter(b => b.settlementStatus === 'pending')
        .reduce((sum, b) => sum + Number(b.profitLoss), 0)
      const wins = bets.filter(b => b.result === 'win').length
      const losses = bets.filter(b => b.result === 'loss').length

      return {
        matchId: match.id,
        label: `${match.teamA} vs ${match.teamB}`,
        matchType: match.matchType,
        matchDate: match.matchDate,
        totalBets: bets.length,
        wins,
        losses,
        matchPnl,
        collected,
        pending,
        bets: bets.map(b => ({
          id: b.id,
          clientName: b.clientName,
          clientUser: b.clientUser,
          betAmount: Number(b.betAmount),
          result: b.result,
          profitLoss: Number(b.profitLoss),
          settlementStatus: b.settlementStatus,
          confirmedByFriend: b.confirmedByFriend,
          disputeStatus: b.disputeStatus,
        })),
      }
    })

    // Series totals
    const allBets = series.matches.flatMap(m => m.betEntries)
    const totalPnl = allBets.reduce((sum, b) => sum + Number(b.profitLoss), 0)
    const outstanding = allBets
      .filter(b => b.settlementStatus === 'pending')
      .reduce((sum, b) => sum + Number(b.profitLoss), 0)
    const wins = allBets.filter(b => b.result === 'win').length
    const winRate = allBets.length > 0 ? Math.round((wins / allBets.length) * 100) : 0

    // By-friend breakdown
    const friendMap = new Map<string, {
      clientName: string
      clientUserId: string | null
      bets: number
      wins: number
      losses: number
      seriesPnl: number
      outstanding: number
    }>()

    for (const bet of allBets) {
      const key = bet.clientUserId ?? bet.clientName
      if (!friendMap.has(key)) {
        friendMap.set(key, {
          clientName: bet.clientName,
          clientUserId: bet.clientUserId,
          bets: 0,
          wins: 0,
          losses: 0,
          seriesPnl: 0,
          outstanding: 0,
        })
      }
      const entry = friendMap.get(key)!
      entry.bets++
      if (bet.result === 'win') entry.wins++
      if (bet.result === 'loss') entry.losses++
      entry.seriesPnl += Number(bet.profitLoss)
      if (bet.settlementStatus === 'pending') entry.outstanding += Number(bet.profitLoss)
    }

    // Payment history for this series (by match dates)
    const seriesStart = series.startDate
    const seriesEnd = series.endDate
    const payments = await prisma.clientPayment.findMany({
      where: {
        userId: user.userId,
        createdAt: { gte: seriesStart, lte: seriesEnd },
      },
      orderBy: { createdAt: 'asc' },
    })

    return jsonResponse({
      series: {
        id: series.id,
        name: series.name,
        status: series.status,
        startDate: series.startDate,
        endDate: series.endDate,
      },
      totals: {
        totalMatches: series.matches.length,
        totalBets: allBets.length,
        winRate,
        totalPnl,
        outstanding,
      },
      matchBreakdown,
      byFriend: Array.from(friendMap.values()),
      paymentHistory: payments,
    })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 2: Verify**

```bash
# Get any series ID from the DB
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210","password":"User@12345"}' | jq -r '.tokens.accessToken')

SERIES_ID=$(curl -s http://localhost:3000/api/series \
  -H "Authorization: Bearer $TOKEN" | jq -r '.series[0].id')

curl -s "http://localhost:3000/api/series/$SERIES_ID/summary" \
  -H "Authorization: Bearer $TOKEN" | jq '.totals'
```

Expected: object with totalMatches, totalBets, winRate, totalPnl, outstanding.

- [ ] **Step 3: Commit**

```bash
git add app/api/series/[id]/summary/route.ts
git commit -m "feat: add GET /api/series/[id]/summary for series P&L breakdown"
```

---

## Task 13: UI — Friend layout + dashboard

**Files:**
- Create: `app/friend/layout.tsx`
- Create: `app/friend/dashboard/page.tsx`

- [ ] **Step 1: Create `app/friend/layout.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { LayoutDashboard, BookOpen, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function FriendLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'FRIEND')) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  const navItems = [
    { href: '/friend/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/friend/bets', icon: BookOpen, label: 'Bets' },
    { href: '/friend/notifications', icon: Bell, label: 'Alerts' },
  ]

  return (
    <div className="min-h-dvh bg-slate-950 text-white pb-20">
      {/* Top header */}
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-amber-400 text-lg">Bet Book</span>
        <button
          onClick={() => { logout(); router.push('/login') }}
          className="text-slate-400 hover:text-white text-sm"
        >
          Logout
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around py-2 z-10">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-4 py-1">
              <Icon size={20} className={active ? 'text-amber-400' : 'text-slate-400'} />
              <span className={`text-xs ${active ? 'text-amber-400' : 'text-slate-500'}`}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/friend/dashboard/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatINR } from '@/lib/format'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

interface Bet {
  id: string
  clientName: string
  betOnTeam: string
  betAmount: number
  odds: number
  betType: string
  result: string
  profitLoss: number
  settlementStatus: string
  confirmedByFriend: boolean
  disputeStatus: string | null
  match: {
    id: string
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    series: { id: string; name: string }
  }
}

export default function FriendDashboard() {
  const { accessToken } = useAuth()
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setBets(data.bets ?? []))
      .finally(() => setIsLoading(false))
  }, [accessToken])

  const totalOwed = bets
    .filter(b => b.profitLoss > 0 && b.settlementStatus === 'pending')
    .reduce((sum, b) => sum + b.profitLoss, 0)

  const totalOwedToMe = bets
    .filter(b => b.profitLoss < 0 && b.settlementStatus === 'pending')
    .reduce((sum, b) => sum + Math.abs(b.profitLoss), 0)

  const net = totalOwed - totalOwedToMe

  if (isLoading) {
    return <div className="text-center text-slate-400 py-20">Loading...</div>
  }

  // Group bets by series
  const bySeries = bets.reduce<Record<string, { seriesName: string; bets: Bet[] }>>(
    (acc, bet) => {
      const sid = bet.match.series.id
      if (!acc[sid]) acc[sid] = { seriesName: bet.match.series.name, bets: [] }
      acc[sid].bets.push(bet)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-slate-400">Total You Owe</p>
            <p className="text-red-400 font-semibold text-lg">{formatINR(totalOwed)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Owed to You</p>
            <p className="text-emerald-400 font-semibold text-lg">{formatINR(totalOwedToMe)}</p>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
          <p className="text-slate-400 text-sm">Net Balance</p>
          <p className={`font-bold text-xl ${net > 0 ? 'text-red-400' : net < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {net > 0 ? '-' : '+'}{formatINR(Math.abs(net))}
          </p>
        </div>
      </div>

      {/* Bets by series */}
      {Object.entries(bySeries).map(([sid, { seriesName, bets: seriesBets }]) => (
        <div key={sid} className="space-y-3">
          <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wider">{seriesName}</h2>
          {seriesBets.slice(0, 5).map(bet => (
            <div key={bet.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">{bet.match.teamA} vs {bet.match.teamB}</p>
                  <p className="text-xs text-slate-400">{bet.match.matchType} · {new Date(bet.match.matchDate).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  bet.result === 'win' ? 'bg-emerald-900 text-emerald-300'
                  : bet.result === 'loss' ? 'bg-red-900 text-red-300'
                  : 'bg-amber-900 text-amber-300'
                }`}>
                  {bet.result}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bet: {formatINR(bet.betAmount)} · {bet.odds}×</span>
                <span className={bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={12} />
                <span className="capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</span>
                {bet.disputeStatus === 'open' && (
                  <span className="bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Disputed</span>
                )}
                {bet.confirmedByFriend && (
                  <span className="bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Confirmed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {bets.length === 0 && (
        <div className="text-center text-slate-500 py-20">No bets yet.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Register a new user (becomes FRIEND), confirm redirect to `/friend/dashboard`. Should show the summary bar and empty bets list.

- [ ] **Step 4: Commit**

```bash
git add app/friend/layout.tsx app/friend/dashboard/page.tsx
git commit -m "feat: add FRIEND layout and dashboard page"
```

---

## Task 14: UI — Friend bets page with confirm/dispute

**Files:**
- Create: `app/friend/bets/page.tsx`

- [ ] **Step 1: Create `app/friend/bets/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface Bet {
  id: string
  clientName: string
  betOnTeam: string
  betAmount: number
  odds: number
  betType: string
  result: string
  profitLoss: number
  settlementStatus: string
  confirmedByFriend: boolean
  disputeStatus: string | null
  match: {
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    series: { name: string }
  }
}

export default function FriendBetsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [bets, setBets] = useState<Bet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [disputeModal, setDisputeModal] = useState<{ betId: string } | null>(null)
  const [disputeNote, setDisputeNote] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadBets = () => {
    if (!accessToken) return
    fetch('/api/bets', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setBets(data.bets ?? []))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { loadBets() }, [accessToken])

  const handleConfirm = async (betId: string) => {
    setActionLoading(betId)
    try {
      const res = await fetch(`/api/bets/${betId}/confirm`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Settlement confirmed')
      loadBets()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDispute = async () => {
    if (!disputeModal) return
    setActionLoading(disputeModal.betId)
    try {
      const res = await fetch(`/api/bets/${disputeModal.betId}/dispute`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: disputeNote }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Dispute raised')
      setDisputeModal(null)
      setDisputeNote('')
      loadBets()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (isLoading) return <div className="text-center text-slate-400 py-20">Loading...</div>

  return (
    <div className="space-y-4">
      <ToastContainer />
      <h1 className="text-xl font-bold text-white">My Bets</h1>

      {bets.map(bet => (
        <div key={bet.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-white">{bet.match.teamA} vs {bet.match.teamB}</p>
              <p className="text-xs text-slate-400">{bet.match.series.name} · {bet.match.matchType} · {new Date(bet.match.matchDate).toLocaleDateString('en-IN')}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              bet.result === 'win' ? 'bg-emerald-900 text-emerald-300'
              : bet.result === 'loss' ? 'bg-red-900 text-red-300'
              : 'bg-amber-900 text-amber-300'
            }`}>{bet.result}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Bet: {formatINR(bet.betAmount)} · Odds {bet.odds}× · {bet.betType}</span>
            <span className={bet.profitLoss >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</span>
            <div className="flex gap-2">
              {bet.disputeStatus === 'open' && (
                <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded-full">Disputed</span>
              )}
              {bet.confirmedByFriend && (
                <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded-full">Confirmed</span>
              )}
              {!bet.confirmedByFriend && bet.settlementStatus !== 'pending' && bet.disputeStatus !== 'open' && (
                <button
                  onClick={() => handleConfirm(bet.id)}
                  disabled={actionLoading === bet.id}
                  className="flex items-center gap-1 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-3 py-1 rounded-full disabled:opacity-50"
                >
                  <CheckCircle2 size={12} />
                  Confirm
                </button>
              )}
              {!bet.disputeStatus && (
                <button
                  onClick={() => setDisputeModal({ betId: bet.id })}
                  className="flex items-center gap-1 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1 rounded-full"
                >
                  <AlertTriangle size={12} />
                  Dispute
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {bets.length === 0 && <div className="text-center text-slate-500 py-20">No bets yet.</div>}

      {/* Dispute modal */}
      {disputeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700 space-y-4">
            <h2 className="text-white font-semibold text-lg">Raise a Dispute</h2>
            <textarea
              value={disputeNote}
              onChange={e => setDisputeNote(e.target.value)}
              placeholder="Describe why you're disputing this bet..."
              className="w-full bg-slate-800 text-white rounded-lg p-3 text-sm border border-slate-700 focus:outline-none focus:border-amber-400 resize-none h-24"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDisputeModal(null); setDisputeNote('') }}
                className="text-slate-400 hover:text-white text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={!disputeNote.trim() || actionLoading === disputeModal.betId}
                className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Raise Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/friend/bets` as a FRIEND user. Should see bet list with Confirm and Dispute buttons.

- [ ] **Step 3: Commit**

```bash
git add app/friend/bets/page.tsx
git commit -m "feat: add friend bets page with confirm and dispute actions"
```

---

## Task 15: UI — Notifications (bell component + friend notifications page)

**Files:**
- Create: `components/NotificationBell.tsx`
- Create: `app/friend/notifications/page.tsx`

- [ ] **Step 1: Create `components/NotificationBell.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bell } from 'lucide-react'
import Link from 'next/link'

export function NotificationBell() {
  const { accessToken } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!accessToken) return
    const load = () => {
      fetch('/api/notifications', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(r => r.json())
        .then(data => setUnreadCount(data.unreadCount ?? 0))
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [accessToken])

  return (
    <Link href="/friend/notifications" className="relative text-slate-400 hover:text-white">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Add NotificationBell to the friend layout header**

In `app/friend/layout.tsx`, add the import:
```ts
import { NotificationBell } from '@/components/NotificationBell'
```

In the header, replace the logout button section with:
```tsx
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-amber-400 text-lg">Bet Book</span>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="text-slate-400 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </header>
```

- [ ] **Step 3: Create `app/friend/notifications/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bell } from 'lucide-react'

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  link: string | null
  createdAt: string
}

export default function FriendNotificationsPage() {
  const { accessToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications ?? [])
        // Mark all as read
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      })
      .finally(() => setIsLoading(false))
  }, [accessToken])

  if (isLoading) return <div className="text-center text-slate-400 py-20">Loading...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Notifications</h1>

      {notifications.length === 0 && (
        <div className="text-center text-slate-500 py-20">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          No notifications yet.
        </div>
      )}

      {notifications.map(n => (
        <div
          key={n.id}
          className={`rounded-xl p-4 border space-y-1 ${n.read ? 'bg-slate-900 border-slate-800' : 'bg-slate-800 border-amber-800/40'}`}
        >
          <div className="flex justify-between items-start">
            <p className="font-medium text-white text-sm">{n.title}</p>
            {!n.read && <span className="w-2 h-2 bg-amber-400 rounded-full mt-1 flex-shrink-0" />}
          </div>
          <p className="text-slate-400 text-sm">{n.body}</p>
          <p className="text-slate-600 text-xs">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Log in as a FRIEND, navigate to `/friend/notifications`. Bell should show badge if unread notifications exist.

- [ ] **Step 5: Commit**

```bash
git add components/NotificationBell.tsx app/friend/notifications/page.tsx app/friend/layout.tsx
git commit -m "feat: add NotificationBell component and friend notifications page"
```

---

## Task 16: UI — Owner friends page (/dashboard/friends)

**Files:**
- Create: `app/dashboard/friends/page.tsx`

- [ ] **Step 1: Create `app/dashboard/friends/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast, ToastContainer } from '@/components/Toast'
import { formatINR } from '@/lib/format'
import { Search, UserPlus, UserMinus, MessageCircle, IndianRupee } from 'lucide-react'

interface Friend {
  linkId: string
  friend: { id: string; name: string; phone: string }
  outstanding: number
}

interface SearchUser {
  id: string
  name: string
  phone: string
}

export default function FriendsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [paymentModal, setPaymentModal] = useState<Friend | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', upiRef: '', note: '' })
  const [isLoading, setIsLoading] = useState(true)

  const loadFriends = () => {
    if (!accessToken) return
    fetch('/api/friends', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setFriends(data.friends ?? []))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { loadFriends() }, [accessToken])

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(r => r.json())
        .then(data => setSearchResults(data.users ?? []))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, accessToken])

  const handleLink = async (friendId: string) => {
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Friend linked!')
      setSearchQuery('')
      setSearchResults([])
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to link')
    }
  }

  const handleUnlink = async (linkId: string) => {
    if (!confirm('Unlink this friend? Bet history is preserved.')) return
    try {
      const res = await fetch(`/api/friends/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Friend unlinked')
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handleRecordPayment = async () => {
    if (!paymentModal) return
    try {
      const res = await fetch('/api/client-payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: paymentModal.friend.name,
          clientUserId: paymentModal.friend.id,
          amount: parseFloat(paymentForm.amount),
          method: paymentForm.method,
          upiRef: paymentForm.upiRef || null,
          note: paymentForm.note || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      toast.success(`Payment recorded. ${data.settledBets} bet(s) settled.`)
      setPaymentModal(null)
      setPaymentForm({ amount: '', method: 'cash', upiRef: '', note: '' })
      loadFriends()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  const sendWhatsApp = (friend: Friend) => {
    const msg = `Hi ${friend.friend.name}, your outstanding balance is ${formatINR(Math.abs(friend.outstanding))}.\nPlease settle at your earliest convenience.\n— Bet Book`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      <h1 className="text-2xl font-bold text-white">Friends</h1>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-slate-800 text-white rounded-xl pl-9 pr-4 py-3 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-10">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{u.name}</p>
                  <p className="text-slate-400 text-xs">{u.phone}</p>
                </div>
                <button
                  onClick={() => handleLink(u.id)}
                  className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-1.5 rounded-full"
                >
                  <UserPlus size={12} />
                  Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends list */}
      {isLoading ? (
        <div className="text-center text-slate-400 py-10">Loading...</div>
      ) : friends.length === 0 ? (
        <div className="text-center text-slate-500 py-10">No friends linked yet. Search to add one.</div>
      ) : (
        <div className="space-y-3">
          {friends.map(f => (
            <div key={f.linkId} className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-white">{f.friend.name}</p>
                  <p className="text-xs text-slate-400">{f.friend.phone}</p>
                </div>
                <div className={`text-lg font-bold ${f.outstanding > 0 ? 'text-emerald-400' : f.outstanding < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {f.outstanding > 0 ? '+' : ''}{formatINR(f.outstanding)}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setPaymentModal(f)}
                  className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-full"
                >
                  <IndianRupee size={12} />
                  Record Payment
                </button>
                <button
                  onClick={() => sendWhatsApp(f)}
                  className="flex items-center gap-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 px-3 py-1.5 rounded-full"
                >
                  <MessageCircle size={12} />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleUnlink(f.linkId)}
                  className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded-full"
                >
                  <UserMinus size={12} />
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Payment modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700 space-y-4">
            <h2 className="text-white font-semibold text-lg">Record Payment — {paymentModal.friend.name}</h2>

            <div>
              <label className="text-slate-400 text-xs block mb-1">Amount Received (₹) *</label>
              <input
                type="number"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="10000"
                className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
              />
            </div>

            <div>
              <label className="text-slate-400 text-xs block mb-1">Payment Method *</label>
              <div className="flex gap-2">
                {(['cash', 'upi'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentForm(p => ({ ...p, method: m }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border ${paymentForm.method === m ? 'bg-amber-500 text-slate-900 border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {paymentForm.method === 'upi' && (
              <div>
                <label className="text-slate-400 text-xs block mb-1">UPI Reference</label>
                <input
                  value={paymentForm.upiRef}
                  onChange={e => setPaymentForm(p => ({ ...p, upiRef: e.target.value }))}
                  placeholder="T2506271234567"
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-slate-400 text-xs block mb-1">Note (optional)</label>
              <input
                value={paymentForm.note}
                onChange={e => setPaymentForm(p => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Partial payment"
                className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-amber-400 text-sm"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setPaymentModal(null)}
                className="text-slate-400 hover:text-white text-sm px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Friends link to the owner's dashboard nav**

In `app/dashboard/page.tsx` (or the existing BottomNav component), add a Friends tab. Open `components/BottomNav.tsx` and add:
```ts
{ href: '/dashboard/friends', icon: Users, label: 'Friends' },
```
Import `Users` from `lucide-react` if not already imported.

- [ ] **Step 3: Verify in browser**

Log in as a USER. Navigate to `/dashboard/friends`. Search for a FRIEND account, link them, see the card appear with outstanding balance.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/friends/page.tsx components/BottomNav.tsx
git commit -m "feat: add friends page with search, link, unlink, record payment, and WhatsApp reminder"
```

---

## Task 17: UI — Series P&L summary page

**Files:**
- Create: `app/dashboard/series/[id]/page.tsx`

- [ ] **Step 1: Create `app/dashboard/series/[id]/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatINR } from '@/lib/format'
import { useParams } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

interface MatchBet {
  id: string
  clientName: string
  betAmount: number
  result: string
  profitLoss: number
  settlementStatus: string
  confirmedByFriend: boolean
  disputeStatus: string | null
  clientUser: { id: string; name: string } | null
}

interface MatchBreakdown {
  matchId: string
  label: string
  matchType: string
  matchDate: string
  totalBets: number
  wins: number
  losses: number
  matchPnl: number
  collected: number
  pending: number
  bets: MatchBet[]
}

interface FriendSummary {
  clientName: string
  clientUserId: string | null
  bets: number
  wins: number
  losses: number
  seriesPnl: number
  outstanding: number
}

interface Payment {
  id: string
  clientName: string
  amount: number
  method: string
  upiRef: string | null
  note: string | null
  createdAt: string
}

interface Summary {
  series: { id: string; name: string; status: string; startDate: string; endDate: string }
  totals: { totalMatches: number; totalBets: number; winRate: number; totalPnl: number; outstanding: number }
  matchBreakdown: MatchBreakdown[]
  byFriend: FriendSummary[]
  paymentHistory: Payment[]
}

type Tab = 'matches' | 'payments' | 'friends'

export default function SeriesSummaryPage() {
  const { accessToken } = useAuth()
  const params = useParams()
  const seriesId = params.id as string
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('matches')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!accessToken || !seriesId) return
    fetch(`/api/series/${seriesId}/summary`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setSummary(data))
      .finally(() => setIsLoading(false))
  }, [accessToken, seriesId])

  const toggleExpand = (matchId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(matchId) ? next.delete(matchId) : next.add(matchId)
      return next
    })
  }

  if (isLoading) return <div className="text-center text-slate-400 py-20">Loading...</div>
  if (!summary) return <div className="text-center text-red-400 py-20">Series not found</div>

  const { series, totals, matchBreakdown, byFriend, paymentHistory } = summary

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-white">{series.name}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {new Date(series.startDate).toLocaleDateString('en-IN')} – {new Date(series.endDate).toLocaleDateString('en-IN')}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full capitalize ${series.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
            {series.status}
          </span>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
          <p className="text-xs text-slate-400">Matches</p>
          <p className="text-2xl font-bold text-white">{totals.totalMatches}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
          <p className="text-xs text-slate-400">Win Rate</p>
          <p className="text-2xl font-bold text-emerald-400">{totals.winRate}%</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
          <p className="text-xs text-slate-400">Total P&L</p>
          <p className={`text-2xl font-bold ${totals.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totals.totalPnl >= 0 ? '+' : ''}{formatINR(totals.totalPnl)}
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
          <p className="text-xs text-slate-400">Outstanding</p>
          <p className="text-2xl font-bold text-amber-400">{formatINR(totals.outstanding)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
        {(['matches', 'payments', 'friends'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-lg capitalize font-medium ${tab === t ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
          >
            {t === 'friends' ? 'By Friend' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Matches */}
      {tab === 'matches' && (
        <div className="space-y-3">
          {matchBreakdown.map(m => (
            <div key={m.matchId} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <button
                onClick={() => toggleExpand(m.matchId)}
                className="w-full px-4 py-3 flex justify-between items-center text-left"
              >
                <div>
                  <p className="font-medium text-white text-sm">{m.label} · {m.matchType}</p>
                  <p className="text-xs text-slate-400">{new Date(m.matchDate).toLocaleDateString('en-IN')} · {m.wins}W {m.losses}L</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${m.matchPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {m.matchPnl >= 0 ? '+' : ''}{formatINR(m.matchPnl)}
                  </p>
                  <p className="text-xs text-slate-500">{expanded.has(m.matchId) ? '▲' : '▼'}</p>
                </div>
              </button>

              {expanded.has(m.matchId) && (
                <div className="border-t border-slate-800">
                  <div className="px-4 py-2 flex justify-between text-xs text-slate-400">
                    <span>Collected: {formatINR(m.collected)}</span>
                    <span>Pending: {formatINR(m.pending)}</span>
                  </div>
                  {m.bets.map(bet => (
                    <div key={bet.id} className="px-4 py-2 flex justify-between items-center border-t border-slate-800/50 text-sm">
                      <div>
                        <p className="text-white">{bet.clientUser?.name ?? bet.clientName}</p>
                        <p className="text-xs text-slate-500 capitalize">{bet.settlementStatus.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{formatINR(bet.betAmount)}</p>
                        <p className={`font-semibold ${bet.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {bet.profitLoss >= 0 ? '+' : ''}{formatINR(bet.profitLoss)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {matchBreakdown.length === 0 && <p className="text-center text-slate-500 py-10">No matches yet.</p>}
        </div>
      )}

      {/* Tab: Payments */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {paymentHistory.map(p => (
            <div key={p.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-white text-sm font-medium">{p.clientName}</p>
                <p className="text-xs text-slate-400 capitalize">{p.method}{p.upiRef ? ` · ${p.upiRef}` : ''}</p>
                <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <p className="text-emerald-400 font-semibold">{formatINR(Number(p.amount))}</p>
            </div>
          ))}
          {paymentHistory.length === 0 && <p className="text-center text-slate-500 py-10">No payments recorded yet.</p>}
        </div>
      )}

      {/* Tab: By Friend */}
      {tab === 'friends' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2 text-xs text-slate-500 px-1">
            <span className="col-span-2">Friend</span>
            <span className="text-center">W/L</span>
            <span className="text-right">P&L</span>
            <span className="text-right">Due</span>
          </div>
          {byFriend.map(f => (
            <div key={f.clientUserId ?? f.clientName} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
              <div className="grid grid-cols-5 gap-2 items-center text-sm">
                <span className="col-span-2 text-white font-medium truncate">{f.clientName}</span>
                <span className="text-center text-slate-400 text-xs">{f.wins}W/{f.losses}L</span>
                <span className={`text-right font-semibold text-xs ${f.seriesPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.seriesPnl >= 0 ? '+' : ''}{formatINR(f.seriesPnl)}
                </span>
                <span className={`text-right text-xs ${f.outstanding > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {formatINR(Math.abs(f.outstanding))}
                </span>
              </div>
            </div>
          ))}
          {byFriend.length === 0 && <p className="text-center text-slate-500 py-10">No bet data yet.</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add series ID to the Bet interface and make series names clickable**

In `app/dashboard/page.tsx`:

First, update the `Bet` interface (top of file) to include series `id`:
```ts
  match: {
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate: string
    series: { id: string; name: string }  // add id here
  }
```

Then, at line 319, replace:
```tsx
                      <td className="text-slate-400">{bet.match.series.name}</td>
```
with:
```tsx
                      <td className="text-slate-400">
                        <Link href={`/dashboard/series/${bet.match.series.id}`} className="hover:text-amber-400 underline-offset-2 hover:underline">
                          {bet.match.series.name}
                        </Link>
                      </td>
```

`Link` is already imported in this file.

- [ ] **Step 3: Verify in browser**

Log in as USER. Click on a series name. Should see the P&L summary page with 3 tabs.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/series/[id]/page.tsx app/dashboard/page.tsx
git commit -m "feat: add series P&L summary page with match, payment, and by-friend tabs"
```

---

## Task 18: Final build verification

- [ ] **Step 1: Run a full production build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any warnings that indicate broken imports or unused variables.

- [ ] **Step 3: Smoke test critical flows**

Start the dev server and verify the following in the browser:

1. Register as a new user → redirects to `/friend/dashboard` ✓
2. Log in as seeded USER (`9876543210`) → sees `/dashboard` ✓
3. Log in as seeded ADMIN (`9999999999`) → sees `/admin` ✓
4. As USER: go to `/dashboard/friends`, search a FRIEND account, link them ✓
5. As FRIEND: go to `/friend/bets`, dispute a bet ✓
6. As USER: see the "Disputed" badge on the bet, resolve it ✓
7. As FRIEND: see the resolution notification at `/friend/notifications` ✓
8. As USER: `/dashboard/friends` → record a bulk payment, confirm bets are auto-settled ✓
9. As USER: click a series → `/dashboard/series/[id]` shows 3 tabs ✓

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: final build verification — personal bet tracker complete"
```
