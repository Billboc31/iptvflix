import type {
  XtreamUserInfo,
  XtreamCategory,
  XtreamVodStream,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamLiveCategory,
  XtreamLiveStream,
} from './types.js'
import { XtreamAuthError, XtreamNetworkError, XtreamParseError } from './errors.js'

interface XtreamClientConfig {
  baseUrl: string
  username: string
  password: string
  timeoutMs?: number
}

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has('username')) u.searchParams.set('username', '[REDACTED]')
    if (u.searchParams.has('password')) u.searchParams.set('password', '[REDACTED]')
    return u.toString()
  } catch {
    return '[URL_REDACTED]'
  }
}

function parseArrayOrThrow<T>(raw: unknown, endpoint: string): T[] {
  if (!Array.isArray(raw)) throw new XtreamParseError(endpoint)
  return raw as T[]
}

function parseAccountInfoOrThrow(raw: unknown, endpoint: string): { user_info: XtreamUserInfo } {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('user_info' in raw) ||
    typeof (raw as Record<string, unknown>).user_info !== 'object' ||
    (raw as Record<string, unknown>).user_info === null
  ) {
    throw new XtreamParseError(endpoint)
  }
  const userInfo = (raw as Record<string, unknown>).user_info as Record<string, unknown>
  if (typeof userInfo.status !== 'string') throw new XtreamParseError(endpoint)
  return raw as { user_info: XtreamUserInfo }
}

function parseSeriesInfoOrThrow(raw: unknown, endpoint: string): XtreamSeriesInfo {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('info' in raw) ||
    !('episodes' in raw)
  ) {
    throw new XtreamParseError(endpoint)
  }
  return raw as XtreamSeriesInfo
}

export class XtreamCodesClient {
  private readonly config: Required<XtreamClientConfig>

  constructor(config: XtreamClientConfig) {
    this.config = { timeoutMs: 10_000, ...config }
  }

  private buildUrl(action: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.config.baseUrl}/player_api.php`)
    url.searchParams.set('username', this.config.username)
    url.searchParams.set('password', this.config.password)
    url.searchParams.set('action', action)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return url.toString()
  }

  private async fetch(action: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = this.buildUrl(action, params)
    let response: Response
    try {
      response = await globalThis.fetch(url, {
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new XtreamNetworkError(`Request to ${sanitizeUrl(url)} timed out`)
      }
      throw new XtreamNetworkError(`Could not reach host at ${sanitizeUrl(url)}`)
    }

    if (!response.ok) {
      throw new XtreamAuthError(`Provider rejected request with HTTP ${response.status}`)
    }

    try {
      return await response.json()
    } catch {
      throw new XtreamParseError(action)
    }
  }

  async authenticate(): Promise<XtreamUserInfo> {
    const raw = await this.fetch('get_account_info')
    const parsed = parseAccountInfoOrThrow(raw, 'get_account_info')
    if (parsed.user_info.status === 'Disabled') {
      throw new XtreamAuthError('Account is disabled')
    }
    return parsed.user_info
  }

  async getVodCategories(): Promise<XtreamCategory[]> {
    const raw = await this.fetch('get_vod_categories')
    return parseArrayOrThrow<XtreamCategory>(raw, 'get_vod_categories')
  }

  async getVodStreams(categoryId?: string): Promise<XtreamVodStream[]> {
    const params: Record<string, string> = {}
    if (categoryId) params.category_id = categoryId
    const raw = await this.fetch('get_vod_streams', params)
    return parseArrayOrThrow<XtreamVodStream>(raw, 'get_vod_streams')
  }

  async getSeriesCategories(): Promise<XtreamCategory[]> {
    const raw = await this.fetch('get_series_categories')
    return parseArrayOrThrow<XtreamCategory>(raw, 'get_series_categories')
  }

  async getSeries(categoryId?: string): Promise<XtreamSeries[]> {
    const params: Record<string, string> = {}
    if (categoryId) params.category_id = categoryId
    const raw = await this.fetch('get_series', params)
    return parseArrayOrThrow<XtreamSeries>(raw, 'get_series')
  }

  async getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo> {
    const raw = await this.fetch('get_series_info', { series_id: String(seriesId) })
    return parseSeriesInfoOrThrow(raw, 'get_series_info')
  }

  async getLiveCategories(): Promise<XtreamLiveCategory[]> {
    const raw = await this.fetch('get_live_categories')
    return parseArrayOrThrow<XtreamLiveCategory>(raw, 'get_live_categories')
  }

  async getLiveStreams(categoryId?: string): Promise<XtreamLiveStream[]> {
    const params: Record<string, string> = {}
    if (categoryId) params.category_id = categoryId
    const raw = await this.fetch('get_live_streams', params)
    return parseArrayOrThrow<XtreamLiveStream>(raw, 'get_live_streams')
  }
}
