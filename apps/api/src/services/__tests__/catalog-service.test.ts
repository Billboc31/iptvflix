import 'dotenv/config'
import { describe, it, expect, afterEach } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies, series as seriesTable } from '../../db/schema/index.js'
import { searchContent } from '../catalog-service.js'

// Fake TMDB IDs in 9_200_000+ range to avoid collision with other test files
const T = {
  frenchOnlyMovie: 9_200_001,
  frenchOnlySeries: 9_200_002,
} as const

const ALL_TEST_TMDB_IDS = Object.values(T)

afterEach(async () => {
  await db.delete(movies).where(inArray(movies.tmdbId, ALL_TEST_TMDB_IDS))
  await db.delete(seriesTable).where(inArray(seriesTable.tmdbId, ALL_TEST_TMDB_IDS))
})

describe('searchContent — French localizations', () => {
  it('returns a movie matched only via localizations.fr.title', async () => {
    await db.insert(movies).values({
      title: 'XZQ_EN_UNIQUE_MOVIE_TITLE',
      tmdbId: T.frenchOnlyMovie,
      matchStatus: 'MATCHED',
      localizations: { fr: { title: 'XZQ_FR_UNIQUE_TITRE_FILM' } },
    })

    const result = await searchContent('XZQ_FR_UNIQUE_TITRE_FILM')

    expect(result.movies).toHaveLength(1)
    expect(result.movies[0].title).toBe('XZQ_EN_UNIQUE_MOVIE_TITLE')
    expect(result.series).toHaveLength(0)
  })

  it('does not return the movie when searching by English title that differs from French title', async () => {
    await db.insert(movies).values({
      title: 'XZQ_EN_UNIQUE_MOVIE_TITLE',
      tmdbId: T.frenchOnlyMovie,
      matchStatus: 'MATCHED',
      localizations: { fr: { title: 'XZQ_FR_UNIQUE_TITRE_FILM' } },
    })

    const result = await searchContent('XZQ_FR_UNIQUE_TITRE_FILM_NOMATCH')

    expect(result.movies).toHaveLength(0)
  })

  it('returns a series matched only via localizations.fr.title', async () => {
    await db.insert(seriesTable).values({
      title: 'XZQ_EN_UNIQUE_SERIES_TITLE',
      tmdbId: T.frenchOnlySeries,
      matchStatus: 'MATCHED',
      localizations: { fr: { title: 'XZQ_FR_UNIQUE_TITRE_SERIE' } },
    })

    const result = await searchContent('XZQ_FR_UNIQUE_TITRE_SERIE')

    expect(result.series).toHaveLength(1)
    expect(result.series[0].title).toBe('XZQ_EN_UNIQUE_SERIES_TITLE')
    expect(result.movies).toHaveLength(0)
  })
})
