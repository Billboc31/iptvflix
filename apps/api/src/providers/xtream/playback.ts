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

/** Headers Xtream panels typically expect (Node's default fetch UA is often blocked). */
export const XTREAM_STREAM_HEADERS: Record<string, string> = {
  'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
  Accept: '*/*',
}

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
    const withExt = `${id}.${ext}`

    if (seriesIdx >= 0) {
      push(`${origin}/series/${user}/${pass}/${withExt}`)
      push(`${origin}/series/${user}/${pass}/${id}`)
    } else {
      push(`${origin}/movie/${user}/${pass}/${withExt}`)
      push(`${origin}/movie/${user}/${pass}/${id}`)
      push(`${origin}/${user}/${pass}/${withExt}`)
      push(`${origin}/${user}/${pass}/${id}`)
      push(`${origin}/live/${user}/${pass}/${withExt}`)
    }
  } catch {
    return out
  }

  return out
}

export async function fetchXtreamStream(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const candidates = xtreamUrlFallbacks(url)
  const merged = { ...XTREAM_STREAM_HEADERS, ...headers }
  let lastResponse: Response | undefined
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        signal,
        headers: merged,
        redirect: 'follow',
      })
      if (res.ok || res.status === 206) return res
      if (res.status === 401 || res.status === 403) return res
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
      const res = await fetch(candidate, {
        method: 'GET',
        headers: { ...XTREAM_STREAM_HEADERS, Range: 'bytes=0-0' },
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
