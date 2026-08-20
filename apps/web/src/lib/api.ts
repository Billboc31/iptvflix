import type {
  InteractionEventBody,
  BatchEventResponse,
  ArrivalItem,
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
  DiscoverResponse,
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
  NestedProfileResponse,
  UpdateProfilePreferencesBody,
  CreateProfileBody,
  UpdateProfileBody,
  SelectProfileResponse,
  FeedbackItem,
  SetFeedbackBody,
  HomeResponse,
  HomePageResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  PlaybackResolveRequest,
  PlaybackSessionResponse,
  DeviceResponse,
  PairingCodeDetailResponse,
  PlaybackCommandRequest,
  PlaybackCommandResponse,
} from '@iptvflix/api-contracts'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

const AUTH_TOKEN_KEY = 'iptvflix_auth_token'

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // private mode / quota — cookie may still work on desktop
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // ignore
  }
}

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
  const token = getStoredAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401) clearStoredAuthToken()
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

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
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

export function getSimilarMovies(id: string): Promise<MovieResponse[]> {
  return request(`/movies/${id}/similar`)
}

export function listSeries(filters: SeriesFilters = {}): Promise<PaginatedList<SeriesResponse>> {
  return request(`/series${toQuery(filters)}`)
}

export function getSeries(id: string): Promise<SeriesDetailResponse> {
  return request(`/series/${id}`)
}

export function getSimilarSeries(id: string): Promise<SeriesResponse[]> {
  return request(`/series/${id}/similar`)
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

export function searchDiscover(q: string): Promise<DiscoverResponse> {
  return request(`/search/remote${toQuery({ q })}`)
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

export function dismissContinueWatching(mediaType: ProgressMediaType, mediaId: string): Promise<void> {
  return request(`/continue-watching/${mediaType}/${mediaId}`, { method: 'DELETE' })
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

export function getProfile(): Promise<NestedProfileResponse> {
  return request('/profile')
}

export function updateProfilePreferences(body: UpdateProfilePreferencesBody): Promise<NestedProfileResponse> {
  return request('/profile/preferences', { method: 'PATCH', body: JSON.stringify(body) })
}

export function listProfiles(): Promise<ProfileResponse[]> {
  return request('/profiles')
}

export async function selectProfile(profileId: string): Promise<SelectProfileResponse> {
  const res = await request<SelectProfileResponse>(`/profiles/${profileId}/select`, { method: 'POST' })
  if (res.token) setStoredAuthToken(res.token)
  return res
}

export function createProfile(body: CreateProfileBody): Promise<ProfileResponse> {
  return request('/profiles', { method: 'POST', body: JSON.stringify(body) })
}

export function updateProfile(profileId: string, body: UpdateProfileBody): Promise<ProfileResponse> {
  return request(`/profiles/${profileId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteProfile(profileId: string): Promise<void> {
  return request(`/profiles/${profileId}`, { method: 'DELETE' })
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

export function fetchHomePage(profileId: string, cursor?: string): Promise<HomePageResponse> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return request(`/profiles/${profileId}/home${qs}`)
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { username, password }
  const res = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (res.token) setStoredAuthToken(res.token)
  return res
}

export async function logout(): Promise<{ ok: true }> {
  try {
    return await request('/auth/logout', { method: 'POST' })
  } finally {
    clearStoredAuthToken()
  }
}

export function getMe(): Promise<MeResponse> {
  return request('/auth/me')
}

export function fetchArrivals(filter: 'unread' | 'all' = 'unread'): Promise<ArrivalItem[]> {
  return request(`/arrivals${toQuery({ filter })}`)
}

export function markArrivalRead(id: string): Promise<void> {
  return request(`/arrivals/${id}/read`, { method: 'PATCH' })
}

export function resolvePlayback(
  mediaType: 'movie' | 'episode',
  mediaId: string,
  body: PlaybackResolveRequest = {},
): Promise<PlaybackSessionResponse> {
  return request(`/playback/resolve/${mediaType}/${mediaId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDevices(): Promise<DeviceResponse[]> {
  return request('/devices')
}

export function getPairingCodeDetail(code: string): Promise<PairingCodeDetailResponse> {
  return request(`/pairing/codes/${code}`)
}

export async function approvePairingCode(code: string, name?: string): Promise<DeviceResponse> {
  const res = await request<Record<string, unknown>>(
    `/pairing/codes/${code}/approve`,
    { method: 'POST', body: JSON.stringify({ name }) },
  )
  const nested = res?.device
  if (nested && typeof nested === 'object' && 'id' in nested && 'name' in nested) {
    return nested as DeviceResponse
  }
  return res as unknown as DeviceResponse
}

export function sendPlayOnTvCommand(
  deviceId: string,
  payload: PlaybackCommandRequest,
): Promise<PlaybackCommandResponse> {
  return request(`/devices/${deviceId}/commands`, { method: 'POST', body: JSON.stringify(payload) })
}

export function renameDevice(deviceId: string, name: string): Promise<DeviceResponse> {
  return request(`/devices/${deviceId}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function revokeDevice(deviceId: string): Promise<void> {
  return request(`/devices/${deviceId}`, { method: 'DELETE' })
}

export function semanticQuery(body: import('@iptvflix/api-contracts').SemanticQueryRequest): Promise<import('@iptvflix/api-contracts').SemanticQueryResponse> {
  return request('/recommendation-lab/semantic-query', { method: 'POST', body: JSON.stringify(body) })
}

export function generateShelfConcepts(
  body: import('@iptvflix/api-contracts').GenerateShelfConceptsBody,
): Promise<import('@iptvflix/api-contracts').GenerateShelfConceptsResponse> {
  return request('/shelf-concepts/generate', { method: 'POST', body: JSON.stringify(body) })
}

export function getShelfConceptPool(
  profileId: string,
): Promise<import('@iptvflix/api-contracts').ShelfConcept[]> {
  return request(`/shelf-concepts${toQuery({ profileId })}`)
}

export function sendShelfConceptFeedback(
  id: string,
  body: import('@iptvflix/api-contracts').ShelfConceptFeedbackBody,
): Promise<void> {
  return request(`/shelf-concepts/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) })
}

export function recordInteractionEvent(event: InteractionEventBody): Promise<void> {
  return request('/interaction-events', { method: 'POST', body: JSON.stringify(event) })
}

export function batchRecordInteractionEvents(events: InteractionEventBody[]): Promise<BatchEventResponse> {
  return request('/interaction-events/batch', { method: 'POST', body: JSON.stringify({ events }) })
}
