import { describe, it, expect } from 'vitest'
import { buildXtreamMovieUrl, buildXtreamEpisodeUrl } from '../playback.js'

// Phase 2 — Xtream VOD URL semantics verification.
// These tests pin the exact expected URL patterns so any future change to
// URL construction is immediately visible.

describe('Xtream VOD URL semantics — /movie/ path', () => {
  it('produces the canonical /movie/{user}/{pass}/{streamId}.{ext} pattern', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'alice', 'hunter2', '12345', 'mkv')
    expect(url).toBe('http://srv.example.com/movie/alice/hunter2/12345.mkv')
  })

  it('embeds container_extension verbatim — mkv stays mkv', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '1', 'mkv')
    expect(url).toBe('http://srv.example.com/movie/u/p/1.mkv')
  })

  it('embeds container_extension verbatim — mp4 stays mp4', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '1', 'mp4')
    expect(url).toBe('http://srv.example.com/movie/u/p/1.mp4')
  })

  it('embeds container_extension verbatim — ts stays ts', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '1', 'ts')
    expect(url).toBe('http://srv.example.com/movie/u/p/1.ts')
  })

  it('embeds container_extension verbatim — m3u8 stays m3u8 (HLS VOD)', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '1', 'm3u8')
    expect(url).toBe('http://srv.example.com/movie/u/p/1.m3u8')
  })

  it('falls back to .ts when container_extension is null', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99', null)
    expect(url).toBe('http://srv.example.com/movie/u/p/99.ts')
  })

  it('falls back to .ts when container_extension is omitted', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99')
    expect(url).toBe('http://srv.example.com/movie/u/p/99.ts')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com/', 'u', 'p', '1', 'mp4')
    expect(url).toBe('http://srv.example.com/movie/u/p/1.mp4')
  })

  it('uses /movie/ prefix — not /series/ or /live/', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '42', 'ts')
    expect(url).toContain('/movie/')
    expect(url).not.toContain('/series/')
    expect(url).not.toContain('/live/')
  })

  it('preserves numeric stream IDs as-is', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '9999', 'mp4')
    expect(url).toBe('http://srv.example.com/movie/u/p/9999.mp4')
  })

  it('preserves base URL port', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com:8080', 'u', 'p', '1', 'ts')
    expect(url).toBe('http://srv.example.com:8080/movie/u/p/1.ts')
  })
})

describe('Xtream VOD URL semantics — movie vs episode separation', () => {
  it('movie URL uses /movie/, episode URL uses /series/ — they must differ', () => {
    const movieUrl = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99', 'mp4')
    const episodeUrl = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '99', 'mp4')
    expect(movieUrl).toContain('/movie/')
    expect(episodeUrl).toContain('/series/')
    expect(movieUrl).not.toBe(episodeUrl)
  })

  it('episode URL must NOT use /movie/ prefix', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '77', 'ts')
    expect(url).not.toContain('/movie/')
  })

  it('movie URL must NOT use /series/ prefix', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '77', 'ts')
    expect(url).not.toContain('/series/')
  })
})

describe('Xtream VOD URL semantics — /series/ path for episodes', () => {
  it('produces the canonical /series/{user}/{pass}/{streamId}.{ext} pattern', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'alice', 'hunter2', '77777', 'mkv')
    expect(url).toBe('http://srv.example.com/series/alice/hunter2/77777.mkv')
  })

  it('embeds container_extension verbatim', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '1', 'ts')
    expect(url).toBe('http://srv.example.com/series/u/p/1.ts')
  })

  it('falls back to .ts when extension is null', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '1', null)
    expect(url).toBe('http://srv.example.com/series/u/p/1.ts')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com/', 'u', 'p', '1', 'mkv')
    expect(url).toBe('http://srv.example.com/series/u/p/1.mkv')
  })
})
