# Personal Bet Tracker — Design Spec
**Date:** 2026-03-28
**Status:** Approved
**Approach:** A — Add FRIEND role to existing system

---

## Overview

Bet Book is being reframed from a professional bookmaker ledger to a **personal cricket bet tracker** for tracking informal bets with friends and family. The core change: friends and family get their own accounts, can see bets placed against them, confirm settlements, and raise disputes. The owner (USER role) gets series-level P&L summaries, bulk settlement tools, and WhatsApp + in-app reminders.

The existing USER/ADMIN/schema is preserved. A new `FRIEND` role and two new models (`FriendLink`, `Notification`) are added. Minimal breakage to existing code.

---

## 1. Data Model Changes

### 1a. Role enum — add `FRIEND`

```prisma
enum Role {
  USER    // The bet owner/tracker (existing)
  FRIEND  // Friends/family — restricted view (new)
  ADMIN   // Platform admin (unchanged)
}
```

Any new registration (non-admin) defaults to `FRIEND`. Existing USER accounts are unaffected.

### 1b. New: `FriendLink` model

Connects a USER to a FRIEND they have searched and linked. No approval step — linking is immediate.

```prisma
model FriendLink {
  id        String   @id @default(cuid())
  userId    String   // the USER (bet owner)
  friendId  String   // the FRIEND (registered user)
  createdAt DateTime @default(now())

  user   User @relation("UserFriends", fields: [userId], references: [id], onDelete: Cascade)
  friend User @relation("FriendOf", fields: [friendId], references: [id], onDelete: Cascade)

  @@unique([userId, friendId])
  @@index([userId])
  @@index([friendId])
}
```

### 1c. New: `Notification` model

In-app notifications for friends (and optionally the owner).

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String   // recipient
  title     String
  body      String
  read      Boolean  @default(false)
  link      String?  // e.g. /friend/bets/[id]
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([read])
}
```

### 1d. `BetEntry` — add confirmation and dispute fields

```prisma
confirmedByFriend  Boolean   @default(false)
disputeStatus      String?   // null | "open" | "resolved"
disputeNote        String?   // friend's reason for dispute
disputeResolvedAt  DateTime?
```

### 1e. `BetEntry.clientUserId` — explicit linking

`clientUserId` stays optional (old bets without a linked friend are unaffected). When a friend is linked via `FriendLink`, all new bets against them populate `clientUserId`. A per-row **"Assign to friend"** button on old bet rows allows retroactive linking.

### 1f. User model additions

```prisma
friendLinks    FriendLink[]   @relation("UserFriends")
friendOf       FriendLink[]   @relation("FriendOf")
notifications  Notification[]
```

---

## 2. Friend Discovery & Linking

### Registration flow

- Friends register at `/register` — same form (phone + name + password)
- `role` defaults to `FRIEND`
- After login they land on `/friend/dashboard`

### Linking flow (owner side)

**Route:** `/dashboard/friends`

1. Owner types phone number or name in a search bar
2. Matching `FRIEND` accounts appear in results
3. Owner taps **"Link"** → `FriendLink` record created instantly
4. Friend appears in owner's friends list
5. When creating a new bet, owner picks from a linked-friends dropdown instead of typing a name

### Friend list card

```
Raj Kumar  ·  9876543210
Outstanding: +₹15,000
[WhatsApp Reminder]  [Unlink]
```

- **Unlink** removes the `FriendLink` but does not delete bet history
- **WhatsApp Reminder** opens a pre-filled `wa.me` message

### Retroactive assignment

On bet rows where `clientUserId` is null, an **"Assign to friend"** button opens a search modal to link the bet to a registered FRIEND.

---

## 3. Friend Dashboard

### Route: `/friend/dashboard`

FRIEND role sees only bets where they are `clientUserId`, across all users who have bet with them.

### Summary bar

```
Total You Owe:  ₹8,000    Total Owed to You:  ₹3,000
Net Balance:   -₹5,000
```

- Positive net = friend owes money to the owner
- Negative net = owner owes money to the friend

### Bets list

Grouped by Series → Match. Read-only except for action buttons.

```
MI vs CSK · IPL · T20                    15 Apr 2026
Bet On: MI  ·  ₹5,000  ·  Odds 1.5×
Result: Win  |  P&L: +₹2,500
Settlement: Pending

[✓ Confirm Settlement]   [⚑ Dispute]
```

### Friend actions

| Action | Effect |
|--------|--------|
| **Confirm Settlement** | Sets `confirmedByFriend = true`, sends in-app notification to owner |
| **Dispute** | Opens modal for reason → sets `disputeStatus = "open"`, notifies owner |
| **View payment history** | Expandable section listing `ClientPayment` records for this friend |

### Navigation (FRIEND role)

| Tab | Route |
|-----|-------|
| Dashboard | `/friend/dashboard` |
| Bets | `/friend/bets` |
| Notifications | `/friend/notifications` |

Bottom nav on mobile (< 640px), top nav on desktop.

---

## 4. Notifications

### In-app notifications

Bell icon in nav header with unread count badge. Clicking opens a notification drawer.

**Triggers that create a `Notification` record:**

| Event | Recipient |
|-------|-----------|
| New bet added with them as client | FRIEND |
| Bet result updated | FRIEND |
| Payment recorded against them | FRIEND |
| Settlement marked on a bet | FRIEND |
| Friend confirms a settlement | USER (owner) |
| Friend opens a dispute | USER (owner) |
| Dispute resolved | FRIEND |

**Notification format:**
```
🔔  New bet added: MI vs CSK — ₹5,000       2h ago
💰  Payment recorded: ₹2,000 received       Yesterday
⚑   Raj Kumar disputed: MI vs CSK bet      Just now
```

### WhatsApp reminders

Owner taps **"WhatsApp Reminder"** on a friend card → opens `wa.me` with pre-filled message:

```
Hi [Friend Name], your outstanding balance is ₹15,000.
Please settle at your earliest convenience.
— Bet Book
```

No backend change. Entirely client-side using existing `wa.me` approach.

---

## 5. Settlement Flow

### Per-bet settlement (existing, enhanced)

Owner marks individual bets as `collected` / `settled` / `lost_in_another_match` — same as today. Additions:
- On settlement, a `Notification` is created for the friend
- Friend can then **Confirm** or **Dispute** from their dashboard
- Confirmed bets show a ✓ chip in the owner's bets table

### Bulk settlement (new)

**Route:** `/dashboard/friends` — "Record Payment" button on each friend card.

**Modal:**
```
Amount Received (₹) *        Payment Method *
[ 10000_____________ ]       [ Cash ]  [ UPI ]

(if UPI selected)
UPI Reference
[ T2506271234567_____ ]

Note (optional)
[ e.g. Partial settle __ ]

              [ Cancel ]  [ Record Payment ]
```

**Backend allocation logic** (`POST /api/client-payments`):
1. Fetch all `pending` `BetEntry` records for this `clientUserId`, ordered by `createdAt ASC`
2. Walk through them oldest-first, marking each `settled` until the payment amount is exhausted
3. If amount covers a bet partially, that bet stays `pending`; the remainder applies to the next bet
4. A `ClientPayment` record is saved (existing model)
5. Notifications created for friend: one per settled bet

**Friend card after payment:**
```
Bet P&L:          +₹15,000
Payments Rcvd:    -₹10,000
─────────────────────────
Net Outstanding:   +₹5,000
```

### Dispute resolution (owner side)

When `disputeStatus = "open"` on a bet:
- Owner's bet row shows a red **"Disputed"** badge
- Two actions available: **Edit bet** (correct the entry) or **Mark Resolved** (with resolution note)
- Resolving sets `disputeStatus = "resolved"`, `disputeResolvedAt = now()`, notifies the friend

---

## 6. Series P&L Summary

### Route: `/dashboard/series/[id]`

Clicking a series opens a dedicated summary page.

### Series header

```
IPL 2026                              Status: Active
Mar 15 – May 30, 2026
```

### Series stats bar

```
Total Matches: 8   Total Bets: 34   Win Rate: 62%
──────────────────────────────────────────────────
Total Series P&L:  +₹42,500    Outstanding: ₹8,000
```

### Per-match breakdown (default tab)

Collapsible match cards:

```
MI vs CSK  ·  T20  ·  Apr 15                    ▼
Bets: 6   Wins: 4   Losses: 2
Match P&L:  +₹12,000
Collected: ₹10,000   Pending: ₹2,000

  Raj Kumar    Bet: ₹5,000   Win   +₹2,500   [settled ✓]
  Amit Shah    Bet: ₹3,000   Loss  -₹3,000   [pending]
  Priya K      Bet: ₹2,000   Win   +₹1,000   [settled ✓]
```

### Payment history tab

All `ClientPayment` records within this series, in chronological order:

```
Apr 16  Raj Kumar paid ₹5,000   [Cash]
Apr 18  Amit Shah paid ₹3,000   [UPI · T250618...]
Apr 20  Priya K paid ₹2,000    [Cash]
```

### By Friend tab

```
Friend       Bets   W/L       Series P&L   Outstanding
Raj Kumar      12   8W/4L     +₹18,000     ₹3,000
Amit Shah       8   3W/5L      -₹6,000     ₹0
Priya K        14   9W/5L     +₹30,500     ₹5,000
```

---

## 7. API Changes

### New routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/friends` | List USER's linked friends |
| `POST` | `/api/friends` | Link a friend (`{ friendId }`) |
| `DELETE` | `/api/friends/[id]` | Unlink a friend |
| `GET` | `/api/friends/search?q=` | Search FRIEND accounts by name/phone |
| `PATCH` | `/api/bets/[id]/assign` | Retroactively assign `clientUserId` |
| `PATCH` | `/api/bets/[id]/confirm` | Friend confirms settlement |
| `PATCH` | `/api/bets/[id]/dispute` | Friend opens dispute (`{ note }`) |
| `PATCH` | `/api/bets/[id]/resolve` | Owner resolves dispute (`{ note }`) |
| `GET` | `/api/notifications` | Get current user's notifications |
| `PATCH` | `/api/notifications/read` | Mark all (or specific) as read |
| `GET` | `/api/series/[id]/summary` | Series P&L summary (per-match + by-friend) |

### Modified routes

- `POST /api/client-payments` — add bulk allocation logic (oldest pending bets first)
- `PUT /api/bets/[id]/settlement` — create `Notification` on settlement update
- `POST /api/bets` — create `Notification` for linked friend when bet is added

### Auth/role middleware

- FRIEND role added to `requireRole()` checks
- `/friend/*` routes accessible to FRIEND only
- `/dashboard/*` routes require USER role
- `/api/bets` for FRIEND: returns only bets where `clientUserId = req.userId`

---

## 8. Implementation Order

1. DB schema — add `FRIEND` to Role enum, `FriendLink`, `Notification` models, `BetEntry` dispute/confirm fields
2. Auth — `role: FRIEND` default on registration, FRIEND redirect to `/friend/dashboard`
3. API: `/api/friends` — search, link, unlink
4. API: `/api/bets/[id]/assign` — retroactive friend assignment
5. API: `/api/bets/[id]/confirm` + `/dispute` + `/resolve` — confirmation and dispute actions
6. API: `/api/notifications` — GET + PATCH read
7. Notification creation — wire up all event triggers (new bet, settlement, dispute, resolution)
8. API: `/api/client-payments` — bulk allocation logic
9. API: `/api/series/[id]/summary` — series P&L summary endpoint
10. UI: `/dashboard/friends` — friend list, link/unlink, record payment modal
11. UI: `/friend/dashboard` — friend summary bar + bets list
12. UI: `/friend/bets` — full bet list with confirm/dispute actions
13. UI: `/friend/notifications` — notification list
14. UI: Notification bell + badge in nav (both USER and FRIEND layouts)
15. UI: `/dashboard/series/[id]` — series P&L page (3 tabs: matches, payments, by friend)
16. UI: "Assign to friend" button on old bet rows
17. UI: Disputed badge + resolve action on owner's bet rows

---

## Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add FRIEND role, FriendLink, Notification, BetEntry fields |
| `lib/middleware.ts` | FRIEND role support in `requireRole()` |
| `lib/validators.ts` | FriendLink, Notification, dispute/confirm schemas |
| `app/api/friends/route.ts` | New — search, list, link |
| `app/api/friends/[id]/route.ts` | New — unlink |
| `app/api/bets/[id]/assign/route.ts` | New — retroactive friend assignment |
| `app/api/bets/[id]/confirm/route.ts` | New — friend confirms settlement |
| `app/api/bets/[id]/dispute/route.ts` | New — friend opens dispute |
| `app/api/bets/[id]/resolve/route.ts` | New — owner resolves dispute |
| `app/api/notifications/route.ts` | New — GET + PATCH |
| `app/api/client-payments/route.ts` | Modified — bulk allocation logic |
| `app/api/series/[id]/summary/route.ts` | New — series P&L summary |
| `app/api/bets/route.ts` | Modified — FRIEND filter, notification on POST |
| `app/api/bets/[id]/settlement/route.ts` | Modified — notification on settlement |
| `app/dashboard/friends/page.tsx` | New — friends list + link + payment |
| `app/dashboard/series/[id]/page.tsx` | New — series P&L summary |
| `app/friend/dashboard/page.tsx` | New — friend summary + bets |
| `app/friend/bets/page.tsx` | New — friend bet list |
| `app/friend/notifications/page.tsx` | New — friend notifications |
| `components/NotificationBell.tsx` | New — bell icon + unread badge |
| `context/AuthContext.tsx` | Modified — handle FRIEND role redirect |
