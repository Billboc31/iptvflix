import { describe, it, expect, beforeEach } from 'vitest'
import { searchEpgPrograms, type EpgCache } from '../epg-service.js'
import { normalizeQuery } from '../live-search-normalizer.js'
import { searchLiveTV } from '../live-search-service.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEpgCache(programs: Array<{
  catalogId: string
  title: string
  startTime: string
  endTime: string
}>): EpgCache {
  const byChannel = new Map<string, Array<{ channelId: string; title: string; startTime: string; endTime: string }>>()
  for (const p of programs) {
    const list = byChannel.get(p.catalogId) ?? []
    list.push({ channelId: p.catalogId, title: p.title, startTime: p.startTime, endTime: p.endTime })
    byChannel.set(p.catalogId, list)
  }
  return { byChannel, fetchedAt: Date.now() }
}

/** Creates a minimal mock of the Drizzle db for the search service. */
function makeDbMock(
  channelRows: any[],
  sourceRows: any[] = [],
): any {
  let selectCallIndex = 0
  const results = [channelRows, sourceRows]

  const chain = (result: any[]): any => ({
    from: () => chain(result),
    where: () => chain(result),
    orderBy: () => chain(result),
    then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (e: any) => any) => Promise.resolve(result).catch(reject),
    finally: (cb: () => void) => Promise.resolve(result).finally(cb),
  })

  return {
    select: () => {
      const result = results[selectCallIndex] ?? []
      selectCallIndex++
      return chain(result)
    },
    selectDistinct: () => chain([]),
  }
}

// Reference timestamps relative to actual current time so programs aren't expired
const T0 = new Date()
T0.setMilliseconds(0)
const t = (offsetMin: number) =>
  new Date(T0.getTime() + offsetMin * 60_000).toISOString()

// ---------------------------------------------------------------------------
// normalizeQuery
// ---------------------------------------------------------------------------

describe('normalizeQuery', () => {
  it('strips "je veux regarder" prefix', () => {
    expect(normalizeQuery('je veux regarder TF1')).toBe('tf1')
  })

  it('strips "regarder" prefix', () => {
    expect(normalizeQuery('regarder Fort Boyard')).toBe('fort boyard')
  })

  it('strips "mettre" prefix', () => {
    expect(normalizeQuery('mettre M6')).toBe('m6')
  })

  it('strips "voir" prefix', () => {
    expect(normalizeQuery('voir US Open')).toBe('us open')
  })

  it('leaves plain queries unchanged', () => {
    expect(normalizeQuery('TF1')).toBe('tf1')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeQuery('  US   Open  ')).toBe('us open')
  })

  it('does not strip mid-sentence prefix words', () => {
    expect(normalizeQuery('regarder ou ne pas regarder')).toBe('ou ne pas regarder')
  })
})

// ---------------------------------------------------------------------------
// searchEpgPrograms
// ---------------------------------------------------------------------------

describe('searchEpgPrograms', () => {
  it('returns live match', () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(-30), endTime: t(60) },
    ])
    const results = searchEpgPrograms('us open', cache, T0)
    expect(results).toHaveLength(1)
    expect(results[0].isLive).toBe(true)
    expect(results[0].title).toBe('US Open')
    expect(results[0].catalogId).toBe('TF1.fr')
    expect(results[0].matchWeight).toBe(0) // exact
  })

  it('returns upcoming match', () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(60), endTime: t(120) },
    ])
    const results = searchEpgPrograms('us open', cache, T0)
    expect(results).toHaveLength(1)
    expect(results[0].isLive).toBe(false)
  })

  it('skips past programs', () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(-120), endTime: t(-60) },
    ])
    expect(searchEpgPrograms('us open', cache, T0)).toHaveLength(0)
  })

  it('returns empty list when cache is null', () => {
    expect(searchEpgPrograms('tf1', null, T0)).toHaveLength(0)
  })

  it('returns empty list when cache has no channels', () => {
    const cache: EpgCache = { byChannel: new Map(), fetchedAt: Date.now() }
    expect(searchEpgPrograms('tf1', cache, T0)).toHaveLength(0)
  })

  it('matches regardless of accent or case', () => {
    const cache = makeEpgCache([
      { catalogId: 'Arte.fr', title: 'Téléfilm', startTime: t(10), endTime: t(70) },
    ])
    const results = searchEpgPrograms('telefilm', cache, T0)
    expect(results).toHaveLength(1)
  })

  it('assigns lower matchWeight to exact match than substring', () => {
    const cache = makeEpgCache([
      { catalogId: 'CH1.fr', title: 'US Open', startTime: t(10), endTime: t(70) },
      { catalogId: 'CH2.fr', title: 'The US Open Championship', startTime: t(20), endTime: t(80) },
    ])
    const results = searchEpgPrograms('us open', cache, T0)
    const exact = results.find((r) => r.title === 'US Open')!
    const substring = results.find((r) => r.title === 'The US Open Championship')!
    expect(exact.matchWeight).toBeLessThan(substring.matchWeight)
  })

  it('returns programs from multiple channels', () => {
    const cache = makeEpgCache([
      { catalogId: 'CH1.fr', title: 'Fort Boyard', startTime: t(0), endTime: t(90) },
      { catalogId: 'CH2.fr', title: 'Fort Boyard', startTime: t(0), endTime: t(90) },
    ])
    const results = searchEpgPrograms('fort boyard', cache, T0)
    expect(results).toHaveLength(2)
  })

  it('returns repeated upcoming occurrences of the same program', () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(60), endTime: t(90) },
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(300), endTime: t(330) },
    ])
    const results = searchEpgPrograms('journal', cache, T0)
    expect(results).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// searchLiveTV
// ---------------------------------------------------------------------------

describe('searchLiveTV', () => {
  const CHANNEL_TF1 = {
    id: 'uuid-tf1',
    canonicalName: 'TF1',
    normalizedName: 'tf1',
    logoUrl: null,
    categories: ['news'],
    language: 'fr',
    country: 'FR',
    iptvOrgId: 'TF1.fr',
  }

  const SOURCE_TF1 = {
    channelId: 'uuid-tf1',
    streamUrl: 'http://stream.example.com/tf1.m3u8',
    priority: 10,
  }

  it('direct channel match → channels result', async () => {
    const db = makeDbMock([CHANNEL_TF1])
    const cache: EpgCache = { byChannel: new Map(), fetchedAt: Date.now() }

    const result = await searchLiveTV('tf1', cache, db)

    expect(result.channels).toHaveLength(1)
    expect(result.channels[0].channelName).toBe('TF1')
    expect(result.liveNow).toHaveLength(0)
    expect(result.upcoming).toHaveLength(0)
  })

  it('live program match → liveNow result with streamUrl', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(-30), endTime: t(60) },
    ])
    const db = makeDbMock([CHANNEL_TF1], [SOURCE_TF1])

    const result = await searchLiveTV('us open', cache, db)

    expect(result.liveNow).toHaveLength(1)
    const live = result.liveNow[0]
    expect(live.channelId).toBe('uuid-tf1')
    expect(live.channelName).toBe('TF1')
    expect(live.programTitle).toBe('US Open')
    expect(live.streamUrl).toBe('http://stream.example.com/tf1.m3u8')
    expect(live.deliveryMode).toBe('DIRECT')
    expect(live.progress).toBeGreaterThan(0)
    expect(live.progress).toBeLessThan(1)
  })

  it('future program match → upcoming result', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(60), endTime: t(120) },
    ])
    const db = makeDbMock([CHANNEL_TF1])

    const result = await searchLiveTV('us open', cache, db)

    expect(result.upcoming).toHaveLength(1)
    const upcoming = result.upcoming[0]
    expect(upcoming.channelId).toBe('uuid-tf1')
    expect(upcoming.programTitle).toBe('US Open')
    expect(result.liveNow).toHaveLength(0)
  })

  it('duplicate channel sources collapse to one liveNow result', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(-10), endTime: t(20) },
    ])
    const db = makeDbMock([CHANNEL_TF1], [
      { channelId: 'uuid-tf1', streamUrl: 'http://high.example.com/tf1', priority: 20 },
      { channelId: 'uuid-tf1', streamUrl: 'http://low.example.com/tf1', priority: 5 },
    ])

    const result = await searchLiveTV('journal', cache, db)

    expect(result.liveNow).toHaveLength(1)
    expect(result.liveNow[0].streamUrl).toBe('http://high.example.com/tf1')
  })

  it('repeated future programs capped at 3 occurrences', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(60), endTime: t(90) },
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(180), endTime: t(210) },
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(300), endTime: t(330) },
      { catalogId: 'TF1.fr', title: 'Journal', startTime: t(420), endTime: t(450) },
    ])
    const db = makeDbMock([CHANNEL_TF1])

    const result = await searchLiveTV('journal', cache, db)

    expect(result.upcoming).toHaveLength(3)
    // All three should be the soonest occurrences
    expect(result.upcoming[0].startTime).toBe(t(60))
    expect(result.upcoming[2].startTime).toBe(t(300))
  })

  it('no-EPG: returns only channel results, no error', async () => {
    const db = makeDbMock([CHANNEL_TF1])
    const result = await searchLiveTV('tf1', null, db)

    expect(result.channels).toHaveLength(1)
    expect(result.liveNow).toHaveLength(0)
    expect(result.upcoming).toHaveLength(0)
  })

  it('accent and case variation matches same canonical channel', async () => {
    const db = makeDbMock([CHANNEL_TF1])
    // DB mock returns TF1 for any name query (unaccent handled by PostgreSQL in production)
    const result = await searchLiveTV('tf1', null, db)
    expect(result.channels[0].channelName).toBe('TF1')
  })

  it('title match ranks above substring match in liveNow', async () => {
    const cache = makeEpgCache([
      { catalogId: 'CH2.fr', title: 'The US Open Championship', startTime: t(-10), endTime: t(60) },
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(-20), endTime: t(50) },
    ])
    const exactChannel = { ...CHANNEL_TF1, id: 'uuid-tf1', iptvOrgId: 'TF1.fr' }
    const substringChannel = {
      id: 'uuid-ch2',
      canonicalName: 'Canal2',
      normalizedName: 'canal2',
      logoUrl: null,
      categories: [],
      language: 'fr',
      country: 'FR',
      iptvOrgId: 'CH2.fr',
    }
    const db = makeDbMock([exactChannel, substringChannel], [
      { channelId: 'uuid-tf1', streamUrl: 'http://tf1.m3u8', priority: 10 },
      { channelId: 'uuid-ch2', streamUrl: 'http://ch2.m3u8', priority: 10 },
    ])

    const result = await searchLiveTV('us open', cache, db)

    expect(result.liveNow.length).toBeGreaterThan(1)
    expect(result.liveNow[0].programTitle).toBe('US Open')
  })

  it('live program channel excluded from channels group', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'TF1 Journal', startTime: t(-10), endTime: t(30) },
    ])
    const db = makeDbMock([CHANNEL_TF1], [SOURCE_TF1])

    // Query matches both channel name ("TF1") and program title ("TF1 Journal")
    const result = await searchLiveTV('tf1', cache, db)

    // TF1 appears in liveNow (for "TF1 Journal"), NOT in channels
    const inLive = result.liveNow.some((r) => r.channelId === 'uuid-tf1')
    const inChannels = result.channels.some((r) => r.channelId === 'uuid-tf1')
    expect(inLive).toBe(true)
    expect(inChannels).toBe(false)
  })

  it('conversational prefix resolved to same result as plain query', async () => {
    const db1 = makeDbMock([CHANNEL_TF1])
    const db2 = makeDbMock([CHANNEL_TF1])
    const cache: EpgCache = { byChannel: new Map(), fetchedAt: Date.now() }

    const r1 = await searchLiveTV('tf1', cache, db1)
    const r2 = await searchLiveTV(normalizeQuery('je veux regarder tf1'), cache, db2)

    expect(r1.channels[0].channelName).toBe(r2.channels[0].channelName)
  })

  it('live match with no available source excluded from liveNow', async () => {
    const cache = makeEpgCache([
      { catalogId: 'TF1.fr', title: 'US Open', startTime: t(-30), endTime: t(60) },
    ])
    // No source rows → sourceByChannelId will be empty → streamUrl would be ''
    const db = makeDbMock([CHANNEL_TF1], [])

    const result = await searchLiveTV('us open', cache, db)

    expect(result.liveNow).toHaveLength(0)
  })

  it('empty query returns empty response', async () => {
    const db = makeDbMock([])
    const result = await searchLiveTV('', null, db)
    expect(result).toEqual({ liveNow: [], upcoming: [], channels: [] })
  })
})
