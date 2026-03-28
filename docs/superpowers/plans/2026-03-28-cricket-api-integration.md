# Cricket API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Cricbuzz (via RapidAPI) to auto-import series and matches, keep live scores and match status synced in real-time, and surface that data across the admin and user dashboards.

**Architecture:** A `node-cron` scheduler starts inside Next.js's `instrumentation.ts` hook (runs at server boot). Three cron jobs handle adaptive sync: daily for series discovery, every 2 hours for upcoming/recent matches, every 5 minutes for live score updates. Auto-imported matches start deactivated; admin activates them before they appear in the bet flow.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, PostgreSQL, node-cron, Cricbuzz RapidAPI (`cricbuzz-cricket.p.rapidapi.com`), TypeScript, Tailwind CSS, Zod

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `cricbuzzId`, `isActivated`, `liveScore`, `result` to Match; `cricbuzzId` to Series |
| `next.config.js` | Modify | Enable `experimental.instrumentationHook` |
| `instrumentation.ts` | Create | Next.js startup hook — starts the cron scheduler |
| `lib/cricbuzz-client.ts` | Create | RapidAPI fetch wrapper — one function per endpoint |
| `lib/cricket-sync.ts` | Create | Sync logic — `syncSeries`, `syncUpcomingMatches`, `syncLiveMatches` |
| `lib/cricket-scheduler.ts` | Create | node-cron job registration |
| `lib/validators.ts` | Modify | Add `activateMatchSchema` |
| `app/api/cricket/sync/route.ts` | Create | `POST` — ADMIN manual sync trigger |
| `app/api/matches/[id]/activate/route.ts` | Create | `PATCH` — set `isActivated = true` |
| `app/api/matches/route.ts` | Modify | Support `?activated=true` filter; default `isActivated=true` on POST |
| `app/admin/page.tsx` | Modify | "Imported" tab + Sync Now button + live badges |
| `app/dashboard/new-bet/page.tsx` | Modify | Fetch only activated matches; LIVE prefix in dropdown |
| `app/dashboard/page.tsx` | Modify | Live dot + result string on bets table match column |
| `app/dashboard/series/[id]/page.tsx` | Modify | liveScore + result on match cards |
| `app/friend/dashboard/page.tsx` | Modify | Live dot + result on bet cards |
| `app/friend/bets/page.tsx` | Modify | Live dot + result on bet cards |
| `.env.example` | Modify | Add `CRICBUZZ_API_KEY` |

---

## Task 1: Schema — add Cricbuzz fields and migrate existing rows

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `Series` and `Match` in `prisma/schema.prisma`**

Open `prisma/schema.prisma`. Replace the `Series` model (lines 82–94) with:

```prisma
model Series {
  id          String   @id @default(cuid())
  name        String
  startDate   DateTime
  endDate     DateTime
  status      String   @default("active") // active, completed
  cricbuzzId  String?  @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  matches Match[]

  @@index([status])
  @@index([cricbuzzId])
}
```

Replace the `Match` model (lines 96–114) with:

```prisma
model Match {
  id          String   @id @default(cuid())
  seriesId    String
  teamA       String
  teamB       String
  matchDate   DateTime
  venue       String
  matchType   String   @default("T20")
  status      String   @default("upcoming") // upcoming, live, completed
  cricbuzzId  String?  @unique
  isActivated Boolean  @default(false)
  liveScore   String?
  result      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  series     Series     @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  betEntries BetEntry[] @relation("MatchBets")
  linkedBets BetEntry[] @relation("LinkedMatches")

  @@index([seriesId])
  @@index([status])
  @@index([cricbuzzId])
  @@index([isActivated])
}
```

- [ ] **Step 2: Push schema and generate client**

```bash
npm run db:push
npm run db:generate
```

Expected: `✓ Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Set `isActivated = true` for all existing Match rows**

Manually-created matches should be immediately usable. Run in psql or a quick script:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.match.updateMany({ where: { cricbuzzId: null }, data: { isActivated: true } })
  .then(r => { console.log('Updated', r.count, 'rows'); prisma.\$disconnect(); });
"
```

Expected: `Updated N rows` (N = number of existing matches).

- [ ] **Step 4: Add `CRICBUZZ_API_KEY` to `.env.example`**

Open `.env.example` and append:

```
CRICBUZZ_API_KEY=your-rapidapi-key-here
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat: add cricbuzzId, isActivated, liveScore, result fields to Match and Series"
```

---

## Task 2: `lib/cricbuzz-client.ts` — RapidAPI wrapper

**Files:**
- Create: `lib/cricbuzz-client.ts`

- [ ] **Step 1: Create `lib/cricbuzz-client.ts`**

```ts
const BASE_URL = 'https://cricbuzz-cricket.p.rapidapi.com'

function headers(): HeadersInit {
  const key = process.env.CRICBUZZ_API_KEY
  if (!key) throw new Error('CRICBUZZ_API_KEY is not set')
  return {
    'X-RapidAPI-Key': key,
    'X-RapidAPI-Host': 'cricbuzz-cricket.p.rapidapi.com',
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: headers(),
    next: { revalidate: 0 }, // disable Next.js cache for live data
  })
  if (!res.ok) throw new Error(`Cricbuzz API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// --- Types (only the fields we actually use) ---

export interface CricbuzzSeries {
  id: number
  name: string
  startDt?: string
  endDt?: string
}

export interface CricbuzzMatchInfo {
  matchId: number
  seriesId: number
  seriesName: string
  matchDesc: string
  matchFormat: string
  startDate: string // epoch ms as string
  state: string     // "Preview" | "In Progress" | "Complete"
  status: string    // human-readable
  team1: { teamId: number; teamName: string; teamSName: string }
  team2: { teamId: number; teamName: string; teamSName: string }
  venueInfo?: { ground?: string; city?: string }
}

export interface CricbuzzMatch {
  matchInfo: CricbuzzMatchInfo
}

export interface CricbuzzSeriesWrapper {
  series: CricbuzzSeries
  matches?: CricbuzzMatch[]
}

export interface CricbuzzMatchScore {
  matchHeader: {
    matchId: number
    state: string
    status: string
  }
  miniscore?: {
    matchScoreDetails?: {
      inningsScoreList?: Array<{
        batTeamName: string
        runs: number
        wickets: number
        overs: number
      }>
    }
  }
}

// --- API functions ---

export async function fetchInternationalSeries(): Promise<CricbuzzSeries[]> {
  const data = await get<{ seriesMatches: Array<{ seriesAdWrapper?: { series: CricbuzzSeries } }> }>(
    '/series/v1/international'
  )
  return (data.seriesMatches ?? [])
    .map(m => m.seriesAdWrapper?.series)
    .filter((s): s is CricbuzzSeries => !!s)
}

export async function fetchDomesticSeries(): Promise<CricbuzzSeries[]> {
  const data = await get<{ seriesMatches: Array<{ seriesAdWrapper?: { series: CricbuzzSeries } }> }>(
    '/series/v1/domestic'
  )
  return (data.seriesMatches ?? [])
    .map(m => m.seriesAdWrapper?.series)
    .filter((s): s is CricbuzzSeries => !!s)
}

function extractMatches(
  typeMatches: Array<{ seriesMatches?: Array<{ seriesAdWrapper?: CricbuzzSeriesWrapper }> }>
): CricbuzzMatch[] {
  const result: CricbuzzMatch[] = []
  for (const type of typeMatches ?? []) {
    for (const sm of type.seriesMatches ?? []) {
      const matches = sm.seriesAdWrapper?.matches ?? []
      result.push(...matches)
    }
  }
  return result
}

export async function fetchUpcomingMatches(): Promise<CricbuzzMatch[]> {
  const data = await get<{ typeMatches: Array<{ seriesMatches?: Array<{ seriesAdWrapper?: CricbuzzSeriesWrapper }> }> }>(
    '/matches/v1/upcoming'
  )
  return extractMatches(data.typeMatches ?? [])
}

export async function fetchRecentMatches(): Promise<CricbuzzMatch[]> {
  const data = await get<{ typeMatches: Array<{ seriesMatches?: Array<{ seriesAdWrapper?: CricbuzzSeriesWrapper }> }> }>(
    '/matches/v1/recent'
  )
  return extractMatches(data.typeMatches ?? [])
}

export async function fetchLiveMatches(): Promise<CricbuzzMatch[]> {
  const data = await get<{ typeMatches: Array<{ seriesMatches?: Array<{ seriesAdWrapper?: CricbuzzSeriesWrapper }> }> }>(
    '/matches/v1/live'
  )
  return extractMatches(data.typeMatches ?? [])
}

export async function fetchMatchScore(cricbuzzMatchId: number): Promise<CricbuzzMatchScore> {
  return get<CricbuzzMatchScore>(`/mcenter/v1/${cricbuzzMatchId}`)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors in `lib/cricbuzz-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/cricbuzz-client.ts
git commit -m "feat: add Cricbuzz RapidAPI client wrapper"
```

---

## Task 3: `lib/cricket-sync.ts` — sync logic

**Files:**
- Create: `lib/cricket-sync.ts`

- [ ] **Step 1: Create `lib/cricket-sync.ts`**

```ts
import prisma from '@/lib/db'
import {
  fetchInternationalSeries,
  fetchDomesticSeries,
  fetchUpcomingMatches,
  fetchRecentMatches,
  fetchLiveMatches,
  fetchMatchScore,
  CricbuzzMatchInfo,
} from '@/lib/cricbuzz-client'

// --- Helpers ---

function mapMatchFormat(format: string, seriesName: string): string {
  const f = (format ?? '').toUpperCase()
  if (f === 'TEST') return 'Test'
  if (f === 'ODI') return 'ODI'
  if ((seriesName ?? '').toLowerCase().includes('ipl')) return 'IPL'
  if (f === 'T20' || f === 'T20I') return 'T20'
  return 'T20'
}

function mapState(state: string): 'upcoming' | 'live' | 'completed' {
  const s = (state ?? '').toLowerCase()
  if (s === 'in progress' || s === 'live') return 'live'
  if (s === 'complete' || s === 'completed') return 'completed'
  return 'upcoming'
}

function buildLiveScore(score: { batTeamName: string; runs: number; wickets: number; overs: number }): string {
  return `${score.batTeamName} ${score.runs}/${score.wickets} (${score.overs} ov)`
}

// --- Sync functions ---

export async function syncSeries(): Promise<void> {
  console.log('[cricket-sync] syncSeries start')
  try {
    const [international, domestic] = await Promise.all([
      fetchInternationalSeries(),
      fetchDomesticSeries(),
    ])
    const all = [...international, ...domestic]

    for (const s of all) {
      const cricbuzzId = String(s.id)
      const startDate = s.startDt ? new Date(Number(s.startDt)) : new Date()
      const endDate = s.endDt ? new Date(Number(s.endDt)) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

      await prisma.series.upsert({
        where: { cricbuzzId },
        create: { name: s.name, startDate, endDate, status: 'active', cricbuzzId },
        update: { name: s.name, startDate, endDate },
      })
    }
    console.log(`[cricket-sync] syncSeries done — ${all.length} series upserted`)
  } catch (err) {
    console.error('[cricket-sync] syncSeries error:', err)
  }
}

async function upsertMatch(info: CricbuzzMatchInfo): Promise<void> {
  const cricbuzzMatchId = String(info.matchId)
  const cricbuzzSeriesId = String(info.seriesId)
  const status = mapState(info.state)
  const matchType = mapMatchFormat(info.matchFormat, info.seriesName)
  const matchDate = new Date(Number(info.startDate))
  const venue = info.venueInfo?.ground ?? info.venueInfo?.city ?? 'TBC'

  // Find or skip if parent series not in our DB yet
  const series = await prisma.series.findUnique({ where: { cricbuzzId: cricbuzzSeriesId } })
  if (!series) return // series not imported yet — will be picked up after next daily sync

  await prisma.match.upsert({
    where: { cricbuzzId: cricbuzzMatchId },
    create: {
      seriesId: series.id,
      teamA: info.team1.teamName,
      teamB: info.team2.teamName,
      matchDate,
      venue,
      matchType,
      status,
      cricbuzzId: cricbuzzMatchId,
      isActivated: false, // admin must activate before it enters the bet flow
    },
    update: {
      status,
      matchDate,
      venue,
      teamA: info.team1.teamName,
      teamB: info.team2.teamName,
    },
  })
}

export async function syncUpcomingMatches(): Promise<void> {
  console.log('[cricket-sync] syncUpcomingMatches start')
  try {
    const [upcoming, recent] = await Promise.all([fetchUpcomingMatches(), fetchRecentMatches()])
    const all = [...upcoming, ...recent]
    let count = 0
    for (const m of all) {
      try {
        await upsertMatch(m.matchInfo)
        count++
      } catch (err) {
        console.error(`[cricket-sync] upsertMatch error for matchId ${m.matchInfo?.matchId}:`, err)
      }
    }
    console.log(`[cricket-sync] syncUpcomingMatches done — ${count}/${all.length} processed`)
  } catch (err) {
    console.error('[cricket-sync] syncUpcomingMatches error:', err)
  }
}

export async function syncLiveMatches(): Promise<void> {
  // Only run if there are local live matches with a cricbuzzId
  const liveMatches = await prisma.match.findMany({
    where: { status: 'live', cricbuzzId: { not: null } },
    select: { id: true, cricbuzzId: true },
  })

  if (liveMatches.length === 0) return

  console.log(`[cricket-sync] syncLiveMatches — ${liveMatches.length} live matches`)

  for (const match of liveMatches) {
    try {
      const score = await fetchMatchScore(Number(match.cricbuzzId))
      const state = mapState(score.matchHeader.state)
      const innings = score.miniscore?.matchScoreDetails?.inningsScoreList ?? []
      const latestInnings = innings[innings.length - 1]
      const liveScore = latestInnings ? buildLiveScore(latestInnings) : null

      await prisma.match.update({
        where: { id: match.id },
        data: {
          status: state,
          liveScore: state === 'live' ? liveScore : null,
          result: state === 'completed' ? score.matchHeader.status : null,
        },
      })
    } catch (err) {
      console.error(`[cricket-sync] syncLiveMatches error for match ${match.id}:`, err)
    }
  }
}

export async function runFullSync(): Promise<void> {
  await syncSeries()
  await syncUpcomingMatches()
  await syncLiveMatches()
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cricket-sync.ts
git commit -m "feat: add cricket sync logic (syncSeries, syncUpcomingMatches, syncLiveMatches)"
```

---

## Task 4: Scheduler + instrumentation hook

**Files:**
- Create: `lib/cricket-scheduler.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.js`

- [ ] **Step 1: Install node-cron**

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

Expected: `added 2 packages`.

- [ ] **Step 2: Create `lib/cricket-scheduler.ts`**

```ts
import cron from 'node-cron'
import { syncSeries, syncUpcomingMatches, syncLiveMatches } from './cricket-sync'

export function startCricketSync(): void {
  if (!process.env.CRICBUZZ_API_KEY) {
    console.warn('[cricket-scheduler] CRICBUZZ_API_KEY not set — cricket sync disabled')
    return
  }

  console.log('[cricket-scheduler] Starting cricket sync scheduler')

  // Daily at 06:00 — discover new series
  cron.schedule('0 6 * * *', () => {
    syncSeries().catch(err => console.error('[cricket-scheduler] syncSeries failed:', err))
  })

  // Every 2 hours — import upcoming/recent matches
  cron.schedule('0 */2 * * *', () => {
    syncUpcomingMatches().catch(err => console.error('[cricket-scheduler] syncUpcomingMatches failed:', err))
  })

  // Every 5 minutes — update live match scores
  cron.schedule('*/5 * * * *', () => {
    syncLiveMatches().catch(err => console.error('[cricket-scheduler] syncLiveMatches failed:', err))
  })

  // Run an initial sync on startup (fire-and-forget)
  syncSeries()
    .then(() => syncUpcomingMatches())
    .catch(err => console.error('[cricket-scheduler] initial sync failed:', err))
}
```

- [ ] **Step 3: Create `instrumentation.ts`** at the project root (same level as `package.json`)

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCricketSync } = await import('./lib/cricket-scheduler')
    startCricketSync()
  }
}
```

- [ ] **Step 4: Enable instrumentation hook in `next.config.js`**

Replace the entire file with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    instrumentationHook: true,
  },
}

module.exports = nextConfig
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | head -30
```

Expected: `✓ Compiled successfully`. You will also see `[cricket-scheduler]` logs during dev if the API key is set.

- [ ] **Step 6: Commit**

```bash
git add lib/cricket-scheduler.ts instrumentation.ts next.config.js package.json package-lock.json
git commit -m "feat: add node-cron scheduler and Next.js instrumentation hook for cricket sync"
```

---

## Task 5: API routes — sync trigger, activate, and match list filter

**Files:**
- Create: `app/api/cricket/sync/route.ts`
- Create: `app/api/matches/[id]/activate/route.ts`
- Modify: `app/api/matches/route.ts`
- Modify: `lib/validators.ts`

- [ ] **Step 1: Add `activateMatchSchema` to `lib/validators.ts`**

Append before the final type exports (after line 101):

```ts
export const activateMatchSchema = z.object({})  // no body required
```

- [ ] **Step 2: Create `app/api/cricket/sync/route.ts`**

```ts
import { NextRequest } from 'next/server'
import { authenticateRequest, requireRole, jsonResponse, errorResponse } from '@/lib/middleware'
import { handleError } from '@/lib/errors'
import { runFullSync } from '@/lib/cricket-sync'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    // Fire-and-forget — return immediately, sync runs in background
    runFullSync().catch(err => console.error('[api/cricket/sync] runFullSync error:', err))

    return jsonResponse({ message: 'Sync triggered' })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 3: Create `app/api/matches/[id]/activate/route.ts`**

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { authenticateRequest, requireRole, jsonResponse, errorResponse } from '@/lib/middleware'
import { handleError, NotFoundError } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const existing = await prisma.match.findUnique({ where: { id: params.id } })
    if (!existing) throw new NotFoundError('Match not found')

    const match = await prisma.match.update({
      where: { id: params.id },
      data: { isActivated: true },
      include: { series: true },
    })

    return jsonResponse({ message: 'Match activated', match })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 4: Modify `app/api/matches/route.ts`**

Replace the entire file with:

```ts
import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { matchSchema } from '@/lib/validators'
import { errorResponse, jsonResponse, authenticateRequest, requireRole } from '@/lib/middleware'
import { handleError, ValidationError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    await authenticateRequest(request)

    const { searchParams } = new URL(request.url)
    const seriesId = searchParams.get('seriesId')
    const activatedOnly = searchParams.get('activated') === 'true'

    const where: Record<string, unknown> = {}
    if (seriesId) where.seriesId = seriesId
    if (activatedOnly) where.isActivated = true

    const matches = await prisma.match.findMany({
      where,
      orderBy: { matchDate: 'desc' },
      include: { series: true },
    })

    return jsonResponse({ matches })
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    requireRole(['ADMIN'])(user)

    const body = await request.json()

    const parsed = matchSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      )
    }

    const match = await prisma.match.create({
      data: {
        ...parsed.data,
        isActivated: true, // manually created matches are immediately available
      },
      include: { series: true },
    })

    return jsonResponse({ message: 'Match created successfully', match }, 201)
  } catch (error) {
    const { statusCode, message } = handleError(error)
    return errorResponse(message, statusCode)
  }
}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/cricket/sync/route.ts app/api/matches/[id]/activate/route.ts app/api/matches/route.ts lib/validators.ts
git commit -m "feat: add cricket sync API, match activate endpoint, and activated filter on matches list"
```

---

## Task 6: Admin UI — Imported Matches tab, Sync Now button, live badges

**Files:**
- Modify: `app/admin/page.tsx`

Read `app/admin/page.tsx` before editing. The file is large; the changes are additive.

- [ ] **Step 1: Add imports to `app/admin/page.tsx`**

Find the existing import block at the top. Add `RefreshCw, Radio` to the lucide-react import line:

```ts
import {
  LogOut, Plus, TrendingUp, TrendingDown, Users, Zap,
  Loader, BarChart3, Calendar, Clock, Shield, Edit2, Trash2,
  RefreshCw, Radio,
} from 'lucide-react'
```

- [ ] **Step 2: Add state for the Imported tab and sync button**

Find the existing state block (after line 80 roughly). Add these state variables near the other state declarations:

```ts
const [activeTab, setActiveTab] = useState<'series' | 'imported'>('series')
const [isSyncing, setIsSyncing] = useState(false)
const [importedMatches, setImportedMatches] = useState<Array<{
  id: string; teamA: string; teamB: string; matchDate: string;
  venue: string; matchType: string; status: string;
  series: { name: string }
}>>([])
```

- [ ] **Step 3: Add `loadImportedMatches` and `handleSync` functions**

Find where `loadData` or `fetchData` is defined. Add these two functions after it:

```ts
const loadImportedMatches = async () => {
  try {
    const res = await fetch('/api/matches?activated=false', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return
    const data = await res.json()
    // activated=false isn't directly supported — filter client-side from full list
    const all = data.matches ?? []
    setImportedMatches(all.filter((m: { isActivated: boolean }) => !m.isActivated))
  } catch {}
}

const handleSync = async () => {
  setIsSyncing(true)
  try {
    const res = await fetch('/api/cricket/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('Sync failed')
    toast.success('Sync triggered — data will update shortly')
    setTimeout(() => { loadData(); loadImportedMatches() }, 3000)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Sync failed')
  } finally {
    setIsSyncing(false)
  }
}

const handleActivate = async (matchId: string) => {
  try {
    const res = await fetch(`/api/matches/${matchId}/activate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('Failed to activate match')
    toast.success('Match activated')
    loadImportedMatches()
    loadData()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed')
  }
}
```

- [ ] **Step 4: Call `loadImportedMatches` in the existing `useEffect`**

Find the `useEffect` that calls `loadData()` (or `fetchData()`). Add `loadImportedMatches()` to it:

```ts
useEffect(() => {
  if (!user) { router.push('/login'); return }
  if (user.role !== 'ADMIN') { router.push('/dashboard'); return }
  loadData()
  loadImportedMatches()
}, [user, router])
```

- [ ] **Step 5: Add Sync Now button to the admin header**

Find the admin `<header>` section. Add the Sync Now button alongside the existing Logout/New buttons:

```tsx
<button
  onClick={handleSync}
  disabled={isSyncing}
  className="btn-ghost text-xs px-3 py-2 flex items-center gap-1"
  title="Sync cricket data from Cricbuzz"
>
  <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
  <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
</button>
```

- [ ] **Step 6: Add tab switcher and Imported Matches tab content**

Find where the series list is rendered (the main content area). Wrap the existing series list in a tab structure:

```tsx
{/* Tab switcher */}
<div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-4">
  <button
    onClick={() => setActiveTab('series')}
    className={`flex-1 py-2 text-sm rounded-lg font-medium ${activeTab === 'series' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
  >
    Series & Matches
  </button>
  <button
    onClick={() => setActiveTab('imported')}
    className={`flex-1 py-2 text-sm rounded-lg font-medium flex items-center justify-center gap-2 ${activeTab === 'imported' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
  >
    Imported
    {importedMatches.length > 0 && (
      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
        {importedMatches.length}
      </span>
    )}
  </button>
</div>

{/* Existing series content — wrap in: */}
{activeTab === 'series' && (
  <div>
    {/* ... existing series list JSX stays here unchanged ... */}
  </div>
)}

{/* Imported Matches tab */}
{activeTab === 'imported' && (
  <div className="space-y-3">
    {importedMatches.length === 0 ? (
      <div className="text-center text-slate-500 py-10">
        <Radio size={32} className="mx-auto mb-3 opacity-30" />
        No unactivated imported matches. Click Sync to fetch from Cricbuzz.
      </div>
    ) : (
      importedMatches.map(m => (
        <div key={m.id} className="bg-slate-900 rounded-xl p-4 border border-slate-800 flex justify-between items-center">
          <div>
            <p className="font-medium text-white">{m.teamA} vs {m.teamB}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {m.series.name} · {m.matchType} · {new Date(m.matchDate).toLocaleDateString('en-IN')} · {m.venue}
            </p>
          </div>
          <button
            onClick={() => handleActivate(m.id)}
            className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-1.5 rounded-full"
          >
            Activate
          </button>
        </div>
      ))
    )}
  </div>
)}
```

- [ ] **Step 7: Add live badges to activated match cards in the Series tab**

In the existing series match list, find where each match row is rendered. After the team name and status, add:

```tsx
{/* After match status span, add: */}
{match.status === 'live' && (
  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 ml-2">
    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
    LIVE
  </span>
)}
{(match as { result?: string }).result && match.status === 'completed' && (
  <p className="text-xs text-slate-500 mt-0.5">{(match as { result?: string }).result}</p>
)}
```

Also update the `SeriesData` interface at the top of the file to include the new fields:

```ts
interface SeriesData {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  matches: Array<{
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate?: string
    venue?: string
    matchType?: string
    liveScore?: string
    result?: string
    isActivated?: boolean
    _count?: { betEntries: number }
  }>
}
```

- [ ] **Step 8: Build check**

```bash
npm run build 2>&1 | head -30
```

Fix any TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add Imported Matches tab, Sync Now button, and live badges to admin UI"
```

---

## Task 7: User-facing UI — live dot + result on new-bet, dashboard, series, friend pages

**Files:**
- Modify: `app/dashboard/new-bet/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/series/[id]/page.tsx`
- Modify: `app/friend/dashboard/page.tsx`
- Modify: `app/friend/bets/page.tsx`

### 7a — New-bet form: activated filter + LIVE prefix

- [ ] **Step 1: Update match fetch in `app/dashboard/new-bet/page.tsx`**

Find line 62:
```ts
fetch('/api/matches', { headers: { Authorization: `Bearer ${accessToken}` } }),
```

Replace with:
```ts
fetch('/api/matches?activated=true', { headers: { Authorization: `Bearer ${accessToken}` } }),
```

- [ ] **Step 2: Update Match interface to include new fields**

Find the `Match` interface (around line 21):
```ts
interface Match {
  id: string
  seriesId: string
  teamA: string
  teamB: string
  matchDate: string
  venue: string
  status: string
}
```

Replace with:
```ts
interface Match {
  id: string
  seriesId: string
  teamA: string
  teamB: string
  matchDate: string
  venue: string
  status: string
  liveScore?: string
  result?: string
}
```

- [ ] **Step 3: Update match dropdown to show LIVE prefix**

Find the match `<option>` at line 192:
```tsx
<option key={match.id} value={match.id}>
  {match.teamA} vs {match.teamB} — {new Date(match.matchDate).toLocaleDateString('en-IN')}
</option>
```

Replace with:
```tsx
<option key={match.id} value={match.id}>
  {match.status === 'live' ? '🔴 LIVE — ' : ''}{match.teamA} vs {match.teamB} — {new Date(match.matchDate).toLocaleDateString('en-IN')}
</option>
```

- [ ] **Step 4: Show liveScore in the selected match info panel**

Find the `selectedMatch && (` block (around line 199). Inside the info panel, after the status badge span, add:

```tsx
{selectedMatch.liveScore && (
  <p className="text-xs text-emerald-400 font-mono mt-1">{selectedMatch.liveScore}</p>
)}
{selectedMatch.result && (
  <p className="text-xs text-slate-400 mt-1">{selectedMatch.result}</p>
)}
```

### 7b — Dashboard bets table: live dot + result

- [ ] **Step 5: Update `Bet` interface in `app/dashboard/page.tsx`**

Find the `Bet` interface (lines 17–35). Update the `match` field:
```ts
  match: {
    id: string
    teamA: string
    teamB: string
    status: string
    matchDate: string
    liveScore?: string
    result?: string
    series: { id: string; name: string }
  }
```

- [ ] **Step 6: Update match column in bets table**

Find this cell (around line 324–327):
```tsx
<td>
  <div className="font-medium">{bet.match.teamA} vs {bet.match.teamB}</div>
  <div className="text-xs text-slate-500 capitalize">{bet.match.status}</div>
</td>
```

Replace with:
```tsx
<td>
  <div className="flex items-center gap-1.5 font-medium">
    {bet.match.status === 'live' && (
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
    )}
    {bet.match.teamA} vs {bet.match.teamB}
  </div>
  {bet.match.liveScore && (
    <div className="text-xs text-emerald-400 font-mono">{bet.match.liveScore}</div>
  )}
  {bet.match.result && !bet.match.liveScore && (
    <div className="text-xs text-slate-500">{bet.match.result}</div>
  )}
  {!bet.match.liveScore && !bet.match.result && (
    <div className="text-xs text-slate-500 capitalize">{bet.match.status}</div>
  )}
</td>
```

### 7c — Series detail page: liveScore + result on match cards

- [ ] **Step 7: Update `MatchBreakdown` interface in `app/dashboard/series/[id]/page.tsx`**

Find the `MatchBreakdown` interface. Add two fields:
```ts
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
  liveScore?: string   // add this
  result?: string      // add this
  bets: MatchBet[]
}
```

- [ ] **Step 8: Show liveScore/result in match card headers**

Find the collapsible match card button. After the match P&L and expand arrow, add inside the button's right `<div>`:

```tsx
{m.liveScore && (
  <p className="text-xs text-emerald-400 font-mono">{m.liveScore}</p>
)}
{m.result && !m.liveScore && (
  <p className="text-xs text-slate-500 text-right">{m.result}</p>
)}
```

Also add the pulsing dot to the match label for live matches. Find:
```tsx
<p className="font-medium text-white text-sm">{m.label} · {m.matchType}</p>
```

Replace with:
```tsx
<p className="font-medium text-white text-sm flex items-center gap-1.5">
  {m.liveScore && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
  {m.label} · {m.matchType}
</p>
```

### 7d — Friend dashboard + bets: live dot + result

- [ ] **Step 9: Update `Bet` interface in `app/friend/dashboard/page.tsx`**

Find the `Bet` interface. Add to the `match` field:
```ts
  match: {
    id: string
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    liveScore?: string   // add
    result?: string      // add
    series: { id: string; name: string }
  }
```

- [ ] **Step 10: Show liveScore/result on bet cards in `app/friend/dashboard/page.tsx`**

Find the bet card block inside the series map (the `<div className="flex items-center gap-2 text-xs text-slate-500">` block). After the settlement status span, add:

```tsx
{bet.match.liveScore && (
  <span className="text-emerald-400 font-mono">{bet.match.liveScore}</span>
)}
{bet.match.result && !bet.match.liveScore && (
  <span className="text-slate-400">{bet.match.result}</span>
)}
```

Also add a live dot to the match name. Find:
```tsx
<p className="font-medium text-white">{bet.match.teamA} vs {bet.match.teamB}</p>
```

Replace with:
```tsx
<p className="font-medium text-white flex items-center gap-1.5">
  {bet.match.liveScore && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
  {bet.match.teamA} vs {bet.match.teamB}
</p>
```

- [ ] **Step 11: Apply same changes to `app/friend/bets/page.tsx`**

Update the `Bet` interface to add `liveScore?: string` and `result?: string` to the `match` field:

```ts
  match: {
    teamA: string
    teamB: string
    matchDate: string
    matchType: string
    liveScore?: string
    result?: string
    series: { name: string }
  }
```

Find the match team name line:
```tsx
<p className="font-medium text-white">{bet.match.teamA} vs {bet.match.teamB}</p>
```

Replace with:
```tsx
<p className="font-medium text-white flex items-center gap-1.5">
  {bet.match.liveScore && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
  {bet.match.teamA} vs {bet.match.teamB}
</p>
```

After the series/date info line, add:
```tsx
{bet.match.liveScore && (
  <p className="text-xs text-emerald-400 font-mono">{bet.match.liveScore}</p>
)}
{bet.match.result && !bet.match.liveScore && (
  <p className="text-xs text-slate-400">{bet.match.result}</p>
)}
```

- [ ] **Step 12: Final build check**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with zero TypeScript errors.

- [ ] **Step 13: Commit**

```bash
git add app/dashboard/new-bet/page.tsx app/dashboard/page.tsx app/dashboard/series/[id]/page.tsx app/friend/dashboard/page.tsx app/friend/bets/page.tsx
git commit -m "feat: show live dot, liveScore, and result across new-bet, dashboard, series, and friend pages"
```

---

## Self-Review Checklist (completed inline)

**Spec coverage:**
- ✅ Schema: `cricbuzzId`, `isActivated`, `liveScore`, `result` on Match; `cricbuzzId` on Series (Task 1)
- ✅ `lib/cricbuzz-client.ts` with all 6 fetch functions (Task 2)
- ✅ `syncSeries`, `syncUpcomingMatches`, `syncLiveMatches` (Task 3)
- ✅ `instrumentation.ts` + `node-cron` scheduler + adaptive timing (Task 4)
- ✅ `POST /api/cricket/sync` + `PATCH /api/matches/[id]/activate` (Task 5)
- ✅ `GET /api/matches?activated=true` filter (Task 5)
- ✅ `POST /api/matches` defaults `isActivated: true` for manual (Task 5)
- ✅ Admin: Imported Matches tab + Sync Now button + live badges (Task 6)
- ✅ New-bet: activated filter + LIVE prefix (Task 7a)
- ✅ Dashboard bets table: live dot + liveScore + result (Task 7b)
- ✅ Series detail: liveScore + result + live dot on match cards (Task 7c)
- ✅ Friend dashboard + bets: live dot + liveScore + result (Task 7d)
- ✅ `.env.example` updated with `CRICBUZZ_API_KEY` (Task 1)
- ✅ Migration sets `isActivated = true` for existing rows (Task 1, Step 3)

**Type consistency:** All interfaces use `liveScore?: string` and `result?: string` consistently. `CricbuzzMatchInfo`, `CricbuzzSeries`, `CricbuzzMatchScore` types defined in Task 2 and used in Task 3 without drift.

**No placeholders:** All code blocks are complete. All file paths are exact.
