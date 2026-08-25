import { describe, it, expect } from 'vitest'
import { parseM3U, classifyEntries } from '../parser.js'
import { M3UParseError } from '../errors.js'

const VALID_MOVIES_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="tt0133093" tvg-name="The Matrix" tvg-logo="http://img.example.com/matrix.jpg" group-title="VOD Movies",The Matrix
http://stream.example.com/vod/matrix.mkv
#EXTINF:-1 tvg-id="tt0816692" tvg-name="Interstellar" tvg-logo="http://img.example.com/interstellar.jpg" group-title="VOD Movies",Interstellar
http://stream.example.com/vod/interstellar.mkv
`

const SERIES_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="tt0903747-s01e01" tvg-name="Breaking Bad S01E01" group-title="Series Show",Breaking Bad S01E01
http://stream.example.com/series/bb-s01e01.mkv
#EXTINF:-1 tvg-id="tt0903747-s01e02" tvg-name="Breaking Bad S01E02" group-title="Series Show",Breaking Bad S01E02
http://stream.example.com/series/bb-s01e02.mkv
`

const MIXED_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-name="CNN International" group-title="Live TV",CNN International
http://stream.example.com/live/cnn.ts
#EXTINF:-1 tvg-name="Inception" group-title="VOD Film",Inception
http://stream.example.com/vod/inception.mkv
#EXTINF:-1 tvg-name="Dark S01E01" group-title="TV Series",Dark S01E01
http://stream.example.com/series/dark-s01e01.mkv
`

const MISSING_HEADER = `#EXTINF:-1 tvg-name="Something" group-title="Movies",Something
http://stream.example.com/vod/something.mkv
`

const EMPTY_STRING = ''

const MISSING_URL_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-name="Orphan Entry" group-title="VOD Movies",Orphan Entry
#EXTINF:-1 tvg-name="Valid Movie" group-title="VOD Movies",Valid Movie
http://stream.example.com/vod/valid.mkv
`

const NO_GROUP_TITLE_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-name="Unknown Stream",Unknown Stream
http://stream.example.com/unknown.ts
`

describe('parseM3U()', () => {
  it('parses a valid two-movie playlist into two entries', () => {
    const entries = parseM3U(VALID_MOVIES_PLAYLIST)
    expect(entries).toHaveLength(2)
  })

  it('extracts all standard attributes from #EXTINF line', () => {
    const entries = parseM3U(VALID_MOVIES_PLAYLIST)
    expect(entries[0]).toMatchObject({
      tvgId: 'tt0133093',
      tvgName: 'The Matrix',
      tvgLogo: 'http://img.example.com/matrix.jpg',
      groupTitle: 'VOD Movies',
      rawTitle: 'The Matrix',
      streamUrl: 'http://stream.example.com/vod/matrix.mkv',
    })
  })

  it('parses series playlist entries', () => {
    const entries = parseM3U(SERIES_PLAYLIST)
    expect(entries).toHaveLength(2)
    expect(entries[0].rawTitle).toBe('Breaking Bad S01E01')
    expect(entries[0].groupTitle).toBe('Series Show')
  })

  it('parses mixed playlist with live, movie, and series entries', () => {
    const entries = parseM3U(MIXED_PLAYLIST)
    expect(entries).toHaveLength(3)
  })

  it('throws M3UParseError when #EXTM3U header is missing', () => {
    expect(() => parseM3U(MISSING_HEADER)).toThrow(M3UParseError)
  })

  it('throws M3UParseError on empty string', () => {
    expect(() => parseM3U(EMPTY_STRING)).toThrow(M3UParseError)
  })

  it('silently skips #EXTINF entries that have no following URL', () => {
    const entries = parseM3U(MISSING_URL_PLAYLIST)
    expect(entries).toHaveLength(1)
    expect(entries[0].rawTitle).toBe('Valid Movie')
  })

  it('sets groupTitle to null when group-title attribute is absent', () => {
    const entries = parseM3U(NO_GROUP_TITLE_PLAYLIST)
    expect(entries).toHaveLength(1)
    expect(entries[0].groupTitle).toBeNull()
  })
})

describe('classifyEntries()', () => {
  it('classifies movie-group entries as "movie"', () => {
    const entries = parseM3U(VALID_MOVIES_PLAYLIST)
    const classified = classifyEntries(entries)
    expect(classified.every((e) => e.kind === 'movie')).toBe(true)
  })

  it('classifies series entries with SxxExx pattern as "episode"', () => {
    const entries = parseM3U(SERIES_PLAYLIST)
    const classified = classifyEntries(entries)
    expect(classified.every((e) => e.kind === 'episode')).toBe(true)
  })

  it('extracts correct season and episode numbers', () => {
    const entries = parseM3U(SERIES_PLAYLIST)
    const classified = classifyEntries(entries)
    expect(classified[0].seasonNumber).toBe(1)
    expect(classified[0].episodeNumber).toBe(1)
    expect(classified[1].seasonNumber).toBe(1)
    expect(classified[1].episodeNumber).toBe(2)
  })

  it('derives seriesKey from the title prefix before SxxExx', () => {
    const entries = parseM3U(SERIES_PLAYLIST)
    const classified = classifyEntries(entries)
    expect(classified[0].seriesKey).toBe('breaking bad')
    expect(classified[1].seriesKey).toBe('breaking bad')
  })

  it('classifies live TV groups (non-VOD group-title) as "live"', () => {
    const entries = parseM3U(MIXED_PLAYLIST)
    const classified = classifyEntries(entries)
    const live = classified.find((e) => e.rawTitle === 'CNN International')
    expect(live?.kind).toBe('live')
  })

  it('classifies film-group entry as "movie"', () => {
    const entries = parseM3U(MIXED_PLAYLIST)
    const classified = classifyEntries(entries)
    const movie = classified.find((e) => e.rawTitle === 'Inception')
    expect(movie?.kind).toBe('movie')
  })

  it('classifies series entry in mixed playlist as "episode"', () => {
    const entries = parseM3U(MIXED_PLAYLIST)
    const classified = classifyEntries(entries)
    const ep = classified.find((e) => e.rawTitle === 'Dark S01E01')
    expect(ep?.kind).toBe('episode')
    expect(ep?.seasonNumber).toBe(1)
    expect(ep?.episodeNumber).toBe(1)
  })

  it('returns null seasonNumber/episodeNumber/seriesKey for movies', () => {
    const entries = parseM3U(VALID_MOVIES_PLAYLIST)
    const classified = classifyEntries(entries)
    expect(classified[0].seasonNumber).toBeNull()
    expect(classified[0].episodeNumber).toBeNull()
    expect(classified[0].seriesKey).toBeNull()
  })
})
