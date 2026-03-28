import cron from 'node-cron'
import { syncSeries, syncUpcomingMatches, syncLiveMatches } from './cricket-sync'

export function startCricketSync(): void {
  if (!process.env.CRICBUZZ_API_KEY) {
    console.warn('[cricket-scheduler] CRICBUZZ_API_KEY not set — cricket sync disabled')
    return
  }

  cron.schedule('0 6 * * *', async () => {
    console.log('[cricket-scheduler] Running daily series sync')
    try {
      await syncSeries()
    } catch (err) {
      console.error('[cricket-scheduler] Series sync failed:', err)
    }
  })

  cron.schedule('0 */2 * * *', async () => {
    console.log('[cricket-scheduler] Running upcoming matches sync')
    try {
      await syncUpcomingMatches()
    } catch (err) {
      console.error('[cricket-scheduler] Upcoming sync failed:', err)
    }
  })

  cron.schedule('*/5 * * * *', async () => {
    console.log('[cricket-scheduler] Running live match score sync')
    try {
      await syncLiveMatches()
    } catch (err) {
      console.error('[cricket-scheduler] Live sync failed:', err)
    }
  })

  console.log('[cricket-scheduler] Cricket sync jobs registered')
}
