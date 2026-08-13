const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('JWT_SECRET is not configured')
}

const authPasswordHash = process.env.AUTH_PASSWORD_HASH
if (!authPasswordHash) {
  throw new Error('AUTH_PASSWORD_HASH is not configured')
}

export const DATABASE_URL: string = databaseUrl
export const PORT = Number(process.env.PORT ?? 3000)
/** Browser Origin must not include a trailing slash or CORS preflight fails. */
export const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
export const TMDB_API_KEY: string | undefined = process.env.TMDB_API_KEY || undefined
export const TMDB_STALE_DAYS = Number(process.env.TMDB_STALE_DAYS ?? 7)
export const WEB_SECRET: string | undefined = process.env.WEB_SECRET || undefined
export const JWT_SECRET: string = jwtSecret
export const AUTH_USERNAME: string = process.env.AUTH_USERNAME ?? 'admin'
export const AUTH_PASSWORD_HASH: string = authPasswordHash
export const M3U_FETCH_TIMEOUT_MS = Number(process.env.M3U_FETCH_TIMEOUT_MS ?? 60000)
export const SYNC_SCHEDULER_ENABLED =
  process.env.SYNC_SCHEDULER_ENABLED !== undefined
    ? process.env.SYNC_SCHEDULER_ENABLED === 'true'
    : process.env.NODE_ENV === 'production'
export const SOURCE_SYNC_CADENCE_MINUTES = Number(process.env.SOURCE_SYNC_CADENCE_MINUTES ?? 60)
export const DISCOVERY_CADENCE_MINUTES = Number(process.env.DISCOVERY_CADENCE_MINUTES ?? 360)
export const SOURCE_SYNC_CONCURRENCY = Number(process.env.SOURCE_SYNC_CONCURRENCY ?? 2)
export const SCHEDULER_STARTUP_DELAY_MS = Number(process.env.SCHEDULER_STARTUP_DELAY_MS ?? 30000)
