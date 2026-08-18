export type GenreScore = {
  genreId: string
  slug: string
  name: string
  score: number
}

export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  personScores: Record<string, number>
  personMeta: Record<string, { name: string; role: string }>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
  completionRate: number | null
  historyEventCount: number
  tasteVersion: number
}
