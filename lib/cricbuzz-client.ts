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
    next: { revalidate: 0 },
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
