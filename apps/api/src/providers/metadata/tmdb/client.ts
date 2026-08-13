import type {
  MetadataProvider,
  ExternalMovieMetadata,
  ExternalSeriesMetadata,
  ExternalVideo,
  ExternalCreditPerson,
  ExternalSeasonEpisode,
  MetadataCandidate,
  DiscoveryFeed,
  DiscoverParams,
} from '../types.js'
import type {
  TmdbMovieDetail,
  TmdbSeriesDetail,
  TmdbSearchResponse,
  TmdbVideosResponse,
  TmdbCreditsResponse,
  TmdbAggregateCreditsResponse,
  TmdbReleaseDatesResponse,
  TmdbContentRatingsResponse,
  TmdbSeasonResponse,
  TmdbCollection,
} from './types.js'
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

function mapMovieDetail(raw: TmdbMovieDetail): Omit<ExternalMovieMetadata, 'certification'> {
  return {
    title: raw.title,
    originalTitle: raw.original_title ?? null,
    year: parseYear(raw.release_date),
    synopsis: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    genres: raw.genres.map((g) => g.name),
    genreObjects: raw.genres.map((g) => ({ name: g.name, tmdbId: g.id })),
    runtimeMinutes: raw.runtime ?? null,
    imdbId: raw.imdb_id ?? null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
    releaseStatus: raw.status ?? null,
    status: raw.status ?? null,
    releaseDate: raw.release_date || null,
    originalLanguage: raw.original_language ?? null,
    spokenLanguages: raw.spoken_languages
      ? raw.spoken_languages.map((l) => ({ iso639_1: l.iso_639_1, name: l.name }))
      : null,
    productionCountries: raw.production_countries
      ? raw.production_countries.map((c) => ({ iso3166_1: c.iso_3166_1, name: c.name }))
      : null,
    tagline: raw.tagline ?? null,
    keywords: raw.keywords?.results?.map((k) => k.name) ?? null,
    belongsToCollection: raw.belongs_to_collection
      ? {
          tmdbId: raw.belongs_to_collection.id,
          name: raw.belongs_to_collection.name,
          posterPath: raw.belongs_to_collection.poster_path ?? null,
          backdropPath: raw.belongs_to_collection.backdrop_path ?? null,
        }
      : null,
    externalIds: raw.external_ids
      ? (raw.external_ids as unknown as Record<string, string | number | null>)
      : null,
  }
}

function mapSeriesDetail(raw: TmdbSeriesDetail): Omit<ExternalSeriesMetadata, 'certification'> {
  return {
    title: raw.name,
    originalTitle: raw.original_name ?? null,
    firstAirYear: parseYear(raw.first_air_date),
    synopsis: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    genres: raw.genres.map((g) => g.name),
    genreObjects: raw.genres.map((g) => ({ name: g.name, tmdbId: g.id })),
    imdbId: null,
    popularity: raw.popularity ?? null,
    voteAverage: raw.vote_average ?? null,
    voteCount: raw.vote_count ?? null,
    status: raw.status ?? null,
    releaseStatus: raw.status ?? null,
    firstAirDate: raw.first_air_date || null,
    originalLanguage: raw.original_language ?? null,
    spokenLanguages: raw.spoken_languages
      ? raw.spoken_languages.map((l) => ({ iso639_1: l.iso_639_1, name: l.name }))
      : null,
    productionCountries: raw.production_countries
      ? raw.production_countries.map((c) => ({ iso3166_1: c.iso_3166_1, name: c.name }))
      : null,
    tagline: raw.tagline ?? null,
    inProduction: raw.in_production ?? null,
    networks: raw.networks
      ? raw.networks.map((n) => ({
          id: n.id,
          name: n.name,
          logoPath: n.logo_path ?? null,
          originCountry: n.origin_country,
        }))
      : null,
    createdBy: raw.created_by
      ? raw.created_by.map((c) => ({ id: c.id, name: c.name, profilePath: c.profile_path ?? null }))
      : null,
    numberOfSeasons: raw.number_of_seasons ?? null,
    numberOfEpisodes: raw.number_of_episodes ?? null,
    keywords: raw.keywords?.results?.map((k) => k.name) ?? null,
    externalIds: raw.external_ids
      ? (raw.external_ids as unknown as Record<string, string | number | null>)
      : null,
    seasons: raw.seasons
      ? raw.seasons.map((s) => ({
          tmdbId: s.id,
          seasonNumber: s.season_number,
          posterPath: s.poster_path ?? null,
          episodeCount: s.episode_count,
        }))
      : null,
  }
}

const MAX_CAST = 10

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

  async getMovieMetadata(tmdbId: number, opts?: { language?: string }): Promise<ExternalMovieMetadata | null> {
    const params = new URLSearchParams({ append_to_response: 'keywords,external_ids' })
    if (opts?.language) params.set('language', opts.language)
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}?${params}`)
    if (response.status === 404) return null
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbMovieDetail
      return { ...mapMovieDetail(raw), certification: null }
    } catch {
      throw new TmdbNetworkError('Could not parse TMDB movie response')
    }
  }

  async getSeriesMetadata(tmdbId: number, opts?: { language?: string }): Promise<ExternalSeriesMetadata | null> {
    const params = new URLSearchParams({ append_to_response: 'keywords,external_ids' })
    if (opts?.language) params.set('language', opts.language)
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}?${params}`)
    if (response.status === 404) return null
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      const raw = (await response.json()) as TmdbSeriesDetail
      return { ...mapSeriesDetail(raw), certification: null }
    } catch {
      throw new TmdbNetworkError('Could not parse TMDB series response')
    }
  }

  async fetchCollection(collectionTmdbId: number): Promise<TmdbCollection | null> {
    const response = await this.fetchWithRetry(`${BASE_URL}/collection/${collectionTmdbId}`)
    if (response.status === 404) return null
    if (!response.ok) throw new TmdbNetworkError(`TMDB returned HTTP ${response.status}`)
    try {
      return (await response.json()) as TmdbCollection
    } catch {
      throw new TmdbNetworkError('Could not parse TMDB collection response')
    }
  }

  async getMovieVideos(tmdbId: number): Promise<ExternalVideo[]> {
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/videos`)
    if (!response.ok) return []
    try {
      const raw = (await response.json()) as TmdbVideosResponse
      return (raw.results ?? [])
        .filter((v) => v.site === 'YouTube')
        .map((v) => ({
          key: v.key,
          site: v.site,
          type: v.type,
          official: v.official,
          publishedAt: v.published_at ?? null,
        }))
    } catch {
      return []
    }
  }

  async getSeriesVideos(tmdbId: number): Promise<ExternalVideo[]> {
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/videos`)
    if (!response.ok) return []
    try {
      const raw = (await response.json()) as TmdbVideosResponse
      return (raw.results ?? [])
        .filter((v) => v.site === 'YouTube')
        .map((v) => ({
          key: v.key,
          site: v.site,
          type: v.type,
          official: v.official,
          publishedAt: v.published_at ?? null,
        }))
    } catch {
      return []
    }
  }

  async getMovieCredits(tmdbId: number): Promise<ExternalCreditPerson[]> {
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/credits`)
    if (!response.ok) return []
    try {
      const raw = (await response.json()) as TmdbCreditsResponse
      const cast: ExternalCreditPerson[] = (raw.cast ?? [])
        .slice(0, MAX_CAST)
        .map((c) => ({
          name: c.name,
          character: c.character || null,
          role: 'cast' as const,
          order: c.order,
          profilePath: c.profile_path,
        }))
      const directors: ExternalCreditPerson[] = (raw.crew ?? [])
        .filter((c) => c.job === 'Director')
        .map((c, i) => ({
          name: c.name,
          character: null,
          role: 'director' as const,
          order: i,
          profilePath: c.profile_path,
        }))
      return [...cast, ...directors]
    } catch {
      return []
    }
  }

  async getSeriesCredits(tmdbId: number): Promise<ExternalCreditPerson[]> {
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/aggregate_credits`)
    if (!response.ok) return []
    try {
      const raw = (await response.json()) as TmdbAggregateCreditsResponse
      const cast: ExternalCreditPerson[] = (raw.cast ?? [])
        .slice(0, MAX_CAST)
        .map((c) => ({
          name: c.name,
          character: c.roles?.[0]?.character ?? null,
          role: 'cast' as const,
          order: c.order,
          profilePath: c.profile_path,
        }))
      const creators: ExternalCreditPerson[] = (raw.crew ?? [])
        .filter((c) => c.job === 'Creator' || c.job === 'Executive Producer')
        .slice(0, 2)
        .map((c, i) => ({
          name: c.name,
          character: null,
          role: 'director' as const,
          order: i,
          profilePath: c.profile_path,
        }))
      return [...cast, ...creators]
    } catch {
      return []
    }
  }

  async getMovieCertification(tmdbId: number): Promise<string | null> {
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/${tmdbId}/release_dates`)
    if (!response.ok) return null
    try {
      const raw = (await response.json()) as TmdbReleaseDatesResponse
      const usEntry = (raw.results ?? []).find((r) => r.iso_3166_1 === 'US')
      if (!usEntry) return null
      const certified = usEntry.release_dates.find((d) => d.certification)
      return certified?.certification ?? null
    } catch {
      return null
    }
  }

  async getSeriesCertification(tmdbId: number): Promise<string | null> {
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbId}/content_ratings`)
    if (!response.ok) return null
    try {
      const raw = (await response.json()) as TmdbContentRatingsResponse
      const usEntry = (raw.results ?? []).find((r) => r.iso_3166_1 === 'US')
      return usEntry?.rating ?? null
    } catch {
      return null
    }
  }

  async getSeasonEpisodes(tmdbSeriesId: number, seasonNumber: number): Promise<ExternalSeasonEpisode[]> {
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/${tmdbSeriesId}/season/${seasonNumber}`)
    if (response.status === 404) return []
    if (!response.ok) return []
    try {
      const raw = (await response.json()) as TmdbSeasonResponse
      return (raw.episodes ?? []).map((ep) => ({
        episodeNumber: ep.episode_number,
        title: ep.name || null,
        synopsis: ep.overview || null,
        airDate: ep.air_date || null,
        runtimeMinutes: ep.runtime ?? null,
        stillPath: ep.still_path ?? null,
        tmdbId: ep.id ?? null,
        voteAverage: ep.vote_average ?? null,
        voteCount: ep.vote_count ?? null,
      }))
    } catch {
      return []
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB series search response')
    }
  }

  async fetchMovieFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]> {
    const paths: Record<DiscoveryFeed, string> = {
      popular: '/movie/popular',
      trending: '/trending/movie/week',
      upcoming: '/movie/upcoming',
    }
    const params = new URLSearchParams({ page: String(page) })
    const response = await this.fetchWithRetry(`${BASE_URL}${paths[feed]}?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB movie feed response')
    }
  }

  async fetchSeriesFeed(feed: DiscoveryFeed, page: number): Promise<MetadataCandidate[]> {
    const paths: Record<DiscoveryFeed, string> = {
      popular: '/tv/popular',
      trending: '/trending/tv/week',
      upcoming: '/tv/on_the_air',
    }
    const params = new URLSearchParams({ page: String(page) })
    const response = await this.fetchWithRetry(`${BASE_URL}${paths[feed]}?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB series feed response')
    }
  }

  async fetchMovieTopRated(page: number): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ page: String(page) })
    const response = await this.fetchWithRetry(`${BASE_URL}/movie/top_rated?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB movie top_rated response')
    }
  }

  async fetchSeriesTopRated(page: number): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ page: String(page) })
    const response = await this.fetchWithRetry(`${BASE_URL}/tv/top_rated?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB series top_rated response')
    }
  }

  async fetchMovieDiscover(discoverParams: DiscoverParams, page: number): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ sort_by: 'popularity.desc', page: String(page) })
    if (discoverParams.genreId != null) params.set('with_genres', String(discoverParams.genreId))
    if (discoverParams.language) params.set('with_original_language', discoverParams.language)
    const response = await this.fetchWithRetry(`${BASE_URL}/discover/movie?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB movie discover response')
    }
  }

  async fetchSeriesDiscover(discoverParams: DiscoverParams, page: number): Promise<MetadataCandidate[]> {
    const params = new URLSearchParams({ sort_by: 'popularity.desc', page: String(page) })
    if (discoverParams.genreId != null) params.set('with_genres', String(discoverParams.genreId))
    if (discoverParams.language) params.set('with_original_language', discoverParams.language)
    const response = await this.fetchWithRetry(`${BASE_URL}/discover/tv?${params}`)
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
        popularity: item.popularity ?? null,
        voteAverage: item.vote_average ?? null,
      }))
    } catch (err) {
      if (err instanceof TmdbNetworkError) throw err
      throw new TmdbNetworkError('Could not parse TMDB series discover response')
    }
  }
}
