import type { IntroDbSegmentResponse } from './types.js'
import { IntroDbRateLimitError, IntroDbNetworkError } from './errors.js'
import type { CanonicalEpisodeRef, RawSegment, SegmentProvider } from '../types.js'
import { mapIntroDbResponse } from './mapper.js'

const DEFAULT_BASE_URL = 'https://api.introdb.net'
const MAX_RETRIES = 3
const MAX_BACKOFF_MS = 60_000

export class IntroDbClient implements SegmentProvider {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(config: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  async fetchEpisodeSegments(episode: CanonicalEpisodeRef): Promise<RawSegment[]> {
    if (!episode.seriesImdbId) return []
    const raw = await this.fetchWithRetry(episode.seriesImdbId, episode.seasonNumber, episode.episodeNumber)
    if (!raw) return []
    return mapIntroDbResponse(raw, episode.episodeId)
  }

  async fetchRaw(imdbId: string, season: number, episode: number): Promise<IntroDbSegmentResponse | null> {
    return this.fetchWithRetry(imdbId, season, episode)
  }

  private async fetchWithRetry(
    imdbId: string,
    season: number,
    episode: number,
    attempt = 0,
  ): Promise<IntroDbSegmentResponse | null> {
    const params = new URLSearchParams({
      imdb_id: imdbId,
      season: String(season),
      episode: String(episode),
    })
    const url = `${this.baseUrl}/segments?${params}`

    let response: Response
    try {
      response = await globalThis.fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new IntroDbNetworkError('IntroDB request timed out')
      }
      throw new IntroDbNetworkError(`Could not reach IntroDB: ${(err as Error).message}`)
    }

    if (response.status === 404) return null

    if (response.status === 429) {
      if (attempt >= MAX_RETRIES - 1) throw new IntroDbRateLimitError()
      const retryAfterSec = Number(response.headers.get('Retry-After') ?? '5')
      const backoffMs = Math.min(retryAfterSec * 1000 * Math.pow(2, attempt), MAX_BACKOFF_MS)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      return this.fetchWithRetry(imdbId, season, episode, attempt + 1)
    }

    if (!response.ok) {
      throw new IntroDbNetworkError(`IntroDB returned HTTP ${response.status}`)
    }

    try {
      return (await response.json()) as IntroDbSegmentResponse
    } catch {
      throw new IntroDbNetworkError('Could not parse IntroDB response')
    }
  }
}
