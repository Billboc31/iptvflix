import type { PlexLibrarySection, PlexMovieItem, PlexShowItem, PlexEpisodeItem } from './types.js'
import { PlexAuthError, PlexNetworkError, PlexParseError } from './errors.js'

const DEFAULT_TIMEOUT_MS = 10_000

export class PlexClient {
  private readonly timeoutMs: number

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    timeoutMs?: number,
  ) {
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private async fetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(path, this.baseUrl)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    let response: Response
    try {
      response = await globalThis.fetch(url.toString(), {
        headers: {
          'X-Plex-Token': this.token,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new PlexNetworkError('Request to Plex server timed out')
      }
      throw new PlexNetworkError('Could not reach Plex server')
    }

    if (response.status === 401 || response.status === 403) {
      throw new PlexAuthError(`Plex rejected request with HTTP ${response.status}`)
    }

    if (!response.ok) {
      throw new PlexNetworkError(`Plex server responded with HTTP ${response.status}`)
    }

    try {
      return await response.json()
    } catch {
      throw new PlexParseError(path)
    }
  }

  async testConnection(): Promise<{ ok: boolean; serverName?: string; message?: string }> {
    try {
      const raw = await this.fetch('/identity')
      const container = (raw as Record<string, unknown>)?.MediaContainer as Record<string, unknown> | undefined
      if (!container || typeof container !== 'object') {
        return { ok: false, message: 'Unexpected response from Plex server' }
      }
      return {
        ok: true,
        serverName: typeof container.friendlyName === 'string' ? container.friendlyName : undefined,
      }
    } catch (err) {
      if (err instanceof PlexAuthError) {
        return { ok: false, message: 'Authentication failed: check your Plex token' }
      }
      if (err instanceof PlexNetworkError) {
        return { ok: false, message: 'Could not reach the Plex server' }
      }
      return { ok: false, message: 'Connection failed' }
    }
  }

  async fetchLibrarySections(): Promise<PlexLibrarySection[]> {
    const raw = await this.fetch('/library/sections')
    const directories = (raw as Record<string, unknown>)?.MediaContainer as Record<string, unknown> | undefined
    const dirs = directories?.Directory
    if (!Array.isArray(dirs)) throw new PlexParseError('/library/sections')
    return dirs
      .filter((d: unknown) => {
        const entry = d as Record<string, unknown>
        return entry?.type === 'movie' || entry?.type === 'show'
      })
      .map((d: unknown) => {
        const entry = d as Record<string, unknown>
        return {
          key: String(entry.key),
          title: String(entry.title),
          type: entry.type as 'movie' | 'show',
        }
      })
  }

  async fetchMovies(sectionKey: string): Promise<PlexMovieItem[]> {
    const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '1' })
    const container = (raw as Record<string, unknown>)?.MediaContainer as Record<string, unknown> | undefined
    const metadata = container?.Metadata
    if (!Array.isArray(metadata)) return []
    return metadata.map((m: unknown) => mapMetadataItem(m as Record<string, unknown>))
  }

  async fetchShows(sectionKey: string): Promise<PlexShowItem[]> {
    const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '2' })
    const container = (raw as Record<string, unknown>)?.MediaContainer as Record<string, unknown> | undefined
    const metadata = container?.Metadata
    if (!Array.isArray(metadata)) return []
    return metadata.map((m: unknown) => mapMetadataItem(m as Record<string, unknown>))
  }

  async fetchEpisodes(sectionKey: string): Promise<PlexEpisodeItem[]> {
    const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '4' })
    const container = (raw as Record<string, unknown>)?.MediaContainer as Record<string, unknown> | undefined
    const metadata = container?.Metadata
    if (!Array.isArray(metadata)) return []
    return metadata.map((m: unknown) => mapEpisodeMetadataItem(m as Record<string, unknown>))
  }
}

function mapMetadataItem(m: Record<string, unknown>): PlexMovieItem {
  return {
    ratingKey: String(m.ratingKey),
    title: String(m.title),
    year: typeof m.year === 'number' ? m.year : undefined,
    thumb: typeof m.thumb === 'string' ? m.thumb : undefined,
    summary: typeof m.summary === 'string' ? m.summary : undefined,
    Guid: Array.isArray(m.Guid)
      ? (m.Guid as unknown[])
          .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
          .filter((g) => typeof g.id === 'string')
          .map((g) => ({ id: g.id as string }))
      : undefined,
  }
}

function mapEpisodeMetadataItem(m: Record<string, unknown>): PlexEpisodeItem {
  return {
    ratingKey: String(m.ratingKey),
    grandparentRatingKey: String(m.grandparentRatingKey),
    parentIndex: typeof m.parentIndex === 'number' ? m.parentIndex : 0,
    index: typeof m.index === 'number' ? m.index : 0,
    title: String(m.title),
    summary: typeof m.summary === 'string' ? m.summary : undefined,
    duration: typeof m.duration === 'number' ? m.duration : undefined,
    originallyAvailableAt: typeof m.originallyAvailableAt === 'string' ? m.originallyAvailableAt : undefined,
  }
}
