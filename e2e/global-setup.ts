import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startFakeXtream } from './fixtures/xtream-server.js'

const SERVERS_FILE = join(import.meta.dirname, '.fake-servers.json')

export default async function globalSetup() {
  const [happy, empty, authFail] = await Promise.all([
    startFakeXtream('happy', 9998),
    startFakeXtream('empty', 9997),
    startFakeXtream('auth-fail', 9996),
  ])

  writeFileSync(
    SERVERS_FILE,
    JSON.stringify({
      happy: happy.baseUrl,
      empty: empty.baseUrl,
      authFail: authFail.baseUrl,
    }),
  )

  return async () => {
    await Promise.all([happy.stop(), empty.stop(), authFail.stop()])
  }
}
