import { eq, isNull, and } from 'drizzle-orm'
import { db } from './client.js'
import { accounts, profiles } from './schema/index.js'
import { AUTH_USERNAME, AUTH_PASSWORD_HASH } from '../config/env.js'

const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export async function runSeed(): Promise<void> {
  // Ensure the default account exists
  let [defaultAccount] = await db.select().from(accounts).where(eq(accounts.username, AUTH_USERNAME))

  if (!defaultAccount) {
    ;[defaultAccount] = await db
      .insert(accounts)
      .values({ username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH })
      .returning()
  }

  // Link the pre-T098 default profile to the default account if it exists and is unlinked
  const [legacyProfile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, DEFAULT_PROFILE_ID), isNull(profiles.accountId)))

  if (legacyProfile) {
    await db
      .update(profiles)
      .set({ accountId: defaultAccount.id })
      .where(eq(profiles.id, DEFAULT_PROFILE_ID))
    return
  }

  // Create a default profile if the account has none yet
  const [existingProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, defaultAccount.id))

  if (!existingProfile) {
    await db.insert(profiles).values({
      id: DEFAULT_PROFILE_ID,
      accountId: defaultAccount.id,
      name: 'Default',
    })
  }
}
