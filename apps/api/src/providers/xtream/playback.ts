import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export function buildXtreamMovieUrl(
  baseUrl: string,
  username: string,
  password: string,
  providerItemId: string,
  containerExtension?: string | null,
): string {
  const base = baseUrl.replace(/\/$/, '')
  const ext = containerExtension || 'ts'
  // Xtream Codes VOD movies use /movie/{user}/{pass}/{streamId}.{ext}
  return `${base}/movie/${username}/${password}/${providerItemId}.${ext}`
}

export function buildXtreamEpisodeUrl(
  baseUrl: string,
  username: string,
  password: string,
  providerItemId: string,
  containerExtension?: string | null,
): string {
  const base = baseUrl.replace(/\/$/, '')
  const ext = containerExtension || 'ts'
  return `${base}/series/${username}/${password}/${providerItemId}.${ext}`
}

/** HTTPS so a HTTPS web app can play without mixed-content blocking. */
export function browserSafeXtreamUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return url
  }
}

/** Browser-like UA: some Cloudflare IPTV panels block VLC/Node from datacenter IPs. */
export const XTREAM_STREAM_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
}

const XTREAM_USER_AGENTS = [
  XTREAM_STREAM_HEADERS['User-Agent'],
  'VLC/3.0.20 LibVLC/3.0.20',
  'Lavf/60.16.100',
]

/**
 * Alternate Xtream VOD/live URL shapes for the same credentials.
 * Do not log the returned URLs — they embed username/password.
 */
export function xtreamUrlFallbacks(url: string): string[] {
  const seen = new Set<string>([url])
  const out = [url]
  const push = (candidate: string) => {
    if (!seen.has(candidate)) {
      seen.add(candidate)
      out.push(candidate)
    }
  }

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const origin = parsed.origin

    const movieIdx = parts.indexOf('movie')
    const seriesIdx = parts.indexOf('series')
    const liveIdx = parts.indexOf('live')

    let user: string | undefined
    let pass: string | undefined
    let file: string | undefined
    if (movieIdx >= 0 && parts.length >= movieIdx + 4) {
      user = parts[movieIdx + 1]
      pass = parts[movieIdx + 2]
      file = parts[movieIdx + 3]
    } else if (seriesIdx >= 0 && parts.length >= seriesIdx + 4) {
      user = parts[seriesIdx + 1]
      pass = parts[seriesIdx + 2]
      file = parts[seriesIdx + 3]
    } else if (liveIdx >= 0 && parts.length >= liveIdx + 4) {
      user = parts[liveIdx + 1]
      pass = parts[liveIdx + 2]
      file = parts[liveIdx + 3]
    } else if (parts.length >= 3) {
      user = parts[parts.length - 3]
      pass = parts[parts.length - 2]
      file = parts[parts.length - 1]
    }

    if (!user || !pass || !file) return out

    const id = file.includes('.') ? file.slice(0, file.lastIndexOf('.')) : file
    const ext = file.includes('.') ? file.slice(file.lastIndexOf('.') + 1) : 'ts'
    const alts = [ext, 'mkv', 'mp4', 'ts'].filter((e, i, arr) => arr.indexOf(e) === i)

    const origins = [origin]
    if (parsed.protocol === 'http:') origins.push(`https://${parsed.host}`)
    if (parsed.protocol === 'https:') origins.push(`http://${parsed.host}`)

    const pathVariants: string[] = []
    if (seriesIdx >= 0) {
      for (const e of alts.slice(0, 3)) pathVariants.push(`/series/${user}/${pass}/${id}.${e}`)
    } else {
      for (const e of alts.slice(0, 3)) pathVariants.push(`/movie/${user}/${pass}/${id}.${e}`)
      pathVariants.push(`/${user}/${pass}/${id}.${ext}`)
      pathVariants.push(`/live/${user}/${pass}/${id}.${ext}`)
    }

    for (const o of origins) {
      for (const path of pathVariants) push(`${o}${path}`)
    }
    if (!parsed.port) {
      push(`${parsed.protocol}//${parsed.hostname}:8080${pathVariants[0]}`)
      push(`${parsed.protocol}//${parsed.hostname}:25461${pathVariants[0]}`)
    }
  } catch {
    return out
  }

  return out
}

/** Fetch via IPv4 + Host header so Cloudflare/Railway IPv6 egress does not block streams. */
export async function resolveXtreamFetchTarget(
  url: string,
): Promise<{ href: string; extraHeaders: Record<string, string> }> {
  try {
    const parsed = new URL(url)
    if (isIP(parsed.hostname)) return { href: url, extraHeaders: {} }
    const { address } = await lookup(parsed.hostname, { family: 4 })
    const rewritten = new URL(url)
    rewritten.hostname = address
    return { href: rewritten.toString(), extraHeaders: { Host: parsed.hostname } }
  } catch {
    return { href: url, extraHeaders: {} }
  }
}

async function fetchCandidate(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const target = await resolveXtreamFetchTarget(url)
  const merged = { ...XTREAM_STREAM_HEADERS, ...target.extraHeaders, ...headers }
  const res = await fetch(target.href, {
    signal,
    headers: merged,
    redirect: 'follow',
  })
  if (res.ok || res.status === 206) return res
  if (headers.Range && (res.status === 416 || res.status === 513 || res.status === 400)) {
    const { Range: _range, ...withoutRange } = headers
    return fetchCandidate(url, withoutRange, signal)
  }
  return res
}

export async function fetchXtreamStream(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const candidates = xtreamUrlFallbacks(url)
  let lastResponse: Response | undefined
  let lastError: unknown

  const attempts: Array<{ candidate: string; ua: string }> = [
    ...candidates.map((candidate) => ({ candidate, ua: XTREAM_USER_AGENTS[0]! })),
    ...candidates.slice(0, 3).flatMap((candidate) =>
      XTREAM_USER_AGENTS.slice(1).map((ua) => ({ candidate, ua })),
    ),
  ]

  for (const { candidate, ua } of attempts) {
    try {
      const res = await fetchCandidate(
        candidate,
        { ...headers, 'User-Agent': ua },
        signal,
      )
        if (res.ok || res.status === 206) return res
        lastResponse = res
    } catch (err) {
      lastError = err
      if (signal.aborted) throw err
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error('upstream fetch failed')
}

/** Probe candidate URLs with a tiny Range request. Never log the URL (credentials). */
export async function pickWorkingXtreamUrl(url: string, signal?: AbortSignal): Promise<string> {
  const candidates = xtreamUrlFallbacks(url)
  for (const candidate of candidates) {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const target = await resolveXtreamFetchTarget(candidate)
      const res = await fetch(target.href, {
        method: 'GET',
        headers: { ...XTREAM_STREAM_HEADERS, ...target.extraHeaders, Range: 'bytes=0-0' },
        signal: controller.signal,
        redirect: 'follow',
      })
      controller.abort()
      if (res.ok || res.status === 206) return candidate
      if (res.status === 401 || res.status === 403) return url
    } catch {
      if (signal?.aborted) return url
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }
  return url
}

export async function ffmpegInputArgs(providerUrl: string): Promise<string[]> {
  const target = await resolveXtreamFetchTarget(providerUrl)
  const headerLines = [
    `User-Agent: ${XTREAM_STREAM_HEADERS['User-Agent']}`,
    ...Object.entries(target.extraHeaders).map(([key, value]) => `${key}: ${value}`),
  ]
  return [
    '-hide_banner',
    '-user_agent', XTREAM_STREAM_HEADERS['User-Agent'],
    '-headers', `${headerLines.join('\r\n')}\r\n`,
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-analyzeduration', '500000',
    '-probesize', '500000',
    '-fflags', '+genpts+discardcorrupt',
    '-i', target.href,
  ]
}
