import type { FastifyInstance } from 'fastify'
import { and, count, countDistinct, desc, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profileInteractionEvents, profileTaste, profiles } from '../db/schema/index.js'
import { runCompaction, getRetentionStats } from '../services/retention-service.js'

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Events per day (last 30 days), top event types, distinct profile count, total count
  app.get('/admin/interaction-stats', async (_request, reply) => {
    const since = new Date(Date.now() - 30 * 86_400_000)

    const [dailyRows, topTypeRows, profileCountRow, totalRow] = await Promise.all([
      db
        .select({
          day: sql<string>`date_trunc('day', ${profileInteractionEvents.occurredAt})::date::text`,
          count: count(),
        })
        .from(profileInteractionEvents)
        .where(gte(profileInteractionEvents.occurredAt, since))
        .groupBy(sql`date_trunc('day', ${profileInteractionEvents.occurredAt})`)
        .orderBy(sql`date_trunc('day', ${profileInteractionEvents.occurredAt}) DESC`),
      db
        .select({ eventType: profileInteractionEvents.eventType, count: count() })
        .from(profileInteractionEvents)
        .groupBy(profileInteractionEvents.eventType)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ c: countDistinct(profileInteractionEvents.profileId) })
        .from(profileInteractionEvents),
      db.select({ c: count() }).from(profileInteractionEvents),
    ])

    return reply.send({
      eventsPerDay: dailyRows,
      topEventTypes: topTypeRows,
      distinctProfiles: Number(profileCountRow[0]?.c ?? 0),
      totalEvents: Number(totalRow[0]?.c ?? 0),
    })
  })

  // Taste coverage: profiles with computed taste, those with enough signal, oldest builtAt
  app.get('/admin/taste-stats', async (_request, reply) => {
    const [tasteRows, activeProfileRow] = await Promise.all([
      db
        .select({
          profileId: profileTaste.profileId,
          signalCount: profileTaste.signalCount,
          builtAt: profileTaste.builtAt,
          historyEventCount: profileTaste.historyEventCount,
        })
        .from(profileTaste),
      db.select({ c: count() }).from(profiles),
    ])

    const totalActive = Number(activeProfileRow[0]?.c ?? 0)
    const withTaste = tasteRows.length
    const withEnoughSignal = tasteRows.filter((r) => r.signalCount >= 5).length
    const oldest = tasteRows.reduce(
      (acc, r) => (!acc || r.builtAt < acc ? r.builtAt : acc),
      null as Date | null,
    )

    return reply.send({
      profilesWithTaste: withTaste,
      profilesWithEnoughSignal: withEnoughSignal,
      totalActiveProfiles: totalActive,
      coveragePercent: totalActive > 0 ? Math.round((withTaste / totalActive) * 100) : 0,
      oldestTasteBuiltAt: oldest?.toISOString() ?? null,
    })
  })

  // Health: duplicate idempotency rejections, milestone coverage, zero-event profiles
  app.get('/admin/interaction-health', async (_request, reply) => {
    const [milestoneRows, startedRows, zeroEventRows, totalProfileRow] = await Promise.all([
      db
        .select({ profileId: profileInteractionEvents.profileId })
        .from(profileInteractionEvents)
        .where(
          inArray(profileInteractionEvents.eventType, [
            'WATCHED_10_PERCENT', 'WATCHED_25_PERCENT', 'WATCHED_50_PERCENT',
            'WATCHED_75_PERCENT', 'WATCHED_90_PERCENT',
          ]),
        )
        .groupBy(profileInteractionEvents.profileId),
      db
        .select({ profileId: profileInteractionEvents.profileId })
        .from(profileInteractionEvents)
        .where(sql`${profileInteractionEvents.eventType} = 'PLAY_STARTED'`)
        .groupBy(profileInteractionEvents.profileId),
      db
        .select({ profileId: profiles.id })
        .from(profiles)
        .leftJoin(profileInteractionEvents, sql`${profiles.id} = ${profileInteractionEvents.profileId}`)
        .groupBy(profiles.id)
        .having(sql`count(${profileInteractionEvents.id}) = 0`),
      db.select({ c: count() }).from(profiles),
    ])

    const startedSet = new Set(startedRows.map((r) => r.profileId))
    const milestoneSet = new Set(milestoneRows.map((r) => r.profileId))
    const profilesWithStartedAndMilestone = [...startedSet].filter((id) => milestoneSet.has(id)).length

    return reply.send({
      profilesWithZeroEvents: zeroEventRows.length,
      totalProfiles: Number(totalProfileRow[0]?.c ?? 0),
      milestoneCoveragePercent:
        startedSet.size > 0
          ? Math.round((profilesWithStartedAndMilestone / startedSet.size) * 100)
          : 0,
    })
  })

  // Retention stats: events past retention window not yet compacted
  app.get('/admin/retention-stats', async (_request, reply) => {
    const stats = await getRetentionStats()
    return reply.send(stats)
  })

  // Trigger compaction manually
  app.post('/admin/retention-compact', async (_request, reply) => {
    const result = await runCompaction()
    return reply.send(result)
  })
}
