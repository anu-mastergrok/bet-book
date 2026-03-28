import prisma from '@/lib/db'
import {
  fetchInternationalSeries,
  fetchDomesticSeries,
  fetchUpcomingMatches,
  fetchRecentMatches,
  fetchMatchScore,
  CricbuzzMatchInfo,
} from '@/lib/cricbuzz-client'

// --- Helpers ---

function parseMatchType(matchDesc: string, matchFormat: string, seriesName: string): string {
  if ((seriesName ?? '').toLowerCase().includes('ipl')) return 'IPL'
  const d = (matchDesc ?? '').toLowerCase()
  if (d.includes('t20i') || d.includes('t20')) return 'T20'
  if (d.includes('odi')) return 'ODI'
  if (d.includes('test')) return 'Test'
  // Fall back to matchFormat
  const f = (matchFormat ?? '').toUpperCase()
  if (f === 'TEST') return 'Test'
  if (f === 'ODI') return 'ODI'
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
  const matchType = parseMatchType(info.matchDesc, info.matchFormat, info.seriesName)
  const matchDate = new Date(Number(info.startDate))
  const venue = info.venueInfo?.ground ?? info.venueInfo?.city ?? 'TBC'

  // Find parent series — skip if not yet imported
  const series = await prisma.series.findUnique({ where: { cricbuzzId: cricbuzzSeriesId } })
  if (!series) return

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
      isActivated: false,
    },
    update: {
      status,
      matchDate,
      venue,
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
  console.log('[cricket-sync] syncLiveMatches start')
  try {
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
  } catch (err) {
    console.error('[cricket-sync] syncLiveMatches error:', err)
  }
}

export async function runFullSync(): Promise<void> {
  await syncSeries()
  await syncUpcomingMatches()
  await syncLiveMatches()
}
