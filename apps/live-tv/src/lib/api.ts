import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  ProfileResponse,
  SelectProfileResponse,
  ChannelResponse,
  ChannelStreamResponse,
  ChannelPlaybackResponse,
  GuideChannelResponse,
  ChannelHistoryEntry,
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
    // private mode / quota
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // ignore
  }
}

// Pick up ?token= query param from VOD→LiveTV redirect
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href)
  const param = url.searchParams.get('token')
  if (param) {
    setStoredAuthToken(param)
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
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

export function listProfiles(): Promise<ProfileResponse[]> {
  return request('/profiles')
}

export async function selectProfile(profileId: string): Promise<SelectProfileResponse> {
  const res = await request<SelectProfileResponse>(`/profiles/${profileId}/select`, { method: 'POST' })
  if (res.token) setStoredAuthToken(res.token)
  return res
}

export function listChannels(opts?: {
  country?: string
  catalog?: 'curated' | 'all'
  lang?: string
}): Promise<ChannelResponse[]> {
  const params = new URLSearchParams()
  if (opts?.catalog) params.set('catalog', opts.catalog)
  if (opts?.country) params.set('country', opts.country)
  if (opts?.lang) params.set('lang', opts.lang)
  const qs = params.toString()
  return request(`/channels${qs ? `?${qs}` : ''}`)
}

export function getChannelStream(id: string): Promise<ChannelStreamResponse> {
  return request(`/channels/${id}/stream`)
}

export function resolveChannelPlayback(id: string): Promise<ChannelPlaybackResponse> {
  return request(`/channels/${id}/playback/resolve`, { method: 'POST' })
}

export function getGuideChannels(opts?: {
  country?: string
  catalog?: 'curated' | 'all'
  hours?: number
}): Promise<GuideChannelResponse[]> {
  const params = new URLSearchParams()
  if (opts?.catalog) params.set('catalog', opts.catalog)
  if (opts?.country) params.set('country', opts.country)
  if (opts?.hours) params.set('hours', String(opts.hours))
  const qs = params.toString()
  return request(`/channels/guide${qs ? `?${qs}` : ''}`)
}

export function listFavoriteChannels(): Promise<ChannelResponse[]> {
  return request('/channels/favorites')
}

export function addFavorite(id: string): Promise<void> {
  return request(`/channels/${id}/favorite`, { method: 'POST' })
}

export function removeFavorite(id: string): Promise<void> {
  return request(`/channels/${id}/favorite`, { method: 'DELETE' })
}

export function listHistory(): Promise<ChannelHistoryEntry[]> {
  return request('/channels/history')
}

export function recordHistory(id: string): Promise<void> {
  return request(`/channels/${id}/history`, { method: 'POST' })
}
