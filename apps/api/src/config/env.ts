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
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
export const TMDB_API_KEY: string | undefined = process.env.TMDB_API_KEY || undefined
export const TMDB_STALE_DAYS = Number(process.env.TMDB_STALE_DAYS ?? 7)
export const WEB_SECRET: string | undefined = process.env.WEB_SECRET || undefined
export const JWT_SECRET: string = jwtSecret
export const AUTH_USERNAME: string = process.env.AUTH_USERNAME ?? 'admin'
export const AUTH_PASSWORD_HASH: string = authPasswordHash
export const M3U_FETCH_TIMEOUT_MS = Number(process.env.M3U_FETCH_TIMEOUT_MS ?? 60000)
