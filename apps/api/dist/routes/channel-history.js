import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { channelHistory } from '../db/schema/channel-history.js';
import { channels } from '../db/schema/channels.js';
export async function channelHistoryRoutes(app) {
    app.get('/channels/history', async (req, reply) => {
        const profileId = req.profileId;
        // Dedup: one row per channelId, keeping the most recent watchedAt
        const rows = await db
            .selectDistinctOn([channelHistory.channelId], {
            channelId: channelHistory.channelId,
            watchedAt: channelHistory.watchedAt,
            name: channels.canonicalName,
            logoUrl: channels.logoUrl,
        })
            .from(channelHistory)
            .innerJoin(channels, eq(channelHistory.channelId, channels.id))
            .where(eq(channelHistory.profileId, profileId))
            .orderBy(channelHistory.channelId, desc(channelHistory.watchedAt))
            .limit(20);
        // Sort by watchedAt desc across all deduped rows
        rows.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
        return reply.send(rows.map((row) => ({
            channelId: row.channelId,
            name: row.name,
            logoUrl: row.logoUrl ?? null,
            watchedAt: row.watchedAt.toISOString(),
        })));
    });
    app.post('/channels/:id/history', async (req, reply) => {
        const profileId = req.profileId;
        const channelId = req.params.id;
        await db.insert(channelHistory).values({ profileId, channelId });
        return reply.status(204).send();
    });
}
//# sourceMappingURL=channel-history.js.map