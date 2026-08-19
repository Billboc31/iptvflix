import { eq, isNull } from 'drizzle-orm';
import { db } from './client.js';
import { accounts, profiles } from './schema/index.js';
import { AUTH_USERNAME, AUTH_PASSWORD_HASH } from '../config/env.js';
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
export async function runSeed() {
    let [defaultAccount] = await db.select().from(accounts).where(eq(accounts.username, AUTH_USERNAME));
    if (!defaultAccount) {
        ;
        [defaultAccount] = await db
            .insert(accounts)
            .values({ username: AUTH_USERNAME, passwordHash: AUTH_PASSWORD_HASH })
            .onConflictDoNothing({ target: accounts.username })
            .returning();
        if (!defaultAccount) {
            ;
            [defaultAccount] = await db.select().from(accounts).where(eq(accounts.username, AUTH_USERNAME));
        }
    }
    if (!defaultAccount) {
        throw new Error('Failed to ensure default account');
    }
    // Pre-T098 profiles (and any later orphans) have account_id NULL. GET /profiles
    // filters by account, so they vanish after login unless we re-attach them.
    await db.update(profiles).set({ accountId: defaultAccount.id }).where(isNull(profiles.accountId));
    const [existingProfile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, defaultAccount.id));
    if (existingProfile)
        return;
    const [reservedId] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, DEFAULT_PROFILE_ID));
    if (reservedId) {
        await db.insert(profiles).values({
            accountId: defaultAccount.id,
            name: 'Default',
        });
        return;
    }
    await db.insert(profiles).values({
        id: DEFAULT_PROFILE_ID,
        accountId: defaultAccount.id,
        name: 'Default',
    });
}
//# sourceMappingURL=seed.js.map