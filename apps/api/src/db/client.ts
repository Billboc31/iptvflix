import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { DATABASE_URL } from '../config/env.js'
import * as schema from './schema/index.js'
import { describeDatabaseUrl } from './postgres-url.js'

const pool = postgres(DATABASE_URL, {
  max: 10,
  connect_timeout: 30,
})
const target = describeDatabaseUrl(DATABASE_URL)
console.log(`[db] postgres host=${target.host} port=${target.port}`)

export const db = drizzle(pool, { schema })
