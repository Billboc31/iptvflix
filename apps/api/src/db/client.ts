import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { DATABASE_URL } from '../config/env.js'
import * as schema from './schema/index.js'
import { describeDatabaseUrl, isLocalDatabaseUrl, isRailwayInternalUrl } from './postgres-url.js'

function createPool() {
  const local = isLocalDatabaseUrl(DATABASE_URL)
  const internal = isRailwayInternalUrl(DATABASE_URL)
  // Public Railway TCP proxy (*.proxy.rlwy.net) is uneven: some instances
  // complete TLS, others RST the handshake. Prefer no SSL unless local/internal
  // already work without it. Explicit sslmode=require in the URL is honoured
  // by postgres.js — we override it for the flaky public proxy.
  const forcePlain =
    local || internal || /proxy\.rlwy\.net/i.test(DATABASE_URL)
  return postgres(DATABASE_URL, {
    max: 10,
    connect_timeout: 10,
    ssl: forcePlain ? false : undefined,
  })
}

const pool = createPool()
const target = describeDatabaseUrl(DATABASE_URL)
console.log(`[db] postgres host=${target.host} port=${target.port}`)

export const db = drizzle(pool, { schema })
