import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { sources } from '../../db/schema/sources.js'
import { channels } from '../../db/schema/channels.js'
import { channelSources } from '../../db/schema/channel-sources.js'
import { ChannelSyncService, type LiveChannelEntry } from '../channel-sync-service.js'

let testSourceId: string
let testSourceId2: string

function makeEntry(overrides: Partial<LiveChannelEntry> & { providerItemId: string; providerName: string; streamUrl: string }): LiveChannelEntry {
  return {
    tvgId: null,
    tvgLogo: null,
    groupTitle: null,
    priority: 0,
    ...overrides,
  }
}

beforeAll(async () => {
  const [src1] = await db
    .insert(sources)
    .values({ name: 'Channel Sync Test Source A', type: 'M3U', baseUrl: 'http://test-ch-a.example.com', username: 'u', password: 'p' })
    .returning()
  const [src2] = await db
    .insert(sources)
    .values({ name: 'Channel Sync Test Source B', type: 'M3U', baseUrl: 'http://test-ch-b.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId = src1.id
  testSourceId2 = src2.id
})

afterAll(async () => {
  await db.delete(sources).where(inArray(sources.id, [testSourceId, testSourceId2]))
})

afterEach(async () => {
  const sourceRows = await db
    .select({ id: channelSources.channelId })
    .from(channelSources)
    .where(inArray(channelSources.sourceId, [testSourceId, testSourceId2]))
  const channelIds = [...new Set(sourceRows.map((r) => r.id))]
  if (channelIds.length > 0) {
    await db.delete(channels).where(inArray(channels.id, channelIds))
  }
})

describe('ChannelSyncService', () => {
  describe('first sync — creates channels and sources', () => {
    it('creates one canonical channel per distinct entry', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'tf1', providerName: 'TF1', streamUrl: 'http://stream/tf1', tvgId: 'TF1' }),
        makeEntry({ providerItemId: 'france2', providerName: 'France 2', streamUrl: 'http://stream/f2', tvgId: 'France2' }),
      ]

      const result = await ChannelSyncService.syncLiveChannels(testSourceId, entries)

      expect(result.channelsCreated).toBe(2)
      expect(result.sourcesCreated).toBe(2)
      expect(result.channelsUpdated).toBe(0)
      expect(result.sourcesUpdated).toBe(0)
    })
  })

  describe('deduplication — name variants map to one channel', () => {
    it('merges TF1, TF1 HD, and TF1 FHD into one canonical channel', async () => {
      const tvgId = 'TF1'
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'tf1-sd', providerName: 'TF1', streamUrl: 'http://stream/tf1', tvgId }),
        makeEntry({ providerItemId: 'tf1-hd', providerName: 'TF1 HD', streamUrl: 'http://stream/tf1-hd', tvgId }),
        makeEntry({ providerItemId: 'tf1-fhd', providerName: 'TF1 FHD', streamUrl: 'http://stream/tf1-fhd', tvgId }),
      ]

      const result = await ChannelSyncService.syncLiveChannels(testSourceId, entries)

      expect(result.channelsCreated).toBe(1)
      expect(result.sourcesCreated).toBe(3)

      const sourceRows = await db
        .select({ channelId: channelSources.channelId })
        .from(channelSources)
        .where(eq(channelSources.sourceId, testSourceId))
      const uniqueChannelIds = new Set(sourceRows.map((r) => r.channelId))
      expect(uniqueChannelIds.size).toBe(1)
    })
  })

  describe('merge — unique normalized name (quality variants)', () => {
    it('merges Arte / Arte HD when no tvgId conflict', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'arte-sd', providerName: 'Arte', streamUrl: 'http://stream/arte' }),
        makeEntry({ providerItemId: 'arte-hd', providerName: 'Arte HD', streamUrl: 'http://stream/arte-hd' }),
      ]

      await ChannelSyncService.syncLiveChannels(testSourceId, [entries[0]!])
      const result = await ChannelSyncService.syncLiveChannels(testSourceId, [entries[1]!])

      expect(result.channelsCreated).toBe(0)
      expect(result.sourcesCreated).toBe(1)

      const sourceRows = await db
        .select({ channelId: channelSources.channelId })
        .from(channelSources)
        .where(eq(channelSources.sourceId, testSourceId))
      expect(new Set(sourceRows.map((r) => r.channelId)).size).toBe(1)
    })
  })

  describe('non-merge — ambiguous channels stay separate', () => {
    it('does not merge channels with different tvgIds even if names are similar', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'france2-src1', providerName: 'France 2', streamUrl: 'http://stream/f2', tvgId: 'France2' }),
        makeEntry({ providerItemId: 'france2-bis', providerName: 'France 2', streamUrl: 'http://stream/f2-bis', tvgId: 'France2-Bis' }),
      ]

      const result = await ChannelSyncService.syncLiveChannels(testSourceId, entries)

      expect(result.channelsCreated).toBe(2)
      expect(result.sourcesCreated).toBe(2)
    })
  })

  describe('multi-provider — same tvgId from two sources → one channel, two sources', () => {
    it('creates one channel with two channel_source rows', async () => {
      const tvgId = 'M6'
      const entryA = makeEntry({ providerItemId: 'm6-a', providerName: 'M6', streamUrl: 'http://stream-a/m6', tvgId })
      const entryB = makeEntry({ providerItemId: 'm6-b', providerName: 'M6 HD', streamUrl: 'http://stream-b/m6', tvgId })

      await ChannelSyncService.syncLiveChannels(testSourceId, [entryA])
      const result = await ChannelSyncService.syncLiveChannels(testSourceId2, [entryB])

      expect(result.channelsCreated).toBe(0)
      expect(result.sourcesCreated).toBe(1)

      const allSources = await db
        .select({ channelId: channelSources.channelId, sourceId: channelSources.sourceId })
        .from(channelSources)
        .where(inArray(channelSources.sourceId, [testSourceId, testSourceId2]))
      const uniqueChannelIds = new Set(allSources.map((r) => r.channelId))
      expect(uniqueChannelIds.size).toBe(1)
      expect(allSources).toHaveLength(2)
    })
  })

  describe('logo selection', () => {
    it('sets logo on first sync when source provides one', async () => {
      const entry = makeEntry({ providerItemId: 'bfm', providerName: 'BFM TV', streamUrl: 'http://stream/bfm', tvgLogo: 'http://logos/bfm.png' })

      await ChannelSyncService.syncLiveChannels(testSourceId, [entry])

      const [ch] = await db
        .select({ logoUrl: channels.logoUrl })
        .from(channels)
        .innerJoin(channelSources, eq(channelSources.channelId, channels.id))
        .where(and(eq(channelSources.sourceId, testSourceId), eq(channelSources.providerItemId, 'bfm')))
        .limit(1)

      expect(ch?.logoUrl).toBe('http://logos/bfm.png')
    })

    it('updates channel logo when second sync provides one and previous was null', async () => {
      const entry1 = makeEntry({ providerItemId: 'itele', providerName: 'iTELE', streamUrl: 'http://stream/itele' })
      await ChannelSyncService.syncLiveChannels(testSourceId, [entry1])

      const entry2 = makeEntry({ providerItemId: 'itele', providerName: 'iTELE', streamUrl: 'http://stream/itele', tvgLogo: 'http://logos/itele.png' })
      const result = await ChannelSyncService.syncLiveChannels(testSourceId, [entry2])

      expect(result.sourcesUpdated).toBe(1)
      expect(result.channelsUpdated).toBe(1)

      const [ch] = await db
        .select({ logoUrl: channels.logoUrl })
        .from(channels)
        .innerJoin(channelSources, eq(channelSources.channelId, channels.id))
        .where(and(eq(channelSources.sourceId, testSourceId), eq(channelSources.providerItemId, 'itele')))
        .limit(1)

      expect(ch?.logoUrl).toBe('http://logos/itele.png')
    })
  })

  describe('source ordering', () => {
    it('selectPreferredSources returns AVAILABLE before UNAVAILABLE', async () => {
      const { selectPreferredSources } = await import('../../channels/source-selector.js')
      const now = new Date()
      const sources = [
        { id: '2', channelId: 'ch1', sourceId: 's1', streamUrl: 'url2', priority: 0, status: 'UNAVAILABLE' as const, lastSeenAt: now },
        { id: '1', channelId: 'ch1', sourceId: 's1', streamUrl: 'url1', priority: 0, status: 'AVAILABLE' as const, lastSeenAt: now },
      ]
      const ordered = selectPreferredSources(sources)
      expect(ordered[0]!.status).toBe('AVAILABLE')
    })

    it('selectPreferredSources sorts by priority descending among AVAILABLE', async () => {
      const { selectPreferredSources } = await import('../../channels/source-selector.js')
      const now = new Date()
      const sources = [
        { id: '1', channelId: 'ch1', sourceId: 's1', streamUrl: 'url1', priority: 0, status: 'AVAILABLE' as const, lastSeenAt: now },
        { id: '2', channelId: 'ch1', sourceId: 's1', streamUrl: 'url2', priority: 10, status: 'AVAILABLE' as const, lastSeenAt: now },
      ]
      const ordered = selectPreferredSources(sources)
      expect(ordered[0]!.priority).toBe(10)
    })
  })

  describe('idempotence', () => {
    it('second sync with identical entries creates zero new channels and sources', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'rmc', providerName: 'RMC', streamUrl: 'http://stream/rmc', tvgId: 'RMC' }),
        makeEntry({ providerItemId: 'rmc-story', providerName: 'RMC Story', streamUrl: 'http://stream/rmc-story', tvgId: 'RMCStory' }),
      ]

      const first = await ChannelSyncService.syncLiveChannels(testSourceId, entries)
      expect(first.channelsCreated).toBe(2)
      expect(first.sourcesCreated).toBe(2)

      const second = await ChannelSyncService.syncLiveChannels(testSourceId, entries)
      expect(second.channelsCreated).toBe(0)
      expect(second.sourcesCreated).toBe(0)
      expect(second.sourcesUpdated).toBe(2)
    })
  })

  describe('lifecycle', () => {
    it('marks channel_source UNAVAILABLE when entry absent from snapshot', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'nrj12', providerName: 'NRJ 12', streamUrl: 'http://stream/nrj12', tvgId: 'NRJ12' }),
        makeEntry({ providerItemId: 'tfx', providerName: 'TFX', streamUrl: 'http://stream/tfx', tvgId: 'TFX' }),
      ]

      await ChannelSyncService.syncLiveChannels(testSourceId, entries)

      // Second sync: TFX is gone
      const result = await ChannelSyncService.syncLiveChannels(testSourceId, [entries[0]!])
      expect(result.unavailableCount).toBe(1)

      const [tfxSource] = await db
        .select({ status: channelSources.status, unavailableAt: channelSources.unavailableAt })
        .from(channelSources)
        .where(and(eq(channelSources.sourceId, testSourceId), eq(channelSources.providerItemId, 'tfx')))
        .limit(1)

      expect(tfxSource?.status).toBe('UNAVAILABLE')
      expect(tfxSource?.unavailableAt).not.toBeNull()
    })
  })

  describe('match_confidence and match_provenance', () => {
    it('every channel_source row has non-null match_confidence and match_provenance', async () => {
      const entries: LiveChannelEntry[] = [
        makeEntry({ providerItemId: 'gulli', providerName: 'Gulli', streamUrl: 'http://stream/gulli', tvgId: 'Gulli' }),
      ]

      await ChannelSyncService.syncLiveChannels(testSourceId, entries)

      const [row] = await db
        .select({ matchConfidence: channelSources.matchConfidence, matchProvenance: channelSources.matchProvenance })
        .from(channelSources)
        .where(and(eq(channelSources.sourceId, testSourceId), eq(channelSources.providerItemId, 'gulli')))
        .limit(1)

      expect(row?.matchConfidence).not.toBeNull()
      expect(row?.matchProvenance).not.toBeNull()
    })
  })
})
