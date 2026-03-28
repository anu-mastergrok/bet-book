# Cricket API Integration — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

Integrate the Cricbuzz API (via RapidAPI) to auto-import series and matches, keep match status and live scores up to date, and surface real-time data in the admin and user dashboards. The existing manual Series/Match workflow is preserved — imported records go through an admin activation gate before appearing in the bet-creation flow.

---

## 1. Data Model Changes

### 1a. `Series` — add `cricbuzzId`

```prisma
cricbuzzId  String?  @unique  // Cricbuzz series ID for deduplication
```

### 1b. `Match` — add four new fields

```prisma
cricbuzzId   String?  @unique   // Cricbuzz match ID for deduplication
isActivated  Boolean  @default(false)  // admin gate — false = hidden from bet flow
liveScore    String?  // e.g. "IND 180/4 (18.2 ov) vs AUS 210"
result       String?  // e.g. "India won by 6 wickets"
```

**Compatibility:** All existing fields are unchanged. Manually-created records (no `cricbuzzId`) continue to work exactly as before. `isActivated` defaults to `false` for imported matches; manually-created matches should be set to `true` by default (they are already visible since the admin explicitly created them — migration sets `isActivated = true` for all existing rows).

---

## 2. Sync Architecture

### 2a. `instrumentation.ts` (Next.js startup hook)

Runs once when the Node.js server starts. Starts the cricket scheduler.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCricketSync } = await import('./lib/cricket-scheduler')
    startCricketSync()
  }
}
```

### 2b. `lib/cricbuzz-client.ts` (API wrapper)

Thin wrapper around `fetch()` that injects `X-RapidAPI-Key` and `X-RapidAPI-Host` headers. One exported function per Cricbuzz endpoint:

| Function | Cricbuzz endpoint | Purpose |
|----------|-------------------|---------|
| `fetchSeriesList()` | `GET /series/v1/international` + `GET /series/v1/domestic` | Discover series |
| `fetchUpcomingMatches()` | `GET /matches/v1/upcoming` | Upcoming match list |
| `fetchRecentMatches()` | `GET /matches/v1/recent` | Recently completed |
| `fetchLiveMatches()` | `GET /matches/v1/live` | Currently live |
| `fetchMatchScore(cricbuzzId)` | `GET /mcenter/v1/{matchId}` | Live score detail |

All functions throw a typed `CricbuzzError` on non-200 responses. Callers wrap in try/catch.

### 2c. `lib/cricket-sync.ts` (sync logic)

Three pure async functions:

**`syncSeries()`** — Called daily. Fetches international + domestic series from Cricbuzz. For each: upsert into `Series` by `cricbuzzId` (create if new, update name/dates if changed). Does not delete local series.

**`syncUpcomingMatches()`** — Called every 2 hours. Fetches upcoming and recent matches. For each match whose `cricbuzzId` does not exist locally: create a `Match` record with `isActivated = false`. For each match that exists locally: update `status`, `matchDate`, `venue` if changed. Maps Cricbuzz match format to local fields:

| Cricbuzz field | Local field |
|----------------|-------------|
| `matchDesc` | `matchType` (parsed: T20, ODI, Test) |
| `team1.teamName` | `teamA` |
| `team2.teamName` | `teamB` |
| `venue.groundName` | `venue` |
| `startDate` (epoch ms) | `matchDate` |
| `matchInfo.state` | `status` (upcoming/live/completed) |

**`syncLiveMatches()`** — Called every 5 minutes. Queries local DB for matches with `status = 'live'`. For each: calls `fetchMatchScore(cricbuzzId)`, updates `liveScore` and (if complete) `result` + `status = 'completed'`. Skips matches with no `cricbuzzId` (manually created).

Each function is wrapped in try/catch. A sync failure logs the error and returns — it never crashes the server.

### 2d. `lib/cricket-scheduler.ts` (cron setup)

Uses `node-cron` to register three jobs:

```ts
import cron from 'node-cron'
import { syncSeries, syncUpcomingMatches, syncLiveMatches } from './cricket-sync'

export function startCricketSync() {
  cron.schedule('0 6 * * *',     syncSeries)           // daily at 06:00
  cron.schedule('0 */2 * * *',   syncUpcomingMatches)  // every 2 hours
  cron.schedule('*/5 * * * *',   syncLiveMatches)      // every 5 minutes
}
```

### 2e. New API routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/cricket/sync` | ADMIN | Trigger immediate full sync (manual) |
| `PATCH` | `/api/matches/[id]/activate` | ADMIN | Set `isActivated = true` |

### 2f. Modified API routes

- `GET /api/matches` — Add filter: when called from the new-bet form (query param `activated=true`), return only `isActivated = true` matches.
- `POST /api/matches` — Manually-created matches default to `isActivated = true`.

### 2g. Environment variable

```
CRICBUZZ_API_KEY=your-rapidapi-key-here
```

Added to `.env.example`. Sync functions check for this key at startup and log a warning (not an error) if missing — the app runs fine without it, just no auto-sync.

---

## 3. Admin UI Changes

### 3a. "Imported Matches" tab

New tab in `app/admin/page.tsx` alongside the existing series management. Shows all matches where `isActivated = false`, grouped by series name.

Each row:
```
MI vs CSK  ·  T20  ·  15 Apr 2026  ·  Wankhede Stadium
[Activate]
```

Clicking **Activate** calls `PATCH /api/matches/[id]/activate`. The row disappears from this tab and the match becomes available in the bet-creation flow.

### 3b. Live badges on activated matches

In the existing match list, matches are enhanced:
- `status = 'live'`: pulsing green **LIVE** badge + `liveScore` string below team names
- `status = 'completed'`: `result` string below team names (e.g. "India won by 6 wickets")

### 3c. "Sync Now" button

Button in the admin header. Calls `POST /api/cricket/sync`, shows a loading spinner while running, shows a success/error toast on completion.

---

## 4. User-Facing UI Changes

### 4a. New-bet form (`/dashboard/new-bet`)

Match dropdown filters to `isActivated = true` only (via `?activated=true` query param on the existing matches API). Live matches show a "🔴 LIVE" prefix in the dropdown label.

### 4b. Dashboard bets table (`/dashboard/page.tsx`)

Match column additions (no layout change):
- `status = 'live'`: pulsing green dot next to team names
- `status = 'completed'`: `result` string in a small line below team names

### 4c. Series detail page (`/dashboard/series/[id]/page.tsx`)

Per-match cards in the Matches tab show:
- `liveScore` when `status = 'live'`
- `result` when `status = 'completed'`

Slotted below the existing team name / match type line.

### 4d. Friend dashboard (`/friend/dashboard/page.tsx`) and bets page (`/friend/bets/page.tsx`)

Same additions as 4b — live dot and result string on bet cards.

---

## 5. Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `cricbuzzId`, `isActivated`, `liveScore`, `result` to Match; `cricbuzzId` to Series |
| `instrumentation.ts` | New — starts cricket scheduler on server boot |
| `lib/cricbuzz-client.ts` | New — RapidAPI fetch wrapper |
| `lib/cricket-sync.ts` | New — syncSeries, syncUpcomingMatches, syncLiveMatches |
| `lib/cricket-scheduler.ts` | New — node-cron job registration |
| `lib/validators.ts` | Add activate schema |
| `app/api/cricket/sync/route.ts` | New — ADMIN manual sync trigger |
| `app/api/matches/[id]/activate/route.ts` | New — PATCH activate |
| `app/api/matches/route.ts` | Modified — support `?activated=true` filter |
| `app/api/matches/[id]/route.ts` | Modified — POST defaults `isActivated = true` |
| `app/admin/page.tsx` | Modified — Imported Matches tab, live badges, Sync Now button |
| `app/dashboard/new-bet/page.tsx` | Modified — filter to activated matches, LIVE prefix |
| `app/dashboard/page.tsx` | Modified — live dot + result on bets table |
| `app/dashboard/series/[id]/page.tsx` | Modified — liveScore + result on match cards |
| `app/friend/dashboard/page.tsx` | Modified — live dot + result on bet cards |
| `app/friend/bets/page.tsx` | Modified — live dot + result on bet cards |
| `.env.example` | Add CRICBUZZ_API_KEY |

---

## 6. Implementation Order

1. Schema — add new fields, migration sets `isActivated = true` for existing rows
2. `lib/cricbuzz-client.ts` — API wrapper with all five fetch functions
3. `lib/cricket-sync.ts` — sync logic (syncSeries, syncUpcomingMatches, syncLiveMatches)
4. `lib/cricket-scheduler.ts` + `instrumentation.ts` — cron wiring
5. API: `POST /api/cricket/sync` + `PATCH /api/matches/[id]/activate`
6. API: modify `GET /api/matches` for `?activated=true` filter; POST defaults `isActivated=true`
7. Admin UI — Imported Matches tab + Sync Now button + live badges
8. User UI — new-bet dropdown filter + live dot + result strings on dashboard, series page, friend pages
