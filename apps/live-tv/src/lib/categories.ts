export const CATEGORY_DISPLAY_ORDER = [
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
] as const

export type CanonicalCategory = (typeof CATEGORY_DISPLAY_ORDER)[number]

export const CATEGORY_LABELS_FR: Record<string, string> = {
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

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS_FR[cat] ?? cat
}

export function isCanonicalCategory(cat: string): cat is CanonicalCategory {
  return (CATEGORY_DISPLAY_ORDER as readonly string[]).includes(cat)
}
