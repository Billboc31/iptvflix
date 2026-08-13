export function buildXtreamStreamUrl(
  baseUrl: string,
  username: string,
  password: string,
  providerItemId: string,
  ext = 'ts',
): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${username}/${password}/${providerItemId}.${ext}`
}
