# India-Specific Features Design
**Date:** 2026-03-27
**Status:** Approved
**Approach:** A — Mobile-First Cricket Ledger

---

## Overview

Bet Book is used by Indian bookmakers to track cricket/sports bets with clients. This spec covers 7 feature areas that make the app feel native to Indian users: mobile bottom navigation, quick bet amounts, cricket-specific bet types, UPI settlement tracking, WhatsApp share, a Client Dues page, and Indian number formatting.

---

## 1. Data Model Changes

### 1a. Match — add `matchType`

```prisma
matchType  String  @default("T20")
// Allowed values: T20 | ODI | Test | IPL | Domestic
```

### 1b. BetEntry — add UPI/payment fields

```prisma
paymentMethod     String?   // upi | cash | pending
upiTransactionId  String?   // e.g. "T2506271234567"
paymentNote       String?   // free text, e.g. "paid via PhonePe"
```

**Migration:** All new fields are optional with defaults. Run `npm run db:push`. No existing data is affected.

**No new tables.** Client Dues is computed at query time. WhatsApp share is purely client-side.

---

## 2. Mobile Bottom Navigation

**Applies to:** screens narrower than `sm` (640px). Desktop keeps the existing sticky top header.

### User bottom nav (4 tabs)

| Tab | Icon | Route |
|-----|------|-------|
| Home | `LayoutDashboard` | `/dashboard` |
| New Bet | `Plus` (amber, raised) | `/dashboard/new-bet` |
| Clients | `Users` | `/dashboard/clients` |
| History | `BookOpen` | `/dashboard/history` |

- Active tab: amber icon + amber label
- Inactive tab: slate-400 icon + slate-500 label
- "New Bet" tab uses a raised amber circle button (primary action treatment)
- Fixed to bottom with `pb-safe` padding (iPhone home indicator safe area)
- Top header on mobile simplified: logo left, logout icon right — action buttons removed (they move to bottom nav)

### Admin bottom nav (2 tabs)

| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | `LayoutDashboard` | `/admin` |
| All Bets | `Zap` | `/admin/bets` |

---

## 3. New Bet Form Enhancements

### 3a. Quick Amount Presets

Displayed as a row of tap buttons above the `betAmount` input:

```
[ ₹500 ] [ ₹1K ] [ ₹2K ] [ ₹5K ] [ ₹10K ] [ ₹25K ]
```

- Tapping a preset fills `betAmount` instantly
- Active preset highlighted in amber border + amber text
- Manual typing clears active preset highlight
- Preset values: 500, 1000, 2000, 5000, 10000, 25000

### 3b. Cricket Bet Types

Replace generic bet type dropdown with:

| Value | Label |
|-------|-------|
| `toss_winner` | Toss Winner |
| `match_winner` | Match Winner |
| `session_runs` | Session Runs |
| `top_batsman` | Top Batsman |
| `top_bowler` | Top Bowler |
| `player_performance` | Player Performance |
| `other` | Other |

### 3c. Match Type on Match Creation (Admin)

Add `matchType` select in the Add Match modal:

```
[ T20 ] [ ODI ] [ Test ] [ IPL ] [ Domestic ]
```

- Stored as `Match.matchType`
- Displayed as a small badge wherever match name appears: `MI vs CSK · IPL · T20`

---

## 4. UPI Settlement Tracking

**Applies to:** Edit Bet modal (Admin → All Bets) and any settlement update flow.

### Behaviour

- Payment fields appear only when `settlementStatus` is `collected` or `settled`
- Hidden for `pending` and `lost_in_another_match`

### Fields

```
Payment Method *
[ UPI ]  [ Cash ]  [ Pending ]

(conditional — only if UPI selected)
UPI Transaction ID
[ T2506271234567________________ ]
Helper: "Find this in your UPI app's transaction history"

Payment Note (optional)
[ e.g. Paid via PhonePe _______]
```

### Display in bets table

Settlement column shows status badge + payment chip:
- `[settled] [UPI ✓]` — green UPI chip
- `[settled] [Cash]` — slate chip
- `[pending]` — no chip

### API change

`PUT /api/bets/[id]/settlement` body extended:
```json
{
  "settlementStatus": "settled",
  "paymentMethod": "upi",
  "upiTransactionId": "T2506271234567",
  "paymentNote": "Paid via PhonePe"
}
```

No change to P&L calculation logic.

---

## 5. WhatsApp Share

Entirely client-side — no backend changes.

### Placement

- Bets table (dashboard + admin/bets): green WhatsApp icon button in each row's action column
- New bet success state: "Share on WhatsApp" button

### Message format

```
📋 *Bet Slip — Bet Book*

🏏 MI vs CSK (IPL · T20)
📅 15 Apr 2025, 7:30 PM
🏟 Wankhede Stadium, Mumbai

👤 Client: Raj Kumar
🎯 Bet On: MI
💰 Amount: ₹10,000
📊 Odds: 1.5×
🏷 Type: Match Winner

💵 Potential Win: +₹5,000

_Powered by Bet Book_
```

For pending bets, show potential win line:
```
💵 Potential Win: +₹5,000
```

For settled/collected bets, replace with actual result:
```
📊 Result: Win  |  P&L: +₹5,000
✅ Settlement: Settled via UPI
```

### Implementation

```ts
const url = `https://wa.me/?text=${encodeURIComponent(message)}`
window.open(url, '_blank')
```

Opens WhatsApp app on mobile, WhatsApp Web on desktop.

### Button styling

- Icon: `MessageCircle` (Lucide) in `#25D366`
- Background on hover: `hover:bg-green-500/10`
- Sits alongside Edit / Delete in actions column

---

## 6. Client Dues Page

**Route:** `/dashboard/clients`

### Data fetching

`GET /api/bets` (existing endpoint) — group by `clientName` client-side.

Per client compute:
- `totalBets` — count of all bets
- `wins` / `losses` / `pending` — counts
- `totalPnL` — sum of all `profitLoss`
- `outstanding` — sum of `profitLoss` where `settlementStatus = pending`
- `settled` — sum of `profitLoss` where `settlementStatus` is `collected` or `settled`

### Layout

Summary bar at top:
```
Total Outstanding: ₹42,500  across 6 clients
```

Client cards (sorted by absolute outstanding descending):
```
┌─────────────────────────────────────────────┐
│  Raj Kumar                      [WhatsApp]  │
│                                             │
│  8 bets  ·  5W  ·  3L                      │
│                                             │
│  Outstanding:   +₹15,000                   │
│  Total P&L:     +₹22,000                   │
└─────────────────────────────────────────────┘
```

### Colour coding

- Green `+` amount: client owes you
- Red `-` amount: you owe client
- Amber: all bets still pending (no settled/collected)

### WhatsApp reminder

Pre-filled message:
```
Hi [Client Name], your outstanding balance is ₹15,000.
Please settle at your earliest convenience.
— Bet Book
```

---

## 6b. History Page

**Route:** `/dashboard/history`

The existing bets table from the dashboard, extracted into its own dedicated page with richer filtering. No new data fetching — same `GET /api/bets` call.

**Additions over the dashboard table:**
- Filter by: result (win/loss/pending), settlement status, series, date range
- Sort by: date, amount, P&L
- Shows all bets (dashboard table stays as a summary showing last 10)

No new API routes needed.

---

## 7. Indian Number Formatting

### Utility function

`lib/format.ts`:

```ts
export function formatINR(amount: number, short = false): string
```

| Input | `short=false` | `short=true` |
|-------|--------------|-------------|
| 500 | ₹500 | ₹500 |
| 15000 | ₹15,000 | ₹15K |
| 150000 | ₹1,50,000 | ₹1.5L |
| 2500000 | ₹25,00,000 | ₹25L |
| 15000000 | ₹1,50,00,000 | ₹1.5Cr |

- `short=false`: uses `Intl.NumberFormat('en-IN')` — correct Indian comma placement
- `short=true`: K / L / Cr suffixes

### Where each mode is used

| Location | Mode |
|----------|------|
| Summary / stat cards | `short=true` |
| Tables (all columns) | `short=false` |
| WhatsApp bet slip | `short=false` |
| New bet potential profit preview | `short=false` |
| Client Dues outstanding | `short=false` |

---

---

## 8. Admin — Edit & Delete Series and Matches

Currently admin can only **create** series and matches. Full CRUD is required.

### New API routes

**`app/api/series/[id]/route.ts`**
- `PUT` — update name, startDate, endDate, status (ADMIN only)
- `DELETE` — delete series + cascade to matches (ADMIN only)

**`app/api/matches/[id]/route.ts`**
- `PUT` — update teamA, teamB, matchDate, venue, status, matchType (ADMIN only)
- `DELETE` — delete match + cascade to betEntries (ADMIN only)

### UI changes (Admin Dashboard)

Each series card gets two action buttons: **Edit** (pencil) and **Delete** (trash):
- Edit opens a pre-filled modal identical to Create but with existing values
- Delete shows ConfirmModal: *"Delete this series? All matches and bets under it will be permanently deleted."*

Each match row inside a series gets **Edit** and **Delete** buttons:
- Edit opens a pre-filled match modal
- Delete shows ConfirmModal: *"Delete this match? All bets under it will be permanently deleted."*

---

## 9. Manual Client Dues Tracking

Auto-calculated dues (from bet P&L) only show what's owed on paper. Bookmakers also need to record **actual cash/UPI payments** received or made outside of individual bet settlements.

### New DB model

```prisma
model ClientPayment {
  id          String   @id @default(cuid())
  userId      String
  clientName  String
  amount      Decimal  @db.Decimal(10, 2)  // positive = received from client, negative = paid to client
  method      String   @default("cash")    // upi | cash
  upiRef      String?
  note        String?
  createdAt   DateTime @default(now())

  user  User  @relation("UserClientPayments", fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([clientName])
}
```

Add to `User` model: `clientPayments ClientPayment[] @relation("UserClientPayments")`

### New API routes

- `GET /api/client-payments?clientName=Raj+Kumar` — list payments for a client (authenticated user's own)
- `POST /api/client-payments` — record a payment
- `DELETE /api/client-payments/[id]` — delete a payment record

### UI changes (Client Dues page)

Each client card gets a **"Record Payment"** button. Opens a modal:

```
Amount Received (₹) *       Payment Method *
[ 5000_______________ ]     [ Cash ]  [ UPI ]

(if UPI)
UPI Reference
[ T2506271234567______ ]

Note (optional)
[ e.g. Partial payment __ ]

           [ Cancel ]  [ Record Payment ]
```

- Positive amount = client paid you → reduces outstanding
- Client card shows two balance lines:
  ```
  Bet P&L:        +₹15,000
  Payments Rcvd:  -₹5,000
  ─────────────────────────
  Net Outstanding: +₹10,000
  ```
- Payment history expandable per client (list of past payments with delete button)

---

## Implementation Order

1. `lib/format.ts` — formatINR utility (no dependencies)
2. DB schema push — matchType + UPI payment fields + ClientPayment model
3. Update validators — matchType, UPI fields, ClientPayment schema
4. API: settlement route accepts UPI payment fields
5. API: `app/api/series/[id]/route.ts` — PUT + DELETE
6. API: `app/api/matches/[id]/route.ts` — PUT + DELETE
7. API: `app/api/client-payments/route.ts` — GET + POST
8. API: `app/api/client-payments/[id]/route.ts` — DELETE
9. `lib/whatsapp.ts` — message builder utility
10. `formatINR` rollout — replace raw ₹ values across all pages
11. Quick amount presets + cricket bet types — New Bet form
12. Match type + edit/delete — Admin series/matches panel
13. UPI settlement fields — Edit Bet modal + UPI chips in table
14. WhatsApp share buttons — dashboard + admin bets table
15. `app/dashboard/clients/page.tsx` — Client Dues + manual payments
16. `app/dashboard/history/page.tsx` — History page with filters
17. `components/BottomNav.tsx` — mobile bottom navigation component
18. Integrate BottomNav into all pages

---

## Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add matchType, paymentMethod, upiTransactionId, paymentNote |
| `lib/format.ts` | New file — formatINR utility |
| `app/api/bets/[id]/settlement/route.ts` | Accept + save payment fields |
| `app/dashboard/page.tsx` | formatINR, WhatsApp share button, bottom nav |
| `app/dashboard/new-bet/page.tsx` | Quick presets, cricket bet types |
| `app/dashboard/clients/page.tsx` | New page — Client Dues |
| `app/dashboard/history/page.tsx` | New page — filtered bets history |
| `app/admin/page.tsx` | matchType in Add Match modal, bottom nav |
| `app/admin/bets/page.tsx` | UPI chips in table, WhatsApp share, payment fields in edit modal |
| `components/BottomNav.tsx` | New component — mobile bottom navigation |
| `components/WhatsAppShare.ts` | New utility — message builder + open wa.me |
