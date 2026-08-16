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
