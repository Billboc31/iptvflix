import type {
  MovieResponse,
  SeriesResponse,
  PaginatedList,
  MovieFilters,
  SeriesFilters,
  SourceResponse,
  CreateSourceBody,
  UpdateSourceBody,
  TestSourceResult,
  SyncRunResponse,
  TriggerSyncBody,
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
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
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

export function getMovie(id: string): Promise<MovieResponse> {
  return request(`/movies/${id}`)
}

export function listSeries(filters: SeriesFilters = {}): Promise<PaginatedList<SeriesResponse>> {
  return request(`/series${toQuery(filters)}`)
}

export function getSeries(id: string): Promise<SeriesResponse> {
  return request(`/series/${id}`)
}

export function searchContent(
  q: string,
): Promise<{ movies: MovieResponse[]; series: SeriesResponse[] }> {
  return request(`/search${toQuery({ q })}`)
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
