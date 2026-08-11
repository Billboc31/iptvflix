import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profiles } from '../db/schema/index.js'

export const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export async function getDefaultProfile() {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, DEFAULT_PROFILE_ID))
  if (!row) throw new Error('Default profile not found — run migrations')
  return row
}
