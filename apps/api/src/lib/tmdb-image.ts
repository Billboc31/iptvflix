const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

/**
 * Turn a TMDB path (`/abc.jpg`) or already-absolute URL into a usable image URL.
 * Provider covers that are full http(s) URLs are returned unchanged.
 */
export function resolveMediaImageUrl(
  path: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500',
): string | null {
  if (path == null) return null
  const trimmed = String(path).trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${TMDB_IMAGE_BASE}/${size}${normalized}`
}
