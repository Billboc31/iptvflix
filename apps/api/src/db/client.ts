import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { DATABASE_URL } from '../config/env.js'
import * as schema from './schema/index.js'

const pool = postgres(DATABASE_URL)
export const db = drizzle(pool, { schema })
