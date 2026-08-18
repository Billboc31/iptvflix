const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

export const DATABASE_URL: string = databaseUrl
export const PORT = Number(process.env.PORT ?? 3001)
export const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info'
export const OPENAI_API_KEY: string | undefined = process.env.OPENAI_API_KEY || undefined
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'
