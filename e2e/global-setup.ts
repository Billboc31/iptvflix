import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startFakeXtream } from './fixtures/xtream-server.js'
import { startFakeM3U } from './fixtures/m3u-server.js'

const SERVERS_FILE = join(import.meta.dirname, '.fake-servers.json')

export default async function globalSetup() {
  const [happy, empty, authFail, m3uHappy, m3uAuthFail, m3uEmpty, m3uMalformed] =
    await Promise.all([
      startFakeXtream('happy', 9998),
      startFakeXtream('empty', 9997),
      startFakeXtream('auth-fail', 9996),
      startFakeM3U('happy', 9995),
      startFakeM3U('auth-fail', 9994),
      startFakeM3U('empty', 9993),
      startFakeM3U('malformed', 9992),
    ])

  writeFileSync(
    SERVERS_FILE,
    JSON.stringify({
      happy: happy.baseUrl,
      empty: empty.baseUrl,
      authFail: authFail.baseUrl,
      m3uHappy: m3uHappy.baseUrl,
      m3uAuthFail: m3uAuthFail.baseUrl,
      m3uEmpty: m3uEmpty.baseUrl,
      m3uMalformed: m3uMalformed.baseUrl,
    }),
  )

  return async () => {
    await Promise.all([
      happy.stop(),
      empty.stop(),
      authFail.stop(),
      m3uHappy.stop(),
      m3uAuthFail.stop(),
      m3uEmpty.stop(),
      m3uMalformed.stop(),
    ])
  }
}
