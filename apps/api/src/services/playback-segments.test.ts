import { describe, expect, it } from 'vitest'
import { indexSkipDbDump, mapAniSkip, mapSkipDb, resolveAnimeEpisode, validSegment } from './playback-segments.js'
const ref = { episodeId: 'ep', seriesTmdbId: 42, seriesImdbId: null, seasonNumber: 1, episodeNumber: 3 }
describe('playback segment metadata', () => {
  it('maps seconds and accepts only a matching cut for automatic skips', () => {
    const data = { found: true, results: [{ skipType: 'op', interval: { startTime: 30, endTime: 120 }, episodeLength: 1440 }] }
    expect(mapAniSkip(data, 1440)[0]).toMatchObject({ startMs: 30000, endMs: 120000, autoSkipSafe: true })
    expect(mapAniSkip(data, 1500)[0].autoSkipSafe).toBe(false)
    expect(mapAniSkip(data)[0].autoSkipSafe).toBe(false)
  })
  it('refuses mixed story segments and malformed ranges', () => {
    expect(mapAniSkip({ found: true, results: [{ skipType: 'mixed-ed', interval: { startTime: 1, endTime: 90 } }] }, 1440)).toEqual([])
    for (const range of [{ startMs: -1, endMs: 4 }, { startMs: 3, endMs: 2 }, { startMs: 0, endMs: NaN }]) expect(validSegment(range)).toBe(false)
  })
  it('does not automatically use shifted or low-confidence SkipDB results', () => {
    const segment = { start_ms: 0, end_ms: 90000, confidence: 0.9, match: 'exact' }
    expect(mapSkipDb({ segments: { intro: segment } }, 1440)[0].autoSkipSafe).toBe(true)
    expect(mapSkipDb({ segments: { intro: { ...segment, match: 'shifted' } } }, 1440)[0].autoSkipSafe).toBe(false)
  })
  it('refuses ambiguous anime IDs and accounts for season offsets', () => {
    const row = { type: 'TV', mal_id: 12, themoviedb_id: { tv: 42 } }
    expect(resolveAnimeEpisode([row], ref)).toEqual({ malId: 12, episode: 3 })
    expect(resolveAnimeEpisode([row, { ...row, mal_id: 13 }], ref)).toBeNull()
    expect(resolveAnimeEpisode([row], { ...ref, seasonNumber: 2 })).toBeNull()
    expect(resolveAnimeEpisode([row], { ...ref, seasonNumber: 2, absoluteEpisodeNumber: 15 })).toEqual({ malId: 12, episode: 15 })
    expect(resolveAnimeEpisode([{ ...row, season: { tmdb: 1 }, episode_offset: { tmdb: 12 } }], { ...ref, episodeNumber: 14 })).toEqual({ malId: 12, episode: 2 })
  })
  it('marks competing cuts manual', () => {
    expect(mapAniSkip({ found: true, results: [10, 20].map(start => ({ skipType: 'op', interval: { startTime: start, endTime: start + 90 }, episodeLength: 1440 })) }, 1440).every(s => !s.autoSkipSafe)).toBe(true)
  })
})

describe('cached provider variants', () => {
  it('uses the matching cut from a catalog response containing multiple durations', () => {
    const data = { found: true, results: [1440, 1500].map((duration, i) => ({ skipType: 'op', episodeLength: duration, interval: { startTime: 10 + i * 15, endTime: 100 + i * 15 } })) }
    expect(mapAniSkip(data, 1440)).toHaveLength(1)
    expect(mapAniSkip(data, 1440)[0]).toMatchObject({ autoSkipSafe: true, startMs: 10000 })
    expect(mapAniSkip(data, 1500)[0]).toMatchObject({ autoSkipSafe: true, startMs: 25000 })
  })
})

it('indexes the public dump by movie or canonical episode without asserting a matching cut', () => {
  const index = indexSkipDbDump({ segments: [
    { imdb_id: 'tt1', media_type: 'movie', segment_type: 'outro', status: 'approved', start_ms: 1000, end_ms: 5000 },
    { imdb_id: 'tt2', media_type: 'series', season: 2, episode: 1, segment_type: 'intro', status: 'approved', start_ms: 0, end_ms: 90000 },
    { imdb_id: 'tt3', media_type: 'movie', segment_type: 'intro', status: 'pending', start_ms: 0, end_ms: 90000 },
  ] })
  expect(index.get('tt1:movie')?.[0]).toMatchObject({ type: 'CREDITS', autoSkipSafe: false })
  expect(index.get('tt2:2:1')).toHaveLength(1)
  expect(index.has('tt3:movie')).toBe(false)
})
