import type {
  MetadataProvider,
  ExternalMovieMetadata,
  ExternalSeriesMetadata,
  MetadataCandidate,
} from '../types.js'
import type { TmdbMovieDetail, TmdbSeriesDetail, TmdbSearchResponse } from './types.js'
import { TmdbRateLimitError, TmdbNetworkError } from './errors.js'

const BASE_URL = 'https://api.themoviedb.org/3'

function parseYear(dateStr: string | undefined): number | null {
  if (!dateStr || dateStr.length < 4) return null
  const n = parseInt(dateStr.substring(0, 4), 10)
  return isNaN(n) ? null : n
}

function deriveReleaseStatus(dateStr?: string): string | null {
  if (!dateStr) return null
  return new Date(dateStr) > new Date() ? 'Upcoming' : 'Released'
}

function mapMovieDetail(raw: TmdbMovieDetail): ExternalMovieMetadata {
  return {
    title: raw.title,
    originalTitle: raw.original_title ?? null,
    year: parseYear(raw.release_date),
    synopsis: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    genres: raw.genres.map((g) => g.name),
    runtimeMinutes: raw.runtime ?? null,
    imdbId: raw.imdb_id ?? null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    releaseStatus: raw.status ?? null,
    releaseDate: raw.release_date || null,
  }
}

function mapSeriesDetail(raw: TmdbSeriesDetail): ExternalSeriesMetadata {
  return {
    title: raw.name,
    originalTitle: raw.original_name ?? null,
    firstAirYear: parseYear(raw.first_air_date),
    synopsis: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    genres: raw.genres.map((g) => g.name),
    imdbId: null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    releaseStatus: raw.status ?? null,
    firstAirDate: raw.first_air_date || null,
  }
}

export class TmdbClient implements MetadataProvider {
  private readonly apiKey: string
  private readonly timeoutMs: number

  constructor(config: { apiKey: string; timeoutMs?: number }) {
    this.apiKey = config.apiKey
    this.timeoutMs = config.timeoutMs ?? 10_000
  }

  private buildHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  private async doFetch(url: string): Promise<Response> {
    try {
      return await globalThis.fetch(url, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new TmdbNetworkError('TMDB request timed out')
      }
      throw new TmdbNetworkError('Could not reach TMDB')
    }
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    const response = await this.doFetch(url)

    if (response.status !== 429) return response

    const retryAfterSec = Number(response.headers.get('Retry-After') ?? '1')
    await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000))

    const retried = await this.doFetch(url)
    if (retried.status === 429) throw new TmdbRateLimitError()
    return retried
  }

  async getMovieMetadata(tmdbId: number): Promise<ExternalMovieMetadata | null> {
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}`)
    if (response.status === 404) return null
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbMovieDetail
      return mapMovieDetail(raw)
    } catch {
      throw new TmdbNetworkError('Could not parse TMDB movie response')
    }
  }

  async getSeriesMetadata(tmdbId: number): Promise<ExternalSeriesMetadata | null> {
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}`)
    if (response.status === 404) return null
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbSeriesDetail
      return mapSeriesDetail(raw)
    } catch {
      throw new TmdbNetworkError('Could not parse TMDB series response')
    }
  }

  async searchMovies(query: string, year?: number | null): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ query })
    if (year != null) params.set('year', String(year))
    const response = await this.fetchWithRetry(`${BASE_URL}/search/movie?${params}`)
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbSearchResponse
      return (raw.results ?? []).map((item) => ({
        externalId: String(item.id),
        title: item.title ?? item.name ?? '',
        year: parseYear(item.release_date ?? item.first_air_date),
        mediaType: 'MOVIE' as const,
        posterPath: item.poster_path ?? null,
        synopsis: item.overview || null,
        releaseStatus: deriveReleaseStatus(item.release_date),
        releaseDate: item.release_date || null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB movie search response')
    }
  }

  async searchSeries(query: string, year?: number | null): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ query })
    if (year != null) params.set('first_air_date_year', String(year))
    const response = await this.fetchWithRetry(`${BASE_URL}/search/tv?${params}`)
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbSearchResponse
      return (raw.results ?? []).map((item) => ({
        externalId: String(item.id),
        title: item.name ?? item.title ?? '',
        year: parseYear(item.first_air_date ?? item.release_date),
        mediaType: 'SERIES' as const,
        posterPath: item.poster_path ?? null,
        synopsis: item.overview || null,
        releaseStatus: deriveReleaseStatus(item.first_air_date),
        firstAirDate: item.first_air_date || null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB series search response')
    }
  }

}
