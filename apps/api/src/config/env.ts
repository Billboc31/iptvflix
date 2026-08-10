const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured')
}

export const DATABASE_URL: string = databaseUrl
export const PORT = Number(process.env.PORT ?? 3000)
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
