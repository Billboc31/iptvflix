import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config/env.js', () => ({
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_FEED: 20,
  CATALOG_BOOTSTRAP_MAX_PAGES_TOP_RATED: 20,
  CATALOG_BOOTSTRAP_MAX_PAGES_PER_GENRE: 10,
  CATALOG_BOOTSTRAP_MAX_PAGES_FRENCH: 10,
  CATALOG_BOOTSTRAP_GENRE_IDS_MOVIE: [28, 35, 18, 27, 878, 12, 14, 10749],
  CATALOG_BOOTSTRAP_GENRE_IDS_TV: [18, 35, 10765, 10759, 80, 9648],
}))

import { CatalogBootstrapService } from '../catalog-bootstrap-service.js'
import type { BootstrapConfig } from '../catalog-bootstrap-service.js'

const config: BootstrapConfig = {
  maxPagesPerFeed: 20,
  maxPagesTopRated: 15,
  maxPagesPerGenre: 10,
  maxPagesFrench: 8,
  movieGenreIds: [28, 35],
  tvGenreIds: [18, 10765],
}

describe('CatalogBootstrapService.buildSteps', () => {
  it('includes all movie feed steps in order', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    const movieFeeds = steps.filter((s) => s.kind === 'feed' && s.mediaType === 'MOVIE')
    const feedNames = movieFeeds.map((s) => (s.kind === 'feed' ? s.feed : ''))
    expect(feedNames).toEqual(['popular', 'trending', 'upcoming', 'top_rated'])
  })

  it('includes series feed steps', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    const seriesFeeds = steps.filter((s) => s.kind === 'feed' && s.mediaType === 'SERIES')
    const feedNames = seriesFeeds.map((s) => (s.kind === 'feed' ? s.feed : ''))
    expect(feedNames).toContain('popular')
    expect(feedNames).toContain('top_rated')
  })

  it('includes genre steps for movies and series', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    expect(steps).toContainEqual({ kind: 'genre', mediaType: 'MOVIE', genreId: 28, maxPages: 10 })
    expect(steps).toContainEqual({ kind: 'genre', mediaType: 'MOVIE', genreId: 35, maxPages: 10 })
    expect(steps).toContainEqual({ kind: 'genre', mediaType: 'SERIES', genreId: 18, maxPages: 10 })
    expect(steps).toContainEqual({ kind: 'genre', mediaType: 'SERIES', genreId: 10765, maxPages: 10 })
  })

  it('includes French language steps for movies and series', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    expect(steps).toContainEqual({ kind: 'language', mediaType: 'MOVIE', language: 'fr', maxPages: 8 })
    expect(steps).toContainEqual({ kind: 'language', mediaType: 'SERIES', language: 'fr', maxPages: 8 })
  })

  it('uses top_rated maxPages for top_rated feed, perFeed for others', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    const topRatedMovie = steps.find(
      (s) => s.kind === 'feed' && s.mediaType === 'MOVIE' && s.feed === 'top_rated',
    )
    const popularMovie = steps.find(
      (s) => s.kind === 'feed' && s.mediaType === 'MOVIE' && s.feed === 'popular',
    )
    expect(topRatedMovie?.maxPages).toBe(15)
    expect(popularMovie?.maxPages).toBe(20)
  })

  it('respects custom genre lists', () => {
    const customConfig: BootstrapConfig = { ...config, movieGenreIds: [99], tvGenreIds: [] }
    const steps = CatalogBootstrapService.buildSteps(customConfig)
    const movieGenres = steps.filter((s) => s.kind === 'genre' && s.mediaType === 'MOVIE')
    const seriesGenres = steps.filter((s) => s.kind === 'genre' && s.mediaType === 'SERIES')
    expect(movieGenres).toHaveLength(1)
    expect(seriesGenres).toHaveLength(0)
  })

  it('French steps appear after genre steps', () => {
    const steps = CatalogBootstrapService.buildSteps(config)
    const lastGenreIdx = steps.findLastIndex((s) => s.kind === 'genre')
    const firstFrenchIdx = steps.findIndex((s) => s.kind === 'language')
    expect(firstFrenchIdx).toBeGreaterThan(lastGenreIdx)
  })
})
