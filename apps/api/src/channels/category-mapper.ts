/** Canonical Live TV category ids used in API + UI. */
export const CANONICAL_CATEGORIES = [
  'generalist',
  'sport',
  'cinema',
  'news',
  'kids',
  'music',
  'documentary',
  'entertainment',
  'international',
  'other',
] as const

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number]

const CATEGORY_MAP: Record<string, CanonicalCategory> = {
  // Generalist
  general: 'generalist',
  généraliste: 'generalist',
  generalist: 'generalist',
  generaliste: 'generalist',
  général: 'generalist',
  // Sport
  sport: 'sport',
  sports: 'sport',
  football: 'sport',
  soccer: 'sport',
  tennis: 'sport',
  dazn: 'sport',
  beinsport: 'sport',
  'bein sport': 'sport',
  ligue: 'sport',
  ppv: 'sport',
  // Cinema / series
  cinema: 'cinema',
  cinéma: 'cinema',
  film: 'cinema',
  films: 'cinema',
  movie: 'cinema',
  movies: 'cinema',
  series: 'cinema',
  séries: 'cinema',
  vod: 'cinema',
  // News
  news: 'news',
  info: 'news',
  actualité: 'news',
  actualites: 'news',
  information: 'news',
  // Kids
  kids: 'kids',
  enfants: 'kids',
  children: 'kids',
  jeunesse: 'kids',
  animation: 'kids',
  junior: 'kids',
  // Music
  music: 'music',
  musique: 'music',
  musical: 'music',
  // Documentary
  documentary: 'documentary',
  documentaire: 'documentary',
  documentaries: 'documentary',
  nature: 'documentary',
  science: 'documentary',
  discovery: 'documentary',
  // Entertainment
  entertainment: 'entertainment',
  divertissement: 'entertainment',
  variety: 'entertainment',
  variété: 'entertainment',
  varieté: 'entertainment',
  // International
  international: 'international',
  arabic: 'international',
  arab: 'international',
  turkish: 'international',
  indian: 'international',
}

/** Strip IPTV region prefixes like "FR|", "[EN]", "US -" before category matching. */
export function stripRegionPrefix(raw: string): string {
  return raw
    .replace(/^\s*\[[A-Za-z]{2,6}\]\s*/i, '')
    .replace(/^\s*[A-Za-z]{2,6}\s*[|:\-–—]\s*/i, '')
    .trim()
}

export function mapCategory(raw: string): CanonicalCategory {
  const stripped = stripRegionPrefix(raw)
  const key = stripped.toLowerCase().trim()
  if (!key) return 'other'

  if (key in CATEGORY_MAP) return CATEGORY_MAP[key]!

  for (const [pattern, canonical] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(pattern)) return canonical
  }

  // Whole original often embeds sport/cinema even with fancy unicode
  const original = raw.toLowerCase()
  for (const [pattern, canonical] of Object.entries(CATEGORY_MAP)) {
    if (original.includes(pattern)) return canonical
  }

  return 'other'
}

/** Map iptv-org category ids (sports, movies, …) to our canonical set. */
export function mapIptvOrgCategories(raw: string[] | null | undefined): CanonicalCategory[] {
  const mapped = (raw ?? []).map((c) => mapCategory(c))
  const unique = [...new Set(mapped)].filter((c) => c !== 'other')
  return unique.length > 0 ? unique : ['other']
}

/** Stable display order for home rails / chips. */
export const CATEGORY_DISPLAY_ORDER: CanonicalCategory[] = [
  'generalist',
  'sport',
  'news',
  'cinema',
  'kids',
  'entertainment',
  'documentary',
  'music',
  'international',
  'other',
]

export const CATEGORY_LABELS_FR: Record<CanonicalCategory, string> = {
  generalist: 'Généralistes',
  sport: 'Sport',
  news: 'Info',
  cinema: 'Cinéma & séries',
  kids: 'Jeunesse',
  entertainment: 'Divertissement',
  documentary: 'Documentaires',
  music: 'Musique',
  international: 'International',
  other: 'Autres',
}
