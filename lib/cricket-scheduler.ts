import cron from 'node-cron'
import { syncSeries, syncUpcomingMatches, syncLiveMatches } from './cricket-sync'

export function startCricketSync(): void {
  if (!process.env.CRICBUZZ_API_KEY) {
    console.warn('[cricket-scheduler] CRICBUZZ_API_KEY not set — cricket sync disabled')
    return
  }

  cron.schedule('0 6 * * *', () => {
    console.log('[cricket-scheduler] Running daily series sync')
    syncSeries()
  })

  cron.schedule('0 */2 * * *', () => {
    console.log('[cricket-scheduler] Running upcoming matches sync')
    syncUpcomingMatches()
  })

  cron.schedule('*/5 * * * *', () => {
    console.log('[cricket-scheduler] Running live match score sync')
    syncLiveMatches()
  })

  console.log('[cricket-scheduler] Cricket sync jobs registered')
}
