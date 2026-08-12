import type {
  MovieResponse,
  MovieDetailResponse,
  SeriesResponse,
  GenreResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  PaginatedList,
  MovieFilters,
  SeriesFilters,
  SearchResponse,
  SourceResponse,
  CreateSourceBody,
  UpdateSourceBody,
  TestSourceResult,
  SyncRunResponse,
  TriggerSyncBody,
  WatchlistEntry,
  AddToWatchlistBody,
  WatchlistMediaType,
  ViewingProgressRow,
  UpsertProgressBody,
  ProgressMediaType,
  ContinueWatchingItem,
  ShelfSummaryResponse,
  ShelfResponse,
  CreateShelfBody,
  UpdateShelfBody,
  AddShelfMemberBody,
  ReorderShelfMembersBody,
  GenerateShelfBody,
  GenerateShelfResponse,
  ProfileResponse,
  UpdateProfilePreferencesBody,
  FeedbackItem,
  SetFeedbackBody,
  HomeResponse,
} from '@iptvflix/api-contracts'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  // Fastify rejects empty bodies when Content-Type is application/json
  // (e.g. POST /sources/:id/test with no payload).
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed?.error) message = parsed.error
    } catch {
      // keep raw text
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function listMovies(filters: MovieFilters = {}): Promise<PaginatedList<MovieResponse>> {
  return request(`/movies${toQuery(filters)}`)
}

export function getMovie(id: string): Promise<MovieDetailResponse> {
  return request(`/movies/${id}`)
}

export function listSeries(filters: SeriesFilters = {}): Promise<PaginatedList<SeriesResponse>> {
  return request(`/series${toQuery(filters)}`)
}

export function getSeries(id: string): Promise<SeriesDetailResponse> {
  return request(`/series/${id}`)
}

export function getSeriesSeasonEpisodes(
  seriesId: string,
  seasonNumber: number,
  profileId?: string,
): Promise<EpisodeResponse[]> {
  return request(`/series/${seriesId}/seasons/${seasonNumber}/episodes${toQuery({ profileId })}`)
}

export function searchContent(q: string): Promise<SearchResponse> {
  return request(`/search${toQuery({ q })}`)
}

export function materializeMovie(tmdbId: string): Promise<{ id: string }> {
  return request('/discovery/movies', { method: 'POST', body: JSON.stringify({ tmdbId }) })
}

export function materializeSeries(tmdbId: string): Promise<{ id: string }> {
  return request('/discovery/series', { method: 'POST', body: JSON.stringify({ tmdbId }) })
}

export function listGenres(): Promise<GenreResponse[]> {
  return request('/genres')
}

export function listSources(): Promise<SourceResponse[]> {
  return request('/sources')
}

export function createSource(body: CreateSourceBody): Promise<SourceResponse> {
  return request('/sources', { method: 'POST', body: JSON.stringify(body) })
}

export function updateSource(id: string, body: UpdateSourceBody): Promise<SourceResponse> {
  return request(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteSource(id: string): Promise<void> {
  return request(`/sources/${id}`, { method: 'DELETE' })
}

export function testSource(id: string): Promise<TestSourceResult> {
  return request(`/sources/${id}/test`, { method: 'POST' })
}

export function listSyncRuns(): Promise<SyncRunResponse[]> {
  return request('/sync-runs')
}

export function triggerSync(body: TriggerSyncBody): Promise<SyncRunResponse> {
  return request('/sync-runs', { method: 'POST', body: JSON.stringify(body) })
}

export function fetchWatchlist(): Promise<WatchlistEntry[]> {
  return request('/watchlist')
}

export function addToWatchlist(body: AddToWatchlistBody): Promise<WatchlistEntry> {
  return request('/watchlist', { method: 'POST', body: JSON.stringify(body) })
}

export function removeFromWatchlist(mediaType: WatchlistMediaType, mediaId: string): Promise<void> {
  return request(`/watchlist/${mediaType}/${mediaId}`, { method: 'DELETE' })
}

export function upsertProgress(
  mediaType: ProgressMediaType,
  mediaId: string,
  body: UpsertProgressBody,
): Promise<ViewingProgressRow> {
  return request(`/progress/${mediaType}/${mediaId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function fetchContinueWatching(): Promise<ContinueWatchingItem[]> {
  return request('/continue-watching')
}

export function fetchShelves(): Promise<ShelfSummaryResponse[]> {
  return request('/shelves')
}

export function fetchShelf(id: string): Promise<ShelfResponse> {
  return request(`/shelves/${id}`)
}

export function createShelf(body: CreateShelfBody): Promise<ShelfSummaryResponse> {
  return request('/shelves', { method: 'POST', body: JSON.stringify(body) })
}

export function updateShelf(id: string, body: UpdateShelfBody): Promise<ShelfSummaryResponse> {
  return request(`/shelves/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteShelf(id: string): Promise<void> {
  return request(`/shelves/${id}`, { method: 'DELETE' })
}

export function addShelfMember(id: string, body: AddShelfMemberBody): Promise<void> {
  return request(`/shelves/${id}/members`, { method: 'POST', body: JSON.stringify(body) })
}

export function removeShelfMember(id: string, mediaType: 'MOVIE' | 'SERIES', mediaId: string): Promise<void> {
  return request(`/shelves/${id}/members/${mediaType}/${mediaId}`, { method: 'DELETE' })
}

export function reorderShelfMembers(id: string, body: ReorderShelfMembersBody): Promise<void> {
  return request(`/shelves/${id}/members/order`, { method: 'PUT', body: JSON.stringify(body) })
}

export function generateShelf(body: GenerateShelfBody): Promise<GenerateShelfResponse> {
  return request('/shelves/generate', { method: 'POST', body: JSON.stringify(body) })
}

export function refreshShelf(id: string): Promise<GenerateShelfResponse> {
  return request(`/shelves/${id}/refresh`, { method: 'POST' })
}

export function getProfile(): Promise<ProfileResponse> {
  return request('/profile')
}

export function updateProfilePreferences(body: UpdateProfilePreferencesBody): Promise<ProfileResponse> {
  return request('/profile/preferences', { method: 'PATCH', body: JSON.stringify(body) })
}

export function fetchFeedback(): Promise<FeedbackItem[]> {
  return request('/feedback')
}

export function setFeedback(mediaType: WatchlistMediaType, mediaId: string, body: SetFeedbackBody): Promise<FeedbackItem> {
  return request(`/feedback/${mediaType}/${mediaId}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function clearFeedback(mediaType: WatchlistMediaType, mediaId: string): Promise<void> {
  return request(`/feedback/${mediaType}/${mediaId}`, { method: 'DELETE' })
}

export function fetchHome(profileId: string): Promise<HomeResponse> {
  return request(`/profiles/${profileId}/home`)
}
