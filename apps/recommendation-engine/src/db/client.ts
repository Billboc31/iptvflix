import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { DATABASE_URL } from '../config.js'

export const pgClient = postgres(DATABASE_URL, { max: 5 })
export const db = drizzle(pgClient)
