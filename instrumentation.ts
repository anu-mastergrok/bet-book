export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCricketSync } = await import('./lib/cricket-scheduler')
    startCricketSync()
  }
}
