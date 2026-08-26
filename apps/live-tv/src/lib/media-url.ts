/** Resolve a playback gateway path to an absolute URL for the browser player. */
export function resolveMediaUrl(path: string, apiBase: string = import.meta.env.VITE_API_BASE ?? ''): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = String(apiBase ?? '').replace(/\/$/, '')
  let p = path.startsWith('/') ? path : `/${path}`
  if (base) {
    if (p.startsWith('/api/')) p = p.slice(4)
    return `${base}${p}`
  }
  return p
}
