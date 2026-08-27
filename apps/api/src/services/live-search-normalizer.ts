const CONVERSATIONAL_PREFIXES = /^(je veux regarder|je veux voir|mettre|regarder|voir)\s+/i

export function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(CONVERSATIONAL_PREFIXES, '')
    .replace(/\s+/g, ' ')
    .trim()
}
