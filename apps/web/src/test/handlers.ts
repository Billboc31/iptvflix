import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
  MovieDetailResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  MovieResponse,
  SeriesResponse,
  GenreResponse,
  SourceResponse,
  SyncRunResponse,
  PaginatedList,
  WatchlistEntry,
  ContinueWatchingItem,
  ShelfSummaryResponse,
  ShelfResponse,
  ProfileResponse,
  DeviceResponse,
  PairingCodeDetailResponse,
  PlaybackCommandResponse,
} from '@iptvflix/api-contracts'

export const MOCK_MOVIE: MovieDetailResponse = {
  id: 'movie-1',
  title: 'The Test Movie',
  year: 2024,
  synopsis: 'A great test movie.',
  posterUrl: null,
  backdropUrl: null,
  runtime: 120,
  genres: ['Action'],
  quality: 'HD',
  availabilityCount: 1,
  availabilityStatus: 'AVAILABLE',
  trailerKey: 'abc123',
  originalTitle: 'The Original Test Movie',
  imdbId: null,
  tmdbId: 99999,
  enrichmentStatus: 'matched',
  selectedVariantId: null,
  variants: [],
  cast: [
    { name: 'Jane Doe', character: 'Hero', profileUrl: null },
    { name: 'John Smith', character: 'Villain', profileUrl: null },
  ],
  director: 'Denis Villeneuve',
  voteAverage: 7.9,
  certification: 'PG-13',
}

export const MOCK_MOVIE_NO_TRAILER: MovieDetailResponse = {
  ...MOCK_MOVIE,
  id: 'movie-3',
  trailerKey: null,
  cast: [],
  director: null,
  voteAverage: null,
  certification: null,
}

export const MOCK_PROFILE_PREFERENCES = {
  preferredAudioLanguages: [] as string[],
  preferredSubtitleLanguages: [] as string[],
  preferredSourceIds: [] as string[],
  maxVideoQuality: null as string | null,
  autoplayPreviews: true,
}

export const MOCK_UNMATCHED_MOVIE: MovieDetailResponse = {
  id: 'movie-2',
  title: 'Unmatched Movie',
  year: null,
  synopsis: null,
  posterUrl: null,
  backdropUrl: null,
  runtime: null,
  genres: [],
  quality: null,
  availabilityCount: 0,
  availabilityStatus: 'UNAVAILABLE',
  originalTitle: null,
  imdbId: null,
  tmdbId: null,
  enrichmentStatus: 'unmatched',
  selectedVariantId: null,
  variants: [],
  trailerKey: null,
  cast: [],
  director: null,
  voteAverage: null,
  certification: null,
}

export const MOCK_SERIES: SeriesDetailResponse = {
  id: 'series-1',
  title: 'The Test Series',
  year: 2023,
  synopsis: 'A great test series.',
  posterUrl: null,
  backdropUrl: null,
  genres: ['Drama'],
  seasonCount: 2,
  availabilityCount: 1,
  availabilityStatus: 'AVAILABLE',
  originalTitle: null,
  imdbId: null,
  tmdbId: 12345,
  enrichmentStatus: 'partial',
  selectedVariantId: null,
  variants: [],
  seasons: [
    { seasonNumber: 1, title: 'Saison 1', episodeCount: 3, availableEpisodeCount: 2, airYear: 2023 },
    { seasonNumber: 2, title: null, episodeCount: 2, availableEpisodeCount: 0, airYear: 2024 },
  ],
  trailerKey: 'xyz789',
  cast: [{ name: 'Alice Martin', character: 'Lead', profileUrl: null }],
  director: 'Showrunner Name',
  voteAverage: 8.2,
  certification: 'TV-MA',
  status: 'Returning Series',
}

export const MOCK_EPISODES: EpisodeResponse[] = [
  {
    id: 'ep-1',
    episodeNumber: 1,
    title: 'Pilot',
    synopsis: 'The first episode.',
    durationMinutes: 45,
    airDate: '2023-01-01',
    availabilityCount: 1,
    availabilityStatus: 'AVAILABLE',
    selectedVariantId: null,
    variants: [],
    watchState: 'watched',
  },
  {
    id: 'ep-2',
    episodeNumber: 2,
    title: 'Second Episode',
    synopsis: null,
    durationMinutes: 42,
    airDate: '2023-01-08',
    availabilityCount: 1,
    availabilityStatus: 'AVAILABLE',
    selectedVariantId: null,
    variants: [],
    watchState: 'in_progress',
  },
  {
    id: 'ep-3',
    episodeNumber: 3,
    title: null,
    synopsis: null,
    durationMinutes: null,
    airDate: null,
    availabilityCount: 0,
    availabilityStatus: 'UNAVAILABLE',
    selectedVariantId: null,
    variants: [],
    watchState: null,
  },
]

export const MOCK_SOURCE: SourceResponse = {
  id: 'source-1',
  name: 'My IPTV',
  type: 'XTREAM',
  baseUrl: 'http://provider.example.com',
  username: 'user',
  enabled: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

export const MOCK_GENRES: GenreResponse[] = [
  { id: 'genre-1', name: 'Action' },
  { id: 'genre-2', name: 'Drama' },
]

export const MOCK_WATCHLIST_ENTRY: WatchlistEntry = {
  id: 'wl-1',
  profileId: '00000000-0000-0000-0000-000000000001',
  mediaType: 'MOVIE',
  mediaId: 'movie-1',
  title: 'The Test Movie',
  posterUrl: null,
  addedAt: '2024-01-01T10:00:00Z',
}

export const MOCK_CONTINUE_WATCHING: ContinueWatchingItem = {
  id: 'cw-1',
  profileId: '00000000-0000-0000-0000-000000000001',
  mediaType: 'MOVIE',
  mediaId: 'movie-1',
  progressSeconds: 60,
  durationSeconds: 120,
  lastWatchedAt: '2024-01-01T10:00:00Z',
  title: 'The Test Movie',
  posterUrl: null,
}

export const MOCK_SHELF_SUMMARY: ShelfSummaryResponse = {
  id: 'sys_recently_added_movies',
  title: 'Récemment ajoutés — Films',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  position: 1,
}

export const MOCK_SHELF: ShelfResponse = {
  id: 'sys_recently_added_movies',
  title: 'Récemment ajoutés — Films',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [
    {
      mediaType: 'MOVIE',
      mediaId: 'movie-1',
      title: 'The Test Movie',
      posterUrl: null,
    },
  ],
}

export const MOCK_DEVICE_ONLINE: DeviceResponse = {
  id: 'device-1',
  name: 'Salon TV',
  lastSeenAt: new Date(Date.now() - 10_000).toISOString(),
  revokedAt: null,
  createdAt: new Date('2024-01-01').toISOString(),
}

export const MOCK_DEVICE_OFFLINE: DeviceResponse = {
  id: 'device-2',
  name: 'Chambre TV',
  lastSeenAt: new Date(Date.now() - 200_000).toISOString(),
  revokedAt: null,
  createdAt: new Date('2024-01-01').toISOString(),
}

export const MOCK_PAIRING_CODE_DETAIL: PairingCodeDetailResponse = {
  code: 'ABCD1234',
  status: 'pending',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
}

export const MOCK_PLAY_COMMAND: PlaybackCommandResponse = {
  id: 'cmd-1',
  mediaType: 'movie',
  mediaId: 'movie-1',
  availabilityId: null,
  startPositionMs: 0,
  state: 'delivered',
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  createdAt: new Date().toISOString(),
}

export const MOCK_SYNC_RUN: SyncRunResponse = {
  id: 'run-1',
  sourceId: 'source-1',
  status: 'DONE',
  startedAt: '2024-01-01T10:00:00Z',
  finishedAt: '2024-01-01T10:05:00Z',
  moviesAdded: 50,
  seriesAdded: 10,
}

const moviesList: PaginatedList<MovieResponse> = {
  items: [MOCK_MOVIE],
  total: 1,
  page: 1,
  pageSize: 20,
}

const seriesList: PaginatedList<SeriesResponse> = {
  items: [MOCK_SERIES],
  total: 1,
  page: 1,
  pageSize: 20,
}

const defaultProfile: ProfileResponse = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Default',
  preferences: MOCK_PROFILE_PREFERENCES,
}

export const handlers = [
  http.get('/api/profile', () => HttpResponse.json(defaultProfile)),
  http.patch('/api/profile/preferences', async ({ request }) => {
    const body = await request.json() as Partial<ProfileResponse['preferences']>
    return HttpResponse.json({ ...defaultProfile, preferences: { ...MOCK_PROFILE_PREFERENCES, ...body } })
  }),
  http.get('/api/movies', () => HttpResponse.json(moviesList)),
  http.get('/api/movies/:id', () => HttpResponse.json(MOCK_MOVIE)),
  http.get('/api/series', () => HttpResponse.json(seriesList)),
  http.get('/api/series/:id', () => HttpResponse.json(MOCK_SERIES)),
  http.get('/api/series/:id/seasons/:seasonNumber/episodes', () =>
    HttpResponse.json(MOCK_EPISODES),
  ),
  http.get('/api/search', () =>
    HttpResponse.json({ movies: [MOCK_MOVIE], series: [MOCK_SERIES], externalMovies: [], externalSeries: [] }),
  ),
  http.get('/api/genres', () => HttpResponse.json(MOCK_GENRES)),
  http.get('/api/sources', () => HttpResponse.json([MOCK_SOURCE])),
  http.post('/api/sources', () => HttpResponse.json(MOCK_SOURCE, { status: 201 })),
  http.patch('/api/sources/:id', () => HttpResponse.json(MOCK_SOURCE)),
  http.delete('/api/sources/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/sources/:id/test', () =>
    HttpResponse.json({ ok: true, message: 'Connexion réussie' }),
  ),
  http.get('/api/sync-runs', () => HttpResponse.json([MOCK_SYNC_RUN])),
  http.post('/api/sync-runs', () => HttpResponse.json(MOCK_SYNC_RUN, { status: 201 })),
  http.get('/api/watchlist', () => HttpResponse.json([MOCK_WATCHLIST_ENTRY])),
  http.post('/api/watchlist', () => HttpResponse.json(MOCK_WATCHLIST_ENTRY, { status: 201 })),
  http.delete('/api/watchlist/:mediaType/:mediaId', () => new HttpResponse(null, { status: 204 })),
  http.put('/api/progress/:mediaType/:mediaId', () => HttpResponse.json(MOCK_CONTINUE_WATCHING)),
  http.get('/api/continue-watching', () => HttpResponse.json([MOCK_CONTINUE_WATCHING])),
  http.get('/api/devices', () => HttpResponse.json([MOCK_DEVICE_ONLINE])),
  http.get('/api/pairing/codes/:code', ({ params }) => {
    const { code } = params as { code: string }
    if (code === 'ABCD1234') return HttpResponse.json(MOCK_PAIRING_CODE_DETAIL)
    return new HttpResponse(null, { status: 404 })
  }),
  http.post('/api/pairing/codes/:code/approve', () => HttpResponse.json(MOCK_DEVICE_ONLINE, { status: 201 })),
  http.post('/api/devices/:id/commands', () => HttpResponse.json(MOCK_PLAY_COMMAND, { status: 201 })),
  http.patch('/api/devices/:id', ({ params }) =>
    HttpResponse.json({ ...MOCK_DEVICE_ONLINE, id: (params as { id: string }).id }),
  ),
  http.delete('/api/devices/:id', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/shelves', () => HttpResponse.json([MOCK_SHELF_SUMMARY])),
  http.get('/api/shelves/:id', () => HttpResponse.json(MOCK_SHELF)),
  http.post('/api/shelves', () => HttpResponse.json(MOCK_SHELF_SUMMARY, { status: 201 })),
  http.patch('/api/shelves/:id', () => HttpResponse.json(MOCK_SHELF_SUMMARY)),
  http.delete('/api/shelves/:id', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/shelves/:id/members', () => new HttpResponse(null, { status: 204 })),
  http.delete('/api/shelves/:id/members/:mediaType/:mediaId', () => new HttpResponse(null, { status: 204 })),
  http.put('/api/shelves/:id/members/order', () => new HttpResponse(null, { status: 204 })),
]

export const server = setupServer(...handlers)
