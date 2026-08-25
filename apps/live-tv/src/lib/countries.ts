export const COUNTRY_LABELS_FR: Record<string, string> = {
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  GB: 'Royaume-Uni',
  US: 'États-Unis',
  CA: 'Canada',
  DE: 'Allemagne',
  IT: 'Italie',
  ES: 'Espagne',
  PT: 'Portugal',
  NL: 'Pays-Bas',
  TR: 'Turquie',
  SA: 'Moyen-Orient',
  PL: 'Pologne',
  RU: 'Russie',
}

export function countryLabel(code: string): string {
  const upper = code.toUpperCase()
  return COUNTRY_LABELS_FR[upper] ?? upper
}

const LANG_TO_COUNTRY: Record<string, string> = {
  fr: 'FR',
  en: 'GB',
  ar: 'SA',
  it: 'IT',
  es: 'ES',
  de: 'DE',
  nl: 'NL',
  pt: 'PT',
  tr: 'TR',
  pl: 'PL',
  ru: 'RU',
}

export function preferredCountryFromLanguages(langs: string[] | undefined): string {
  const primary = langs?.[0]?.trim().toLowerCase().slice(0, 2)
  if (primary && LANG_TO_COUNTRY[primary]) return LANG_TO_COUNTRY[primary]!
  return 'FR'
}
