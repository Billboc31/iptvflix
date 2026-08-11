import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
  MovieResponse,
  SeriesResponse,
  GenreResponse,
  SourceResponse,
  SyncRunResponse,
  PaginatedList,
  WatchlistEntry,
  ContinueWatchingItem,
} from '@iptvflix/api-contracts'

export const MOCK_MOVIE: MovieResponse = {
  id: 'movie-1',
  title: 'The Test Movie',
  year: 2024,
  synopsis: 'A great test movie.',
  posterUrl: null,
  backdropUrl: null,
  runtime: 120,
  genres: ['Action'],
  quality: 'HD',
  availabilityStatus: 'AVAILABLE',
}

export const MOCK_SERIES: SeriesResponse = {
  id: 'series-1',
  title: 'The Test Series',
  year: 2023,
  synopsis: 'A great test series.',
  posterUrl: null,
  backdropUrl: null,
  genres: ['Drama'],
  seasonCount: 2,
  availabilityStatus: 'AVAILABLE',
}

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

export const handlers = [
  http.get('/api/movies', () => HttpResponse.json(moviesList)),
  http.get('/api/movies/:id', () => HttpResponse.json(MOCK_MOVIE)),
  http.get('/api/series', () => HttpResponse.json(seriesList)),
  http.get('/api/series/:id', () => HttpResponse.json(MOCK_SERIES)),
  http.get('/api/search', () =>
    HttpResponse.json({ movies: [MOCK_MOVIE], series: [MOCK_SERIES] }),
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
]

export const server = setupServer(...handlers)
