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
}
